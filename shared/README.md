# shared/ — single source of truth for the health ruleset

`ruleset.json` holds every tunable number, severity, and plain-English message
the health verdict is built from. Both front-ends read the **same** file so the
CLI verdict and the web verdict never drift:

- **Web** (`web/lib/analyze.ts`) imports it directly (copied to
  `web/lib/ruleset.generated.json` at build time by `web/scripts/sync-assets.mjs`).
- **CLI** (`macvitals-analyze.sh`) loads it at runtime *if it can find it*
  (`shared/ruleset.json` relative to the script), and otherwise falls back to
  identical built-in defaults — so the two `.sh` files still run standalone when
  copied onto a machine by themselves. The CLI reads the **numeric tunables and
  grade bands** from here; the message wording is duplicated in the script only
  so a bare copy still prints friendly text.

## Schema

| Key | Meaning |
|-----|---------|
| `score.start` | Starting score before deductions (100). |
| `score.gradeBands[]` | `{min,label}` bands, highest first, mapping score → grade. |
| `verdicts.{critical,warn,ok}` | Banner `level`, `symbol`, `label`. |
| `categories[]` | `{key,title,icon}` for dashboard grouping. |
| `tunables.*` | Per-check thresholds and point deductions. |
| `messages.*` | Finding text. Placeholders: `{smart}`, `{cap}`, `{cycles}`, `{conditionSuffix}`, `{n}`, `{limit}`. |
| `nextSteps[]` / `nextStepsCriticalExtra` | The "what to do next" checklist. |

## Editing the rules

Change a threshold, weight, or message **here**. Then:

1. The web picks it up on its next build automatically.
2. The CLI picks up numeric changes automatically when run from the repo; if you
   change **message wording**, mirror it into `macvitals-analyze.sh` too (grep
   the message key — the strings match verbatim).

Keep the invariant: severity `critical` findings are deal-breakers and force the
overall verdict to "DO NOT BUY YET" regardless of the numeric score.
