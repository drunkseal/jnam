#!/usr/bin/env python3
"""
JNAM Modular Pedalboard Engine
Manages dynamic jalv process lifecycles, parameter FIFOs, and real-time JACK routing.
"""

import os
import re
import json
import time
import subprocess
from plugins import get_plugins_catalog, FEATURED_PLUGINS

NAM_DIR = os.environ.get("JNAM_DIR", os.path.expanduser("~/nam"))
PEDALBOARD_FILE = os.path.join(NAM_DIR, "pedalboard.json")
CONNECTIONS_XML = os.path.join(NAM_DIR, "connections.xml")

# Active jalv processes and FIFO descriptors:
# { slot_id: { "proc": Popen, "fifo": path, "pipe": fd, "uri": str } }
active_pedals = {}

DEFAULT_PEDALBOARD = {
    "slots": [
        {
            "id": "pedal_ts9",
            "uri": "http://guitarix.sourceforge.net/plugins/gxts9#ts9sim",
            "name": "GxTubeScreamer",
            "category": "distortion",
            "color": "#10b981",
            "position": "pre",
            "enabled": False,
            "params": {
                "fslider0_": -16.0,
                "fslider1_": 400.0,
                "fslider2_": 0.5
            }
        },
        {
            "id": "pedal_delay",
            "uri": "http://guitarix.sourceforge.net/plugins/gx_delay_stereo#_delay_stereo",
            "name": "GxDelay-Stereo",
            "category": "delay",
            "color": "#00e5ff",
            "position": "post",
            "enabled": False,
            "params": {
                "timt_l": 350.0,
                "timt_r": 350.0,
                "level_l": -8.0,
                "level_r": -8.0,
                "lfo": 0.2
            }
        },
        {
            "id": "pedal_reverb",
            "uri": "http://guitarix.sourceforge.net/plugins/gx_reverb_stereo#_reverb_stereo",
            "name": "GxReverb-Stereo",
            "category": "reverb",
            "color": "#2dd4bf",
            "position": "post",
            "enabled": False,
            "params": {
                "dry_wet": 30.0,
                "roomsize": 0.5,
                "damp": 0.3
            }
        }
    ]
}

def get_pedalboard():
    if os.path.exists(PEDALBOARD_FILE):
        try:
            with open(PEDALBOARD_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, dict) and "slots" in data:
                    return data
        except Exception:
            pass
    return DEFAULT_PEDALBOARD.copy()

def save_pedalboard(state):
    try:
        os.makedirs(NAM_DIR, exist_ok=True)
        with open(PEDALBOARD_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"[pedalboard] Error saving state: {e}")

