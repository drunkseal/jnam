#!/usr/bin/env bash
# ==============================================================================
# JNAM - Universal Installer for Debian/Ubuntu (apt), Fedora (dnf), Arch (pacman)
# ==============================================================================
set -e

CYAN="\033[96m"
GREEN="\033[92m"
YELLOW="\033[93m"
RED="\033[91m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}======================================================${RESET}"
echo -e "${BOLD}${CYAN}    JNAM - JACK Neural Amp Modeler Installer          ${RESET}"
echo -e "${BOLD}${CYAN}======================================================${RESET}"

if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo).${RESET}"
    exit 1
fi

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(eval echo "~$TARGET_USER")
INSTALL_DIR="/opt/jnam"
DATA_DIR="/var/lib/jnam"

echo -e "Installing for user: ${GREEN}${TARGET_USER}${RESET} (Home: ${TARGET_HOME})"

# ------------------------------------------------------------------------------
# 1. Package Manager Detection & Installation
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}[1/6] Detecting Package Manager & Installing Dependencies...${RESET}"

if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
    echo -e "Detected ${GREEN}Debian/Ubuntu/Armbian (apt)${RESET}"
    apt-get update
    apt-get install -y jackd2 libjack-jackd2-dev gcc make jalv jconvolver aj-snapshot sox python3 curl alsa-utils
elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="dnf"
    echo -e "Detected ${GREEN}Fedora/RHEL/CentOS (dnf)${RESET}"
    dnf install -y jack-audio-connection-kit jack-audio-connection-kit-devel gcc make jalv sox python3 curl alsa-utils
    # Check for jconvolver / aj-snapshot on Fedora
    if ! command -v jconvolver >/dev/null 2>&1; then
        echo -e "${YELLOW}Notice: jconvolver may need to be installed from RPM Fusion or compiled.${RESET}"
    fi
elif command -v pacman >/dev/null 2>&1; then
    PKG_MGR="pacman"
    echo -e "Detected ${GREEN}Arch Linux/Manjaro (pacman)${RESET}"
    pacman -Sy --noconfirm jack2 gcc make jalv sox python curl alsa-utils
    if ! command -v jconvolver >/dev/null 2>&1; then
        echo -e "${YELLOW}Notice: jconvolver and aj-snapshot can be installed via AUR (e.g. yay -S jconvolver aj-snapshot).${RESET}"
    fi
else
    echo -e "${RED}Unknown package manager. Please ensure jack2, jalv, jconvolver, and sox are installed.${RESET}"
fi

# ------------------------------------------------------------------------------
# 2. Configure Real-Time Audio Permissions
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}[2/6] Configuring Real-Time Audio Priorities...${RESET}"

# Create audio group if needed
groupadd -f audio
groupadd -f realtime 2>/dev/null || true

usermod -a -G audio "$TARGET_USER" 2>/dev/null || true
if getent group realtime >/dev/null; then
    usermod -a -G realtime "$TARGET_USER" 2>/dev/null || true
fi

cat << 'EOF' > /etc/security/limits.d/99-realtime-audio.conf
@audio   - rtprio     95
@audio   - memlock    unlimited
@audio   - nice      -19
@realtime - rtprio    95
@realtime - memlock   unlimited
@realtime - nice     -19
EOF

echo -e "${GREEN}Audio group & RT limits configured (RTPRIO=95, memlock=unlimited).${RESET}"

# ------------------------------------------------------------------------------
# 3. Deploy JNAM Files to /opt/jnam
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}[3/6] Deploying JNAM Application Files to ${INSTALL_DIR}...${RESET}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "${INSTALL_DIR}"
cp -r "${SCRIPT_DIR}/bin" "${INSTALL_DIR}/"
cp -r "${SCRIPT_DIR}/scripts" "${INSTALL_DIR}/"
cp -r "${SCRIPT_DIR}/web" "${INSTALL_DIR}/"
cp -r "${SCRIPT_DIR}/systemd" "${INSTALL_DIR}/"
[ -d "${SCRIPT_DIR}/src" ] && cp -r "${SCRIPT_DIR}/src" "${INSTALL_DIR}/"
[ -f "${SCRIPT_DIR}/Makefile" ] && cp "${SCRIPT_DIR}/Makefile" "${INSTALL_DIR}/"

