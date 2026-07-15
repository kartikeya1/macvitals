#!/usr/bin/env bash
#
# macvitals-analyze.sh
# =========================
# Reads a report folder produced by macvitals.sh and prints a
# PLAIN-ENGLISH health assessment that a non-technical person can understand:
# an overall verdict, a per-area breakdown, the specific red flags found, and
# concrete next steps to take with the seller.
#
# It is READ-ONLY: it only reads the report files and writes a single
# HEALTH_ANALYSIS.txt back into the same report folder.
#
# Usage:
#   bash macvitals-analyze.sh                 # auto-find newest report here
#   bash macvitals-analyze.sh <report-folder> # analyze a specific report
#
# The scoring is a transparent, rule-based heuristic (documented inline) — not
# a black box. Every value it reasons about comes straight from the report;
# nothing is invented.

set -u

# ----------------------------------------------------------------------------
# 0. Locate the report folder
# ----------------------------------------------------------------------------
REPORT="${1:-}"

if [ -z "$REPORT" ]; then
  # No argument: pick the newest MacVitals_Report_* directory in the current dir.
  REPORT="$(ls -dt ./MacVitals_Report_*/ 2>/dev/null | head -1)"
fi

# Allow the user to point at a .zip or at summary.json and be forgiving.
REPORT="${REPORT%/}"
if [ -z "$REPORT" ] || [ ! -d "$REPORT" ]; then
  echo "Could not find a report folder to analyze."
  echo
  echo "Run the inspection first:"
  echo "    bash macvitals.sh"
  echo
  echo "Then either run this from the same folder, or pass the report path:"
  echo "    bash macvitals-analyze.sh /path/to/MacVitals_Report_YYYYMMDD_HHMMSS"
  exit 1
fi

SUMMARY="${REPORT}/summary.json"
if [ ! -f "$SUMMARY" ]; then
  echo "Error: $SUMMARY not found — is '$REPORT' a report from macvitals.sh?"
  exit 1
fi

OUT="${REPORT}/HEALTH_ANALYSIS.txt"
: > "$OUT"   # start the analysis file fresh

# ----------------------------------------------------------------------------
# 1. Small helpers
# ----------------------------------------------------------------------------

# getv <json.key.path>  -> scalar value from summary.json, or empty.
getv() {
  local out
  out="$(plutil -extract "$1" raw -o - "$SUMMARY" 2>/dev/null)" && printf '%s' "$out"
}

# lc <string> -> lowercase
lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# digits <string> -> only the digits (e.g. "80%" -> "80"), empty if none
digits() { printf '%s' "$1" | tr -cd '0-9'; }

# say <line...> -> print to screen AND append to the analysis file
say() { printf '%s\n' "$*" | tee -a "$OUT"; }

# Collections of findings, filled in as we evaluate each area.
CRITICAL=()   # deal-breakers — do not buy until resolved
WARN=()       # concerns worth negotiating on / verifying
GOOD=()       # positive signals
INFO=()       # neutral context

SCORE=100     # indicative heuristic score; deductions applied below

deduct() { SCORE=$((SCORE - $1)); }

# ----------------------------------------------------------------------------
# 1b. Load tunables from shared/ruleset.json (single source of truth).
#     If the file isn't found (e.g. the two .sh files were copied somewhere on
#     their own), the built-in defaults below are used — identical values — so
#     the analyzer always runs standalone. See shared/README.md.
# ----------------------------------------------------------------------------
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
RULESET=""
for cand in "$SELF_DIR/shared/ruleset.json" "$SELF_DIR/../shared/ruleset.json" "$SELF_DIR/ruleset.json"; do
  [ -f "$cand" ] && { RULESET="$cand"; break; }
done

# rget <keypath> <default> -> value from ruleset.json when present & non-empty,
# otherwise the default. Never fails.
rget() {
  local v=""
  [ -n "$RULESET" ] && v="$(plutil -extract "$1" raw -o - "$RULESET" 2>/dev/null)"
  if [ -n "$v" ]; then printf '%s' "$v"; else printf '%s' "$2"; fi
}

