# Contributing

Thanks for your interest in improving MacVitals! This is a small,
dependency-free project and contributions are welcome.

## Ground rules

The whole point of this tool is that it is **safe to run on a machine you don't
own yet**. Any contribution MUST preserve these invariants:

1. **Read-only.** No command may modify settings, install software, or write
   anywhere except the tool's own output folder.
2. **No dependencies.** Stock macOS utilities only — no Homebrew, `jq`, Python,
   or anything a fresh, offline Mac wouldn't already have.
3. **No fabricated data.** If a value can't be read, report `null` / `[skipped]`
   — never guess or interpolate.
4. **Graceful degradation.** A missing or blocked command must produce a note,
   never abort the run.

## How to contribute

1. Fork and create a branch.
2. Make your change. If you add a data source, add it to both the relevant
   `*.txt` collector and (if it's a key indicator) to `summary.json` and the
   analyzer's scoring.
3. Test on a real Mac:
   ```bash
   bash macvitals.sh /tmp
   bash macvitals-analyze.sh /tmp/MacVitals_Report_*
   plutil -convert xml1 -o /dev/null /tmp/MacVitals_Report_*/summary.json  # must validate
   ```
4. If you can, test on **both** an Apple Silicon and an Intel Mac — the code
   must not break on either.
5. Open a PR describing what you added and why, and paste a sanitized snippet of
   the new output (redact your serial number / UUIDs).

## Good first contributions

- Additional SMART / NVMe attributes worth surfacing.
- Better heuristics in the analyzer (with a clear rationale — keep it transparent).
- Intel-Mac-specific coverage and testing.
- Localization of the analyzer's plain-English output.

## Reporting issues

Open an issue with your macOS version, Mac model (Apple Silicon or Intel), and
the relevant snippet of output (redact anything identifying).
