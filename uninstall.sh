#!/usr/bin/env bash
# ==============================================================================
# JNAM - Uninstaller
# ==============================================================================
set -e

CYAN="\033[96m"
GREEN="\033[92m"
RED="\033[91m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e "${BOLD}${RED}Uninstalling JNAM...${RESET}"

if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: Must be run as root (use sudo).${RESET}"
    exit 1
fi

systemctl stop jnam-web.service 2>/dev/null || true
systemctl stop jnam.service 2>/dev/null || true
systemctl stop jnam-jack.service 2>/dev/null || true

systemctl disable jnam-web.service 2>/dev/null || true
systemctl disable jnam.service 2>/dev/null || true
systemctl disable jnam-jack.service 2>/dev/null || true

rm -f /etc/systemd/system/jnam*.service
systemctl daemon-reload

rm -f /usr/local/bin/jnam
rm -rf /opt/jnam

echo -e "${GREEN}JNAM removed successfully.${RESET}"
echo -e "Note: Your models and IRs in /var/lib/jnam and ~/nam were preserved."
