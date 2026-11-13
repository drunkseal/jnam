#!/bin/bash
echo "[jnam] Stopping all audio engine components..."
killall -TERM aj-snapshot jconvolver jalv 2>/dev/null || true
for i in {1..10}; do
    if ! pgrep -x "jalv|jconvolver|aj-snapshot" >/dev/null 2>&1; then
        break
    fi
    sleep 0.1
done
killall -9 aj-snapshot jconvolver jalv 2>/dev/null || true
rm -f /tmp/nam_*.fifo
echo "[jnam] Stopped."
