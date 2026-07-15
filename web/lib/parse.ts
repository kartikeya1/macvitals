// Turns a dropped file (summary.json OR a MacVitals_Report .zip) into the
// normalized AnalysisInput. Runs ENTIRELY in the browser — nothing is uploaded.
import type { AnalysisInput } from "./analyze";

/** Mirror of the CLI's panic-count logic: "No .panic files found" => 0,
 *  otherwise count filename lines (excluding the echoed "$ ..." command line). */
function countPanics(systemTxt: string): number {
  if (!systemTxt) return 0;
  if (systemTxt.includes("No .panic files found")) return 0;
  return systemTxt
    .split("\n")
    .filter((l) => l.includes(".panic") && !l.trimStart().startsWith("$") && !l.includes("No .panic"))
    .length;
}

/** Extract the CPU speed limit (100 = no throttling) from thermal.txt. */
function parseCpuSpeedLimit(thermalTxt: string): number | null {
  if (!thermalTxt) return null;
  const line = thermalTxt.split("\n").find((l) => /CPU_Speed_Limit/i.test(l));
  if (!line) return null;
  const d = line.replace(/[^0-9]/g, "");
  return d === "" ? null : parseInt(d, 10);
}

/** summary.json already has the nested shape AnalysisInput expects. */
function fromSummary(summary: Record<string, unknown>): AnalysisInput {
  return {
    hardware: summary.hardware as AnalysisInput["hardware"],
    software: summary.software as AnalysisInput["software"],
    battery: summary.battery as AnalysisInput["battery"],
    storage: summary.storage as AnalysisInput["storage"],
    security: summary.security as AnalysisInput["security"],
  };
}

export async function parseReportFile(file: File): Promise<AnalysisInput> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".json")) {
    const summary = JSON.parse(await file.text());
    return fromSummary(summary);
    // panics / cpuSpeedLimit stay undefined -> those findings are skipped.
  }

  if (name.endsWith(".zip")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    let summary: Record<string, unknown> = {};
    let systemTxt = "";
    let thermalTxt = "";

    for (const path of Object.keys(zip.files)) {
      const entry = zip.files[path];
      if (entry.dir) continue;
      const lower = path.toLowerCase();
      if (lower.endsWith("summary.json")) summary = JSON.parse(await entry.async("string"));
      else if (lower.endsWith("system.txt")) systemTxt = await entry.async("string");
      else if (lower.endsWith("thermal.txt")) thermalTxt = await entry.async("string");
    }

    if (!Object.keys(summary).length) {
      throw new Error("That .zip doesn't contain a summary.json — is it a MacVitals report?");
    }

    const input = fromSummary(summary);
    input.panics = countPanics(systemTxt);
    input.cpuSpeedLimit = parseCpuSpeedLimit(thermalTxt);
    return input;
  }

  throw new Error("Please drop a summary.json file or a MacVitals_Report .zip.");
}
