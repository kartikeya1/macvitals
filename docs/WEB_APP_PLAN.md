# MacVitals Web — Product & Technical Plan

_Status: planning. The CLI (`macvitals.sh` + `macvitals-analyze.sh`) is built and working. This document plans the hosted web experience._

---

## 1. The one constraint that shapes everything

**A web browser cannot read Mac hardware.** Battery cycle count, SMART status, MDM enrollment, serial numbers — none of it is reachable from JavaScript. macOS sandboxes all of it behind native tools (`system_profiler`, `ioreg`, `pmset`, …).

So a "run it entirely in the browser" product is **impossible**. There will always be a local collection step. The web app's job is to make everything _around_ that step effortless:

```
   ┌─────────────────────────┐     ┌──────────────────────────┐     ┌───────────────────────┐
   │  1. GET THE COLLECTOR    │     │  2. RUN IT LOCALLY (once) │     │  3. VIEW THE DASHBOARD │
   │  website → copy 1 command│ ──► │  Terminal: bash macvitals │ ──► │  drag the report onto  │
   │  or download macvitals.sh│     │  produces MacVitals_Report│     │  the site → pretty UI  │
   └─────────────────────────┘     └──────────────────────────┘     └───────────────────────┘
                                                                        (parsed 100% in-browser,
                                                                         nothing is uploaded)
```

The value proposition: today a non-technical person gets a plain-text verdict in Terminal. The web app turns that same data into a **shareable, visual health dashboard** — and lowers the "how do I even get the script" friction to one copy-paste.

---

## 2. Data model decision: fully client-side (locked)

- The report (which contains serial numbers, hardware UUIDs, MAC addresses, and MDM server URLs) is parsed and analyzed **entirely in the browser**. It is never sent to any server.
- "Keep their logs / download logs package" = **local downloads**, not server storage:
  - Download the original `.zip` (they already have it).
  - Download a **self-contained HTML report** (the rendered dashboard saved as one file they can keep, email, or hand to a buyer/seller).
  - Optional: a one-page **PDF** export.
- Consequence: **no backend, no database, no accounts, no privacy policy headaches, free static hosting on Vercel.** This is both the cheapest and the most trustworthy option — and "your data never leaves your device" becomes a headline feature.

> Future option (explicitly deferred): opt-in cloud history with accounts, to track a Mac's health over time. Only worth it if there's demand; it reintroduces a backend, DB, auth, and a privacy policy. Not in the initial scope.

---

## 3. Architecture

```
macvitals/                 ← repo root (CLI lives here today)
├── macvitals.sh
├── macvitals-analyze.sh
├── shared/
│   └── ruleset.json        ← the scoring rules, as data (single source of truth)
└── web/                    ← the Vercel app (new)
    ├── app/                ← Next.js App Router (static export)
    │   ├── page.tsx        ← landing + "get the collector"
    │   └── report/page.tsx ← the dashboard (drop zone → visualized report)
    ├── lib/
    │   ├── parse.ts        ← read summary.json / unzip a .zip in-browser (JSZip)
    │   └── analyze.ts      ← the SAME heuristic as macvitals-analyze.sh, in TS
    ├── components/         ← ScoreGauge, VerdictBanner, CategoryCard, FindingList…
    └── public/
```

- **Framework:** Next.js (App Router) with `output: 'export'` → pure static site. Most Vercel-native; you deploy by connecting the repo. (A plain Vite + React SPA is an equally fine fallback.)
- **Styling:** Tailwind CSS. Dark/light aware.
- **In-browser parsing:** `JSZip` to read an uploaded `.zip`; native `JSON.parse` for `summary.json`. Text files (`system.txt`, `thermal.txt`) parsed for the same signals the CLI uses (panics, CPU speed limit).
- **No network calls at runtime.** A strict Content-Security-Policy blocks egress — enforces the privacy promise at the browser level.

### Avoiding two copies of the logic

The scoring lives in **one place** and both the shell analyzer and the web app read it:

- Extract the rules (thresholds, messages, severities) into `shared/ruleset.json`.
- `macvitals-analyze.sh` reads it (via `plutil`/simple parsing); `web/lib/analyze.ts` imports it.
- This keeps the CLI verdict and the web verdict **identical**, and makes contributions land in one file.

---

## 4. The dashboard (feature 3: "human-readable analysis")

What the `/report` page renders after a drop:

1. **Verdict banner** — big, color-coded: ✅ Healthy / ⚠️ Caution / ❌ Don't buy yet. Mirrors the CLI.
2. **Health score gauge** — the 0–100 heuristic as a radial gauge, with the grade band.
3. **At-a-glance machine card** — model, chip, RAM, macOS, serial (with a "hide/redact" toggle for sharing).
4. **Category tiles** — Battery, Storage, Security, Thermal, Stability, Display — each a card with a status pill and the one-line finding. Click to expand the raw evidence from the report.
5. **Deal-breakers / Check / Looks good / Good-to-know** — the four grouped finding lists, same as the CLI, but with icons and expandable detail.
6. **"What to do next"** checklist — the actionable seller/buyer steps.
7. **Export bar** — Download HTML report · Download PDF · Copy summary for ChatGPT/Claude · Re-drop another report.

Design: clean, calm, trustworthy (it's a health report). Accessible color use (not color-only status). Fully responsive — someone may open it on a phone next to the laptop they're inspecting.

---

## 5. Getting the collector (feature: "minimal steps")

The landing page offers, in order of friendliness:

1. **Copy one command** (primary CTA):
   ```
   curl -fsSL https://<your-domain>/macvitals.sh -o macvitals.sh && bash macvitals.sh
   ```
   With a clear, honest note: _"This downloads our open-source script and runs it locally. Read it first — it's ~600 lines and does nothing but read your Mac."_ (We deliberately do **not** pipe `curl | bash` — the file is saved so a cautious user can inspect it.)
2. **Download `macvitals.sh`** (button) — for people who'd rather not use `curl`.
3. **View source on GitHub** — trust link.

Both scripts are served as static assets from `web/public/`, kept in sync with the repo root by a tiny build step (copy on `predev`/`prebuild`).

> **Gatekeeper reality:** a downloaded script is quarantined; running it via `bash macvitals.sh` sidesteps the "unidentified developer" block. The page shows this explicitly. A future notarized `.pkg`/`.app` would remove even this step (see roadmap).

---

## 6. Keeping logs (feature 2: "analyse + keep their logs, downloadable package")

Handled locally, in the browser:

- After analysis, an **Export** action bundles the parsed data + the rendered verdict into a **single downloadable HTML file** (self-contained, works offline forever) and/or re-packages the original files as a `.zip` via JSZip.
- Nothing is stored server-side. If the user wants history, they keep the downloaded files (or, later, opt into cloud history — deferred).

---

## 7. Phased roadmap

| Phase | Deliverable | Status |
|------:|-------------|--------|
| **0** | CLI collector + analyzer | ✅ done |
| **1** | `shared/ruleset.json`: analyzer rules as data; CLI loads it (with standalone fallback), web imports it — one source of truth | ✅ done |
| **2** | Static Next.js app on Vercel: landing + "get the collector"; plus a working `/report` drag-drop → in-browser parse+analyze → verdict + score gauge + findings | ✅ done |
| **3** | Dashboard polish: per-category cards with expandable raw evidence, redact-for-sharing toggle, sample/demo mode | ⏭ next |
| **4** | Export: self-contained HTML report + PDF + "copy for AI" | ⏭ |
| **5** | Polish: mobile pass, animations, empty/error states | ⏭ |
| **6** _(deferred)_ | Notarized `.pkg`/`.app` one-click collector; optional cloud history with accounts | ⏭ |

> Phase 2 already includes a functional `/report` dashboard (verdict banner, radial score gauge, machine card, grouped findings, next-steps) — verified to produce the **same** verdict as the CLI. Phase 3 is polish (evidence drill-down, redaction, demo mode), not core function.

Build & deploy notes live in [`../web/README.md`](../web/README.md).

---

## 8. Open decisions (for later)

- **Domain** for serving the script + app (affects the `curl` command).
- **PDF export**: client-side (`html2pdf`/print CSS) vs skip for MVP (HTML export may be enough).
- **Demo mode**: ship a sample report so first-time visitors can see the dashboard without running anything — strongly recommended for a show-off repo.
- **Notarized native collector**: removes the Terminal step entirely, but needs an Apple Developer account ($99/yr) and a build pipeline.

---

## 9. Why this design is the right call

- **Trust:** the exact reason someone runs a health check on a used/second-hand Mac is that they don't fully trust it. Uploading its serial number and MDM details to a stranger's server undercuts that. "Runs locally, nothing uploaded" is not a limitation here — it's the feature.
- **Cost:** $0 static hosting, no DB, no auth to maintain.
- **Speed to ship:** the analysis logic already exists; Phase 1–4 is mostly a UI over a known ruleset.