# Build tuner if source is present
if [ -f "${INSTALL_DIR}/src/tuner.c" ]; then
    echo -e "Compiling real-time tuner..."
    gcc -O2 "${INSTALL_DIR}/src/tuner.c" -o "${INSTALL_DIR}/bin/jnam-tuner" -ljack -lm || {
        echo -e "${YELLOW}Warning: Failed to compile tuner binary. Continuing...${RESET}"
    }
fi

chmod +x "${INSTALL_DIR}/bin/jnam"
[ -f "${INSTALL_DIR}/bin/jnam-tuner" ] && chmod +x "${INSTALL_DIR}/bin/jnam-tuner"
chmod +x "${INSTALL_DIR}/scripts/"*.sh
chmod +x "${INSTALL_DIR}/web/server.py"

# Symlink global CLI binary
ln -sf "${INSTALL_DIR}/bin/jnam" /usr/local/bin/jnam
if [ -f "${INSTALL_DIR}/bin/jnam-tuner" ]; then
    ln -sf "${INSTALL_DIR}/bin/jnam-tuner" /usr/local/bin/jnam-tuner
fi

# ------------------------------------------------------------------------------
# 4. Set up Data Directories (/var/lib/jnam and user symlinks)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}[4/6] Setting up Model & Cab IR storage...${RESET}"

mkdir -p "${DATA_DIR}/models" "${DATA_DIR}/irs"

# If user already has ~/nam, link it
if [ -d "${TARGET_HOME}/nam" ]; then
    echo -e "Found existing ${TARGET_HOME}/nam - syncing with ${DATA_DIR}..."
    cp -rn "${TARGET_HOME}/nam/models/"* "${DATA_DIR}/models/" 2>/dev/null || true
    cp -rn "${TARGET_HOME}/nam/irs/"* "${DATA_DIR}/irs/" 2>/dev/null || true
fi

# Ensure user ~/nam points to or mirrors data dir
mkdir -p "${TARGET_HOME}/nam"
chown -R "${TARGET_USER}:audio" "${DATA_DIR}" "${TARGET_HOME}/nam"

# ------------------------------------------------------------------------------
# 5. Check Neural Amp Modeler LV2 Plugin
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}[5/6] Checking Neural Amp Modeler LV2 Plugin...${RESET}"

LV2_SYSTEM_DIR="/usr/lib/lv2/neural_amp_modeler.lv2"
LV2_USER_DIR="${TARGET_HOME}/.lv2/neural_amp_modeler.lv2"

if [ ! -d "$LV2_SYSTEM_DIR" ] && [ ! -d "$LV2_USER_DIR" ]; then
    echo -e "${YELLOW}NAM LV2 plugin not found in standard paths.${RESET}"
    echo -e "You can install precompiled neural-amp-modeler-lv2 into ${TARGET_HOME}/.lv2/"
    echo -e "or clone https://github.com/mikeoliphant/neural-amp-modeler-lv2 and build it."
else
    echo -e "${GREEN}Neural Amp Modeler LV2 plugin detected.${RESET}"
fi

# ------------------------------------------------------------------------------
# 6. Install & Start Systemd Services
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}[6/6] Installing Systemd Services...${RESET}"

cp "${INSTALL_DIR}/systemd/"*.service /etc/systemd/system/
systemctl daemon-reload

systemctl enable jnam-jack.service
systemctl enable jnam.service
systemctl enable jnam-web.service

systemctl restart jnam-jack.service
sleep 1
systemctl restart jnam.service
systemctl restart jnam-web.service

echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
echo -e "${BOLD}${GREEN}        JNAM Installation Completed Successfully!     ${RESET}"
echo -e "${BOLD}${GREEN}======================================================${RESET}"
echo -e "  CLI Tool:      ${CYAN}jnam status${RESET} (or ${CYAN}jnam --help${RESET})"
echo -e "  Web Interface: ${CYAN}http://localhost:8080/${RESET} or ${CYAN}http://$(hostname -I | awk '{print $1}'):8080/${RESET}"
echo -e "  Data Folder:   ${CYAN}${DATA_DIR}${RESET} (Models & IRs)"
echo -e ""