SCORE_START="$(rget score.start 100)"
SCORE="$SCORE_START"
BAT_GOOD="$(rget tunables.battery.goodPct 85)"
BAT_FINE="$(rget tunables.battery.finePct 80)"
BAT_WORN="$(rget tunables.battery.wornPct 70)"
BAT_DED_WORN="$(rget tunables.battery.deductWorn 5)"
BAT_DED_BAD="$(rget tunables.battery.deductBad 10)"
SMART_DED_BAD="$(rget tunables.smart.deductBad 40)"
SMART_DED_UNK="$(rget tunables.smart.deductUnknown 5)"
AL_DED_ON="$(rget tunables.activationLock.deductOn 40)"
AL_DED_UNK="$(rget tunables.activationLock.deductUnknown 5)"
MDM_DED="$(rget tunables.mdm.deduct 30)"
PROF_DED="$(rget tunables.profiles.deduct 10)"
PANIC_DED="$(rget tunables.panics.deduct 10)"
THERM_DED="$(rget tunables.thermal.deduct 10)"
GRADE_EXCELLENT="$(rget score.gradeBands.0.min 85)"
GRADE_GOOD="$(rget score.gradeBands.1.min 70)"
GRADE_FAIR="$(rget score.gradeBands.2.min 50)"

# ----------------------------------------------------------------------------
# 2. Pull the values we reason about
# ----------------------------------------------------------------------------
model="$(getv hardware.model_name)"
chip="$(getv hardware.chip)"
ram="$(getv hardware.memory)"
serial="$(getv hardware.serial_number)"
os_version="$(getv software.os_version)"

batt_cap_raw="$(getv battery.maximum_capacity_percent)"
batt_cap="$(digits "$batt_cap_raw")"
[ -z "$batt_cap" ] && batt_cap="$(digits "$(getv battery.raw_health_percent_from_registers)")"
batt_cycles="$(getv battery.cycle_count)"
batt_condition="$(getv battery.condition)"

smart="$(getv storage.smart_status)"
trim="$(getv storage.trim_support)"
ssd_model="$(getv storage.ssd_model)"
ssd_cap="$(getv storage.capacity)"

sip="$(getv security.sip)"
filevault="$(getv security.filevault)"
gatekeeper="$(getv security.gatekeeper)"
activation="$(getv security.activation_lock)"
mdm="$(getv security.mdm_enrollment)"
profiles="$(getv security.configuration_profile_count)"

# Signals that live in the text files (not in summary.json):
SYS="${REPORT}/system.txt"
THERM="${REPORT}/thermal.txt"

# Kernel panics: the collector prints "No .panic files found" when there are
# none. If that marker is absent, count filename lines (excluding the echoed
# command line, which starts with "$ ").
panics=0
if [ -f "$SYS" ]; then
  if grep -q "No .panic files found" "$SYS"; then
    panics=0
  else
    panics="$(grep '\.panic' "$SYS" 2>/dev/null | grep -v '^\$' | grep -cv 'No .panic')"
    panics="${panics:-0}"
  fi
fi

# Thermal / CPU speed limit (100 = no throttling at capture time).
cpu_speed_limit="$(grep -i 'CPU_Speed_Limit' "$THERM" 2>/dev/null | head -1 | tr -cd '0-9')"

# ----------------------------------------------------------------------------
# 3. Evaluate each area
# ----------------------------------------------------------------------------

# --- Storage / SSD (CRITICAL) ---
smart_lc="$(lc "$smart")"
if [ "$smart_lc" = "verified" ]; then
  GOOD+=("SSD self-check (SMART) reports \"Verified\" — the drive is not reporting failures.")
elif [ -n "$smart" ]; then
  CRITICAL+=("SSD SMART status is \"$smart\" (should be \"Verified\"). This points to a failing or degraded drive.")
  deduct "$SMART_DED_BAD"
else
  WARN+=("SSD SMART status could not be read — verify the drive health manually before buying.")
  deduct "$SMART_DED_UNK"
fi
[ "$(lc "$trim")" = "yes" ] && GOOD+=("SSD TRIM is enabled (normal, keeps the SSD healthy).")

# --- Enterprise management / ownership (CRITICAL for a used machine) ---
activation_lc="$(lc "$activation")"
case "$activation_lc" in
  *disabl*)  GOOD+=("Activation Lock is OFF — you will be able to set the Mac up as your own.") ;;
  *enabl*)   CRITICAL+=("Activation Lock is ON. Until the seller removes it from their Apple ID, this Mac is effectively unusable by you.") ; deduct "$AL_DED_ON" ;;
  *)         WARN+=("Activation Lock status was not reported — confirm it is OFF before paying (System Settings > General > About, or ask the seller to sign out of iCloud in front of you).") ; deduct "$AL_DED_UNK" ;;
