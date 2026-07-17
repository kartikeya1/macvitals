#!/usr/bin/env bash
#
# macvitals.sh
# =========================
# A comprehensive, READ-ONLY health inspection for evaluating a used
# Apple Silicon (or Intel) MacBook — or checking your own.
#
# Design guarantees:
#   * Read-only. It never changes settings, never installs anything, and
#     writes ONLY inside its own timestamped output directory.
#   * No internet required. Every command is a local macOS utility.
#   * No sudo required for the core report. A clearly separated OPTIONAL
#     section collects a few extra diagnostics *only* if you run with
#     --with-sudo (and even then, every command remains read-only).
#   * Graceful degradation. Missing/blocked commands are noted, never fatal.
#   * No fabricated values. If a value can't be read, the report says so.
#
# Compatibility:
#   * Runs on ANY modern Mac — both Apple Silicon (M1/M2/M3/M4) and Intel.
#     It is generic: it reads whatever machine it runs on, so it must be run
#     ON the machine you want to inspect (not on a different Mac).
#   * Apple-Silicon-only details self-skip on Intel (and vice-versa) with a
#     clear note — the run never fails because of the CPU family.
#   * macOS ONLY. It refuses to run on Windows/Linux (guarded via `uname`).
#   * If the file was downloaded from the internet, running it as
#     `bash macvitals.sh` avoids the "unidentified developer" prompt.
#
# Output:
#   A folder  MacVitals_Report_<timestamp>/  containing one file per topic,
#   plus raw machine-readable JSON dumps under raw/, plus a curated
#   summary.json. The folder is then compressed to MacVitals_Report_<ts>.zip.
#
# Usage:
#   bash macvitals.sh                 # core report, saved in the current folder
#   bash macvitals.sh ~/Desktop       # choose where the report folder is saved
#   bash macvitals.sh --with-sudo     # + optional elevated (still read-only) scan
#
# The script intentionally favors completeness, robustness and clarity
# over brevity.

# We deliberately do NOT use `set -e`: many diagnostic commands legitimately
# exit non-zero (feature absent, hardware not present, permission denied) and
# that must not abort the whole run. Each command's status is handled locally.
set -u
set -o pipefail

MV_VERSION="1.0.0"

# ----------------------------------------------------------------------------
# 0. Argument parsing and environment
# ----------------------------------------------------------------------------

WITH_SUDO=0          # collect the optional sudo-gated diagnostics?
BASE_DIR="$(pwd)"    # where the report folder will be created

for arg in "$@"; do
  case "$arg" in
    --with-sudo) WITH_SUDO=1 ;;
    -v|--version)
      echo "MacVitals ${MV_VERSION}"
      exit 0
      ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed -E 's/^# ?//'
      exit 0
      ;;
    *)
      # Any non-flag argument is treated as the output base directory.
      if [ -d "$arg" ]; then
        BASE_DIR="$arg"
      else
        echo "Warning: '$arg' is not a directory; using current directory." >&2
      fi
      ;;
  esac
done

# Guard: this script only makes sense on macOS.
if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: MacVitals runs on macOS only (uname reports $(uname -s))." >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# 0b. Presentation layer — colors, banner, and an animated step spinner.
#     Everything here is cosmetic; it degrades cleanly to plain text when the
#     output isn't a terminal (piped/redirected) or NO_COLOR is set.
# ----------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  BLUE=$'\033[34m'; MAGENTA=$'\033[35m'; CYAN=$'\033[36m'
  UI=1
else
  BOLD=; DIM=; RESET=; RED=; GREEN=; YELLOW=; BLUE=; MAGENTA=; CYAN=; UI=0
fi

SPIN=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)

banner() {
  printf '\n'
  printf '   %s%s╱╲%s          %s%s╱╲%s\n'                  "$BOLD" "$CYAN" "$RESET" "$BOLD" "$CYAN" "$RESET"
  printf '  %s%s╱  ╲────╱╲────╱  ╲───%s   %s%sMacVitals%s %s v%s%s\n' "$BOLD" "$CYAN" "$RESET" "$BOLD" "$MAGENTA" "$RESET" "$DIM" "$MV_VERSION" "$RESET"
  printf '  %s%s        ╲╱%s            %sMac health, in plain English%s\n' "$BOLD" "$CYAN" "$RESET" "$DIM" "$RESET"
  printf '\n'
  printf '  %s●%s Private   %s●%s No changes   %s●%s Nothing installed   %s●%s ~1 minute\n' \
         "$GREEN" "$RESET" "$GREEN" "$RESET" "$GREEN" "$RESET" "$GREEN" "$RESET"
  printf '\n'
}

