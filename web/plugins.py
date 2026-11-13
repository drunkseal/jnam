#!/usr/bin/env python3
"""
JNAM Modular Plugin Catalog & Metadata Scanner
Discovers, parses, and categorizes installed LV2 audio plugins using lv2ls and lv2info.
"""

import os
import re
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor

FEATURED_PLUGINS = [
    # --- Distortions & Drives ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gxts9#ts9sim",
        "name": "GxTubeScreamer",
        "tagline": "Classic TS-9 Tube Screamer Overdrive",
        "category": "distortion",
        "color": "#10b981", # Green
        "icon": "ts9"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_bossds1_#_bossds1_",
        "name": "GxBoss DS-1",
        "tagline": "Iconic Orange Hard-Clipping Distortion",
        "category": "distortion",
        "color": "#f97316", # Orange
        "icon": "ds1"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_muff_#_muff_",
        "name": "GxMuff",
        "tagline": "Electro-Harmonix Big Muff Pi Fuzz Sustainer",
        "category": "distortion",
        "color": "#a855f7", # Purple
        "icon": "muff"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_fuzzface_#_fuzzface_",
        "name": "GxFuzzFace",
        "tagline": "Vintage Germanium Transistor Fuzz",
        "category": "distortion",
        "color": "#ec4899", # Pink
        "icon": "fuzz"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_mxrdist_#_mxrdist_",
        "name": "GxMXR Distortion+",
        "tagline": "70s Classic Germanium Distortion / Overdrive",
        "category": "distortion",
        "color": "#eab308", # Yellow
        "icon": "mxr"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gxbooster#booster",
        "name": "GxBooster",
        "tagline": "Clean Signal Boost & Treble Enhancer",
        "category": "distortion",
        "color": "#06b6d4", # Cyan
        "icon": "boost"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_rangem_#_rangem_",
        "name": "GxRangemaster",
        "tagline": "Dallas Rangemaster Treble Booster",
        "category": "distortion",
        "color": "#84cc16", # Lime
        "icon": "boost"
    },

    # --- Modulations ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_chorus_stereo#_chorus_stereo",
        "name": "GxChorus-Stereo",
        "tagline": "Lush Analog Stereo Chorus with Depth & Rate",
        "category": "modulation",
        "color": "#3b82f6", # Blue
        "icon": "chorus"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_flanger#_flanger",
        "name": "GxFlanger",
        "tagline": "Jet Plane Comb-Filtered Sweep Flanger",
        "category": "modulation",
        "color": "#6366f1", # Indigo
        "icon": "flanger"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_phaser#_phaser",
        "name": "GxPhaser",
        "tagline": "4-Stage Analog Optical Phase Shifter",
        "category": "modulation",
        "color": "#8b5cf6", # Violet
        "icon": "phaser"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_tremolo#_tremolo",
        "name": "GxTremolo",
        "tagline": "Vintage Amp Optical Amplitude Pulsing Tremolo",
        "category": "modulation",
        "color": "#14b8a6", # Teal
        "icon": "tremolo"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gxtubevibrato#tubevibrato",
        "name": "GxTubeVibrato",
        "tagline": "True Pitch Modulation Vibrato",
        "category": "modulation",
        "color": "#0ea5e9", # Sky Blue
        "icon": "vibrato"
    },

    # --- Delays ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_delay_stereo#_delay_stereo",
        "name": "GxDelay-Stereo",
        "tagline": "Stereo Delay with Modulation LFO & Pan",
        "category": "delay",
        "color": "#00e5ff", # Bright Neon Cyan
        "icon": "delay"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gxtape_st#tape",
        "name": "GxTapeDelay",
        "tagline": "Warm Tape Saturation & Flutter Echo",
        "category": "delay",
        "color": "#d97706", # Amber
        "icon": "tape"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gxechocat#echocat",
        "name": "GxEchocat",
        "tagline": "Multi-Head Binson/Echoplex Vintage Echo",
        "category": "delay",
        "color": "#f59e0b", # Gold
        "icon": "echo"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_digital_delay_st_#_digital_delay_st_",
        "name": "GxDigitalDelay",
        "tagline": "Pristine Studio Stereo Digital Delay",
        "category": "delay",
        "color": "#38bdf8", # Light Blue
        "icon": "delay"
    },

    # --- Reverbs ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_reverb_stereo#_reverb_stereo",
        "name": "GxReverb-Stereo",
        "tagline": "Studio Plate & Acoustic Room Reverb",
        "category": "reverb",
        "color": "#2dd4bf", # Turquoise
        "icon": "reverb"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_zita_rev1_stereo#_zita_rev1_stereo",
        "name": "GxZita-Rev1",
        "tagline": "Pristine Algorithmic Studio Hall Reverb",
        "category": "reverb",
        "color": "#22c55e", # Emerald
        "icon": "reverb"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_shimmizita_#_shimmizita_",
        "name": "GxShimmizita",
        "tagline": "Ambient Shimmer Reverb with Pitch Shifter",
        "category": "reverb",
        "color": "#c084fc", # Lavender
        "icon": "shimmer"
    },

    # --- Dynamics & Gates ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_compressor#_compressor",
        "name": "GxCompressor",
        "tagline": "Studio Leveler & Guitar Sustain Compressor",
        "category": "dynamics",
        "color": "#ef4444", # Red
        "icon": "comp"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_expander#_expander",
        "name": "GxNoiseGate",
        "tagline": "Fast Attack Downward Noise Expander & Gate",
        "category": "dynamics",
        "color": "#f43f5e", # Rose
        "icon": "gate"
    },

    # --- Pitch & Octave ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_oc_2_#_oc_2_",
        "name": "GxOC-2 Octaver",
        "tagline": "Boss OC-2 Dual Sub-Octave Down Divider",
        "category": "pitch",
        "color": "#7c3aed", # Violet
        "icon": "octave"
    },

    # --- Filters & EQ ---
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gxautowah#autowah",
        "name": "GxAutoWah",
        "tagline": "Dynamic Envelope Follower Funk Wah",
        "category": "filter",
        "color": "#f97316", # Orange
        "icon": "wah"
    },
    {
        "uri": "http://guitarix.sourceforge.net/plugins/gx_graphiceq_#_graphiceq_",
        "name": "GxGraphicEQ",
        "tagline": "10-Band Precision Graphic Tone Sculpting EQ",
        "category": "filter",
        "color": "#64748b", # Slate
        "icon": "eq"
    }
]

