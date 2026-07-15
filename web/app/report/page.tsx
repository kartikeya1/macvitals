"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReportFile } from "@/lib/parse";
import { analyze, type AnalysisResult, type Severity } from "@/lib/analyze";
import { healthySample, problemSample } from "@/lib/samples";

const SEV_LABEL: Record<Severity, string> = {
  critical: "DEAL-BREAKER",
  warn: "CHECK",
  good: "GOOD",
  info: "FYI",
};

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

export default function ReportPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSample = (which: "good" | "bad") => {
    setError(null);
    setIsSample(true);
    setResult(analyze(which === "good" ? healthySample : problemSample));
    if (typeof window !== "undefined") window.scrollTo({ top: 260, behavior: "smooth" });
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsSample(false);
    try {
      const input = await parseReportFile(file);
      setResult(analyze(input));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not read that file.");
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

  const order: Severity[] = ["critical", "warn", "good", "info"];

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
        className={"dropzone" + (dragging ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <div style={{ fontSize: "2rem" }}>📄</div>
        <h3>Drop your report here</h3>
        <p>or click to choose a file (summary.json or .zip)</p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.zip"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--crit)", color: "var(--crit)" }}>
          {error}
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
              <span className="note">Serial {result.machine.serial}</span>
            </div>
          </div>

          <div className="card findings result-in">
            {order.map((sev) =>
              result.groups[sev].length ? (
                <div key={sev}>
                  <h3>
                    {sev === "critical" && "🚫 Deal-breakers"}
                    {sev === "warn" && "⚠️ Things to check or negotiate on"}
                    {sev === "good" && "✅ Looks good"}
                    {sev === "info" && "ℹ️ Good to know"}
                  </h3>
                  {result.groups[sev].map((f, i) => (
                    <div className="finding" key={i}>
                      <span className={`tag ${sev}`}>{SEV_LABEL[sev]}</span>
                      <span>{f.text}</span>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>

          <div className="card result-in">
            <h3 style={{ marginTop: 0 }}>What to do next</h3>
            <ol className="next">
              {result.nextSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          <p className="note" style={{ textAlign: "center" }}>
            <button className="btn secondary" onClick={() => { setResult(null); setError(null); }}>
              Analyze another report
            </button>
          </p>
        </>
      )}
    </main>
  );
}