esac

mdm_lc="$(lc "$mdm")"
managed=0
case "$mdm_lc" in
  *"enrollment: yes"*|*"mdm server"*|*"managed by"*) managed=1 ;;
esac
if [ "$managed" -eq 1 ]; then
  CRITICAL+=("The Mac is still enrolled in a company's device-management (MDM) system. A managed Mac can be remotely locked, wiped, or restricted by the previous owner's IT. It MUST be released from management before you buy.")
  deduct "$MDM_DED"
elif [ -n "$mdm_lc" ]; then
  GOOD+=("No active device-management (MDM) enrollment detected.")
fi

# Configuration profiles: 0 expected on a clean machine.
if printf '%s' "$profiles" | grep -qE '^[0-9]+$'; then
  if [ "$profiles" -gt 0 ]; then
    WARN+=("$profiles configuration profile(s) are installed. On a properly wiped machine there should be none — these are leftovers from the previous (likely corporate) owner. Ask for a clean macOS reinstall.")
    deduct "$PROF_DED"
  else
    GOOD+=("No leftover configuration profiles — consistent with a clean machine.")
  fi
fi

# --- Security posture (mostly informational / good) ---
[ -n "$sip" ] && case "$(lc "$sip")" in *enabled*) GOOD+=("System Integrity Protection (macOS's core self-protection) is enabled — normal and good.");; *) WARN+=("System Integrity Protection appears disabled — unusual; ask why it was turned off.");; esac
[ -n "$gatekeeper" ] && case "$(lc "$gatekeeper")" in *enabled*) GOOD+=("Gatekeeper (app security) is enabled — normal.");; esac
case "$(lc "$filevault")" in
  *" on"*|*"is on"*) INFO+=("FileVault disk encryption is currently ON. Make sure the seller either turns it off or does a full erase + reinstall of macOS at handover — otherwise you could be locked out of the disk.") ;;
esac

# --- Battery (the buyer treats this as low priority / replaceable) ---
if [ -n "$batt_cap" ]; then
  if   [ "$batt_cap" -ge "$BAT_GOOD" ]; then GOOD+=("Battery at ${batt_cap}% of original capacity — healthy.")
  elif [ "$batt_cap" -ge "$BAT_FINE" ]; then INFO+=("Battery at ${batt_cap}% capacity — mild wear, still fine for daily use.")
  elif [ "$batt_cap" -ge "$BAT_WORN" ]; then INFO+=("Battery at ${batt_cap}% capacity — noticeable wear. Replaceable later at an Apple service centre if it bothers you."); deduct "$BAT_DED_WORN"
  else                                       WARN+=("Battery at ${batt_cap}% capacity — significantly worn. Budget for a replacement (this is a known, planned cost)."); deduct "$BAT_DED_BAD"
  fi
fi
[ -n "$batt_cycles" ] && INFO+=("Battery charge cycles: ${batt_cycles}${batt_condition:+, condition reported as \"$batt_condition\"}.")

# --- Stability / thermal ---
if [ "$panics" -gt 0 ]; then
  WARN+=("$panics kernel-panic report(s) found on disk. Occasional panics can be software; repeated ones can indicate failing hardware. Check system.txt and ask the seller about crashes."); deduct "$PANIC_DED"
else
  GOOD+=("No kernel-panic crash reports found — a good stability sign.")
fi
if [ -n "$cpu_speed_limit" ] && [ "$cpu_speed_limit" -lt 100 ]; then
  WARN+=("CPU was thermally throttled (speed limit ${cpu_speed_limit}%) at the moment of capture. If it stays below 100% when idle/cool, suspect a thermal problem (dried paste, dust, or fan)."); deduct "$THERM_DED"
elif [ -n "$cpu_speed_limit" ]; then
  GOOD+=("CPU was running at full speed (no thermal throttling) at capture time.")
fi

# Score floor.
[ "$SCORE" -lt 0 ] && SCORE=0

