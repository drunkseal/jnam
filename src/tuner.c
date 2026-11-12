#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <unistd.h>
#include <signal.h>
#include <jack/jack.h>

#define WINDOW_SIZE 2048
#define HALF_WINDOW (WINDOW_SIZE / 2)
#define MIN_FREQ 25.0f   // Lowest detectable freq (Hz)
#define MAX_FREQ 1500.0f // Highest detectable freq (Hz)
#define YIN_THRESHOLD 0.15f
#define SILENCE_RMS 0.003f

static const char *NOTE_NAMES[] = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
};

static jack_client_t *client = NULL;
static jack_port_t *input_port = NULL;

static float sample_ring[WINDOW_SIZE];
static int ring_write_idx = 0;
static int sample_rate = 48000;
static volatile int running = 1;

static void sig_handler(int sig) {
    (void)sig;
    running = 0;
}

static int process_callback(jack_nframes_t nframes, void *arg) {
    (void)arg;
    jack_default_audio_sample_t *in = (jack_default_audio_sample_t *)jack_port_get_buffer(input_port, nframes);
    if (!in) return 0;

    for (jack_nframes_t i = 0; i < nframes; i++) {
        sample_ring[ring_write_idx] = in[i];
        ring_write_idx = (ring_write_idx + 1) % WINDOW_SIZE;
    }
    return 0;
}

// YIN Pitch Detection Algorithm
static float detect_pitch(const float *buffer, int length, int srate, float *out_rms) {
    // 1. Calculate RMS
    double sum_sq = 0.0;
    for (int i = 0; i < length; i++) {
        sum_sq += buffer[i] * buffer[i];
    }
    float rms = sqrtf((float)(sum_sq / length));
    if (out_rms) *out_rms = rms;

    if (rms < SILENCE_RMS) {
        return 0.0f;
    }

    int min_period = (int)(srate / MAX_FREQ);
    int max_period = (int)(srate / MIN_FREQ);
    if (max_period > HALF_WINDOW) max_period = HALF_WINDOW;

    // 2. Difference function
    float diff[HALF_WINDOW];
    diff[0] = 0.0f;
    for (int tau = 1; tau < max_period; tau++) {
        double d = 0.0;
        for (int i = 0; i < HALF_WINDOW; i++) {
            float delta = buffer[i] - buffer[i + tau];
            d += delta * delta;
        }
        diff[tau] = (float)d;
    }

    // 3. Cumulative mean normalized difference
    float cmndf[HALF_WINDOW];
    cmndf[0] = 1.0f;
    double running_sum = 0.0;
    for (int tau = 1; tau < max_period; tau++) {
        running_sum += diff[tau];
        if (running_sum > 0.00001) {
            cmndf[tau] = diff[tau] * tau / (float)running_sum;
        } else {
            cmndf[tau] = 1.0f;
        }
    }

    // 4. Absolute threshold searching
    int best_tau = -1;
    for (int tau = min_period; tau < max_period; tau++) {
        if (cmndf[tau] < YIN_THRESHOLD) {
            while (tau + 1 < max_period && cmndf[tau + 1] < cmndf[tau]) {
                tau++;
            }
            best_tau = tau;
            break;
        }
    }

    // If no dip below threshold, find global minimum
    if (best_tau == -1) {
        float min_val = 100.0f;
        for (int tau = min_period; tau < max_period; tau++) {
            if (cmndf[tau] < min_val) {
                min_val = cmndf[tau];
                best_tau = tau;
            }
        }
        if (min_val > 0.35f) {
            return 0.0f; // Low confidence
        }
    }

    // 5. Parabolic interpolation around best_tau
    float exact_tau = (float)best_tau;
    if (best_tau > 1 && best_tau < max_period - 1) {
        float alpha = cmndf[best_tau - 1];
        float beta  = cmndf[best_tau];
        float gamma = cmndf[best_tau + 1];
        float denom = 2.0f * (alpha - 2.0f * beta + gamma);
        if (fabsf(denom) > 0.00001f) {
            exact_tau += (alpha - gamma) / denom;
        }
    }

    if (exact_tau > 0.0f) {
        return (float)srate / exact_tau;
    }
    return 0.0f;
}

int main(int argc, char **argv) {
    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    const char *target_port = (argc > 1) ? argv[1] : NULL;

    jack_status_t status;
    client = jack_client_open("jnam-tuner", JackNullOption, &status);
    if (!client) {
        fprintf(stderr, "Error: Could not connect to JACK server.\n");
        return 1;
    }

    sample_rate = jack_get_sample_rate(client);
    input_port = jack_port_register(client, "input", JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput, 0);
    if (!input_port) {
        fprintf(stderr, "Error: Could not register input port.\n");
        jack_client_close(client);
        return 1;
    }

    jack_set_process_callback(client, process_callback, NULL);

    if (jack_activate(client) != 0) {
        fprintf(stderr, "Error: Could not activate JACK client.\n");
        jack_client_close(client);
        return 1;
    }

    if (target_port && strlen(target_port) > 0) {
        jack_connect(client, target_port, "jnam-tuner:input");
    }

    float linear_buf[WINDOW_SIZE];

    while (running) {
        // Read window from ring buffer
        int current_idx = ring_write_idx;
        for (int i = 0; i < WINDOW_SIZE; i++) {
            int src_idx = (current_idx + i) % WINDOW_SIZE;
            linear_buf[i] = sample_ring[src_idx];
        }

        float rms = 0.0f;
        float pitch = detect_pitch(linear_buf, WINDOW_SIZE, sample_rate, &rms);

        if (pitch >= MIN_FREQ && pitch <= MAX_FREQ) {
            float midi_note = 69.0f + 12.0f * log2f(pitch / 440.0f);
            int round_note = (int)roundf(midi_note);
            float cents = (midi_note - (float)round_note) * 100.0f;
            int note_idx = ((round_note % 12) + 12) % 12;
            int octave = (round_note / 12) - 1;
            int in_tune = (fabsf(cents) <= 3.0f);

            printf("{\"active\":true,\"note\":\"%s\",\"octave\":%d,\"freq\":%.2f,\"cents\":%.1f,\"in_tune\":%s,\"rms\":%.4f}\n",
                   NOTE_NAMES[note_idx], octave, pitch, cents, in_tune ? "true" : "false", rms);
        } else {
            printf("{\"active\":false,\"rms\":%.4f}\n", rms);
        }
        fflush(stdout);

        // Update ~25 times per second (40ms)
        usleep(40000);
    }

    jack_deactivate(client);
    jack_client_close(client);
    return 0;
}
