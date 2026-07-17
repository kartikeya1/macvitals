<!-- Thanks for contributing to MacVitals! -->

## What & why

<!-- What does this change do, and why? -->

## Checklist

- [ ] **Read-only** — no command changes settings, installs software, or writes outside the report folder.
- [ ] **No new dependencies** in the CLI (stock macOS tools only).
- [ ] **No fabricated values** — anything unreadable is reported as `null` / `[skipped]`.
- [ ] If I changed scoring, I edited **`shared/ruleset.json`** (not hard-coded logic in two places) and updated both `macvitals-analyze.sh` and `web/lib/analyze.ts`.
- [ ] `node scripts/check-ruleset-sync.mjs` passes (ruleset ↔ CLI parity).
- [ ] `cd web && npm run build` succeeds.
- [ ] I updated the relevant **docs** (README / web/README / WEB_APP_PLAN / CHANGELOG) in this PR.

## Testing

<!-- How did you test? Paste sanitized output if relevant (redact serial/UUIDs). -->