def parse_single_lv2info(uri):
    try:
        info_txt = subprocess.check_output(["lv2info", uri], stderr=subprocess.DEVNULL, timeout=2.0).decode("utf-8", errors="ignore")
    except Exception:
        return None

    p = {
        "uri": uri,
        "name": uri,
        "category": "utility",
        "class": "",
        "author": "",
        "audio_in": [],
        "audio_out": [],
        "is_stereo": False,
        "controls": [],
        "ports": []
    }

    lines = info_txt.splitlines()
    curr_port = None
    for line in lines:
        if line.startswith("\tName:"):
            p["name"] = line.split(":", 1)[1].strip()
        elif line.startswith("\tClass:"):
            p["class"] = line.split(":", 1)[1].strip()
        elif line.startswith("\tAuthor:"):
            p["author"] = line.split(":", 1)[1].strip()
        elif re.match(r"^\tPort \d+:", line):
            if curr_port:
                p["ports"].append(curr_port)
            curr_port = {
                "type": [],
                "symbol": "",
                "name": "",
                "min": 0.0,
                "max": 1.0,
                "default": 0.0,
                "is_toggle": False,
                "is_integer": False
            }
        elif curr_port is not None:
            s = line.strip()
            if s.startswith("Type:") or s.startswith("http://"):
                curr_port["type"].append(s.replace("Type:", "").strip())
            elif s.startswith("Symbol:"):
                curr_port["symbol"] = s.split(":", 1)[1].strip()
            elif s.startswith("Name:"):
                curr_port["name"] = s.split(":", 1)[1].strip()
            elif s.startswith("Minimum:"):
                try: curr_port["min"] = float(s.split(":", 1)[1].strip())
                except Exception: pass
            elif s.startswith("Maximum:"):
                try: curr_port["max"] = float(s.split(":", 1)[1].strip())
                except Exception: pass
            elif s.startswith("Default:"):
                try: curr_port["default"] = float(s.split(":", 1)[1].strip())
                except Exception: pass
            elif "toggled" in s:
                curr_port["is_toggle"] = True
            elif "integer" in s:
                curr_port["is_integer"] = True

    if curr_port:
        p["ports"].append(curr_port)

    ports = p.pop("ports", [])
    audio_in = [prt["symbol"] for prt in ports if any("AudioPort" in t for t in prt["type"]) and any("InputPort" in t for t in prt["type"])]
    audio_out = [prt["symbol"] for prt in ports if any("AudioPort" in t for t in prt["type"]) and any("OutputPort" in t for t in prt["type"])]

    # Must be an audio processor
    if not audio_in or not audio_out:
        return None

    # Exclude NAM amp itself from pedalboard catalog (NAM is hosted in main amp slot)
    if "neural-amp-modeler" in uri or "neural_amp_modeler" in uri:
        return None

    controls = []
    for prt in ports:
        if any("ControlPort" in t for t in prt["type"]) and any("InputPort" in t for t in prt["type"]):
            # Ignore standard bypass port (bypass handled via routing or explicit toggle)
            if prt["symbol"] in ["BYPASS", "bypass"]:
                continue
            controls.append({
                "symbol": prt["symbol"],
                "name": prt["name"],
                "min": prt["min"],
                "max": prt["max"],
                "default": prt["default"],
                "is_toggle": prt["is_toggle"],
                "is_integer": prt["is_integer"]
            })

    p["audio_in"] = audio_in
    p["audio_out"] = audio_out
    p["is_stereo"] = len(audio_out) > 1
    p["controls"] = controls

    # Categorize
    name_lower = p["name"].lower()
    class_lower = p["class"].lower()
    uri_lower = uri.lower()

    if any(w in name_lower or w in class_lower or w in uri_lower for w in ["fuzz", "distortion", "overdrive", "scream", "ds1", "muff", "boost", "drive", "clipper"]) and "delay" not in name_lower:
        p["category"] = "distortion"
    elif any(w in name_lower or w in class_lower or w in uri_lower for w in ["chorus", "flanger", "phaser", "tremolo", "vibrato", "leslie", "detune"]) and "reverb" not in name_lower:
        p["category"] = "modulation"
    elif any(w in name_lower or w in class_lower or w in uri_lower for w in ["delay", "echo"]) and "reverb" not in name_lower:
        p["category"] = "delay"
    elif any(w in name_lower or w in class_lower or w in uri_lower for w in ["reverb", "room", "ambience", "zita", "plate", "gverb"]):
        p["category"] = "reverb"
    elif any(w in name_lower or w in class_lower or w in uri_lower for w in ["compressor", "expander", "gate", "limiter", "dynamics", "de-ess"]):
        p["category"] = "dynamics"
    elif any(w in name_lower or w in class_lower or w in uri_lower for w in ["wah", "filter", "eq", "tone", "graphiceq", "bandpass", "lowpass", "highpass"]):
        p["category"] = "filter"
    elif any(w in name_lower or w in class_lower or w in uri_lower for w in ["pitch", "octav", "ringmod", "shifter", "subsynth"]):
        p["category"] = "pitch"
    else:
        p["category"] = "utility"

    return p

