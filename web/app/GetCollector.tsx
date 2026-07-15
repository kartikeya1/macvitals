"use client";

import { useState } from "react";
import CopyCommand from "./CopyCommand";
import { SITE_ORIGIN, GITHUB_URL, COLLECTOR_FILENAME } from "@/lib/site";

type Loc = "desktop" | "downloads" | "current";

const LOCATIONS: { key: Loc; label: string; arg: string; where: string }[] = [
  { key: "desktop", label: "Desktop", arg: " ~/Desktop", where: "~/Desktop" },
  { key: "downloads", label: "Downloads", arg: " ~/Downloads", where: "~/Downloads" },
  { key: "current", label: "Current folder", arg: "", where: "the folder you run it in" },
];

export default function GetCollector() {
  const [loc, setLoc] = useState<Loc>("desktop");
  const chosen = LOCATIONS.find((l) => l.key === loc)!;
  const command = `curl -fsSL ${SITE_ORIGIN}/${COLLECTOR_FILENAME} -o macvitals.sh && bash macvitals.sh${chosen.arg}`;

  return (
    <section id="get" className="card" data-reveal>
      <h2>Get the collector</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Open the <b>Terminal</b> app on the Mac you want to check, then paste this and press Return.
        It downloads the open-source script and runs it locally:
      </p>

      <div className="loc-picker">
        <span className="loc-label">Save the report to:</span>
        {LOCATIONS.map((l) => (
          <button
            key={l.key}
            className={"loc-btn" + (loc === l.key ? " active" : "")}
            onClick={() => setLoc(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <CopyCommand command={command} />

      <p className="note" style={{ marginTop: 12 }}>
        📁 When it finishes, your report is saved to{" "}
        <b>{chosen.where}/MacVitals_Report_&lt;date&gt;/</b> along with a{" "}
        <b>.zip</b> of the same name. Drag that <code>.zip</code> onto the{" "}
        <a href="/report/">Analyze a report</a> page — the Terminal also prints the exact path when it&apos;s done.
      </p>

      <details className="perm">
        <summary>🔐 What macOS might ask you — and why</summary>
        <div className="perm-body">
          <p>
            MacVitals is <b>read-only</b> and does <b>not</b> need your admin password for the standard
            check. It never installs anything, and never changes a setting.
          </p>
          <ul>
            <li>
              <b>&ldquo;Terminal wants to access data from other apps / System Events&rdquo;</b> — this can
              appear when it reads a couple of system areas (like your login items). Click{" "}
              <b>Allow</b> to include those checks, or <b>Don&apos;t Allow</b> to simply skip them — the
              rest of the report is unaffected.
            </li>
            <li>
              <b>A password prompt</b> only appears if you choose to run the optional deep scan
              (<code>--with-sudo</code>). The one-click command above never uses it.
            </li>
            <li>
              Because you run it with <code>bash</code>, macOS won&apos;t block it with the
              &ldquo;unidentified developer&rdquo; warning.
            </li>
          </ul>
        </div>
      </details>

      <p className="note" style={{ marginTop: 14 }}>
        Prefer not to use <code>curl</code>?{" "}
        <a href={`/${COLLECTOR_FILENAME}`} download>Download {COLLECTOR_FILENAME}</a> and run{" "}
        <code>bash {COLLECTOR_FILENAME}</code>. ·{" "}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">View source on GitHub</a>
      </p>
      <p className="note">
        <b>macOS only</b> (Apple Silicon or Intel).
      </p>
    </section>
  );
}