# ----------------------------------------------------------------------------
# 4. Decide the overall verdict
# ----------------------------------------------------------------------------
if [ "${#CRITICAL[@]}" -gt 0 ]; then
  VERDICT="DO NOT BUY YET — serious issues must be resolved first"
  VSYMBOL="[ X ]"
elif [ "${#WARN[@]}" -gt 0 ]; then
  VERDICT="PROCEED WITH CAUTION — some concerns to check or negotiate on"
  VSYMBOL="[ ! ]"
else
  VERDICT="LOOKS HEALTHY — reasonable to buy"
  VSYMBOL="[ OK ]"
fi

# Grade band from the heuristic score (thresholds from the shared ruleset).
if   [ "$SCORE" -ge "$GRADE_EXCELLENT" ]; then GRADE="Excellent"
elif [ "$SCORE" -ge "$GRADE_GOOD" ];      then GRADE="Good"
elif [ "$SCORE" -ge "$GRADE_FAIR" ];      then GRADE="Fair"
else                                           GRADE="Poor"
fi

# ----------------------------------------------------------------------------
# 5. Print the report (to screen + HEALTH_ANALYSIS.txt)
# ----------------------------------------------------------------------------
say "==================================================================="
say "   MACVITALS  —  HEALTH ASSESSMENT  (plain-English summary)"
say "==================================================================="
say "Machine : ${model:-Unknown} / ${chip:-?} / ${ram:-?}"
say "macOS   : ${os_version:-Unknown}"
say "Serial  : ${serial:-Unknown}"
say "Report  : $REPORT"
say "-------------------------------------------------------------------"
say ""
say "  OVERALL VERDICT:  $VSYMBOL  $VERDICT"
say "  Indicative health score: ${SCORE}/100  (${GRADE})"
say "  (score is a simple, transparent heuristic — read the details below)"
say ""

if [ "${#CRITICAL[@]}" -gt 0 ]; then
  say "-------------------------------------------------------------------"
  say "  [ X ]  DEAL-BREAKERS  — resolve these BEFORE handing over money:"
  say "-------------------------------------------------------------------"
  for i in "${CRITICAL[@]}"; do say "   * $i"; done
  say ""
fi

if [ "${#WARN[@]}" -gt 0 ]; then
  say "-------------------------------------------------------------------"
  say "  [ ! ]  THINGS TO CHECK OR NEGOTIATE ON:"
  say "-------------------------------------------------------------------"
  for i in "${WARN[@]}"; do say "   * $i"; done
  say ""
fi

if [ "${#GOOD[@]}" -gt 0 ]; then
  say "-------------------------------------------------------------------"
  say "  [ OK ]  LOOKS GOOD:"
  say "-------------------------------------------------------------------"
  for i in "${GOOD[@]}"; do say "   * $i"; done
  say ""
fi

if [ "${#INFO[@]}" -gt 0 ]; then
  say "-------------------------------------------------------------------"
  say "  [ i ]  GOOD TO KNOW:"
  say "-------------------------------------------------------------------"
  for i in "${INFO[@]}"; do say "   * $i"; done
  say ""
fi

# --- Actionable next steps, phrased for a non-technical buyer ---
say "-------------------------------------------------------------------"
say "  WHAT TO DO NEXT"
say "-------------------------------------------------------------------"
say "   1. Ask the seller to sign out of iCloud and erase the Mac"
say "      (System Settings > General > Transfer or Reset > Erase All"
say "      Content and Settings) IN FRONT OF YOU. This clears Activation"
say "      Lock, device management, profiles and FileVault in one step."
say "   2. Physically test every port with a real device/charger, and"
say "      test the camera, speakers, microphone and keyboard."
say "   3. Run Apple's built-in hardware test (see diagnostics.txt in this"
say "      folder) and note the reference code — ADP000 means no issues."
if [ "${#CRITICAL[@]}" -gt 0 ]; then
  say "   4. Because DEAL-BREAKERS were found above, do not pay until they"
  say "      are fixed and you re-run this tool to confirm they are gone."
fi
say ""
say "-------------------------------------------------------------------"
say "This assessment is a decision aid, not a guarantee. It only reflects"
say "what the machine reported at inspection time. For a fuller picture,"
say "share the whole report (or its .zip) with an AI assistant and ask:"
say "\"Based on this MacBook report, should I buy it and why?\""
say "==================================================================="

echo
echo "Saved a copy of this assessment to: $OUT"
