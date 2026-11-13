#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <unistd.h>
#include <signal.h>
#include <pthread.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <jack/jack.h>

#define FIFO_PATH "/tmp/nam_metronome.fifo"
#define MAX_SUBDIV 4
#define MAX_BEATS 16

static jack_client_t *client = NULL;
static jack_port_t *out_l = NULL;
static jack_port_t *out_r = NULL;
static int sample_rate = 48000;

static volatile int app_running = 1;
static volatile int metro_running = 0;
static volatile float metro_bpm = 120.0f;
static volatile int metro_beats = 4;
static volatile int metro_subdiv = 1;
static volatile float metro_vol = 0.8f;
static volatile int metro_sound = 0; // 0=Beep, 1=Woodblock, 2=Rimshot, 3=Cowbell

static unsigned long long total_frames = 0;
static double click_phase = 0.0;
static double click_phase2 = 0.0;

static void sig_handler(int sig) {
    (void)sig;
    app_running = 0;
    metro_running = 0;
}

static void connect_playback_ports(void) {
    if (!client || !out_l || !out_r) return;
    const char *port_l = jack_port_name(out_l);
    const char *port_r = jack_port_name(out_r);
    jack_connect(client, port_l, "system:playback_1");
    jack_connect(client, port_r, "system:playback_2");
}

static int process_callback(jack_nframes_t nframes, void *arg) {
    (void)arg;
    jack_default_audio_sample_t *buf_l = (jack_default_audio_sample_t *)jack_port_get_buffer(out_l, nframes);
    jack_default_audio_sample_t *buf_r = (jack_default_audio_sample_t *)jack_port_get_buffer(out_r, nframes);

    if (!buf_l || !buf_r) return 0;

    if (!metro_running) {
        memset(buf_l, 0, nframes * sizeof(jack_default_audio_sample_t));
        memset(buf_r, 0, nframes * sizeof(jack_default_audio_sample_t));
        total_frames = 0;
        click_phase = 0.0;
        click_phase2 = 0.0;
        return 0;
    }

    float bpm = metro_bpm;
    if (bpm < 20.0f) bpm = 20.0f;
    if (bpm > 320.0f) bpm = 320.0f;

    int beats = metro_beats;
    if (beats < 1) beats = 1;
    if (beats > MAX_BEATS) beats = MAX_BEATS;

    int subdiv = metro_subdiv;
    if (subdiv < 1) subdiv = 1;
    if (subdiv > MAX_SUBDIV) subdiv = MAX_SUBDIV;

    float vol = metro_vol;
    if (vol < 0.0f) vol = 0.0f;
    if (vol > 1.0f) vol = 1.0f;

    int sound = metro_sound;

    double frames_per_subdiv = (double)sample_rate * 60.0 / ((double)bpm * (double)subdiv);
    if (frames_per_subdiv < 100.0) frames_per_subdiv = 100.0;

    int click_duration_frames = (int)(sample_rate * 0.035); // 35ms click

    for (jack_nframes_t i = 0; i < nframes; i++) {
        unsigned long long f = total_frames++;
        unsigned long long subdiv_index = (unsigned long long)(f / frames_per_subdiv);
        unsigned long long frame_in_subdiv = (unsigned long long)(f - (subdiv_index * frames_per_subdiv));

        int subdiv_in_beat = (int)(subdiv_index % (unsigned long long)subdiv);
        int beat_in_bar = (int)((subdiv_index / (unsigned long long)subdiv) % (unsigned long long)beats);

        int is_accent = (beat_in_bar == 0 && subdiv_in_beat == 0);
        int is_beat = (subdiv_in_beat == 0);

        if (frame_in_subdiv == 0) {
            click_phase = 0.0;
            click_phase2 = 0.0;
        }

        float sample = 0.0f;

        if ((int)frame_in_subdiv < click_duration_frames) {
            double t = (double)frame_in_subdiv / (double)sample_rate;
            double decay_rate = is_accent ? 70.0 : 85.0;
            double env = exp(-t * decay_rate);

            if (sound == 0) {
                // 0: Digital Beep (crisp high-pitched square-sine)
                double freq = is_accent ? 1760.0 : (is_beat ? 880.0 : 660.0);
                sample = (float)(sin(click_phase) * env);
                click_phase += 2.0 * M_PI * freq / (double)sample_rate;
                if (click_phase >= 2.0 * M_PI) click_phase -= 2.0 * M_PI;
            } else if (sound == 1) {
                // 1: Woodblock (warm pitch-sweep acoustic resonance)
                double base_freq = is_accent ? (1200.0 - t * 14000.0) : (850.0 - t * 10000.0);
                if (base_freq < 320.0) base_freq = 320.0;
                sample = (float)((sin(click_phase) + 0.35 * sin(click_phase2)) * env);
                click_phase += 2.0 * M_PI * base_freq / (double)sample_rate;
                if (click_phase >= 2.0 * M_PI) click_phase -= 2.0 * M_PI;
                click_phase2 += 2.0 * M_PI * (base_freq * 2.3) / (double)sample_rate;
                if (click_phase2 >= 2.0 * M_PI) click_phase2 -= 2.0 * M_PI;
            } else if (sound == 2) {
                // 2: Cross-Stick / Rimshot (snappy drum rim)
                double freq = is_accent ? 650.0 : 420.0;
                double noise = ((double)rand() / (double)RAND_MAX * 2.0 - 1.0);
                sample = (float)((0.55 * sin(click_phase) + 0.45 * noise) * env);
                click_phase += 2.0 * M_PI * freq / (double)sample_rate;
                if (click_phase >= 2.0 * M_PI) click_phase -= 2.0 * M_PI;
            } else {
                // 3: Cowbell (two metallic resonant tones)
                double f1 = is_accent ? 587.0 : 540.0;
                double f2 = is_accent ? 880.0 : 800.0;
                sample = (float)((0.5 * sin(click_phase) + 0.5 * sin(click_phase2)) * env);
                click_phase += 2.0 * M_PI * f1 / (double)sample_rate;
                if (click_phase >= 2.0 * M_PI) click_phase -= 2.0 * M_PI;
                click_phase2 += 2.0 * M_PI * f2 / (double)sample_rate;
                if (click_phase2 >= 2.0 * M_PI) click_phase2 -= 2.0 * M_PI;
            }

            float gain_scale = is_accent ? 1.0f : (is_beat ? 0.72f : 0.48f);
            sample *= vol * gain_scale;
        }

        buf_l[i] = sample;
        buf_r[i] = sample;
    }

    return 0;
}

