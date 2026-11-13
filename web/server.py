#!/usr/bin/env python3
"""
JNAM Web Controller - Lightweight, zero-dependency REST & Web UI server for JNAM.
Includes Audio Device, Input/Output Routing, and Real-Time Pitch Detection Tuner.
"""
import os
import re
import sys
import glob
import json
import time
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

NAM_DIR = os.environ.get("JNAM_DIR", os.path.expanduser("~/nam"))
MODELS_DIR = os.path.join(NAM_DIR, "models")
IRS_DIR = os.path.join(NAM_DIR, "irs")
CURRENT_MODEL = os.path.join(NAM_DIR, "current_model.nam")
CURRENT_IR = os.path.join(NAM_DIR, "current_ir.wav")
CAB_CONF = os.path.join(NAM_DIR, "cab.conf")
CAB_MODE_FILE = os.path.join(NAM_DIR, "cab_mode")
AUDIO_DEV_FILE = os.path.join(NAM_DIR, "audio_device")
BUFFER_FILE = os.path.join(NAM_DIR, "buffer_size")
IN_CHAN_FILE = os.path.join(NAM_DIR, "input_channel")
OUT_CHAN_FILE = os.path.join(NAM_DIR, "output_channel")
CONNECTIONS_XML = os.path.join(NAM_DIR, "connections.xml")
FX_FILE = os.path.join(NAM_DIR, "fx.json")
FIFO_PATH = "/tmp/nam_control.fifo"
DRIVE_FIFO = "/tmp/nam_drive.fifo"
DELAY_FIFO = "/tmp/nam_delay.fifo"
REVERB_FIFO = "/tmp/nam_reverb.fifo"
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

DEFAULT_FX = {
    "drive": {
        "enabled": False,
        "model": "ts9",
        "drive": 0.5,
        "tone": 400.0,
        "level": -10.0
    },
    "delay": {
        "enabled": False,
        "time": 350.0,
        "level": -8.0,
        "lfo": 0.2
    },
    "reverb": {
        "enabled": False,
        "dry_wet": 30.0,
        "roomsize": 0.5,
        "damp": 0.3
    }
}

state_cache = {
    "input_level": 0.0,
    "output_level": 0.0,
    "quality_scale": 1.0,
    "tuner_active": False
}

tuner_process = None

def get_models():
    return sorted(glob.glob(os.path.join(MODELS_DIR, "**/*.nam"), recursive=True))

def get_irs():
    return sorted(glob.glob(os.path.join(IRS_DIR, "**/*.wav"), recursive=True))

def get_current_model():
    if os.path.islink(CURRENT_MODEL):
        return os.path.realpath(CURRENT_MODEL)
    return None

_metadata_cache = {}

def get_current_ir():
    if os.path.islink(CURRENT_IR):
        return os.path.realpath(CURRENT_IR)
    return None

