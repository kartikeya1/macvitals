// Copies the canonical repo assets into the web app so it can serve/import them.
// Runs automatically before `dev` and `build` (see package.json). This is what
// keeps the downloadable script and the web ruleset in lockstep with the CLI.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const repo = join(web, ".."); // repo root (where the .sh files live)

mkdirSync(join(web, "public"), { recursive: true });
mkdirSync(join(web, "lib"), { recursive: true });

const copies = [
  // Served as downloadable static assets:
  [join(repo, "macvitals.sh"), join(web, "public", "macvitals.sh")],
  [join(repo, "macvitals-analyze.sh"), join(web, "public", "macvitals-analyze.sh")],
  // Imported by the web analyzer so CLI + web share ONE ruleset:
  [join(repo, "shared", "ruleset.json"), join(web, "lib", "ruleset.generated.json")],
];

let ok = 0;
for (const [src, dst] of copies) {
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log("[sync-assets] " + dst.replace(web + "/", ""));
    ok++;
  } else {
    console.warn("[sync-assets] MISSING source, skipped: " + src);
  }
}
console.log(`[sync-assets] done (${ok}/${copies.length} synced)`);