static void *fifo_thread_func(void *arg) {
    (void)arg;
    mkfifo(FIFO_PATH, 0666);

    while (app_running) {
        int fd = open(FIFO_PATH, O_RDONLY);
        if (fd < 0) {
            usleep(100000);
            continue;
        }

        char buffer[256];
        int buf_idx = 0;
        char ch;

        while (app_running && read(fd, &ch, 1) > 0) {
            if (ch == '\n' || ch == '\r') {
                buffer[buf_idx] = '\0';
                if (buf_idx > 0) {
                    if (strcasecmp(buffer, "START") == 0) {
                        metro_running = 1;
                        connect_playback_ports();
                    } else if (strcasecmp(buffer, "STOP") == 0) {
                        metro_running = 0;
                    } else if (strncasecmp(buffer, "BPM ", 4) == 0) {
                        float v = atof(buffer + 4);
                        if (v >= 20.0f && v <= 320.0f) metro_bpm = v;
                    } else if (strncasecmp(buffer, "BEATS ", 6) == 0) {
                        int b = atoi(buffer + 6);
                        if (b >= 1 && b <= MAX_BEATS) metro_beats = b;
                    } else if (strncasecmp(buffer, "SUBDIV ", 7) == 0) {
                        int s = atoi(buffer + 7);
                        if (s >= 1 && s <= MAX_SUBDIV) metro_subdiv = s;
                    } else if (strncasecmp(buffer, "VOL ", 4) == 0) {
                        float v = atof(buffer + 4);
                        if (v >= 0.0f && v <= 1.0f) metro_vol = v;
                    } else if (strncasecmp(buffer, "SOUND ", 6) == 0) {
                        int s = atoi(buffer + 6);
                        if (s >= 0 && s <= 3) metro_sound = s;
                    } else if (strcasecmp(buffer, "QUIT") == 0) {
                        app_running = 0;
                        metro_running = 0;
                    }
                }
                buf_idx = 0;
            } else if (buf_idx < (int)sizeof(buffer) - 1) {
                buffer[buf_idx++] = ch;
            }
        }
        close(fd);
    }
    return NULL;
}

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    jack_status_t status;
    client = jack_client_open("jnam-metronome", JackNullOption, &status);
    if (!client) {
        fprintf(stderr, "[metronome] Error: Could not connect to JACK server.\n");
        return 1;
    }

    sample_rate = jack_get_sample_rate(client);
    out_l = jack_port_register(client, "out_1", JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput, 0);
    out_r = jack_port_register(client, "out_2", JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput, 0);

    if (!out_l || !out_r) {
        fprintf(stderr, "[metronome] Error: Could not register output ports.\n");
        jack_client_close(client);
        return 1;
    }

    jack_set_process_callback(client, process_callback, NULL);

    if (jack_activate(client) != 0) {
        fprintf(stderr, "[metronome] Error: Could not activate JACK client.\n");
        jack_client_close(client);
        return 1;
    }

    // Auto-connect to system playback
    connect_playback_ports();

    pthread_t fifo_tid;
    pthread_create(&fifo_tid, NULL, fifo_thread_func, NULL);

    while (app_running) {
        usleep(100000);
    }

    pthread_join(fifo_tid, NULL);
    jack_deactivate(client);
    jack_client_close(client);
    unlink(FIFO_PATH);
    return 0;
}