def get_model_metadata(model_path):
    if not model_path or not os.path.exists(model_path):
        return {}
    real = os.path.realpath(model_path)
    if real in _metadata_cache:
        return _metadata_cache[real]
    try:
        with open(real, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
            meta = data.get("metadata", {})
            _metadata_cache[real] = meta
            return meta
    except Exception:
        return {}

def get_cab_mode():
    if os.path.exists(CAB_MODE_FILE):
        try:
            with open(CAB_MODE_FILE, "r") as f:
                return f.read().strip().lower()
        except Exception:
            return "auto"
    return "auto"

def set_cab_mode(mode):
    with open(CAB_MODE_FILE, "w") as f:
        f.write(mode.strip().lower() + "\n")

def is_cab_effective_enabled():
    mode = get_cab_mode()
    if mode == "on":
        return True
    elif mode in ["off", "bypass"]:
        return False
    else:  # auto
        cur_m = get_current_model()
        meta = get_model_metadata(cur_m)
        return meta.get("gear_type") != "amp_cab"

def get_audio_device():
    if os.path.exists(AUDIO_DEV_FILE):
        try:
            with open(AUDIO_DEV_FILE, "r") as f:
                val = f.read().strip()
                if val:
                    return val
        except Exception:
            pass
    return "auto"

def set_audio_device(dev):
    with open(AUDIO_DEV_FILE, "w") as f:
        f.write(dev.strip() + "\n")

def get_input_channel():
    if os.path.exists(IN_CHAN_FILE):
        try:
            with open(IN_CHAN_FILE, "r") as f:
                val = f.read().strip().lower()
                if val in ["both", "1", "2"]:
                    return val
        except Exception:
            pass
    return "both"

def set_input_channel(chan):
    with open(IN_CHAN_FILE, "w") as f:
        f.write(chan.strip().lower() + "\n")

def get_output_channel():
    if os.path.exists(OUT_CHAN_FILE):
        try:
            with open(OUT_CHAN_FILE, "r") as f:
                val = f.read().strip().lower()
                if val in ["stereo", "1", "2"]:
                    return val
        except Exception:
            pass
    return "stereo"

def set_output_channel(chan):
    with open(OUT_CHAN_FILE, "w") as f:
        f.write(chan.strip().lower() + "\n")

def get_alsa_cards():
    cards = []
    if not os.path.exists("/proc/asound/cards"):
        return cards
    try:
        with open("/proc/asound/cards", "r") as f:
            content = f.read()
        matches = re.findall(r'^\s*(\d+)\s+\[([^\]]+)\]:\s+([^\n]+)\n\s+([^\n]+)', content, re.MULTILINE)
        cur_dev = get_audio_device()
        for m in matches:
            idx = int(m[0])
            card_id = m[1].strip()
            name = m[2].strip()
            desc = m[3].strip()
            dev_hw = f"hw:{idx}"
            cards.append({
                "index": idx,
                "id": card_id,
                "name": name,
                "desc": desc,
                "hw": dev_hw,
                "is_active": (cur_dev == dev_hw or (cur_dev == "auto" and "USB" in card_id))
            })
    except Exception:
        pass
    return cards

def get_hardware_audio_params():
    rate = 48000
    period_size = None
    periods = 3
    # 1. Read directly from active ALSA hw_params (zero latency impact, zero audio graph lock)
    try:
        for pcm_path in glob.glob("/proc/asound/card*/pcm0p/sub0/hw_params"):
            with open(pcm_path, "r") as f:
                content = f.read()
            m_rate = re.search(r'^rate:\s*(\d+)', content, re.MULTILINE)
            m_period = re.search(r'^period_size:\s*(\d+)', content, re.MULTILINE)
            m_buf = re.search(r'^buffer_size:\s*(\d+)', content, re.MULTILINE)
            if m_rate:
                rate = int(m_rate.group(1))
            if m_period:
                period_size = int(m_period.group(1))
            if m_buf and m_period and int(m_period.group(1)) > 0:
                periods = int(m_buf.group(1)) // int(m_period.group(1))
            if period_size is not None:
                break
    except Exception:
        pass

    # 2. Try jack_bufsize if ALSA card was not parsed
    if period_size is None:
        try:
            out = subprocess.check_output(["jack_bufsize"], stderr=subprocess.DEVNULL).decode().strip()
            if out and out.isdigit():
                period_size = int(out)
        except Exception:
            pass

    # 3. Fallback to file or default 256
    if period_size is None and os.path.exists(BUFFER_FILE):
        try:
            with open(BUFFER_FILE, "r") as f:
                val = f.read().strip()
                if val.isdigit():
                    period_size = int(val)
        except Exception:
            pass

    if period_size is None:
        period_size = 256

    latency_ms = round((period_size / float(rate)) * 1000.0, 2)
    return {
        "sample_rate": rate,
        "buffer_size": period_size,
        "periods": periods,
        "latency_ms": latency_ms
    }

def set_buffer_size(size):
    try:
        size = int(size)
    except ValueError:
        return False
    os.makedirs(NAM_DIR, exist_ok=True)
    with open(BUFFER_FILE, "w") as f:
        f.write(str(size) + "\n")
    applied_live = False
    try:
        ret = subprocess.call(["jack_bufsize", str(size)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        applied_live = (ret == 0)
    except Exception:
        pass
    return applied_live

def get_fx_state():
    if os.path.exists(FX_FILE):
        try:
            with open(FX_FILE, "r") as f:
                data = json.load(f)
                res = {k: v.copy() for k, v in DEFAULT_FX.items()}
                for k, v in data.items():
                    if k in res and isinstance(v, dict):
                        res[k].update(v)
                return res
        except Exception:
            pass
    return {k: v.copy() for k, v in DEFAULT_FX.items()}

def save_fx_state(state):
    try:
        os.makedirs(NAM_DIR, exist_ok=True)
        with open(FX_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass

def send_fx_fifo(fifo_path, cmd):
    if os.path.exists(fifo_path):
        try:
            with open(fifo_path, "w") as fp:
                fp.write(cmd + "\n")
            return True
        except Exception:
            return False
    return False

def update_fx_params(slot, params):
    fx = get_fx_state()
    if slot not in fx:
        return fx
    fx[slot].update(params)
    save_fx_state(fx)

    # Sync to real-time plugin FIFO
    if slot == "drive":
        if "drive" in params:
            send_fx_fifo(DRIVE_FIFO, f"fslider2_ = {float(params['drive']):.6f}")
        if "tone" in params:
            send_fx_fifo(DRIVE_FIFO, f"fslider1_ = {float(params['tone']):.6f}")
        if "level" in params:
            send_fx_fifo(DRIVE_FIFO, f"fslider0_ = {float(params['level']):.6f}")
        if "enabled" in params:
            send_fx_fifo(DRIVE_FIFO, f"BYPASS = {1.0 if params['enabled'] else 0.0:.1f}")

    elif slot == "delay":
        if "time" in params:
            t = float(params["time"])
            send_fx_fifo(DELAY_FIFO, f"timt_l = {t:.6f}")
            send_fx_fifo(DELAY_FIFO, f"timt_r = {t:.6f}")
        if "level" in params:
            l = float(params["level"])
            send_fx_fifo(DELAY_FIFO, f"level_l = {l:.6f}")
            send_fx_fifo(DELAY_FIFO, f"level_r = {l:.6f}")
        if "lfo" in params:
            send_fx_fifo(DELAY_FIFO, f"lfo = {float(params['lfo']):.6f}")
        if "enabled" in params:
            send_fx_fifo(DELAY_FIFO, f"BYPASS = {1.0 if params['enabled'] else 0.0:.1f}")

    elif slot == "reverb":
        if "dry_wet" in params:
            send_fx_fifo(REVERB_FIFO, f"dry_wet = {float(params['dry_wet']):.6f}")
        if "roomsize" in params:
            send_fx_fifo(REVERB_FIFO, f"roomsize = {float(params['roomsize']):.6f}")
        if "damp" in params:
            send_fx_fifo(REVERB_FIFO, f"damp = {float(params['damp']):.6f}")

    return fx

def generate_connections_xml(in_chan=None, out_chan=None, cab_enabled=None, fx_state=None):
    if in_chan is None:
        in_chan = get_input_channel()
    if out_chan is None:
        out_chan = get_output_channel()
    if cab_enabled is None:
        cab_enabled = is_cab_effective_enabled()
    if fx_state is None:
        fx_state = get_fx_state()

    drive_on = fx_state.get("drive", {}).get("enabled", False)
    delay_on = fx_state.get("delay", {}).get("enabled", False)
    reverb_on = fx_state.get("reverb", {}).get("enabled", False)

    in_ports = []
    if in_chan in ["both", "1"]: in_ports.append("capture_1")
    if in_chan in ["both", "2"]: in_ports.append("capture_2")

    clients = {}
    def add_conn(src_client, src_port, dest_client_port):
        if src_client not in clients:
            clients[src_client] = {}
        if src_port not in clients[src_client]:
            clients[src_client][src_port] = []
        if dest_client_port not in clients[src_client][src_port]:
            clients[src_client][src_port].append(dest_client_port)

    # 1. Inputs -> (Drive or NAM)
    if drive_on:
        for p in in_ports:
            add_conn("system", p, "drive:in")
        add_conn("drive", "out", "nam:input")
    else:
        for p in in_ports:
            add_conn("system", p, "nam:input")

    # 2. NAM -> (Cab or Next)
    if cab_enabled:
        add_conn("nam", "output", "cab:in")
        curr_out_l = ("cab", "out")
        curr_out_r = ("cab", "out")
    else:
        curr_out_l = ("nam", "output")
        curr_out_r = ("nam", "output")

    # 3. (Cab/NAM) -> (Delay or Next)
    if delay_on:
        add_conn(curr_out_l[0], curr_out_l[1], "delay:in")
        add_conn(curr_out_r[0], curr_out_r[1], "delay:in1")
        curr_out_l = ("delay", "out")
        curr_out_r = ("delay", "out1")

    # 4. (Delay/Cab/NAM) -> (Reverb or Next)
    if reverb_on:
        add_conn(curr_out_l[0], curr_out_l[1], "reverb:in")
        add_conn(curr_out_r[0], curr_out_r[1], "reverb:in1")
        curr_out_l = ("reverb", "out")
        curr_out_r = ("reverb", "out1")

    # 5. Final Stage -> Playback
    if out_chan in ["stereo", "1"]:
        add_conn(curr_out_l[0], curr_out_l[1], "system:playback_1")
    if out_chan in ["stereo", "2"]:
        add_conn(curr_out_r[0], curr_out_r[1], "system:playback_2")

    lines = ['<?xml version="1.0" encoding="utf-8"?>', '<aj-snapshot>', '<jack>']
    for c_name, ports in clients.items():
        lines.append(f'  <client name="{c_name}">')
        for p_name, dests in ports.items():
            lines.append(f'    <port name="{p_name}">')
            for d in dests:
                lines.append(f'      <connection port="{d}" />')
            lines.append('    </port>')
        lines.append('  </client>')
    lines.append('</jack>')
    lines.append('</aj-snapshot>')

    content = "\n".join(lines) + "\n"
    with open(CONNECTIONS_XML, "w") as f:
        f.write(content)
    return content

def apply_jack_routing_live():
    generate_connections_xml()
    try:
        subprocess.call(["aj-snapshot", "-r", "-j", "-x", CONNECTIONS_XML], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def send_fifo(cmd):
    if os.path.exists(FIFO_PATH):
        try:
            with open(FIFO_PATH, "w") as fp:
                fp.write(cmd + "\n")
            return True
        except Exception:
            return False
    return False

def start_tuner():
    global tuner_process
    if tuner_process and tuner_process.poll() is None:
        return tuner_process

    state_cache["tuner_active"] = True

    # 1. Silent Tuning: Disconnect audio output so open strings are muted
    for src in ["nam:output", "cab:out"]:
        for pb in ["system:playback_1", "system:playback_2"]:
            subprocess.call(["jack_disconnect", src, pb], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    send_fifo("output_level = -90.0")

    # 2. Determine target input port
    in_chan = get_input_channel()
    target_port = "system:capture_1" if in_chan == "1" else "system:capture_2"

    # 3. Launch tuner binary
    bin_paths = [
        "/usr/local/bin/jnam-tuner",
        "/opt/jnam/bin/jnam-tuner",
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "bin", "jnam-tuner")
    ]
    tuner_bin = next((p for p in bin_paths if os.path.exists(p) and os.access(p, os.X_OK)), None)
    if not tuner_bin:
        print("[tuner] Error: jnam-tuner binary not found.")
        return None

    try:
        tuner_process = subprocess.Popen(
            [tuner_bin, target_port],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=1,
            universal_newlines=True
        )
        return tuner_process
    except Exception as e:
        print(f"[tuner] Failed starting tuner: {e}")
        return None

def stop_tuner():
    global tuner_process
    state_cache["tuner_active"] = False

    if tuner_process:
        try:
            tuner_process.terminate()
            tuner_process.wait(timeout=0.5)
        except Exception:
            try:
                tuner_process.kill()
            except Exception:
                pass
        tuner_process = None

    # Restore master audio routing and volume
    apply_jack_routing_live()
    send_fifo(f"output_level = {state_cache['output_level']}")

def restart_service():
    for svc in ["jnam.service", "nam-rig.service"]:
        try:
            if subprocess.call(["systemctl", "is-active", "--quiet", svc]) == 0:
                subprocess.call(["sudo", "systemctl", "restart", svc])
                return True
        except Exception:
            pass
    try:
        subprocess.call(["sudo", "systemctl", "restart", "nam-rig.service"])
        return True
    except Exception:
        return False

def restart_jack():
    for svc in ["jnam-jack.service", "jack.service"]:
        try:
            if subprocess.call(["systemctl", "is-active", "--quiet", svc]) == 0:
                subprocess.call(["sudo", "systemctl", "restart", svc])
                restart_service()
                return True
        except Exception:
            pass
    return False

_last_cpu_time = 0.0
_cached_cpu = (0.0, 0.0)

def is_process_running(proc_name):
    try:
        for pid in os.listdir("/proc"):
            if pid.isdigit():
                try:
                    with open(f"/proc/{pid}/comm", "r") as f:
                        if proc_name in f.read():
                            return True
                except Exception:
                    pass
    except Exception:
        pass
    return False

def get_full_status():
    global _last_cpu_time, _cached_cpu
    now = time.time()

    jack_active = is_process_running("jackd")
    rig_active = is_process_running("jalv")

    cur_m = get_current_model()
    meta = get_model_metadata(cur_m) if cur_m else {}
    cur_ir = get_current_ir()
    cab_mode = get_cab_mode()
    cab_active = is_cab_effective_enabled()
    in_chan = get_input_channel()
    out_chan = get_output_channel()

    # Pre-calculated routing map (avoids jack_lsp locking the real-time audio graph)
    in_ports = []
    if in_chan in ["both", "1"]: in_ports.append("system:capture_1")
    if in_chan in ["both", "2"]: in_ports.append("system:capture_2")
    connections = {
        "nam:input": in_ports,
        "system:playback_1": ["nam:output"],
        "system:playback_2": ["nam:output"]
    }

    # Throttle CPU inspection to once every 5 seconds
    if now - _last_cpu_time > 5.0:
        _last_cpu_time = now
        jalv_cpu, jackd_cpu = 0.0, 0.0
        try:
            ps_out = subprocess.check_output(["ps", "-eo", "comm,%cpu"], stderr=subprocess.DEVNULL).decode()
            for line in ps_out.splitlines():
                parts = line.strip().split()
                if len(parts) >= 2:
                    comm, cpu_str = parts[0], parts[1]
                    if "jalv" in comm:
                        jalv_cpu = float(cpu_str)
                    elif "jackd" in comm:
                        jackd_cpu = float(cpu_str)
            _cached_cpu = (jalv_cpu, jackd_cpu)
        except Exception:
            pass
    else:
        jalv_cpu, jackd_cpu = _cached_cpu

    hw_p = get_hardware_audio_params()

    return {
        "jack_running": jack_active,
        "rig_running": rig_active,
        "current_model": {
            "path": cur_m,
            "filename": os.path.basename(cur_m) if cur_m else None,
            "folder": os.path.basename(os.path.dirname(cur_m)) if cur_m else None,
            "gear_type": meta.get("gear_type", "unknown"),
            "is_full_rig": meta.get("gear_type") == "amp_cab",
            "name": meta.get("name", os.path.basename(cur_m) if cur_m else "None")
        },
        "current_ir": {
            "path": cur_ir,
            "filename": os.path.basename(cur_ir) if cur_ir else None,
            "folder": os.path.basename(os.path.dirname(cur_ir)) if cur_ir else None
        },
        "cab": {
            "mode": cab_mode,
            "effective_active": cab_active,
            "bypassed": not cab_active
        },
        "audio_hardware": {
            "configured_device": get_audio_device(),
            "input_channel": get_input_channel(),
            "output_channel": get_output_channel(),
            "available_cards": get_alsa_cards(),
            "buffer_size": hw_p["buffer_size"],
            "sample_rate": hw_p["sample_rate"],
            "periods": hw_p["periods"],
            "latency_ms": hw_p["latency_ms"]
        },
        "dsp": state_cache,
        "fx": get_fx_state(),
        "tuner": {
            "active": state_cache["tuner_active"]
        },
        "telemetry": {
            "jalv_cpu": jalv_cpu,
            "jackd_cpu": jackd_cpu,
            "routing": connections,
            "buffer_size": hw_p["buffer_size"],
            "sample_rate": hw_p["sample_rate"],
            "latency_ms": hw_p["latency_ms"]
        }
    }


class JNAMHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def send_json(self, data, code=200):
        try:
            body = json.dumps(data).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            self.send_json(get_full_status())
            return
        elif path == "/api/models":
            models = []
            cur_m = get_current_model()
            for m in get_models():
                meta = get_model_metadata(m)
                models.append({
                    "path": m,
                    "filename": os.path.basename(m),
                    "folder": os.path.basename(os.path.dirname(m)),
                    "gear_type": meta.get("gear_type", "unknown"),
                    "is_full_rig": meta.get("gear_type") == "amp_cab",
                    "is_active": m == cur_m
                })
            self.send_json({"models": models})
            return
        elif path == "/api/irs":
            irs = []
            cur_ir = get_current_ir()
            for ir in get_irs():
                irs.append({
                    "path": ir,
                    "filename": os.path.basename(ir),
                    "folder": os.path.basename(os.path.dirname(ir)),
                    "is_active": ir == cur_ir
                })
            self.send_json({"irs": irs})
            return
        elif path == "/api/devices":
            self.send_json({
                "configured": get_audio_device(),
                "cards": get_alsa_cards()
            })
            return
        elif path == "/api/fx":
            self.send_json(get_fx_state())
            return
        elif path == "/api/tuner/stream":
            # Server-Sent Events (SSE) Real-Time Pitch Data Stream
            proc = start_tuner()
            if not proc or not proc.stdout:
                self.send_error(500, "Could not start tuner engine")
                return

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            try:
                for line in proc.stdout:
                    if not line:
                        break
                    data = f"data: {line.strip()}\n\n"
                    self.wfile.write(data.encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, Exception):
                pass
            finally:
                stop_tuner()
            return

        if path == "/" or path == "":
            path = "/index.html"
        safe_rel = os.path.relpath(path, "/")
        file_path = os.path.join(STATIC_DIR, safe_rel)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            mime_types = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".json": "application/json",
                ".svg": "image/svg+xml",
                ".png": "image/png"
            }
            content_type = mime_types.get(ext, "application/octet-stream")
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        self.send_error(404, "File Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            req_data = json.loads(body)
        except Exception:
            req_data = {}

        if path == "/api/model":
            target = req_data.get("path")
            if not target:
                name = req_data.get("name", "").lower()
                for m in get_models():
                    if name in m.lower():
                        target = m
                        break
            if target and os.path.exists(target):
                if os.path.lexists(CURRENT_MODEL):
                    os.remove(CURRENT_MODEL)
                os.symlink(target, CURRENT_MODEL)
                restart_service()
                self.send_json({"success": True, "model": target})
            else:
                self.send_json({"success": False, "error": "Model not found"}, code=400)
            return

        elif path == "/api/ir":
            target = req_data.get("path")
            if not target:
                name = req_data.get("name", "").lower()
                for ir in get_irs():
                    if name in ir.lower():
                        target = ir
                        break
            if target and os.path.exists(target):
                if os.path.lexists(CURRENT_IR):
                    os.remove(CURRENT_IR)
                os.symlink(target, CURRENT_IR)
                with open(CAB_CONF, "w") as fp:
                    fp.write(f"""/convolver/new 1 1 128 2048 1.0\n/input/name 1 in\n/output/name 1 out\n/impulse/read 1 1 1 0 0 0 1 "{CURRENT_IR}"\n""")
                restart_service()
                self.send_json({"success": True, "ir": target})
            else:
                self.send_json({"success": False, "error": "IR not found"}, code=400)
            return

        elif path == "/api/cab":
            mode = req_data.get("mode", "auto").lower()
            if mode in ["auto", "on", "off", "bypass"]:
                if mode == "bypass":
                    mode = "off"
                set_cab_mode(mode)
                restart_service()
                self.send_json({"success": True, "mode": mode, "effective_active": is_cab_effective_enabled()})
            else:
                self.send_json({"success": False, "error": "Invalid mode"}, code=400)
            return

        elif path == "/api/routing":
            changed_device = False
            if "device" in req_data:
                dev = str(req_data["device"]).strip()
                set_audio_device(dev)
                changed_device = True

            if "input_channel" in req_data:
                in_chan = str(req_data["input_channel"]).lower()
                if in_chan in ["both", "1", "2"]:
                    set_input_channel(in_chan)

            if "output_channel" in req_data:
                out_chan = str(req_data["output_channel"]).lower()
                if out_chan in ["stereo", "1", "2"]:
                    set_output_channel(out_chan)

            if changed_device:
                restart_jack()
            else:
                apply_jack_routing_live()

            self.send_json({
                "success": True,
                "input_channel": get_input_channel(),
                "output_channel": get_output_channel(),
                "device": get_audio_device()
            })
            return

        elif path == "/api/buffer":
            buf_size = req_data.get("buffer_size")
            try:
                buf_size = int(buf_size)
            except Exception:
                buf_size = None
            if buf_size in [64, 128, 256, 512, 1024]:
                applied = set_buffer_size(buf_size)
                hw_p = get_hardware_audio_params()
                self.send_json({
                    "success": True,
                    "applied_live": applied,
                    "buffer_size": hw_p["buffer_size"],
                    "sample_rate": hw_p["sample_rate"],
                    "latency_ms": hw_p["latency_ms"]
                })
            else:
                self.send_json({"success": False, "error": "Invalid buffer size. Options: 64, 128, 256, 512, 1024"}, code=400)
            return

        elif path == "/api/fx":
            slot = req_data.get("slot")
            if slot in ["drive", "delay", "reverb"]:
                changed_enabled = False
                params = {}
                if "enabled" in req_data:
                    params["enabled"] = bool(req_data["enabled"])
                    changed_enabled = True
                for p in ["drive", "tone", "level", "time", "lfo", "dry_wet", "roomsize", "damp", "model"]:
                    if p in req_data:
                        params[p] = req_data[p]
                new_fx = update_fx_params(slot, params)
                if changed_enabled:
                    apply_jack_routing_live()
                self.send_json({"success": True, "fx": new_fx})
            else:
                self.send_json({"success": False, "error": "Invalid slot. Options: drive, delay, reverb"}, code=400)
            return

        elif path == "/api/gain":
            channel = req_data.get("channel", "in").lower()
            try:
                val = float(req_data.get("value", 0.0))
            except Exception:
                val = 0.0

            sym = "input_level" if "in" in channel else "output_level"
            state_cache[sym] = val
            ok = send_fifo(f"{sym} = {val}")
            self.send_json({"success": ok, "parameter": sym, "value": val})
            return

        elif path == "/api/quality":
            try:
                val = float(req_data.get("value", 1.0))
            except Exception:
                val = 1.0
            val = max(0.0, min(1.0, val))
            state_cache["quality_scale"] = val
            ok = send_fifo(f"quality_scale = {val}")
            self.send_json({"success": ok, "parameter": "quality_scale", "value": val})
            return

        elif path == "/api/tuner/stop":
            stop_tuner()
            self.send_json({"success": True, "active": False})
            return

        elif path == "/api/service":
            action = req_data.get("action", "restart").lower()
            if action == "restart":
                ok = restart_service()
                self.send_json({"success": ok, "action": action})
            else:
                self.send_json({"success": False, "error": "Unsupported action"}, code=400)
            return

        self.send_error(404, "Endpoint not found")


def run_server(host="0.0.0.0", port=8080):
    server = HTTPServer((host, port), JNAMHandler)
    print(f"JNAM Web Controller running at http://{host}:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping JNAM Web Controller...")
        stop_tuner()
        server.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port=port)