intro() {
  printf '  %sWhat happens now%s  MacVitals reads this Mac — battery, SSD, security,\n' "$BOLD" "$RESET"
  printf '  thermal, connectivity and system logs — and writes a shareable report.\n'
  printf '  %sIt makes zero changes to your machine and installs nothing.%s\n\n' "$DIM" "$RESET"
  printf '  %sSaving report to%s  %s%s%s\n' "$BOLD" "$RESET" "$CYAN" "$OUTDIR" "$RESET"
  if [ "$WITH_SUDO" -eq 1 ]; then
    printf '  %sMode%s  deep scan (--with-sudo) — you may be asked for your password.\n' "$BOLD" "$RESET"
  fi
  printf '\n'
}

# step "<label>" <function>  -> run a section with a live spinner + tick.
STEP_I=0
STEP_TOTAL=15
step() {
  local label="$1" fn="$2" tag
  STEP_I=$((STEP_I + 1))
  tag="$(printf '%s[%2d/%2d]%s' "$DIM" "$STEP_I" "$STEP_TOTAL" "$RESET")"
  if [ "$UI" -eq 1 ]; then
    "$fn" &
    local pid=$! i=0 n=${#SPIN[@]}
    while kill -0 "$pid" 2>/dev/null; do
      printf '\r  %s%s%s %s %s\033[K' "$CYAN" "${SPIN[$i]}" "$RESET" "$tag" "$label"
      i=$(((i + 1) % n))
      sleep 0.08
    done
    wait "$pid"
    printf '\r  %s✓%s %s %s\033[K\n' "$GREEN" "$RESET" "$tag" "$label"
  else
    printf '  [%d/%d] %s\n' "$STEP_I" "$STEP_TOTAL" "$label"
    "$fn"
  fi
}

# ----------------------------------------------------------------------------
# 0c. Create the output directory.
# ----------------------------------------------------------------------------
TS="$(date +%Y%m%d_%H%M%S)"
OUTDIR="${BASE_DIR%/}/MacVitals_Report_${TS}"
RAWDIR="${OUTDIR}/raw"
mkdir -p "$RAWDIR" || { echo "Error: cannot create $OUTDIR" >&2; exit 1; }

# ----------------------------------------------------------------------------
# 1. Helper functions
# ----------------------------------------------------------------------------

# have <binary>  -> success if the binary is callable (name in PATH or abs path)
have() {
  command -v "$1" >/dev/null 2>&1 || [ -x "$1" ]
}

# json_escape <string> -> escapes a value for safe inclusion in JSON.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"   # backslash first
  s="${s//\"/\\\"}"   # double quote
  s="${s//$'\t'/\\t}" # tab
  s="${s//$'\r'/}"    # strip CR
  s="${s//$'\n'/\\n}" # newline
  printf '%s' "$s"
}

# record <file> <title> <command-string>
#   Runs <command-string> through bash, appending a titled section with the
#   command line and its combined stdout/stderr. If the leading binary is not
#   available, records a clear "[skipped]" note instead of failing.
record() {
  local file="$1" title="$2" cmd="$3"
  local probe="$cmd"
  probe="${probe#sudo -n }"
  probe="${probe#sudo }"
  local bin="${probe%% *}"
  {
    printf '\n===== %s =====\n' "$title"
    printf '$ %s\n' "$cmd"
    if ! have "$bin"; then
      printf '[skipped: "%s" is not available on this system]\n' "$bin"
    else
      bash -c "$cmd" 2>&1
      local rc=$?
      if [ "$rc" -ne 0 ]; then
        printf '[note: "%s" exited with status %d — may be unsupported here or need elevated rights]\n' "$bin" "$rc"
      fi
    fi
  } >> "$file"
}

# record_sudo <file> <title> <command-string-without-sudo>
#   Same as record() but only runs when --with-sudo was given. Otherwise notes.
record_sudo() {
  local file="$1" title="$2" cmd="$3"
  if [ "$WITH_SUDO" -ne 1 ]; then
    {
      printf '\n===== %s =====\n' "$title"
      printf '$ sudo %s\n' "$cmd"
      printf '[skipped: re-run with --with-sudo to collect this elevated, read-only diagnostic]\n'
    } >> "$file"
    return
  fi
  record "$file" "$title" "sudo $cmd"
}

# file_header <file> <human title>
file_header() {
  local file="$1" title="$2"
  {
    printf '################################################################\n'
    printf '# %s\n' "$title"
    printf '# Host: %s\n' "$(scutil --get ComputerName 2>/dev/null || hostname)"
    printf '# Generated: %s\n' "$(date)"
    printf '# Tool: macvitals.sh (read-only)\n'
    printf '################################################################\n'
  } > "$file"
}

# sp_json <DataType>  -> dump a system_profiler section as JSON into raw/
sp_json() {
  local dt="$1"
  if have system_profiler; then
    system_profiler -json "$dt" > "${RAWDIR}/${dt}.json" 2>/dev/null || true
  fi
}

