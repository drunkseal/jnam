#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <unistd.h>
#include <jack/jack.h>

static jack_port_t *out_l = NULL;
static jack_port_t *out_r = NULL;
static int sample_rate = 48000;
static int current_frame = 0;
static volatile int finished = 0;
static double phase_l = 0.0;
static double phase_r = 0.0;

static int process(jack_nframes_t nframes, void *arg) {
    (void)arg;
    jack_default_audio_sample_t *buf_l = (jack_default_audio_sample_t *)jack_port_get_buffer(out_l, nframes);
    jack_default_audio_sample_t *buf_r = (jack_default_audio_sample_t *)jack_port_get_buffer(out_r, nframes);

    int total_frames = (int)(sample_rate * 3.6); // 3.6 seconds total

    for (jack_nframes_t i = 0; i < nframes; i++) {
        if (current_frame >= total_frames) {
            buf_l[i] = 0.0f;
            buf_r[i] = 0.0f;
            finished = 1;
            continue;
        }

        double t = (double)current_frame / sample_rate;
        float amp_l = 0.0f;
        float amp_r = 0.0f;
        double freq_l = 440.0;
        double freq_r = 440.0;

        // Phase 1: 0.0s - 1.1s -> Left ear only (440 Hz, A4)
        if (t < 1.1) {
            double env = 1.0;
            if (t < 0.1) env = t / 0.1;
            else if (t > 0.95) env = (1.1 - t) / 0.15;
            freq_l = 440.0;
            amp_l = (float)(sin(phase_l) * 0.15 * env);
        }
        // Phase 2: 1.2s - 2.3s -> Right ear only (554.37 Hz, C#5)
        else if (t >= 1.2 && t < 2.3) {
            double local_t = t - 1.2;
            double env = 1.0;
            if (local_t < 0.1) env = local_t / 0.1;
            else if (local_t > 0.95) env = (1.1 - local_t) / 0.15;
            freq_r = 554.37;
            amp_r = (float)(sin(phase_r) * 0.15 * env);
        }
        // Phase 3: 2.4s - 3.5s -> Both ears stereo (A major harmony: 440 Hz + 659.25 Hz)
        else if (t >= 2.4 && t < 3.5) {
            double local_t = t - 2.4;
            double env = 1.0;
            if (local_t < 0.1) env = local_t / 0.1;
            else if (local_t > 0.8) env = (1.1 - local_t) / 0.3;
            freq_l = 440.0;
            freq_r = 659.25;
            amp_l = (float)(sin(phase_l) * 0.12 * env);
            amp_r = (float)(sin(phase_r) * 0.12 * env);
        }

        buf_l[i] = amp_l;
        buf_r[i] = amp_r;

        phase_l += 2.0 * M_PI * freq_l / sample_rate;
        if (phase_l >= 2.0 * M_PI) phase_l -= 2.0 * M_PI;

        phase_r += 2.0 * M_PI * freq_r / sample_rate;
        if (phase_r >= 2.0 * M_PI) phase_r -= 2.0 * M_PI;

        current_frame++;
    }
    return 0;
}

int main() {
    jack_client_t *client = jack_client_open("jnam_tone", JackNullOption, NULL);
    if (!client) {
        fprintf(stderr, "Could not open JACK client\n");
        return 1;
    }
    sample_rate = jack_get_sample_rate(client);
    jack_set_process_callback(client, process, NULL);
    out_l = jack_port_register(client, "out_1", JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput, 0);
    out_r = jack_port_register(client, "out_2", JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput, 0);
    jack_activate(client);

    jack_connect(client, jack_port_name(out_l), "system:playback_1");
    jack_connect(client, jack_port_name(out_r), "system:playback_2");

    while (!finished) {
        usleep(40000);
    }
    usleep(50000);
    jack_deactivate(client);
    jack_client_close(client);
    return 0;
}
