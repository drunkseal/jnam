# JNAM (JACK Neural Amp Modeler)

JNAM turns any Linux SBC (Orange Pi, Raspberry Pi, Radxa) or PC into a dedicated real-time guitar amplifier and cabinet processor using JACK2, LV2, and zero-latency convolution.

## Features

- **Sub-3ms Real-Time Latency**: Tuned for 128 samples at 48kHz on PREEMPT_RT or lowlatency kernels.
- **Web Controller UI**: Modern browser interface to switch models, toggle cab bypass, tweak gain, and change quality from a phone or tablet.
- **Smart Cab Auto-Bypass**: Inspects model metadata (`amp_cab` vs `amp`) and bypasses cabinet IRs when physical cabs/mics are already modeled, preventing muffled double-cabbing.
- **Universal Multi-Distro Installer**: Supports `apt` (Debian/Ubuntu/Armbian), `dnf` (Fedora), and `pacman` (Arch/Manjaro).
- **Lightweight Architecture**: No bulky GUI host overhead; runs headless using `jalv` and `jconvolver`.
- **Automatic Audio Hardware Detection**: Detects USB class-compliant interfaces (Focusrite, Behringer, MOTU) on startup.

## Quick Start

```bash
git clone git@github.com:drunkseal/jnam.git
cd jnam
sudo ./install.sh
```

Once installed, open `http://<ip-of-device>:8080` in your web browser.

## CLI Usage

```bash
jnam status               # View active model, cab status, and JACK routing
jnam list                 # List available models and IRs
jnam model <name|index>   # Switch active amp model
jnam ir <name|index>      # Switch cabinet IR
jnam cab auto             # Auto-detect cab bypass based on model
jnam cab on               # Force cabinet IR on
jnam cab off              # Force bypass cabinet IR
jnam gain in 3.0          # Adjust input gain in dB
jnam gain out -2.0        # Adjust output gain in dB
jnam quality 1.0          # Set A2 model quality scale (0.0 to 1.0)
jnam restart              # Restart the audio pipeline
```

## License

MIT License. See LICENSE for details.