# jval <jsonfile> <keypath>  -> print a scalar value from JSON, or empty.
# Uses plutil (ships with macOS). Only emits output when plutil succeeded (rc 0),
# so we never fabricate a value out of an "invalid key path" error message.
jval() {
  local f="$1" key="$2" out
  [ -f "$f" ] || return 0
  if out="$(plutil -extract "$key" raw -o - "$f" 2>/dev/null)"; then
    printf '%s' "$out"
  fi
}

# ioreg_val <class> <key>  -> first scalar value of "key" in an ioreg object.
ioreg_val() {
  local cls="$1" key="$2"
  have ioreg || return 0
  ioreg -r -c "$cls" 2>/dev/null \
    | awk -F'= ' -v k="\"$key\"" '$1 ~ k {gsub(/^[ \t]+/,"",$2); print $2; exit}'
}

# ----------------------------------------------------------------------------
# 2. Collection sections (each is a function so the driver can show progress)
# ----------------------------------------------------------------------------

# Pre-dump raw system_profiler JSON — feeds both the text reports and summary.
sec_prep() {
  local dt
  for dt in SPHardwareDataType SPPowerDataType SPStorageDataType SPNVMeDataType \
            SPDisplaysDataType SPMemoryDataType SPSoftwareDataType \
            SPConfigurationProfileDataType SPAirPortDataType SPBluetoothDataType \
            SPThunderboltDataType SPUSBDataType SPAudioDataType SPCameraDataType \
            SPNetworkDataType SPiBridgeDataType; do
    sp_json "$dt"
  done
}

sec_hardware() {
  local F="${OUTDIR}/hardware.txt"
  file_header "$F" "HARDWARE OVERVIEW"
  record "$F" "Hardware overview (system_profiler)"        "system_profiler SPHardwareDataType"
  record "$F" "Platform expert device (serial/UUID/board)" "ioreg -rd1 -c IOPlatformExpertDevice"
  record "$F" "Model identifier"                           "sysctl -n hw.model"
  record "$F" "Chip / CPU brand"                           "sysctl -n machdep.cpu.brand_string"
  record "$F" "CPU core counts"                            "sysctl -n hw.physicalcpu hw.logicalcpu hw.ncpu"
  record "$F" "CPU performance/efficiency core split"      "sysctl -n hw.perflevel0.physicalcpu hw.perflevel1.physicalcpu 2>/dev/null || echo 'perflevel keys not present (Intel Mac)'"
  record "$F" "Physical memory (bytes)"                    "sysctl -n hw.memsize"
  record "$F" "Board id / device tree"                     "ioreg -l | grep -iE 'board-id|target-type|product-name|model' | head -n 40"
  record "$F" "Firmware / Boot ROM (NVRAM readout)"        "nvram -p | grep -iE 'boot|firmware|version' || echo 'no matching nvram keys'"
}

sec_battery() {
  local F="${OUTDIR}/battery.txt"
  file_header "$F" "BATTERY & POWER"
  record "$F" "Power / battery (system_profiler)"          "system_profiler SPPowerDataType"
  record "$F" "AppleSmartBattery (raw hardware registers)" "ioreg -r -c AppleSmartBattery"
  record "$F" "Battery summary"                            "pmset -g batt"
  record "$F" "Power management settings"                  "pmset -g"
  record "$F" "Custom power settings"                      "pmset -g custom"
  record "$F" "AC / battery adapter details"               "pmset -g ac; pmset -g adapter 2>/dev/null || system_profiler SPPowerDataType | grep -A12 -i 'AC Charger'"
  record "$F" "Thermal / CPU speed-limit state"            "pmset -g therm"
  record "$F" "Assertions holding power state"             "pmset -g assertions"
}

sec_storage() {
  local F="${OUTDIR}/storage.txt"
  file_header "$F" "STORAGE / SSD"
  record "$F" "NVMe controller & SMART status"             "system_profiler SPNVMeDataType"
  record "$F" "SATA/other storage (if any)"                "system_profiler SPStorageDataType"
  record "$F" "Disk list (all disks & partitions)"         "diskutil list"
  record "$F" "APFS container layout"                      "diskutil apfs list"
  record "$F" "Physical disk info (disk0)"                 "diskutil info disk0"
  record "$F" "TRIM support"                               "system_profiler SPNVMeDataType | grep -i 'TRIM' || diskutil info disk0 | grep -i 'TRIM' || echo 'TRIM field not reported'"
  record "$F" "Filesystem usage"                           "df -h"
  record "$F" "Inode usage"                                "df -i"
  record "$F" "SMART capability (smartctl, if installed)"  "smartctl -a disk0"
}

sec_display() {
  local F="${OUTDIR}/display.txt"
  file_header "$F" "DISPLAY"
  record "$F" "Displays (internal + any external history)" "system_profiler SPDisplaysDataType"
  record "$F" "Display / GPU underlying frame buffers"     "ioreg -l | grep -iE 'IODisplayEDID|DisplayProductName|DisplaySerialNumber|IODisplayPrefsKey' | head -n 40"
}