def is_jack_ready():
    try:
        res = subprocess.run(["jack_wait", "-c"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1.0)
        return res.returncode == 0
    except Exception:
        return False

def find_plugin_meta(uri):
    # Check featured first
    for f in FEATURED_PLUGINS:
        if f["uri"] == uri:
            return f
    # Check catalog
    cat = get_plugins_catalog()
    for p in cat.get("plugins", []):
        if p["uri"] == uri:
            return p
    return None

def get_slot_audio_ports(slot):
    uri = slot.get("uri")
    cat = get_plugins_catalog()
    plugin = next((p for p in cat.get("plugins", []) if p["uri"] == uri), None)
    if plugin and plugin.get("audio_in") and plugin.get("audio_out"):
        return plugin["audio_in"], plugin["audio_out"]
    return ["in"], ["out"]

def start_pedal_process(slot_id, uri, initial_params=None):
    global active_pedals
    if slot_id in active_pedals:
        p_info = active_pedals[slot_id]
        if p_info.get("proc") and p_info["proc"].poll() is None:
            return True
        # Dead or invalid process: clean up cleanly first
        stop_pedal_process(slot_id)

    if not is_jack_ready():
        return False

    fifo_path = f"/tmp/nam_{slot_id}.fifo"
    if os.path.exists(fifo_path):
        try: os.unlink(fifo_path)
        except OSError: pass

    try:
        os.mkfifo(fifo_path, 0o666)
    except OSError:
        pass

    try:
        # Open in O_RDWR to keep the FIFO open and prevent EOF when writes finish
        keep_fd = os.open(fifo_path, os.O_RDWR | os.O_NONBLOCK)
    except Exception as e:
        print(f"[pedalboard] Error opening FIFO {fifo_path}: {e}")
        keep_fd = None

    # Determine CPU core affinity: pin to Core 2 (Audio DSP)
    cmd = ["taskset", "-c", "2", "jalv", "-n", slot_id, uri]

    try:
        fifo_in = open(fifo_path, "r")
        proc = subprocess.Popen(
            cmd,
            stdin=fifo_in,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        active_pedals[slot_id] = {
            "proc": proc,
            "fifo": fifo_path,
            "pipe": keep_fd,
            "uri": uri,
            "file": fifo_in
        }

        # Wait up to 1 second for jalv to register in JACK
        for _ in range(20):
            if proc.poll() is not None:
                break
            try:
                ports = subprocess.check_output(["jack_lsp"], stderr=subprocess.DEVNULL, timeout=0.5).decode("utf-8")
                if f"{slot_id}:" in ports:
                    break
            except Exception:
                pass
            time.sleep(0.05)

        # Send initial parameter values if provided
        if initial_params and keep_fd is not None:
            for k, v in initial_params.items():
                cmd_line = f"{k} = {float(v):.6f}\n".encode("utf-8")
                try:
                    os.write(keep_fd, cmd_line)
                except Exception:
                    pass

        return True
    except Exception as e:
        print(f"[pedalboard] Error spawning jalv for {slot_id} ({uri}): {e}")
        return False

def stop_pedal_process(slot_id):
    global active_pedals
    p_info = active_pedals.pop(slot_id, None)

    if p_info:
        # Try graceful quit via FIFO command
        if p_info.get("pipe") is not None:
            try:
                os.write(p_info["pipe"], b"QUIT\n")
                os.close(p_info["pipe"])
            except Exception:
                pass

        proc = p_info.get("proc")
        if proc:
            try:
                proc.terminate()
                proc.wait(timeout=0.2)
            except Exception:
                try:
                    proc.kill()
                    proc.wait(timeout=0.1)
                except Exception:
                    pass

        if p_info.get("file"):
            try: p_info["file"].close()
            except Exception: pass

        fifo = p_info.get("fifo")
        if fifo and os.path.exists(fifo):
            try: os.unlink(fifo)
            except OSError: pass

    # Always ensure no orphan jalv process for this slot remains
    try:
        subprocess.call(["pkill", "-9", "-f", f"jalv -n {slot_id} "], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def send_pedal_param(slot_id, symbol, value):
    global active_pedals
    p_info = active_pedals.get(slot_id)
    if not p_info or not p_info.get("pipe") or (p_info.get("proc") and p_info["proc"].poll() is not None):
        # Revive pedal if dead
        pb = get_pedalboard()
        target = next((s for s in pb.get("slots", []) if s["id"] == slot_id), None)
        if target:
            start_pedal_process(slot_id, target["uri"], target.get("params"))
            p_info = active_pedals.get(slot_id)
        if not p_info or not p_info.get("pipe"):
            return False

    cmd = f"{symbol} = {float(value):.6f}\n".encode("utf-8")
    try:
        os.write(p_info["pipe"], cmd)
        return True
    except Exception as e:
        return False

def ensure_all_pedals_running():
    if not is_jack_ready():
        return False
    pb = get_pedalboard()
    for slot in pb.get("slots", []):
        sid = slot["id"]
        uri = slot["uri"]
        params = slot.get("params", {})
        start_pedal_process(sid, uri, params)
    return True

def stop_all_pedals():
    for sid in list(active_pedals.keys()):
        stop_pedal_process(sid)

def build_connections_map(in_chan="both", out_chan="stereo", cab_enabled=False, slots=None):
    if slots is None:
        slots = get_pedalboard().get("slots", [])

    pre_slots = [s for s in slots if s.get("enabled", False) and s.get("position", "pre") == "pre"]
    post_slots = [s for s in slots if s.get("enabled", False) and s.get("position", "pre") == "post"]

    in_ports = []
    if in_chan in ["both", "1"]: in_ports.append("system:capture_1")
    if in_chan in ["both", "2"]: in_ports.append("system:capture_2")
    if not in_ports: in_ports = ["system:capture_1"]

    connections = [] # [(src, dest)]

    # 1. Input -> PRE-Amp Pedals -> NAM
    curr_sources = in_ports
    for slot in pre_slots:
        sid = slot["id"]
        audio_in, audio_out = get_slot_audio_ports(slot)
        if len(audio_in) == 1:
            for src in curr_sources:
                connections.append((src, f"{sid}:{audio_in[0]}"))
        else:
            if len(curr_sources) == 1:
                connections.append((curr_sources[0], f"{sid}:{audio_in[0]}"))
                connections.append((curr_sources[0], f"{sid}:{audio_in[1]}"))
            else:
                connections.append((curr_sources[0], f"{sid}:{audio_in[0]}"))
                connections.append((curr_sources[1], f"{sid}:{audio_in[1]}"))
        curr_sources = [f"{sid}:{p}" for p in audio_out]

    # Connect last PRE source to NAM
    for src in curr_sources:
        connections.append((src, "nam:input"))

    # 2. NAM -> CAB (if enabled)
    if cab_enabled:
        connections.append(("nam:output", "cab:in"))
        curr_l = "cab:out"
        curr_r = "cab:out"
    else:
        curr_l = "nam:output"
        curr_r = "nam:output"

    # 3. CAB/NAM -> POST-Amp Pedals (Modulation, Delay, Reverb)
    for slot in post_slots:
        sid = slot["id"]
        audio_in, audio_out = get_slot_audio_ports(slot)
        if len(audio_in) == 1:
            connections.append((curr_l, f"{sid}:{audio_in[0]}"))
            if curr_r != curr_l:
                connections.append((curr_r, f"{sid}:{audio_in[0]}"))
        else:
            connections.append((curr_l, f"{sid}:{audio_in[0]}"))
            connections.append((curr_r, f"{sid}:{audio_in[1]}"))

        if len(audio_out) == 1:
            curr_l = f"{sid}:{audio_out[0]}"
            curr_r = f"{sid}:{audio_out[0]}"
        else:
            curr_l = f"{sid}:{audio_out[0]}"
            curr_r = f"{sid}:{audio_out[1]}"

    # 4. Final Stage -> System Playback
    if out_chan in ["stereo", "1"]:
        connections.append((curr_l, "system:playback_1"))
    if out_chan in ["stereo", "2"]:
        connections.append((curr_r, "system:playback_2"))

    # 5. Metronome Always Summed to Playback
    connections.append(("jnam-metronome:out_1", "system:playback_1"))
    connections.append(("jnam-metronome:out_2", "system:playback_2"))

    return connections

def generate_connections_xml(in_chan="both", out_chan="stereo", cab_enabled=False, slots=None):
    connections = build_connections_map(in_chan, out_chan, cab_enabled, slots)

    clients = {}
    for src, dst in connections:
        if ":" not in src or ":" not in dst:
            continue
        src_c, src_p = src.split(":", 1)
        if src_c not in clients:
            clients[src_c] = {}
        if src_p not in clients[src_c]:
            clients[src_c][src_p] = []
        if dst not in clients[src_c][src_p]:
            clients[src_c][src_p].append(dst)

    xml_lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<aj-snapshot>',
        '<jack>'
    ]

    for cname, ports in sorted(clients.items()):
        xml_lines.append(f'  <client name="{cname}">')
        for pname, dests in sorted(ports.items()):
            xml_lines.append(f'    <port name="{pname}">')
            for dst in dests:
                xml_lines.append(f'      <connection port="{dst}" />')
            xml_lines.append('    </port>')
        xml_lines.append('  </client>')

    xml_lines.append('</jack>')
    xml_lines.append('</aj-snapshot>\n')

    xml_content = "\n".join(xml_lines)
    try:
        os.makedirs(NAM_DIR, exist_ok=True)
        with open(CONNECTIONS_XML, "w") as f:
            f.write(xml_content)
    except Exception as e:
        print(f"[pedalboard] Error writing connections.xml: {e}")

    return connections

def apply_jack_routing_live(in_chan="both", out_chan="stereo", cab_enabled=False, slots=None):
    desired = build_connections_map(in_chan, out_chan, cab_enabled, slots)
    generate_connections_xml(in_chan, out_chan, cab_enabled, slots)

    desired_pairs = {frozenset([src, dst]) for src, dst in desired}

    # Get current active connections and available ports from JACK
    current_pairs = set()
    available_ports = set()
    try:
        out = subprocess.check_output(["jack_lsp", "-c"], stderr=subprocess.DEVNULL, timeout=1.5).decode("utf-8")
        curr_port = None
        for line in out.splitlines():
            if not line.startswith("   "):
                curr_port = line.strip()
                if curr_port:
                    available_ports.add(curr_port)
            elif curr_port:
                dst = line.strip()
                if dst:
                    available_ports.add(dst)
                # Ignore tuner connections during normal play
                if "jnam-tuner" not in curr_port and "jnam-tuner" not in dst:
                    current_pairs.add(frozenset([curr_port, dst]))
    except Exception:
        current_pairs = set()

    # Disconnect obsolete audio connections
    for pair in (current_pairs - desired_pairs):
        p1, p2 = list(pair)
        try:
            subprocess.call(["jack_disconnect", p1, p2], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    # Connect desired audio paths (verifying port availability if known)
    for src, dst in desired:
        if frozenset([src, dst]) not in current_pairs:
            if available_ports and (src not in available_ports or dst not in available_ports):
                continue
            try:
                subprocess.call(["jack_connect", src, dst], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass

    return True

# High-Level Modular Operations
def add_pedal(uri, position="post"):
    pb = get_pedalboard()
    slots = pb.get("slots", [])

    meta = find_plugin_meta(uri)
    if not meta:
        meta = {
            "name": uri.split("/")[-1].replace("#", " ").capitalize(),
            "category": "utility",
            "color": "#64748b"
        }

    # Generate unique ID
    existing_ids = {s["id"] for s in slots}
    idx = 1
    slot_id = f"pedal_{idx}"
    while slot_id in existing_ids:
        idx += 1
        slot_id = f"pedal_{idx}"

    # Default parameters
    params = {}
    cat_plugins = get_plugins_catalog().get("plugins", [])
    p_info = next((p for p in cat_plugins if p["uri"] == uri), None)
    if p_info:
        for c in p_info.get("controls", []):
            params[c["symbol"]] = c["default"]

    new_slot = {
        "id": slot_id,
        "uri": uri,
        "name": meta.get("name", slot_id),
        "category": meta.get("category", "utility"),
        "color": meta.get("color", "#3b82f6"),
        "position": position if position in ["pre", "post"] else "post",
        "enabled": True,
        "params": params
    }

    slots.append(new_slot)
    pb["slots"] = slots
    save_pedalboard(pb)

    # Start jalv instance
    start_pedal_process(slot_id, uri, params)
    return new_slot

def remove_pedal(slot_id):
    pb = get_pedalboard()
    slots = pb.get("slots", [])
    target = next((s for s in slots if s["id"] == slot_id), None)
    if not target:
        return False

    slots = [s for s in slots if s["id"] != slot_id]
    pb["slots"] = slots
    save_pedalboard(pb)

    stop_pedal_process(slot_id)
    return True

def reorder_pedals(slot_ids):
    pb = get_pedalboard()
    slots = pb.get("slots", [])
    slot_map = {s["id"]: s for s in slots}

    new_slots = []
    for sid in slot_ids:
        if sid in slot_map:
            new_slots.append(slot_map[sid])
    # Add any remaining slots not in slot_ids
    for s in slots:
        if s["id"] not in slot_ids:
            new_slots.append(s)

    pb["slots"] = new_slots
    save_pedalboard(pb)
    return pb

def update_pedal_slot(slot_id, updates):
    pb = get_pedalboard()
    slots = pb.get("slots", [])
    target = next((s for s in slots if s["id"] == slot_id), None)
    if not target:
        return None

    if "enabled" in updates:
        target["enabled"] = bool(updates["enabled"])
        if target["enabled"]:
            start_pedal_process(slot_id, target["uri"], target.get("params"))
    if "position" in updates and updates["position"] in ["pre", "post"]:
        target["position"] = updates["position"]
    if "params" in updates and isinstance(updates["params"], dict):
        target.setdefault("params", {}).update(updates["params"])
        for sym, val in updates["params"].items():
            send_pedal_param(slot_id, sym, val)

    save_pedalboard(pb)
    return target
