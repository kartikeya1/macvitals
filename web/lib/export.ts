// Client-side export helpers: a self-contained HTML report, an AI-ready text
// summary, and small download/clipboard utilities. Everything runs in the
// browser — consistent with MacVitals never uploading your data.
import {
  CATEGORIES,
  worstSeverity,
  type AnalysisResult,
  type Finding,
  type Severity,
} from "./analyze";

const SEV_LABEL: Record<Severity, string> = {
  critical: "DEAL-BREAKER",
  warn: "CHECK",
  good: "GOOD",
  info: "FYI",
};

export function maskSerial(s: string): string {
  if (!s || s.length < 4 || s === "Unknown") return s;
  return s.slice(0, 3) + "•".repeat(Math.max(4, s.length - 3));
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "report";
}

/** yyyy-mm-dd from a Date (browser runtime — Date is available here). */
function dateStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function reportFilename(result: AnalysisResult, ext: string): string {
  return `MacVitals_${sanitizeFilename(result.machine.model)}_${dateStamp(new Date())}.${ext}`;
}

// ---------------------------------------------------------------------------
// Self-contained HTML report (inline CSS, printable, works offline forever)
// ---------------------------------------------------------------------------
export function buildReportHtml(result: AnalysisResult, opts: { redact: boolean }): string {
  const serial = opts.redact ? maskSerial(result.machine.serial) : result.machine.serial;
  const vColor =
    result.verdict.level === "critical" ? "#be123c" : result.verdict.level === "warn" ? "#b45309" : "#15803d";
  const vBg =
    result.verdict.level === "critical" ? "#fdeaee" : result.verdict.level === "warn" ? "#fdf2e2" : "#e7f6ec";

  const tagColor: Record<Severity, [string, string]> = {
    critical: ["#be123c", "#fdeaee"],
    warn: ["#b45309", "#fdf2e2"],
    good: ["#15803d", "#e7f6ec"],
    info: ["#1d4ed8", "#e9f0fe"],
  };

  const findingHtml = (f: Finding) => {
    const [fg, bg] = tagColor[f.severity];
    return `<div class="f"><span class="tag" style="color:${fg};background:${bg}">${SEV_LABEL[f.severity]}</span><span>${esc(
      f.text
    )}</span></div>`;
  };

  const cats = CATEGORIES.map((c) => ({ ...c, findings: result.byCategory[c.key] || [] })).filter(
    (c) => c.findings.length > 0
  );

  const catHtml = cats
    .map((c) => {
      const ev = (result.evidence[c.key] || [])
        .map((e) => `<tr><td class="k">${esc(e.label)}</td><td class="v">${esc(e.value)}</td></tr>`)
        .join("");
      return `
      <section class="cat">
        <h3>${c.icon} ${esc(c.title)} <span class="status" style="color:${tagColor[worstSeverity(c.findings)][0]}">●</span></h3>
        ${c.findings.map(findingHtml).join("")}
        ${ev ? `<table class="ev"><caption>Evidence from the report</caption>${ev}</table>` : ""}
      </section>`;
    })
    .join("");

  const steps = result.nextSteps.map((s) => `<li>${esc(s)}</li>`).join("");
  const generated = new Date().toLocaleString();

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>MacVitals report — ${esc(result.machine.model)}</title>
<style>
  :root{--ink:#0f172a;--muted:#64748b;--border:#e5e9f0;--panel:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:#f4f6fb;color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:820px;margin:0 auto;padding:32px 22px 60px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.2rem;letter-spacing:-.02em}
  .brand .m{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#2563eb,#0ea5e9)}
  .meta{color:var(--muted);font-size:.85rem;margin:4px 0 22px}
  .verdict{display:flex;gap:20px;align-items:center;background:${vBg};border:1px solid ${vColor}55;border-radius:16px;padding:22px 24px;margin-bottom:18px}
  .score{flex:0 0 auto;width:84px;height:84px;border-radius:50%;border:8px solid ${vColor};display:flex;flex-direction:column;align-items:center;justify-content:center}
  .score b{font-size:1.5rem;line-height:1}.score small{color:var(--muted);font-size:.7rem}
  .verdict .lbl{font-size:1.15rem;font-weight:750;color:${vColor}}
  .machine{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px 20px;margin-bottom:18px;color:var(--muted);font-size:.92rem}
  .machine b{color:var(--ink)}
  .cat{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px 20px;margin-bottom:12px}
  .cat h3{margin:0 0 10px;font-size:1.02rem}
  .f{display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--border)}
  .f:first-of-type{border-top:none}
  .tag{flex:0 0 auto;font-size:.66rem;font-weight:800;padding:3px 8px;border-radius:6px;height:fit-content;letter-spacing:.04em}
  table.ev{width:100%;border-collapse:collapse;margin-top:12px;background:#f2f5fa;border-radius:10px;overflow:hidden}
  table.ev caption{caption-side:top;text-align:left;font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:10px 12px 4px}
  table.ev td{padding:6px 12px;border-top:1px solid var(--border);font-size:.9rem}
  table.ev td.k{color:var(--muted)}table.ev td.v{text-align:right;font-weight:650;font-family:ui-monospace,Menlo,monospace;font-size:.85rem}
  h2{font-size:1.05rem;margin:22px 0 8px}
  ol{padding-left:20px}ol li{margin-bottom:8px}
  .foot{color:var(--muted);font-size:.8rem;margin-top:28px;border-top:1px solid var(--border);padding-top:16px}
</style></head>
<body><div class="wrap">
  <div class="brand"><span class="m"></span>MacVitals</div>
  <div class="meta">Health report · generated ${esc(generated)} · analyzed locally, never uploaded</div>

  <div class="verdict">
    <div class="score"><b>${result.score}</b><small>${esc(result.grade)}</small></div>
    <div><div class="lbl">${esc(result.verdict.label)}</div>
    <div class="meta" style="margin:6px 0 0">Indicative 0–100 heuristic · every finding cites a value from the report.</div></div>
  </div>

  <div class="machine"><b>${esc(result.machine.model)}</b> · ${esc(result.machine.chip)} · ${esc(
    result.machine.ram
  )} · ${esc(result.machine.os)} · Serial ${esc(serial)}</div>

  ${catHtml}

  <h2>What to do next</h2>
  <ol>${steps}</ol>

  <div class="foot">Generated by MacVitals · macvitals.vercel.app · This is a decision aid, not a guarantee.</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// AI-ready plain-text summary (paste into ChatGPT / Claude)
// ---------------------------------------------------------------------------
export function buildAiText(result: AnalysisResult, opts: { redact: boolean }): string {
  const serial = opts.redact ? maskSerial(result.machine.serial) : result.machine.serial;
  const lines: string[] = [];
  lines.push("MacVitals health report (read-only diagnostics from a Mac)");
  lines.push("");
  lines.push(`Machine: ${result.machine.model} · ${result.machine.chip} · ${result.machine.ram} · ${result.machine.os}`);
  lines.push(`Serial: ${serial}`);
  lines.push(`Verdict: ${result.verdict.label}`);
  lines.push(`Indicative health score: ${result.score}/100 (${result.grade})`);
  lines.push("");

  const section = (title: string, arr: Finding[]) => {
    if (!arr.length) return;
    lines.push(title);
    for (const f of arr) lines.push(`- ${f.text}`);
    lines.push("");
  };
  section("DEAL-BREAKERS:", result.groups.critical);
  section("THINGS TO CHECK / NEGOTIATE:", result.groups.warn);
  section("LOOKS GOOD:", result.groups.good);
  section("GOOD TO KNOW:", result.groups.info);

  lines.push("EVIDENCE FROM THE REPORT:");
  for (const c of CATEGORIES) {
    const rows = result.evidence[c.key] || [];
    if (!rows.length) continue;
    lines.push(`  ${c.title}: ${rows.map((r) => `${r.label}=${r.value}`).join(", ")}`);
  }
  lines.push("");
  lines.push(
    "Question: Based on this report, should I buy this Mac (or is mine healthy)? What are the biggest risks, what should I check or negotiate on, and what future maintenance is likely?"
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts where the async Clipboard API is blocked.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