sec_thermal() {
  local F="${OUTDIR}/thermal.txt"
  file_header "$F" "THERMAL"
  record "$F" "CPU speed-limit / thermal pressure (pmset)" "pmset -g therm"
  record "$F" "Battery temperature register (ioreg)"       "ioreg -r -c AppleSmartBattery | grep -iE 'Temperature|VirtualTemperature'"
  record "$F" "Thermal notes" "echo 'Fan RPM and SMC sensor temperatures require third-party tools (e.g. iStats/smcFanControl) which are NOT installed by this read-only script. Use --with-sudo for powermetrics-based thermal sampling.'"
  record_sudo "$F" "powermetrics thermal sample (5s)"      "powermetrics -n 1 -i 1000 --samplers smc,thermal 2>/dev/null || powermetrics -n 1 -i 1000 2>/dev/null"
}

sec_memory() {
  local F="${OUTDIR}/memory.txt"
  file_header "$F" "MEMORY"
  record "$F" "Installed memory (system_profiler)"         "system_profiler SPMemoryDataType"
  record "$F" "Total physical memory (bytes)"              "sysctl -n hw.memsize"
  record "$F" "VM statistics"                              "vm_stat"
  record "$F" "Memory pressure"                            "memory_pressure -Q 2>/dev/null || memory_pressure 2>/dev/null | head -n 20"
  record "$F" "Swap usage"                                 "sysctl vm.swapusage"
}

sec_network() {
  local F="${OUTDIR}/network.txt"
  file_header "$F" "CONNECTIVITY / NETWORK"
  record "$F" "Wi-Fi chipset & capabilities"               "system_profiler SPAirPortDataType"
  record "$F" "Bluetooth controller & version"             "system_profiler SPBluetoothDataType"
  record "$F" "Thunderbolt controller"                     "system_profiler SPThunderboltDataType"
  record "$F" "USB controllers & devices"                  "system_profiler SPUSBDataType"
  record "$F" "Network hardware ports"                     "networksetup -listallhardwareports"
  record "$F" "Interface addresses (MAC/IP)"               "ifconfig"
}

sec_ports() {
  local F="${OUTDIR}/ports.txt"
  file_header "$F" "PORTS"
  record "$F" "Thunderbolt / USB-C ports"                  "system_profiler SPThunderboltDataType"
  record "$F" "USB tree (each controller = a physical port set)" "system_profiler SPUSBDataType"
  record "$F" "Card reader (if present)"                   "system_profiler SPCardReaderDataType 2>/dev/null || echo 'No built-in SD card reader data type (or none present).'"
  record "$F" "Ports note" "echo 'Physical port faults (a dead USB-C port, a flaky HDMI) usually only reveal themselves by plugging devices in. Cross-check the USB tree above by physically testing each port with a known-good device/charger.'"
}

sec_camera_audio() {
  local F="${OUTDIR}/camera_audio.txt"
  file_header "$F" "CAMERA & AUDIO"
  record "$F" "Camera(s)"                                  "system_profiler SPCameraDataType"
  record "$F" "Audio devices (speakers/mics/in/out)"       "system_profiler SPAudioDataType"
}

sec_software() {
  local F="${OUTDIR}/software.txt"
  file_header "$F" "SOFTWARE / OS"
  record "$F" "macOS version"                              "sw_vers"
  record "$F" "Kernel version"                             "uname -a"
  record "$F" "Software overview (boot mode, uptime, SIP)" "system_profiler SPSoftwareDataType"
  record "$F" "Boot time"                                  "sysctl -n kern.boottime"
  record "$F" "Uptime & load averages"                     "uptime"
  record "$F" "Rosetta 2 status (Apple Silicon)"           "[ -d /Library/Apple/usr/share/rosetta ] && echo 'Rosetta 2 appears installed' || echo 'Rosetta 2 not installed (or Intel Mac)'; pgrep -x oahd >/dev/null 2>&1 && echo 'oahd (Rosetta daemon) running' || echo 'oahd not running'"
  record "$F" "Recent installed updates history"           "system_profiler SPInstallHistoryDataType 2>/dev/null | head -n 120 || echo 'Install history unavailable'"
  record "$F" "launchctl loaded services (user)"           "launchctl list 2>/dev/null | head -n 200"
  record "$F" "LaunchAgents / LaunchDaemons on disk"       "ls -la /Library/LaunchAgents /Library/LaunchDaemons ~/Library/LaunchAgents 2>/dev/null"
  record "$F" "Loaded kernel/system extensions"            "kmutil showloaded 2>/dev/null | head -n 100 || kextstat 2>/dev/null | head -n 100"
  record "$F" "System extensions (systemextensionsctl)"    "systemextensionsctl list 2>/dev/null"
  record "$F" "Login items (Background Task Mgmt on disk)"  "ls -la ~/Library/LaunchAgents 2>/dev/null; echo '---'; osascript -e 'tell application \"System Events\" to get the name of every login item' 2>/dev/null || echo '(login-item query skipped; would require Automation permission)'"
}

