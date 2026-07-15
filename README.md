# 🩺 MacVitals

![Platform: macOS](https://img.shields.io/badge/platform-macOS-black?logo=apple)
![Apple Silicon + Intel](https://img.shields.io/badge/Apple%20Silicon%20%2B%20Intel-supported-brightgreen)
![Shell: bash](https://img.shields.io/badge/shell-bash-4EAA25?logo=gnubash&logoColor=white)
![Read-only](https://img.shields.io/badge/mode-read--only-blue)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-success)
![License: MIT](https://img.shields.io/badge/license-MIT-yellow)

**A single, dependency-free, strictly read-only script that generates a complete diagnostic report for any Mac — then explains, in plain English, whether the machine is worth buying.**

You're about to hand over cash for a second-hand Mac. The seller says "it's perfect." This tool lets you (or an AI assistant) *verify that* — SSD health, battery wear, hidden enterprise management, kernel panics, thermal throttling, activation lock — in one command, without changing a single setting on the machine.

```bash
bash macvitals.sh
```

That's it. You get a folder of clean, topic-separated reports plus a machine-readable `summary.json`, **and a plain-English verdict printed right in your terminal** — no technical knowledge needed. Want a second opinion? The whole thing zips up ready to drop into ChatGPT/Claude with *"should I buy this?"*

```
  OVERALL VERDICT:  [ X ]  DO NOT BUY YET — serious issues must be resolved first
  Indicative health score: 60/100  (Fair)

  [ X ]  DEAL-BREAKERS — resolve these BEFORE handing over money:
     * The Mac is still enrolled in a company's device-management (MDM) system...
  [ OK ]  LOOKS GOOD:
     * SSD self-check (SMART) reports "Verified" — the drive is not reporting failures.
     * Activation Lock is OFF — you will be able to set the Mac up as your own.
```

---

## Why it exists

Most "Mac health check" advice is a checklist of things to click through manually in System Settings, or a paid app that wants Full Disk Access. Neither is great when you're standing next to a stranger's laptop for ten minutes deciding whether to buy it.

This script is:

- **Read-only.** It never writes anywhere except its own output folder. No settings touched, nothing installed. Safe to run on a machine you don't own yet.
- **Zero-dependency.** No Homebrew, no `jq`, no Python. Only stock macOS utilities. It runs on a fresh, offline machine.
- **Honest.** If a value can't be read, the report says `null` or `[skipped]`. It never guesses or fabricates a reading.
- **AI-ready.** The output is structured so another model can reason over it and answer *"buy / don't buy, and why."*

---

## What it checks

| Area | Highlights |
|------|-----------|
| 🔩 **Hardware** | Model, chip, serial, board ID, firmware/Boot ROM, hardware UUID |
| 🔋 **Battery** | Cycle count, max capacity, condition, **raw health computed from hardware registers** (cross-checked against the reported %), temperature, voltage |
| 💾 **Storage** | SSD model, **SMART status**, TRIM, APFS layout, capacity, disk usage |
| 🖥️ **Display** | Resolution, refresh, color profile, EDID markers, external-display history |
| 🌡️ **Thermal** | CPU speed-limit / thermal pressure, battery temp (+ `powermetrics` with `--with-sudo`) |
| 🧠 **Memory** | RAM config, VM stats, swap, memory pressure |
| 📡 **Connectivity** | Wi-Fi / Bluetooth / Thunderbolt / USB controllers, interfaces, MACs |
| 🔌 **Ports** | Thunderbolt/USB-C/card-reader enumeration |
| 🎥 **Camera & Audio** | Device presence and identifiers |
| 🔐 **Security** | SIP, FileVault, Gatekeeper, **Activation Lock**, **MDM enrollment & configuration profiles** |
| 📜 **Stability** | Kernel panics, abnormal shutdown causes, wake/sleep history, top processes |

> 🚩 The **security section is the killer feature for used purchases**: it surfaces leftover MDM enrollment, the MDM server URL, and any installed configuration profiles — the enterprise-management remnants that a "wiped" office laptop often still carries and that can brick your ownership later.

---

## Quick start

The project is **two scripts**. Keep them in the same folder:

| Script | Job |
|--------|-----|
| `macvitals.sh` | Collects the raw diagnostics (read-only) |
| `macvitals-analyze.sh` | Turns that data into a plain-English buy/don't-buy verdict |

```bash
# 1. Copy BOTH scripts onto the Mac you want to inspect (AirDrop / USB).
# 2. Run the inspector — it auto-runs the analyzer at the end:
bash macvitals.sh
```

You'll see the report location **and** the plain-English health assessment. Done.

```bash
# Optional: choose where the report is written
bash macvitals.sh ~/Desktop

# Optional: collect extra elevated (still read-only) diagnostics
bash macvitals.sh --with-sudo
```

### Re-analyze an existing report (no re-scan needed)

Already have a report folder (or someone sent you one)? Get the verdict without re-running the scan:

```bash
bash macvitals-analyze.sh                       # newest report in this folder
bash macvitals-analyze.sh MacVitals_Report_2026…  # a specific report
```

The verdict is also saved to `HEALTH_ANALYSIS.txt` inside the report folder, so it travels with the `.zip`.

> **How the verdict works:** it's a transparent, rule-based heuristic — SSD SMART status, leftover enterprise management (MDM/profiles), Activation Lock, kernel panics, thermal throttling and battery wear each map to a clearly-labelled finding. Nothing is a black box; every conclusion cites a value from the report.

### Sample `summary.json`

```json
{
  "hardware": { "model_name": "MacBook Pro", "chip": "Apple M1 Pro", "serial_number": "…" },
  "battery":  { "cycle_count": "234", "maximum_capacity_percent": "85%", "condition": "Good" },
  "storage":  { "ssd_model": "APPLE SSD AP0512R", "smart_status": "Verified", "trim_support": "Yes" },
  "security": { "activation_lock": "activation_lock_disabled", "configuration_profile_count": 0 }
}
```

Hand that (or the whole `.zip`) to an AI assistant and ask for a verdict.

---

## Compatibility

| Platform | Supported | Notes |
|----------|:---------:|-------|
| Apple Silicon Mac (M1/M2/M3/M4) | ✅ | Primary target — every section works |
| Intel Mac | ✅ | Apple-Silicon-only fields self-skip with a clear note; T2 info replaces the iBridge section |
| Windows / Linux | ❌ | Refuses to run (guarded via `uname`) — every tool it uses is macOS-only |

**It is generic, not tied to any one machine** — it reports whatever Mac it runs on, so run it *on the machine you're evaluating*.

> **Gatekeeper tip:** if you download the script from the internet, macOS may quarantine it. Running it as `bash macvitals.sh` (rather than double-clicking) avoids the "unidentified developer" prompt.

---

## Safety guarantees

- ✅ Read-only — writes only inside its timestamped output folder
- ✅ No network access required
- ✅ No software installed, no settings modified
- ✅ Core report needs **no `sudo`**; the elevated section is opt-in and still read-only
- ✅ Every unavailable command degrades gracefully — a missing tool is a note, never a crash

---

## Output layout

```
MacVitals_Report_<timestamp>/
├── HEALTH_ANALYSIS.txt # plain-English verdict (from the analyzer)
├── summary.json        # curated, machine-readable snapshot
├── hardware.txt
├── battery.txt
├── storage.txt
├── display.txt
├── thermal.txt
├── memory.txt
├── network.txt
├── ports.txt
├── camera_audio.txt
├── security.txt
├── software.txt
├── system.txt          # panics / shutdowns / wake history / top processes
├── diagnostics.txt     # how to run Apple Diagnostics manually
├── README.txt          # what to scrutinize for a buy decision
└── raw/                # raw system_profiler JSON dumps
MacVitals_Report_<timestamp>.zip
```

---

## Notes & limitations

- **Fan RPM and per-sensor SMC temperatures** require third-party tools (e.g. `iStats`) and are intentionally *not* installed — the script stays dependency-free. `--with-sudo` adds `powermetrics`-based thermal sampling instead.
- **Apple Diagnostics** (the built-in hardware self-test) can't be triggered by a script and is deliberately not automated; `diagnostics.txt` explains how to run it by hand.
- This tool reports data. The *decision* is yours (or your AI's) — it doesn't pretend to give a verdict itself.

---

## Web version (planned)

A hosted, fully client-side dashboard is planned: get the collector with one copy-paste, run it locally, then drag the report onto the site for a visual health verdict — **with nothing ever uploaded** (the report is parsed entirely in your browser). Free static hosting on Vercel, no backend. See the full product + technical plan in [docs/WEB_APP_PLAN.md](docs/WEB_APP_PLAN.md).

## Recording a demo for the repo

A terminal recording sells a CLI tool better than any screenshot. To capture one with [asciinema](https://asciinema.org):

```bash
# install once (Homebrew), then record a run:
brew install asciinema
asciinema rec demo.cast -c "bash macvitals.sh /tmp"
# upload and embed the resulting badge/link in this README:
asciinema upload demo.cast
```

Prefer a static image? Take a screenshot of the final "HEALTH ASSESSMENT" block (⌘⇧4) and drop it in a `docs/` folder, then reference it here:

```markdown
![Sample verdict](docs/sample-verdict.png)
```

> Redact your serial number and UUIDs before publishing any recording or screenshot.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The one hard rule: every change must keep the tool **read-only, dependency-free, and honest** (no fabricated values).

## License

[MIT](LICENSE) — do whatever you like. No warranty; you run it at your own discretion.
