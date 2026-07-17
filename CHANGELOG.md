# Changelog

All notable changes to MacVitals are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

_Nothing yet._

## [1.0.0] — 2026-07-17

First public release.

### Added
- **CLI collector** (`macvitals.sh`) — read-only macOS diagnostics across hardware,
  battery, storage/SMART, display, thermal, memory, connectivity, ports, camera/audio,
  software/startup items, security/enterprise-management, and system logs. Writes a
  topic-separated report folder + `summary.json` + a `.zip`, with an ASCII banner,
  animated step progress, and a premium terminal presentation.
- **CLI analyzer** (`macvitals-analyze.sh`) — plain-English buy / don't-buy verdict
  with a transparent 0–100 heuristic score.
- **Shared ruleset** (`shared/ruleset.json`) — one source of truth for scoring,
  consumed by both the CLI and the web app.
- **Web app** (`web/`, Next.js static export) — fully client-side dashboard:
  - Landing page with Mac-detection banner and a one-line install (Desktop/Downloads
    save-location picker, "what macOS might ask" explainer).
  - `/report` dashboard: drag-drop `summary.json` or `.zip`, parsed and analyzed
    entirely in the browser; verdict banner, animated score gauge, per-category cards
    with raw-evidence drill-down, redact-for-sharing toggle, demo deep-links.
  - Export: self-contained HTML report, Save as PDF (print), and Copy for AI.
  - Light/dark themes, reveal-on-scroll animations, loading/error states, keyboard
    accessibility, and a responsive mobile layout.
- **Hosting** — `vercel.json` builds `web/` and serves the static export; brand
  logo + favicon + OpenGraph image.
- **Docs & hygiene** — README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue/PR
  templates, and CI (build + shellcheck + ruleset validation).

[Unreleased]: https://github.com/kartikeya1/macvitals/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kartikeya1/macvitals/releases/tag/v1.0.0
