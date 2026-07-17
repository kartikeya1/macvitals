"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReportFile } from "@/lib/parse";
import {
  analyze,
  worstSeverity,
  CATEGORIES,
  type AnalysisResult,
  type Finding,
  type Severity,
} from "@/lib/analyze";
import { healthySample, problemSample } from "@/lib/samples";
import {
  buildReportHtml,
  buildAiText,
  downloadTextFile,
  copyText,
  maskSerial,
  reportFilename,
} from "@/lib/export";

const SEV_LABEL: Record<Severity, string> = {
  critical: "DEAL-BREAKER",
  warn: "CHECK",
  good: "GOOD",
  info: "FYI",
};
const STATUS_LABEL: Record<Severity, string> = {
  critical: "Needs attention",
  warn: "Check",
  good: "Healthy",
  info: "Info",
};
const SEV_RANK: Record<Severity, number> = { critical: 0, warn: 1, good: 2, info: 3 };

function ScoreGauge({ score, grade, level }: { score: number; grade: string; level: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const target = c * (1 - score / 100);
  const color = level === "critical" ? "var(--crit)" : level === "warn" ? "var(--warn)" : "var(--ok)";

  // Start empty, then animate to the target so the arc "fills" on reveal.
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [target, c]);

  return (
    <div className="gauge" aria-label={`Health score ${score} of 100`}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          className="arc"
          cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div className="val">
        <span className="num">{score}</span>
        <span className="grade">{grade}</span>
      </div>
    </div>
  );
}

