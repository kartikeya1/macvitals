// Web port of the MacVitals health analysis. It reads the SAME ruleset the CLI
// uses (shared/ruleset.json, synced to lib/ruleset.generated.json at build) so
// the browser verdict and the terminal verdict are identical.
import rulesetJson from "./ruleset.generated.json";

export type Severity = "critical" | "warn" | "good" | "info";

export interface Finding {
  severity: Severity;
  category: string; // one of ruleset.categories[].key
  text: string;
}

/** Normalized inputs the analyzer reasons about. Mirrors summary.json plus two
 *  signals that only exist in the text files (present only when a .zip is dropped). */
export interface AnalysisInput {
  hardware?: {
    model_name?: string;
    chip?: string;
    memory?: string;
    serial_number?: string;
  };
  software?: { os_version?: string };
  battery?: {
    maximum_capacity_percent?: string;
    raw_health_percent_from_registers?: string;
    cycle_count?: string;
    condition?: string;
  };
  storage?: {
    smart_status?: string;
    trim_support?: string;
    ssd_model?: string;
    capacity?: string;
  };
  security?: {
    sip?: string;
    filevault?: string;
    gatekeeper?: string;
    activation_lock?: string;
    mdm_enrollment?: string;
    configuration_profile_count?: number | string;
  };
  panics?: number; // undefined when unknown (summary.json-only drop)
  cpuSpeedLimit?: number | null; // undefined/null when unknown
}

export interface EvidenceRow {
  label: string;
  value: string;
}

export interface AnalysisResult {
  machine: { model: string; chip: string; ram: string; os: string; serial: string };
  score: number;
  grade: string;
  verdict: { level: "critical" | "warn" | "ok"; symbol: string; label: string };
  findings: Finding[];
  groups: Record<Severity, Finding[]>;
  byCategory: Record<string, Finding[]>;
  evidence: Record<string, EvidenceRow[]>;
  nextSteps: string[];
  hasCritical: boolean;
}

/** Worst severity present in a set of findings, for a category's status pill. */
export function worstSeverity(findings: Finding[]): Severity {
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  if (findings.some((f) => f.severity === "good")) return "good";
  return "info";
}

interface Ruleset {
  score: { start: number; gradeBands: { min: number; label: string }[] };
  verdicts: Record<"critical" | "warn" | "ok", { level: "critical" | "warn" | "ok"; symbol: string; label: string }>;
  categories: { key: string; title: string; icon: string }[];
  tunables: {
    battery: { goodPct: number; finePct: number; wornPct: number; deductWorn: number; deductBad: number };
    smart: { deductBad: number; deductUnknown: number };
    activationLock: { deductOn: number; deductUnknown: number };
    mdm: { deduct: number };
    profiles: { deduct: number };
    panics: { deduct: number };
    thermal: { deduct: number };
  };
  messages: Record<string, string>;
  nextSteps: string[];
  nextStepsCriticalExtra: string;
}

const R = rulesetJson as unknown as Ruleset;

export const CATEGORIES = R.categories;

function lc(s: string | undefined): string {
  return (s ?? "").toLowerCase();
}

function digits(s: string | undefined): number | null {
  if (s == null) return null;
  const d = String(s).replace(/[^0-9]/g, "");
  return d === "" ? null : parseInt(d, 10);
}

/** Fill {placeholders} in a ruleset message. */
function msg(key: string, vars: Record<string, string | number> = {}): string {
  let t = R.messages[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    t = t.replaceAll(`{${k}}`, String(v));
  }
  return t;
}