sec_security() {
  local F="${OUTDIR}/security.txt"
  file_header "$F" "SECURITY & ENTERPRISE MANAGEMENT"
  record "$F" "System Integrity Protection (SIP)"          "csrutil status"
  record "$F" "FileVault status"                           "fdesetup status"
  record "$F" "Gatekeeper status"                          "spctl --status"
  record "$F" "Activation Lock (system_profiler)"          "system_profiler SPHardwareDataType | grep -i 'Activation Lock' || echo 'Activation Lock status not reported by this macOS version — verify manually via System Settings > General > About, or Apple Configurator.'"
  record "$F" "Secure boot / iBridge (T2) info"            "system_profiler SPiBridgeDataType 2>/dev/null || echo 'No iBridge/T2 (expected on Apple Silicon).'"
  record "$F" "MDM enrollment status"                      "profiles status -type enrollment 2>/dev/null || echo 'profiles enrollment query unavailable'"
  record "$F" "Configuration profiles (system_profiler)"   "system_profiler SPConfigurationProfileDataType 2>/dev/null || echo 'No configuration profile data returned.'"
  record "$F" "Configuration profiles note" "echo 'A clean second-hand machine should show NO enrollment, NO MDM, and NO configuration profiles. Any profile here is a red flag worth questioning before purchase.'"
  record_sudo "$F" "Installed profiles (full, needs root)" "profiles list"
  record_sudo "$F" "Remote management (ARD) status"        "/usr/libexec/mdmclient QueryDeviceInformation 2>/dev/null | grep -iE 'MDM|Managed|Supervised|DEP|Enroll' || echo 'no management markers'"
}

sec_logs() {
  local F="${OUTDIR}/system.txt"
  file_header "$F" "SYSTEM LOGS & STABILITY HISTORY"
  record "$F" "Reboot history"                             "last reboot | head -n 30"
  record "$F" "Shutdown history"                           "last shutdown | head -n 30"
  record "$F" "Previous shutdown causes (last 60 days)"    "log show --style syslog --last 60d --predicate 'eventMessage CONTAINS \"Previous shutdown cause\"' 2>/dev/null | tail -n 40 || echo 'log show unavailable/empty'"
  record "$F" "Kernel panic reports on disk"               "ls -la /Library/Logs/DiagnosticReports/*.panic 2>/dev/null || echo 'No .panic files found (good sign).'"
  record "$F" "Recent crash/diagnostic reports"            "ls -lat /Library/Logs/DiagnosticReports 2>/dev/null | head -n 40; echo '---user---'; ls -lat ~/Library/Logs/DiagnosticReports 2>/dev/null | head -n 40"
  record "$F" "Wake/sleep history (pmset log)"             "pmset -g log 2>/dev/null | grep -iE 'Sleep|Wake|DarkWake|Assertion' | tail -n 60 || echo 'pmset log unavailable'"
  record "$F" "Top memory consumers"                       "top -l 1 -o mem -n 15 -stats pid,command,mem,cpu 2>/dev/null | tail -n 20"
  record "$F" "Top CPU consumers"                          "top -l 1 -o cpu -n 15 -stats pid,command,cpu,mem 2>/dev/null | tail -n 20"
}

write_diagnostics_note() {
  local F="${OUTDIR}/diagnostics.txt"
  file_header "$F" "APPLE HARDWARE DIAGNOSTICS"
  cat >> "$F" <<'EOF'

Apple Diagnostics (the built-in hardware self-test) CANNOT be run from a script
and is intentionally NOT automated here.

To run it manually (does not modify the machine):
  1. Shut the Mac down.
  2. Apple Silicon: power on and keep holding the power button until "Loading
     startup options" appears, then press Command (⌘) + D.
     Intel: power on and immediately hold the D key.
  3. Let the test run and record the reference code (e.g. ADP000 = no issues
     found; PPT/PPF codes = battery; VFD = display; NDR = network; etc.).

Report any resulting reference codes alongside this report for a complete
hardware picture.
EOF
}

