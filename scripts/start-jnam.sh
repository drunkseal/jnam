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
  <client name="system">
$( [ "$IN_CHAN" = "both" ] || [ "$IN_CHAN" = "1" ] && echo '    <port name="capture_1"><connection port="nam:input" /></port>' )
$( [ "$IN_CHAN" = "both" ] || [ "$IN_CHAN" = "2" ] && echo '    <port name="capture_2"><connection port="nam:input" /></port>' )
  </client>
$( if [ "$CAB_ENABLED" -eq 1 ]; then cat << NAM_CAB
  <client name="nam">
    <port name="output"><connection port="cab:in" /></port>
  </client>
  <client name="cab">
    <port name="out">
$( [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "1" ] && echo '      <connection port="system:playback_1" />' )
$( [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "2" ] && echo '      <connection port="system:playback_2" />' )
    </port>
  </client>
NAM_CAB
else cat << NAM_DIR
  <client name="nam">
    <port name="output">
$( [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "1" ] && echo '      <connection port="system:playback_1" />' )
$( [ "$OUT_CHAN" = "stereo" ] || [ "$OUT_CHAN" = "2" ] && echo '      <connection port="system:playback_2" />' )
    </port>
  </client>
NAM_DIR
fi )
</jack>
</aj-snapshot>
XML

# Prepare FIFOs for live parameter control (NAM + Pedalboard FX)
NAM_FIFO="/tmp/nam_control.fifo"
DRIVE_FIFO="/tmp/nam_drive.fifo"
DELAY_FIFO="/tmp/nam_delay.fifo"
REVERB_FIFO="/tmp/nam_reverb.fifo"

rm -f "$NAM_FIFO" "$DRIVE_FIFO" "$DELAY_FIFO" "$REVERB_FIFO"
mkfifo "$NAM_FIFO" "$DRIVE_FIFO" "$DELAY_FIFO" "$REVERB_FIFO"
sleep infinity > "$NAM_FIFO" &
NAM_FKEEP=$!
sleep infinity > "$DRIVE_FIFO" &
DRIVE_FKEEP=$!
sleep infinity > "$DELAY_FIFO" &
DELAY_FKEEP=$!
sleep infinity > "$REVERB_FIFO" &
REVERB_FKEEP=$!

cleanup() {
    echo "[jnam] Stopping rig and pedalboard components..."
    kill $JALV_PID $CAB_PID $DRIVE_PID $DELAY_PID $REVERB_PID $SNAP_PID $NAM_FKEEP $DRIVE_FKEEP $DELAY_FKEEP $REVERB_FKEEP 2>/dev/null || true
    rm -f "$NAM_FIFO" "$DRIVE_FIFO" "$DELAY_FIFO" "$REVERB_FIFO"
}

TERMINATED=0
on_term() {
    TERMINATED=1
    cleanup
    exit 0
}
trap on_term SIGINT SIGTERM
trap cleanup EXIT

# CPU Core Pinning for Real-Time Isolation
# Core 3: 100% Dedicated to Neural Amp Modeler (WaveNet DSP)
# Core 2: Dedicated to Cab IR (jconvolver), Pedalboard FX, and JACK Driver
NUM_CPUS=$(nproc --all 2>/dev/null || nproc || echo 1)
NAM_AFFINITY=""
CAB_AFFINITY=""
if [ "$NUM_CPUS" -ge 4 ]; then
    NAM_AFFINITY="taskset -c 3"
    CAB_AFFINITY="taskset -c 2"
fi

# 6. Start NAM plugin host (jalv) on Core 3
echo "[jnam] Starting Neural Amp Modeler (jalv) on dedicated core..."
$NAM_AFFINITY jalv -n nam http://github.com/mikeoliphant/neural-amp-modeler-lv2 < "$NAM_FIFO" &
JALV_PID=$!
PIDS_TO_WATCH+=($JALV_PID)

# 7. Start Cab IR convolution engine (if enabled) on Core 2
if [ "$CAB_ENABLED" -eq 1 ]; then
    echo "[jnam] Starting Cab IR engine (jconvolver)..."
    $CAB_AFFINITY jconvolver -N cab "$NAM_DIR/cab.conf" &
    CAB_PID=$!
    PIDS_TO_WATCH+=($CAB_PID)
fi

# 8. Start Pedalboard FX on Core 2
echo "[jnam] Starting Pedalboard FX (Drive, Delay, Reverb)..."
$CAB_AFFINITY jalv -n drive http://guitarix.sourceforge.net/plugins/gxts9#ts9sim < "$DRIVE_FIFO" &
DRIVE_PID=$!
PIDS_TO_WATCH+=($DRIVE_PID)

$CAB_AFFINITY jalv -n delay http://guitarix.sourceforge.net/plugins/gx_delay_stereo#_delay_stereo < "$DELAY_FIFO" &
DELAY_PID=$!
PIDS_TO_WATCH+=($DELAY_PID)

$CAB_AFFINITY jalv -n reverb http://guitarix.sourceforge.net/plugins/gx_reverb_stereo#_reverb_stereo < "$REVERB_FIFO" &
REVERB_PID=$!
PIDS_TO_WATCH+=($REVERB_PID)

# Wait up to 5 seconds for all plugin ports to register in JACK
for i in $(seq 1 50); do
    PORTS=$(jack_lsp 2>/dev/null || true)
    if echo "$PORTS" | grep -q "nam:input" && \
       echo "$PORTS" | grep -q "drive:in" && \
       echo "$PORTS" | grep -q "delay:in" && \
       echo "$PORTS" | grep -q "reverb:in"; then
        if [ "$CAB_ENABLED" -eq 0 ] || echo "$PORTS" | grep -q "cab:in"; then
            break
        fi
    fi
    sleep 0.1
done

# 9. Establish clean signal chain connections
python3 -c "
import sys, os
sys.path.insert(0, '$NAM_DIR/web')
try:
    import server
    server.apply_jack_routing_live()
except Exception as e:
    pass
" 2>/dev/null || true

# 10. Start connection keeper daemon (aj-snapshot)
echo "[jnam] Starting connection manager (aj-snapshot)..."
$CAB_AFFINITY aj-snapshot -d -j -q "$NAM_DIR/connections.xml" &
SNAP_PID=$!

echo "[jnam] JNAM Rig & Pedalboard running successfully on JACK2!"

# Wait on critical processes
wait -n "${PIDS_TO_WATCH[@]}"

if [ "$TERMINATED" -eq 0 ]; then
    echo "[jnam] Warning: Audio component terminated unexpectedly."
    exit 1
fi
