#!/bin/bash
echo "[jnam] Stopping NAM audio rig..."
pkill -TERM -f "jalv -n nam" 2>/dev/null || true
pkill -TERM -f "jconvolver -N cab" 2>/dev/null || true
pkill -TERM -f "aj-snapshot" 2>/dev/null || true
sleep 0.2
pkill -9 -f "jalv -n nam" 2>/dev/null || true
pkill -9 -f "jconvolver -N cab" 2>/dev/null || true
pkill -9 -f "aj-snapshot" 2>/dev/null || true
rm -f /tmp/nam_control.fifo
echo "[jnam] Rig stopped."
