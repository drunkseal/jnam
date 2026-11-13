#!/bin/bash
set -e

export JACK_NO_AUDIO_RESERVATION=1

# 1. Lock CPU scaling governor to performance for real-time audio stability
for g in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo performance > "$g" 2>/dev/null || true
done

NAM_DIR="${JNAM_DIR:-$HOME/nam}"
DEV_FILE="$NAM_DIR/audio_device"
BUF_FILE="$NAM_DIR/buffer_size"

BUF_SIZE=512
if [ -f "$BUF_FILE" ]; then
    CUSTOM_BUF=$(cat "$BUF_FILE" | tr -d '[:space:]')
    [ -n "$CUSTOM_BUF" ] && BUF_SIZE="$CUSTOM_BUF"
fi

# 2. Check for user-configured audio device
if [ -f "$DEV_FILE" ]; then
    CONFIGURED_DEV=$(cat "$DEV_FILE" | tr -d '[:space:]')
    if [ -n "$CONFIGURED_DEV" ] && [ "$CONFIGURED_DEV" != "auto" ]; then
        echo "[jnam-jack] Using configured ALSA device: $CONFIGURED_DEV (48kHz, ${BUF_SIZE} buffer, 3 periods)..."
        exec /usr/bin/jackd -R -P 80 -d alsa -d "$CONFIGURED_DEV" -r 48000 -p "$BUF_SIZE" -n 3
    fi
fi

# 3. Auto-detect USB class-compliant audio interface (Scarlett, Behringer, MOTU, etc.)
CARD=$(grep -E 'USB|Scarlett|Audio' /proc/asound/cards | grep -v 'Codec' | head -n 1 | awk '{print $1}')

if [ -n "$CARD" ]; then
    echo "[jnam-jack] Auto-detected USB audio card: hw:$CARD (48kHz, ${BUF_SIZE} buffer, 3 periods)..."
    exec /usr/bin/jackd -R -P 80 -d alsa -d "hw:$CARD" -r 48000 -p "$BUF_SIZE" -n 3
else
    echo "[jnam-jack] No USB audio interface found. Starting JACK with dummy driver (48kHz, ${BUF_SIZE} buffer)..."
    exec /usr/bin/jackd -R -P 80 -d dummy -r 48000 -p "$BUF_SIZE"
fi