export function analyze(input: AnalysisInput): AnalysisResult {
  const findings: Finding[] = [];
  let score = R.score.start;
  const t = R.tunables;

  const add = (severity: Severity, category: string, text: string, deduct = 0) => {
    findings.push({ severity, category, text });
    score -= deduct;
  };

  // --- Storage / SSD (critical) ---
  const smart = input.storage?.smart_status;
  if (lc(smart) === "verified") {
    add("good", "storage", msg("smart.ok"));
  } else if (smart) {
    add("critical", "storage", msg("smart.bad", { smart }), t.smart.deductBad);
  } else {
    add("warn", "storage", msg("smart.unknown"), t.smart.deductUnknown);
  }
  if (lc(input.storage?.trim_support) === "yes") add("good", "storage", msg("trim.ok"));

  // --- Enterprise management / ownership (critical) ---
  const al = lc(input.security?.activation_lock);
  if (al.includes("disabl")) add("good", "security", msg("activationLock.ok"));
  else if (al.includes("enabl")) add("critical", "security", msg("activationLock.on"), t.activationLock.deductOn);
  else add("warn", "security", msg("activationLock.unknown"), t.activationLock.deductUnknown);

  const mdm = lc(input.security?.mdm_enrollment);
  const managed = mdm.includes("enrollment: yes") || mdm.includes("mdm server") || mdm.includes("managed by");
  if (managed) add("critical", "security", msg("mdm.managed"), t.mdm.deduct);
  else if (mdm) add("good", "security", msg("mdm.clean"));

  const profRaw = input.security?.configuration_profile_count;
  const profCount = typeof profRaw === "number" ? profRaw : digits(profRaw as string | undefined);
  if (profCount != null) {
    if (profCount > 0) add("warn", "security", msg("profiles.present", { n: profCount }), t.profiles.deduct);
    else add("good", "security", msg("profiles.none"));
  }

  const sip = lc(input.security?.sip);
  if (sip) add(sip.includes("enabled") ? "good" : "warn", "security", sip.includes("enabled") ? msg("sip.ok") : msg("sip.off"));
  const gk = lc(input.security?.gatekeeper);
  if (gk.includes("enabled")) add("good", "security", msg("gatekeeper.ok"));
  const fv = lc(input.security?.filevault);
  if (fv.includes(" on") || fv.includes("is on")) add("info", "security", msg("filevault.on"));

  // --- Battery ---
  let cap = digits(input.battery?.maximum_capacity_percent);
  if (cap == null) cap = digits(input.battery?.raw_health_percent_from_registers);
  if (cap != null) {
    if (cap >= t.battery.goodPct) add("good", "battery", msg("battery.good", { cap }));
    else if (cap >= t.battery.finePct) add("info", "battery", msg("battery.fine", { cap }));
    else if (cap >= t.battery.wornPct) add("info", "battery", msg("battery.worn", { cap }), t.battery.deductWorn);
    else add("warn", "battery", msg("battery.bad", { cap }), t.battery.deductBad);
  }
  const cycles = input.battery?.cycle_count;
  if (cycles) {
    const conditionSuffix = input.battery?.condition
      ? `, condition reported as "${input.battery.condition}"`
      : "";
    add("info", "battery", msg("battery.cycles", { cycles, conditionSuffix }));
  }

  // --- Stability (only when the signal is known, i.e. a .zip was dropped) ---
  if (input.panics != null) {
    if (input.panics > 0) add("warn", "stability", msg("panics.present", { n: input.panics }), t.panics.deduct);
    else add("good", "stability", msg("panics.none"));
  }

  // --- Thermal (only when known) ---
  if (input.cpuSpeedLimit != null) {
    if (input.cpuSpeedLimit < 100) add("warn", "thermal", msg("thermal.throttled", { limit: input.cpuSpeedLimit }), t.thermal.deduct);
    else add("good", "thermal", msg("thermal.ok"));
  }

  if (score < 0) score = 0;

  // Grade band (highest matching min).
  const grade = R.score.gradeBands.find((b) => score >= b.min)?.label ?? "Poor";

  // Verdict: any critical → critical; else any warn → warn; else ok.
  const groups: Record<Severity, Finding[]> = { critical: [], warn: [], good: [], info: [] };
  for (const f of findings) groups[f.severity].push(f);
  const hasCritical = groups.critical.length > 0;
  const verdict = hasCritical ? R.verdicts.critical : groups.warn.length > 0 ? R.verdicts.warn : R.verdicts.ok;

  const nextSteps = [...R.nextSteps];
  if (hasCritical) nextSteps.push(R.nextStepsCriticalExtra);

  // Findings grouped by subsystem, for the category cards.
  const byCategory: Record<string, Finding[]> = {};
  for (const cat of R.categories) byCategory[cat.key] = [];
  for (const f of findings) (byCategory[f.category] ||= []).push(f);

  // Raw evidence per category — the actual values the verdict is based on.
  const rows = (arr: (EvidenceRow | null)[]): EvidenceRow[] => arr.filter(Boolean) as EvidenceRow[];
  const row = (label: string, value: string | undefined | null): EvidenceRow | null =>
    value ? { label, value } : null;

  const activationReadable = al.includes("disabl") ? "Off" : al.includes("enabl") ? "On" : "Not reported";
  const mdmReadable = managed ? "Enrolled" : mdm ? "None" : "Not reported";
  const fvReadable = fv.includes(" on") || fv.includes("is on") ? "On" : fv ? "Off" : "";
  const sipReadable = sip ? (sip.includes("enabled") ? "Enabled" : "Disabled") : "";
  const gkReadable = gk ? (gk.includes("enabled") ? "Enabled" : "Disabled") : "";

  const evidence: Record<string, EvidenceRow[]> = {
    storage: rows([
      row("SMART status", input.storage?.smart_status),
      row("TRIM", input.storage?.trim_support),
      row("Drive", input.storage?.ssd_model),
      row("Capacity", input.storage?.capacity),
    ]),
    security: rows([
      row("Activation Lock", activationReadable),
      row("Device management (MDM)", mdmReadable),
      row("Configuration profiles", profCount != null ? String(profCount) : null),
      row("FileVault", fvReadable),
      row("System Integrity Protection", sipReadable),
      row("Gatekeeper", gkReadable),
    ]),
    battery: rows([
      row("Maximum capacity", cap != null ? `${cap}%` : null),
      row("Charge cycles", cycles),
      row("Condition", input.battery?.condition),
    ]),
    thermal: rows([
      row("CPU speed limit", input.cpuSpeedLimit != null ? `${input.cpuSpeedLimit}%` : null),
    ]),
    stability: rows([
      row("Kernel panic reports", input.panics != null ? String(input.panics) : null),
    ]),
  };

  return {
    machine: {
      model: input.hardware?.model_name ?? "Unknown",
      chip: input.hardware?.chip ?? "?",
      ram: input.hardware?.memory ?? "?",
      os: input.software?.os_version ?? "Unknown",
      serial: input.hardware?.serial_number ?? "Unknown",
    },
    score,
    grade,
    verdict,
    findings,
    groups,
    byCategory,
    evidence,
    nextSteps,
    hasCritical,
  };
}