def scan_all_installed_plugins():
    try:
        out = subprocess.check_output(["lv2ls"], timeout=3.0).decode("utf-8")
        uris = [line.strip() for line in out.strip().splitlines() if line.strip()]
    except Exception:
        uris = []

    catalog = []
    # Use thread pool to scan quickly in parallel
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = executor.map(parse_single_lv2info, uris)
        for res in results:
            if res:
                catalog.append(res)

    # Sort catalog: Guitarix and featured plugins first, then alphabetical by name
    def sort_key(p):
        is_featured = any(f["uri"] == p["uri"] for f in FEATURED_PLUGINS)
        is_gx = "guitarix" in p["uri"]
        return (not is_featured, not is_gx, p["name"].lower())

    catalog.sort(key=sort_key)
    return catalog

def get_plugins_catalog(cache_path=None):
    if cache_path is None:
        nam_dir = os.environ.get("JNAM_DIR", os.path.expanduser("~/nam"))
        cache_path = os.path.join(nam_dir, "plugins_cache.json")

    if cache_path and os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                cached = json.load(f)
                if isinstance(cached, list) and len(cached) > 0:
                    return {
                        "featured": FEATURED_PLUGINS,
                        "plugins": cached
                    }
        except Exception:
            pass

    catalog = scan_all_installed_plugins()
    if cache_path and len(catalog) > 0:
        try:
            os.makedirs(os.path.dirname(os.path.realpath(cache_path)), exist_ok=True)
            with open(cache_path, "w") as f:
                json.dump(catalog, f, indent=2)
        except Exception:
            pass

    return {
        "featured": FEATURED_PLUGINS,
        "plugins": catalog
    }