function CategoryCard({
  icon,
  title,
  findings,
  evidence,
}: {
  icon: string;
  title: string;
  findings: Finding[];
  evidence: { label: string; value: string }[];
}) {
  const worst = worstSeverity(findings);
  const openByDefault = worst === "critical" || worst === "warn";
  return (
    <details className="catcard result-in" open={openByDefault}>
      <summary className="cathead">
        <span className="cat-ic">{icon}</span>
        <span className="cat-title">{title}</span>
        <span className={`tag ${worst}`}>{STATUS_LABEL[worst]}</span>
        <span className="chev" aria-hidden>›</span>
      </summary>
      <div className="catbody">
        {findings.map((f, i) => (
          <div className="finding" key={i}>
            <span className={`tag ${f.severity}`}>{SEV_LABEL[f.severity]}</span>
            <span>{f.text}</span>
          </div>
        ))}
        {evidence.length > 0 && (
          <div className="evidence">
            <div className="evidence-title">Evidence from the report</div>
            {evidence.map((e) => (
              <div className="ev-row" key={e.label}>
                <span className="k">{e.label}</span>
                <span className="v">{e.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default function ReportPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [redact, setRedact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDownloadHtml = () => {
    if (!result) return;
    downloadTextFile(reportFilename(result, "html"), buildReportHtml(result, { redact }), "text/html");
  };

  const onCopyAi = async () => {
    if (!result) return;
    const ok = await copyText(buildAiText(result, { redact }));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const onSavePdf = () => {
    // Expand every category card so its evidence prints, then open the OS print
    // dialog (which offers "Save as PDF"). No PDF library needed.
    document.querySelectorAll<HTMLDetailsElement>(".catcard").forEach((d) => (d.open = true));
    window.print();
  };

  const loadSample = useCallback((which: "good" | "bad") => {
    setError(null);
    setIsSample(true);
    setResult(analyze(which === "good" ? healthySample : problemSample));
    if (typeof window !== "undefined") window.scrollTo({ top: 240, behavior: "smooth" });
  }, []);

  // Support deep-links like /report/?demo=good so the landing page can show a
  // populated dashboard in one click.
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get("demo");
    if (demo === "good" || demo === "bad") loadSample(demo);
  }, [loadSample]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsSample(false);
    setLoading(true);
    try {
      const input = await parseReportFile(file);
      setResult(analyze(input));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Category cards ordered worst-first so problems surface at the top.
  const orderedCats = result
    ? CATEGORIES.map((cat) => ({ ...cat, findings: result.byCategory[cat.key] || [] }))
        .filter((cat) => cat.findings.length > 0)
        .sort((a, b) => SEV_RANK[worstSeverity(a.findings)] - SEV_RANK[worstSeverity(b.findings)])
    : [];

  return (
    <main>
      <section className="hero" style={{ padding: "40px 0 18px" }}>
        <h1 style={{ fontSize: "2rem" }}>Analyze a report</h1>
        <p className="sub">
          Drop your <code>summary.json</code> or the <code>MacVitals_Report</code> <code>.zip</code>.
          It&apos;s read and analyzed right here in your browser — nothing is uploaded.
        </p>
      </section>

      <p className="note" style={{ textAlign: "center", marginBottom: 8 }}>
        No report yet? Try a demo:
      </p>
      <div className="samples">
        <button className="btn small" onClick={() => loadSample("good")}>✅ Load a healthy example</button>
        <button className="btn small secondary" onClick={() => loadSample("bad")}>🚩 Load a problem example</button>
      </div>

      <div
        className={"dropzone" + (dragging ? " drag" : "") + (loading ? " busy" : "")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !loading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop a report file, or press Enter to choose one"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <div className="spinner" aria-hidden />
            <h3>Reading your report…</h3>
            <p>Parsing and analyzing locally — this stays on your device.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: "2rem" }}>📄</div>
            <h3>Drop your report here</h3>
            <p>or click to choose a file (summary.json or .zip)</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".json,.zip"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {error && (
        <div className="errorbox" role="alert">
          <span className="ico" aria-hidden>⚠️</span>
          <span className="msg">{error}</span>
          <button className="dismiss" aria-label="Dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {result && (
        <>
          {isSample && (
            <p className="note" style={{ textAlign: "center", marginTop: 18, marginBottom: 0 }}>
              📋 This is a <b>demo report</b> with made-up data — just to show what the results look like.
            </p>
          )}

          <div className={`verdict result-in ${result.verdict.level}`} style={{ marginTop: 20 }}>
            <ScoreGauge score={result.score} grade={result.grade} level={result.verdict.level} />
            <div>
              <div className="label">{result.verdict.label}</div>
              <div className="note" style={{ marginTop: 6 }}>
                Indicative health score {result.score}/100 ({result.grade}). Transparent heuristic —
                every finding below cites a value from your report.
              </div>
            </div>
          </div>

          <div className="card result-in">
            <div className="machine">
              <span><b>{result.machine.model}</b></span>
              <span>{result.machine.chip}</span>
              <span>{result.machine.ram}</span>
              <span>{result.machine.os}</span>
              <span className="note">
                Serial {redact ? maskSerial(result.machine.serial) : result.machine.serial}
              </span>
              <label className="redact" title="Hide identifiers before sharing a screenshot">
                <input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} />
                Redact for sharing
              </label>
            </div>
          </div>

          <div className="catgrid">
            {orderedCats.map((cat) => (
              <CategoryCard
                key={cat.key}
                icon={cat.icon}
                title={cat.title}
                findings={cat.findings}
                evidence={result.evidence[cat.key] || []}
              />
            ))}
          </div>

          <div className="card result-in">
            <h3 style={{ marginTop: 0 }}>What to do next</h3>
            <ol className="next">
              {result.nextSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="card result-in no-print export-bar">
            <div>
              <b>Save or share this report</b>
              <div className="note" style={{ marginTop: 2 }}>
                Everything is generated locally.{" "}
                {redact ? "Serial is redacted in exports." : "Turn on “Redact for sharing” above to mask the serial."}
              </div>
            </div>
            <div className="export-actions">
              <button className="btn small" onClick={onDownloadHtml}>⬇ Download HTML report</button>
              <button className="btn small secondary" onClick={onSavePdf}>🖨 Save as PDF</button>
              <button className="btn small secondary" onClick={onCopyAi}>
                {copied ? "Copied ✓" : "📋 Copy for AI"}
              </button>
            </div>
          </div>

          <p className="note no-print" style={{ textAlign: "center" }}>
            <button className="btn secondary" onClick={() => { setResult(null); setError(null); setIsSample(false); }}>
              Analyze another report
            </button>
          </p>
        </>
      )}
    </main>
  );
}
