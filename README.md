# JNAM (JACK Neural Amp Modeler)

JNAM turns any Linux SBC (Orange Pi, Raspberry Pi, Radxa) or PC into a dedicated real-time guitar amplifier and cabinet processor using JACK2, LV2, and zero-latency convolution.

## Features

- **Sub-3ms Real-Time Latency**: Tuned for 128 samples at 48kHz on PREEMPT_RT or lowlatency kernels.
- **Web Controller UI**: Modern browser interface to switch models, toggle cab bypass, select audio devices, route channels, tweak gain, and change quality from a phone or tablet.
- **Built-in Real-Time Guitar Tuner**:
  - Embedded high-precision chromatic tuner using the YIN pitch-detection algorithm.
  - Real-time SSE (Server-Sent Events) streaming from JACK with needle & cent meter.
  - **Silent Tuning**: Automatically mutes master audio output and pauses NAM processing while tuning.
- **Audio Device & Channel Selection**:
  - Dynamically detect and switch ALSA soundcards (e.g. Focusrite Scarlett, Behringer, USB audio).
  - Select Input routing: **Both (Summed)**, **Input 1 (Mic)**, or **Input 2 (Guitar)**.
  - Select Output routing: **Stereo (1+2)**, **Left Only (1)**, or **Right Only (2)**.
- **Smart Cab Auto-Bypass**: Inspects model metadata (`amp_cab` vs `amp`) and bypasses cabinet IRs when physical cabs/mics are already modeled, preventing muffled double-cabbing.
- **Universal Multi-Distro Installer**: Supports `apt` (Debian/Ubuntu/Armbian), `dnf` (Fedora), and `pacman` (Arch/Manjaro).
- **Lightweight Headless Architecture**: No bulky GUI host overhead; runs headless using `jalv` and `jconvolver`.

## Quick Start

```bash
git clone git@github.com:drunkseal/jnam.git
cd jnam
sudo ./install.sh
```

Once installed, open `http://<ip-of-device>:8080` in your web browser.

## CLI Usage

```bash
jnam status                 # View active model, cab status, hardware, and routing
jnam list                   # List available models and IRs
jnam device [hw:X|auto]     # View or select active ALSA audio device
jnam channel in [both|1|2]  # Route Input: Both (1+2), Input 1 (Mic), or Input 2 (Guitar)
jnam channel out [stereo|1|2]# Route Output: Stereo (1+2), Left (1), or Right (2)
jnam model <name|index>     # Switch active amp model
jnam ir <name|index>        # Switch cabinet IR
jnam cab auto               # Auto-detect cab bypass based on model
jnam cab on                 # Force cabinet IR on
jnam cab off                # Force bypass cabinet IR
jnam gain in 3.0            # Adjust input gain in dB
jnam gain out -2.0          # Adjust output gain in dB
jnam quality 1.0            # Set A2 model quality scale (0.0 to 1.0)
jnam restart                # Restart the audio pipeline
```

## License

MIT License. See LICENSE for details.
