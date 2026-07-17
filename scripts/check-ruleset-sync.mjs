#!/usr/bin/env node
// Guards the "single source of truth" contract: every message in
// shared/ruleset.json must still appear (verbatim, minus placeholders) in the
// CLI analyzer, so the terminal verdict and the web verdict never drift.
//
// Cross-platform (Node only) so it runs in CI. Exits non-zero on drift.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ruleset = JSON.parse(readFileSync(join(root, "shared", "ruleset.json"), "utf8"));
// Normalize bash-escaped double quotes (\") to plain quotes so message text
// compares equal regardless of shell-string escaping.
const cli = readFileSync(join(root, "macvitals-analyze.sh"), "utf8").replace(/\\"/g, '"');

const problems = [];

for (const [key, template] of Object.entries(ruleset.messages || {})) {
  // Split the message on {placeholders}; require the longest static chunk to be
  // present verbatim in the CLI script (chunks under 12 chars are too generic).
  const chunks = String(template)
    .split(/\{[^}]+\}/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 12);
  if (chunks.length === 0) continue; // message is essentially all placeholders
  const longest = chunks.sort((a, b) => b.length - a.length)[0];
  if (!cli.includes(longest)) {
    problems.push(`  messages.${key}: CLI is missing → "${longest}"`);
  }
}

if (problems.length) {
  console.error("Ruleset drift detected — shared/ruleset.json and macvitals-analyze.sh disagree:");
  console.error(problems.join("\n"));
  console.error("\nFix: mirror the message wording into macvitals-analyze.sh (see shared/README.md).");
  process.exit(1);
}

console.log(`OK — all ${Object.keys(ruleset.messages || {}).length} ruleset messages are in sync with the CLI.`);
