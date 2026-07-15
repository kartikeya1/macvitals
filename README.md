<p align="center">
  <img src="logo.svg" alt="MacVitals" width="320" />
</p>

<p align="center">
  <a href="https://macvitals.vercel.app"><b>macvitals.vercel.app</b></a> ·
  Check any Mac's health in plain English.
</p>

<p align="center">
  <img alt="Platform: macOS" src="https://img.shields.io/badge/platform-macOS-black?logo=apple" />
  <img alt="Apple Silicon + Intel" src="https://img.shields.io/badge/Apple%20Silicon%20%2B%20Intel-supported-brightgreen" />
  <img alt="Shell: bash" src="https://img.shields.io/badge/shell-bash-4EAA25?logo=gnubash&logoColor=white" />
  <img alt="Web: Next.js" src="https://img.shields.io/badge/web-Next.js%20(static)-black?logo=nextdotjs" />
  <img alt="Read-only" src="https://img.shields.io/badge/mode-read--only-blue" />
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-yellow" />
</p>

---

**MacVitals** is a two-part tool for judging a Mac's health — perfect for vetting a used MacBook before you buy, or checking your own:

1. A **read-only shell script** that inspects the machine (battery, SSD, security, thermal, logs…) and writes a shareable report.
2. A **fully client-side web dashboard** that turns that report into a plain-English buy / don't-buy verdict with a 0–100 score — **analyzed entirely in your browser; nothing is ever uploaded.**

> The report contains your serial number, hardware IDs and network addresses. MacVitals has **no backend** — the web app parses and scores everything locally, so that data never leaves your device.

---

## Table of contents

- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [What it checks](#what-it-checks)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Deployment (Vercel)](#deployment-vercel)
- [Adding a new check / feature](#adding-a-new-check--feature)
- [Roadmap — done & pending](#roadmap--done--pending)
- [Privacy & safety guarantees](#privacy--safety-guarantees)
- [Contributing](#contributing)
- [Maintaining this README](#maintaining-this-readme)
- [License](#license)

---

## Quick start

### As a user (the website way)

1. Go to **[macvitals.vercel.app](https://macvitals.vercel.app)** and copy the one-line command (pick where to save the report — Desktop / Downloads).
2. Paste it into **Terminal** on the Mac you want to check:
   ```bash
   curl -fsSL https://macvitals.vercel.app/macvitals.sh -o macvitals.sh && bash macvitals.sh ~/Desktop
   ```
3. When it finishes, it prints where the report + `.zip` were saved.
4. Back on the site, open **Analyze a report** and drop the `.zip` (or `summary.json`) on the page for your verdict.

### From a clone (get the terminal verdict too)

If you keep both scripts together, the collector auto-runs the analyzer and prints the verdict right in the terminal:

```bash
git clone https://github.com/kartikeya1/macvitals
cd macvitals
bash macvitals.sh                 # report saved in the current folder
bash macvitals.sh ~/Desktop       # …or choose where
bash macvitals.sh --with-sudo     # optional deep scan (asks for your password)
```

> **macOS only** (Apple Silicon or Intel). Running via `bash` avoids the "unidentified developer" Gatekeeper prompt on a downloaded file.

---

## How it works

A browser **cannot** read Mac hardware (macOS sandboxes it), so there is always a local collection step. Everything around it is designed to be effortless and private:

```
  1. GET THE COLLECTOR        2. RUN IT LOCALLY (once)      3. VIEW THE DASHBOARD
  site → copy one command  →  Terminal: bash macvitals  →  drag the report onto
  (or download the script)    → MacVitals_Report_…/.zip     the site → visual verdict
                                                            (parsed 100% in-browser)
```

The scoring logic lives in **one** place — [`shared/ruleset.json`](shared/ruleset.json):

- The **CLI analyzer** (`macvitals-analyze.sh`) loads it at runtime (with identical built-in fallbacks so the two `.sh` files still run standalone).
- The **web app** imports it (`web/lib/analyze.ts`).

So the terminal verdict and the browser verdict are always identical.

---

## What it checks

| Area | Highlights |
|------|-----------|
| 🔋 **Battery** | Cycle count, max capacity, condition, raw health from hardware registers, temperature |
| 💾 **Storage / SSD** | **SMART** status, TRIM, APFS layout, capacity, disk usage |
| 🔐 **Security & ownership** | **Activation Lock**, **MDM enrollment**, configuration profiles, FileVault, SIP, Gatekeeper |
| 🌡️ **Thermal** | CPU speed-limit / thermal pressure, battery temp (+ `powermetrics` with `--with-sudo`) |
| 📜 **Stability** | Kernel panics, abnormal shutdown causes, wake/sleep history, top processes |
| 🔩 **Hardware** | Model, chip, cores, firmware / Boot ROM, serial, hardware UUIDs |
| 🧠 **Memory** | RAM, swap, memory pressure |
| 📡 **Connectivity** | Wi-Fi, Bluetooth, Thunderbolt, USB, ports, network interfaces |
| 🎥 **Camera & audio** | Device presence and identifiers |

> 🚩 The **security section is the killer feature for used purchases**: it surfaces leftover MDM enrollment, the MDM server URL, and installed configuration profiles — the enterprise-management remnants a "wiped" office laptop often still carries and that can compromise your ownership later.

---

## Repository layout

```
macvitals/
├── macvitals.sh              # read-only collector (auto-runs the analyzer if present)
├── macvitals-analyze.sh      # plain-English verdict + 0–100 score (reads shared/ruleset.json)
├── shared/
│   ├── ruleset.json          # SINGLE SOURCE OF TRUTH for scoring (CLI + web)
│   └── README.md             # the ruleset schema + how to edit it
├── web/                      # static Next.js site (Vercel)
│   ├── app/                  # landing (page.tsx), report dashboard (report/page.tsx), components
│   ├── lib/                  # analyze.ts, parse.ts, samples.ts, site.ts
│   ├── scripts/sync-assets.mjs   # copies the .sh files + ruleset into web/ at build
│   └── README.md             # web-specific dev/deploy notes
├── docs/
│   └── WEB_APP_PLAN.md       # product & technical plan + phase roadmap
├── logo.svg                  # brand mark
├── vercel.json               # tells Vercel to build web/ and serve web/out
└── LICENSE
```

---

## Local development

### CLI

```bash
bash macvitals.sh /tmp                       # run, output to /tmp
bash macvitals-analyze.sh /tmp/MacVitals_Report_*   # re-analyze an existing report
```

### Web

```bash
cd web
npm install
npm run dev        # http://localhost:3000  (runs sync-assets first)
npm run build      # static export to web/out
```

> ⚠️ **Never run `npm run build` while `next dev` is running** — it clobbers the shared `.next` dir and the dev server then serves empty CSS. Stop dev first, `rm -rf .next`, then build.

---

## Deployment (Vercel)

The repo root [`vercel.json`](vercel.json) makes Vercel build the app in `web/` and serve the static export from `web/out`, so you can import the repo **with the Root Directory left at the repo root**:

1. Vercel → **New Project** → import `kartikeya1/macvitals`.
2. Leave **Root Directory** as the repo root (the `vercel.json` handles the `web/` subdir). Framework preset: **Other**.
3. Deploy.
4. If your domain differs from `macvitals.vercel.app`, update `SITE_ORIGIN` in [`web/lib/site.ts`](web/lib/site.ts) and redeploy — it's used in the copy-paste command.

The collector script is served at `/{macvitals.sh}` (synced into `web/public` at build), which is what the one-line `curl` command fetches.

---

## Adding a new check / feature

**To add a new health check end-to-end:**

1. **Collect the raw data** — add a `record` line to the relevant `sec_*` function in [`macvitals.sh`](macvitals.sh) (and, if it's a key indicator, extract it into `summary.json` inside `build_summary`).
2. **Define the rule** — add the threshold/deduction/message to [`shared/ruleset.json`](shared/ruleset.json) (see [`shared/README.md`](shared/README.md) for the schema).
3. **Score it** in both front-ends:
   - CLI: add the branch to `macvitals-analyze.sh` (read tunables via `rget`).
   - Web: add the branch to `web/lib/analyze.ts` (reads the same ruleset) and, if it needs a raw value, to `web/lib/parse.ts`.
4. **Show it** — the web dashboard groups findings by category automatically; add the category to `ruleset.categories` if it's new.
5. **Test**: `bash macvitals.sh /tmp && bash macvitals-analyze.sh /tmp/MacVitals_Report_*`, then `cd web && npm run build`, and drop a report on the local site.

**Invariants any change must preserve:** read-only · zero-dependency (stock macOS tools only) · no fabricated values (missing → `null`/`[skipped]`) · graceful degradation.

---

## Roadmap — done & pending

**Done ✅**
- **Phase 0** — read-only CLI collector + plain-English analyzer.
- **Phase 1** — shared `ruleset.json` consumed by both CLI and web (one source of truth).
- **Phase 2** — static Next.js site: landing, "get the collector", in-browser report parsing + verdict.
- **Phase 3** — dashboard polish: per-category cards with raw-evidence drill-down, redact-for-sharing toggle, demo deep-links (`?demo=good|bad`), animations, light/dark themes.

**Pending / next ⏭**
- **Phase 4** — export a self-contained HTML report + PDF + "copy for AI" from the dashboard.
- **Phase 5** — mobile polish, richer empty/error states.
- **Deferred** — notarized one-click `.pkg`/`.app` collector (removes the Terminal step); optional opt-in cloud history (would introduce a backend + privacy policy).

**Known limitations**
- Fan RPM / per-sensor SMC temps need third-party tools and are intentionally not bundled (use `--with-sudo` for `powermetrics`).
- Apple Diagnostics can't be scripted; `diagnostics.txt` explains how to run it by hand.

---

## Privacy & safety guarantees

- ✅ **Read-only** — the script writes only inside its own timestamped report folder; it changes no settings and installs nothing.
- ✅ **No upload** — the web app has no backend; your report is parsed and scored in your browser.
- ✅ **No sudo** for the core report; the elevated section is opt-in (`--with-sudo`) and still read-only.
- ✅ **No fabricated values** — anything unreadable is reported as `null` / `[skipped]`, never guessed.
- ✅ **Redact-for-sharing** toggle masks the serial number before you screenshot a verdict.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The one hard rule: every change keeps the tool **read-only, dependency-free, and honest**. PRs that add checks should touch `shared/ruleset.json` (not hard-code logic in two places).

---

## Maintaining this README

This README is the canonical entry point — **keep it current**. When you change behavior, update the matching section here in the same PR: the **Roadmap** (move items between done/pending), **What it checks** (new checks), **Repository layout** (new files), and **Deployment** (if the build/hosting changes). A feature isn't "done" until the README reflects it.

---

## License

[MIT](LICENSE) — do what you like. No warranty; you run it at your own discretion.
