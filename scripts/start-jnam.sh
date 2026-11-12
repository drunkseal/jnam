#!/bin/bash
set -e

NAM_DIR="${JNAM_DIR:-$HOME/nam}"
FIFO="/tmp/nam_control.fifo"
CAB_MODE_FILE="$NAM_DIR/cab_mode"
IN_CHAN_FILE="$NAM_DIR/input_channel"
OUT_CHAN_FILE="$NAM_DIR/output_channel"

mkdir -p "$NAM_DIR/models" "$NAM_DIR/irs"

# 1. Wait for JACK server
echo "[jnam] Waiting for JACK server..."
MAX_WAIT=30
WAITED=0
until jack_wait -c >/dev/null 2>&1; do
    sleep 0.5
    WAITED=$((WAITED + 1))
    if [ "$WAITED" -ge "$MAX_WAIT" ]; then
        echo "[jnam] Error: JACK server not ready after ${MAX_WAIT} checks"
        exit 1
    fi
done
echo "[jnam] JACK server is ready."

# 2. Ensure default symlinks
if [ ! -e "$NAM_DIR/current_model.nam" ]; then
    DEFAULT_MODEL=$(find "$NAM_DIR/models" -name "*.nam" | head -n 1)
    if [ -n "$DEFAULT_MODEL" ]; then
        ln -sf "$DEFAULT_MODEL" "$NAM_DIR/current_model.nam"
    fi
fi

if [ ! -e "$NAM_DIR/current_ir.wav" ]; then
    DEFAULT_IR=$(find "$NAM_DIR/irs" -name "*48*.wav" | head -n 1)
    if [ -z "$DEFAULT_IR" ]; then
        DEFAULT_IR=$(find "$NAM_DIR/irs" -name "*.wav" | head -n 1)
    fi
    if [ -n "$DEFAULT_IR" ]; then
        ln -sf "$DEFAULT_IR" "$NAM_DIR/current_ir.wav"
    fi
fi

# 3. Determine Cab mode (auto, on, off)
CAB_MODE="auto"
if [ -f "$CAB_MODE_FILE" ]; then
    CAB_MODE=$(cat "$CAB_MODE_FILE" | tr -d '[:space:]')
fi

CAB_ENABLED=0
if [ "$CAB_MODE" = "on" ]; then
    CAB_ENABLED=1
elif [ "$CAB_MODE" = "off" ] || [ "$CAB_MODE" = "bypass" ]; then
    CAB_ENABLED=0
else
    # Auto-detect from model metadata
    MODEL_TYPE=$(python3 -c "import json, os; p = os.path.realpath('$NAM_DIR/current_model.nam'); d = json.load(open(p)); print(d.get('metadata', {}).get('gear_type', 'unknown'))" 2>/dev/null || echo "unknown")
    if [ "$MODEL_TYPE" = "amp_cab" ]; then
        echo "[jnam] Model is Full Rig (amp_cab). Auto-bypassing Cab IR."
        CAB_ENABLED=0
    else
        echo "[jnam] Model is DI/Amp ($MODEL_TYPE). Auto-enabling Cab IR."
        CAB_ENABLED=1
    fi
fi

# 4. Determine Input and Output channel configuration
IN_CHAN="both"
if [ -f "$IN_CHAN_FILE" ]; then
    IN_CHAN=$(cat "$IN_CHAN_FILE" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
fi

OUT_CHAN="stereo"
if [ -f "$OUT_CHAN_FILE" ]; then
    OUT_CHAN=$(cat "$OUT_CHAN_FILE" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
fi

PIDS_TO_WATCH=()

# 5. Generate connections.xml and config
if [ "$CAB_ENABLED" -eq 1 ]; then
    echo "[jnam] Cab IR is ENABLED."
    cat << CONF > "$NAM_DIR/cab.conf"
/convolver/new 1 1 128 2048 1.0
/input/name 1 in
/output/name 1 out
/impulse/read 1 1 1 0 0 0 1 "$NAM_DIR/current_ir.wav"
CONF
fi

# Generate XML
cat << XML > "$NAM_DIR/connections.xml"
<?xml version="1.0" encoding="utf-8"?>
<aj-snapshot>
  <jack>
    <connections>
$( [ "$IN_CHAN" = "both" ] || [ "$IN_CHAN" = "1" ] && echo '      <port id="system:capture_1"><connection port="nam:input" /></port>' )
$( [ "$IN_CHAN" = "both" ] || [ "$IN_CHAN" = "2" ] && echo '      <port id="system:capture_2"><connection port="nam:input" /></port>' )
$( [ "$CAB_ENABLED" -eq 1 ] && echo '      <port id="nam:output"><connection port="cab:in" /></port>' )
      <port id="$( [ "$CAB_ENABLED" -eq 1 ] && echo "cab:out" || echo "nam:output" )">
$( [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "1" ] && echo '        <connection port="system:playback_1" />' )
$( [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "2" ] && echo '        <connection port="system:playback_2" />' )
      </port>
    </connections>
  </jack>
</aj-snapshot>
XML

# Prepare FIFO for live parameter control
rm -f "$FIFO"
mkfifo "$FIFO"
sleep infinity > "$FIFO" &
FIFO_KEEP_PID=$!

cleanup() {
    echo "[jnam] Stopping rig components..."
    kill $JALV_PID $CAB_PID $SNAP_PID $FIFO_KEEP_PID 2>/dev/null || true
    rm -f "$FIFO"
}

TERMINATED=0
on_term() {
    TERMINATED=1
    cleanup
    exit 0
}
trap on_term SIGINT SIGTERM
trap cleanup EXIT

# 6. Start NAM plugin host (jalv)
echo "[jnam] Starting Neural Amp Modeler (jalv)..."
jalv -n nam http://github.com/mikeoliphant/neural-amp-modeler-lv2 < "$FIFO" &
JALV_PID=$!
PIDS_TO_WATCH+=($JALV_PID)

# 7. Start Cab IR convolution engine (if enabled)
if [ "$CAB_ENABLED" -eq 1 ]; then
    echo "[jnam] Starting Cab IR engine (jconvolver)..."
    jconvolver -N cab "$NAM_DIR/cab.conf" &
    CAB_PID=$!
    PIDS_TO_WATCH+=($CAB_PID)
fi

sleep 1.0

# 8. Start connection keeper daemon (aj-snapshot)
echo "[jnam] Starting connection manager (aj-snapshot)..."
aj-snapshot -d -j -q "$NAM_DIR/connections.xml" &
SNAP_PID=$!

# Initial connect attempt
if [ "$IN_CHAN" = "both" ] || [ "$IN_CHAN" = "1" ]; then
    jack_connect system:capture_1 nam:input 2>/dev/null || true
fi
if [ "$IN_CHAN" = "both" ] || [ "$IN_CHAN" = "2" ]; then
    jack_connect system:capture_2 nam:input 2>/dev/null || true
fi

if [ "$CAB_ENABLED" -eq 1 ]; then
    jack_connect nam:output cab:in 2>/dev/null || true
    OUT_SRC="cab:out"
else
    OUT_SRC="nam:output"
fi

if [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "1" ]; then
    jack_connect "$OUT_SRC" system:playback_1 2>/dev/null || true
fi
if [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "2" ]; then
    jack_connect "$OUT_SRC" system:playback_2 2>/dev/null || true
fi

echo "[jnam] JNAM Rig running successfully on JACK2!"

# Wait on critical processes
wait -n "${PIDS_TO_WATCH[@]}"

if [ "$TERMINATED" -eq 0 ]; then
    echo "[jnam] Warning: Audio component terminated unexpectedly."
    exit 1
fi