# ----------------------------------------------------------------------------
# 3. Curated summary.json (+ diagnostics note + in-report README)
# ----------------------------------------------------------------------------
build_summary() {
  local HW="${RAWDIR}/SPHardwareDataType.json"
  local PW="${RAWDIR}/SPPowerDataType.json"
  local NV="${RAWDIR}/SPNVMeDataType.json"
  local SW="${RAWDIR}/SPSoftwareDataType.json"
  local CP="${RAWDIR}/SPConfigurationProfileDataType.json"

  local model_name model_id chip cores ram serial platform_uuid boot_rom smc_ver provisioning_udid activation_lock
  model_name="$(jval "$HW" 'SPHardwareDataType.0.machine_name')"
  model_id="$(jval "$HW" 'SPHardwareDataType.0.machine_model')"
  chip="$(jval "$HW" 'SPHardwareDataType.0.chip_type')"
  [ -z "$chip" ] && chip="$(jval "$HW" 'SPHardwareDataType.0.cpu_type')"
  cores="$(jval "$HW" 'SPHardwareDataType.0.number_processors')"
  ram="$(jval "$HW" 'SPHardwareDataType.0.physical_memory')"
  serial="$(jval "$HW" 'SPHardwareDataType.0.serial_number')"
  platform_uuid="$(jval "$HW" 'SPHardwareDataType.0.platform_UUID')"
  boot_rom="$(jval "$HW" 'SPHardwareDataType.0.boot_rom_version')"
  smc_ver="$(jval "$HW" 'SPHardwareDataType.0.os_loader_version')"
  provisioning_udid="$(jval "$HW" 'SPHardwareDataType.0.provisioning_UDID')"
  activation_lock="$(jval "$HW" 'SPHardwareDataType.0.activation_lock_status')"

  local batt_cycle batt_condition batt_maxcap_pct batt_charging
  batt_cycle="$(jval "$PW" 'SPPowerDataType.0.sppower_battery_health_info.sppower_battery_cycle_count')"
  batt_condition="$(jval "$PW" 'SPPowerDataType.0.sppower_battery_health_info.sppower_battery_health')"
  batt_maxcap_pct="$(jval "$PW" 'SPPowerDataType.0.sppower_battery_health_info.sppower_battery_health_maximum_capacity')"
  batt_charging="$(jval "$PW" 'SPPowerDataType.0.sppower_battery_charge_info.sppower_battery_is_charging')"
  [ -z "$batt_cycle" ] && batt_cycle="$(ioreg_val AppleSmartBattery CycleCount)"

  local ioreg_designcap ioreg_rawmaxcap ioreg_temp_raw batt_temp_c batt_raw_health_pct
  ioreg_designcap="$(ioreg_val AppleSmartBattery DesignCapacity)"
  ioreg_rawmaxcap="$(ioreg_val AppleSmartBattery AppleRawMaxCapacity)"
  ioreg_temp_raw="$(ioreg_val AppleSmartBattery Temperature)"
  batt_temp_c=""
  if printf '%s' "$ioreg_temp_raw" | grep -qE '^[0-9]+$'; then
    batt_temp_c="$(awk -v t="$ioreg_temp_raw" 'BEGIN{printf "%.1f", t/100}')"
  fi
  batt_raw_health_pct=""
  if printf '%s' "$ioreg_designcap" | grep -qE '^[0-9]+$' && \
     printf '%s' "$ioreg_rawmaxcap" | grep -qE '^[0-9]+$' && [ "$ioreg_designcap" -gt 0 ]; then
    batt_raw_health_pct="$(awk -v m="$ioreg_rawmaxcap" -v d="$ioreg_designcap" 'BEGIN{printf "%.0f", (m/d)*100}')"
  fi

  local ssd_smart ssd_model ssd_capacity ssd_serial ssd_trim
  ssd_smart="$(jval "$NV" 'SPNVMeDataType.0._items.0.smart_status')"
  ssd_model="$(jval "$NV" 'SPNVMeDataType.0._items.0._name')"
  [ -z "$ssd_model" ] && ssd_model="$(jval "$NV" 'SPNVMeDataType.0._items.0.device_model')"
  ssd_capacity="$(jval "$NV" 'SPNVMeDataType.0._items.0.size')"
  ssd_serial="$(jval "$NV" 'SPNVMeDataType.0._items.0.device_serial')"
  ssd_trim="$(jval "$NV" 'SPNVMeDataType.0._items.0.spnvme_trim_support')"

  local os_version kernel_version uptime_str secure_vm
  os_version="$(jval "$SW" 'SPSoftwareDataType.0.os_version')"
  [ -z "$os_version" ] && os_version="$(sw_vers -productVersion 2>/dev/null) ($(sw_vers -buildVersion 2>/dev/null))"
  kernel_version="$(jval "$SW" 'SPSoftwareDataType.0.kernel_version')"
  [ -z "$kernel_version" ] && kernel_version="$(uname -v 2>/dev/null)"
  uptime_str="$(jval "$SW" 'SPSoftwareDataType.0.uptime')"
  secure_vm="$(jval "$SW" 'SPSoftwareDataType.0.secure_vm')"

  local sip_status filevault_status gatekeeper_status mdm_enrollment
  sip_status="$(csrutil status 2>/dev/null | sed -n '1p')"
  filevault_status="$(fdesetup status 2>/dev/null | sed -n '1p')"
  gatekeeper_status="$(spctl --status 2>/dev/null | sed -n '1p')"
  mdm_enrollment="$(profiles status -type enrollment 2>/dev/null | tr '\n' '; ')"

  local profile_count="unknown"
  if [ -f "$CP" ]; then
    if plutil -extract 'SPConfigurationProfileDataType.0._items' json -o - "$CP" >/dev/null 2>&1; then
      profile_count="$(plutil -extract 'SPConfigurationProfileDataType.0._items' json -o - "$CP" 2>/dev/null | grep -c '"_name"')"
    fi
  fi

  local SUMMARY="${OUTDIR}/summary.json"
  {
    emit_kv() {
      local k="$1" v="$2"
      if [ -z "$v" ]; then printf '    "%s": null' "$k"
      else printf '    "%s": "%s"' "$k" "$(json_escape "$v")"; fi
    }
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$(json_escape "$(date)")"
    printf '  "tool": "macvitals.sh",\n'
    printf '  "read_only": true,\n'

    printf '  "hardware": {\n'
    emit_kv model_name "$model_name";          printf ',\n'
    emit_kv model_identifier "$model_id";      printf ',\n'
    emit_kv chip "$chip";                       printf ',\n'
    emit_kv cpu_core_summary "$cores";          printf ',\n'
    emit_kv memory "$ram";                       printf ',\n'
    emit_kv serial_number "$serial";            printf ',\n'
    emit_kv platform_uuid "$platform_uuid";     printf ',\n'
    emit_kv boot_rom_version "$boot_rom";       printf ',\n'
    emit_kv smc_os_loader_version "$smc_ver";   printf ',\n'
    emit_kv provisioning_udid "$provisioning_udid"; printf '\n'
    printf '  },\n'

    printf '  "battery": {\n'
    emit_kv cycle_count "$batt_cycle";              printf ',\n'
    emit_kv condition "$batt_condition";            printf ',\n'
    emit_kv maximum_capacity_percent "$batt_maxcap_pct"; printf ',\n'
    emit_kv raw_health_percent_from_registers "$batt_raw_health_pct"; printf ',\n'
    emit_kv design_capacity_mah "$ioreg_designcap"; printf ',\n'
    emit_kv raw_max_capacity_mah "$ioreg_rawmaxcap"; printf ',\n'
    emit_kv temperature_c "$batt_temp_c";           printf ',\n'
    emit_kv is_charging "$batt_charging";            printf '\n'
    printf '  },\n'

    printf '  "storage": {\n'
    emit_kv ssd_model "$ssd_model";       printf ',\n'
    emit_kv device_serial "$ssd_serial";  printf ',\n'
    emit_kv capacity "$ssd_capacity";     printf ',\n'
    emit_kv trim_support "$ssd_trim";     printf ',\n'
    emit_kv smart_status "$ssd_smart";    printf '\n'
    printf '  },\n'

    printf '  "software": {\n'
    emit_kv os_version "$os_version";       printf ',\n'
    emit_kv kernel_version "$kernel_version"; printf ',\n'
    emit_kv uptime "$uptime_str";           printf ',\n'
    emit_kv secure_virtual_memory "$secure_vm"; printf '\n'
    printf '  },\n'

    printf '  "security": {\n'
    emit_kv sip "$sip_status";                    printf ',\n'
    emit_kv filevault "$filevault_status";        printf ',\n'
    emit_kv gatekeeper "$gatekeeper_status";      printf ',\n'
    emit_kv activation_lock "$activation_lock";   printf ',\n'
    emit_kv mdm_enrollment "$mdm_enrollment";     printf ',\n'
    printf '    "configuration_profile_count": %s\n' "${profile_count:-null}"
    printf '  }\n'

    printf '}\n'
  } > "$SUMMARY"

  # Validate (plutil -convert reads JSON; -lint does not). Never fake it.
  if have plutil; then
    if ! plutil -convert xml1 -o /dev/null "$SUMMARY" >/dev/null 2>&1; then
      printf '%s' "" # keep quiet during the spinner; raw files remain authoritative
    fi
  fi

  write_diagnostics_note
  write_report_readme
}

