#!/bin/bash
set -e

export JACK_NO_AUDIO_RESERVATION=1

# 1. Lock CPU scaling governor to performance for real-time audio stability
for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo performance > "$g" 2>/dev/null || true
done

NAM_DIR="${JNAM_DIR:-$HOME/nam}"
DEV_FILE="$NAM_DIR/audio_device"

# 2. Check for user-configured audio device
if [ -f "$DEV_FILE" ]; then
    CONFIGURED_DEV=$(cat "$DEV_FILE" | tr -d '[:space:]')
    if [ -n "$CONFIGURED_DEV" ] && [ "$CONFIGURED_DEV" != "auto" ]; then
        echo "[jnam-jack] Using configured ALSA device: $CONFIGURED_DEV (48kHz, 128 buffer, synchronous)..."
        exec /usr/bin/jackd -R -P 80 -S -d alsa -d "$CONFIGURED_DEV" -r 48000 -p 128 -n 2
    fi
fi

# 3. Auto-detect USB class-compliant audio interface (Scarlett, Behringer, MOTU, etc.)
CARD=$(grep -E 'USB|Scarlett|Audio' /proc/asound/cards | grep -v 'Codec' | head -n 1 | awk '{print $1}')

if [ -n "$CARD" ]; then
    echo "[jnam-jack] Auto-detected USB audio card: hw:$CARD (48kHz, 128 buffer, synchronous)..."
    exec /usr/bin/jackd -R -P 80 -S -d alsa -d "hw:$CARD" -r 48000 -p 128 -n 2
else
    echo "[jnam-jack] No USB audio interface found. Starting JACK with dummy driver (48kHz, 128 buffer)..."
    exec /usr/bin/jackd -R -P 80 -S -d dummy -r 48000 -p 128
fi