write_report_readme() {
  cat > "${OUTDIR}/README.txt" <<EOF
MacVitals Health Report
=======================
Generated: $(date)
Sudo diagnostics collected: $( [ "$WITH_SUDO" -eq 1 ] && echo yes || echo "no (re-run with --with-sudo for the optional elevated section)")

This folder was produced by a strictly READ-ONLY inspection. Nothing on the
machine was modified.

Compatibility: the tool runs on any modern Mac (Apple Silicon M1/M2/M3/M4 or
Intel) and reports whatever machine it was run on — so this report describes
the specific Mac the script executed on. It is macOS-only.

To read this report the easy way: open https://macvitals.vercel.app , go to
"Analyze a report", and drop the .zip (or summary.json) onto the page. It is
analyzed entirely in your browser — nothing is uploaded.

Files:

  summary.json      Curated, machine-readable snapshot of the key indicators.
  hardware.txt      Model, chip, serial, board, firmware.
  battery.txt       Cycle count, capacity, condition, charge registers.
  storage.txt       SSD model, SMART status, TRIM, APFS layout, usage.
  display.txt       Internal/external display info, EDID markers.
  thermal.txt       Thermal pressure, battery temp (+ powermetrics if sudo).
  memory.txt        RAM config, VM stats, swap, memory pressure.
  network.txt       Wi-Fi/Bluetooth/Thunderbolt/USB, interfaces, MACs.
  ports.txt         Thunderbolt/USB-C/card-reader enumeration.
  camera_audio.txt  Camera and audio device presence.
  software.txt      macOS/kernel, updates, launch items, extensions, Rosetta.
  security.txt      SIP, FileVault, Gatekeeper, Activation Lock, MDM/profiles.
  system.txt        Reboot/shutdown/panic/wake history, top processes.
  diagnostics.txt   How to run Apple Diagnostics manually (not automated).
  raw/              Machine-readable system_profiler JSON dumps.

What to scrutinize for a used-machine purchase decision:
  * security.txt  -> MUST show no MDM, no enrollment, no configuration profiles,
                     and Activation Lock removed. Any of these is a dealbreaker
                     until resolved.
  * system.txt    -> .panic files or repeated abnormal shutdown causes suggest
                     logic-board / thermal instability.
  * storage.txt   -> SMART status must read "Verified". Anything else = risk.
  * battery.txt   -> cycle count / capacity (a replaceable, lower-priority item).
  * hardware.txt  -> serial should match the physical machine; firmware present.
EOF
}

# ----------------------------------------------------------------------------
# 4. Package the report into a .zip
# ----------------------------------------------------------------------------
ZIP="${OUTDIR}.zip"
sec_compress() {
  if have ditto; then
    ditto -c -k --sequesterRsrc --keepParent "$OUTDIR" "$ZIP" 2>/dev/null
  elif have zip; then
    ( cd "$(dirname "$OUTDIR")" && zip -r -q "$(basename "$ZIP")" "$(basename "$OUTDIR")" )
  fi
}

# ----------------------------------------------------------------------------
# 5. Drive the whole run
# ----------------------------------------------------------------------------
banner
intro

step "Reading system profile"          sec_prep
step "Hardware"                         sec_hardware
step "Battery & power"                  sec_battery
step "Storage / SSD"                    sec_storage
step "Display"                          sec_display
step "Thermal"                          sec_thermal
step "Memory"                           sec_memory
step "Connectivity & network"          sec_network
step "Ports"                            sec_ports
step "Camera & audio"                   sec_camera_audio
step "Software & startup items"         sec_software
step "Security & enterprise management" sec_security
step "System logs & stability history"  sec_logs
step "Analyzing & building summary"     build_summary
step "Packaging report"                 sec_compress

# ----------------------------------------------------------------------------
# 6. Final, presentable summary + next step
# ----------------------------------------------------------------------------
printf '\n'
printf '  %s%s✓ Report ready%s\n' "$BOLD" "$GREEN" "$RESET"
printf '  %s──────────────────────────────────────────────%s\n' "$DIM" "$RESET"
printf '  %sFolder%s   %s\n' "$BOLD" "$RESET" "$OUTDIR"
if [ -f "$ZIP" ]; then
  printf '  %sZip%s      %s%s%s\n' "$BOLD" "$RESET" "$CYAN" "$ZIP" "$RESET"
fi
printf '  %sSummary%s  %s/summary.json\n' "$BOLD" "$RESET" "$OUTDIR"
printf '\n'

# If the analyzer is next to this script (full package / local repo), produce
# the plain-English verdict right here. Otherwise (the one-line web install),
# point the user back to the site to drop their .zip.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
ANALYZER="${SCRIPT_DIR}/macvitals-analyze.sh"
if [ -f "$ANALYZER" ]; then
  printf '  %sGenerating your plain-English health verdict…%s\n\n' "$DIM" "$RESET"
  bash "$ANALYZER" "$OUTDIR"
else
  printf '  %sNext step%s\n' "$BOLD" "$RESET"
  printf '  Open %s%shttps://macvitals.vercel.app%s and choose "Analyze a report",\n' "$BOLD" "$CYAN" "$RESET"
  if [ -f "$ZIP" ]; then
    printf '  then drag the %s.zip%s above onto the page for your health verdict.\n' "$BOLD" "$RESET"
  else
    printf '  then drop the %ssummary.json%s from the folder above onto the page.\n' "$BOLD" "$RESET"
  fi
  printf '  %sEverything is analyzed in your browser — nothing is uploaded.%s\n' "$DIM" "$RESET"
fi
printf '\n'
