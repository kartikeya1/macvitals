// Fake demo reports so visitors can see the dashboard without running anything.
// These mirror the shape of a real summary.json (+ the zip-only panic/thermal
// signals) so they exercise the exact same analyzer as a genuine report.
import type { AnalysisInput } from "./analyze";

export const healthySample: AnalysisInput = {
  hardware: { model_name: "MacBook Air", chip: "Apple M2", memory: "16 GB", serial_number: "DEMO-CLEAN-01" },
  software: { os_version: "macOS 15.5 (24F74)" },
  battery: { cycle_count: "96", condition: "Normal", maximum_capacity_percent: "94%" },
  storage: { ssd_model: "APPLE SSD AP0512Z", capacity: "500.28 GB", trim_support: "Yes", smart_status: "Verified" },
  security: {
    sip: "System Integrity Protection status: enabled.",
    filevault: "FileVault is Off.",
    gatekeeper: "assessments enabled",
    activation_lock: "activation_lock_disabled",
    mdm_enrollment: "Enrolled via DEP: No; MDM enrollment: No",
    configuration_profile_count: 0,
  },
  panics: 0,
  cpuSpeedLimit: 100,
};

export const problemSample: AnalysisInput = {
  hardware: { model_name: "MacBook Pro", chip: "Apple M1 Pro", memory: "16 GB", serial_number: "DEMO-RISKY-02" },
  software: { os_version: "macOS 14.4 (23E214)" },
  battery: { cycle_count: "812", condition: "Service Recommended", maximum_capacity_percent: "61%" },
  storage: { ssd_model: "APPLE SSD AP0512R", capacity: "500.28 GB", trim_support: "Yes", smart_status: "Failing" },
  security: {
    sip: "System Integrity Protection status: enabled.",
    filevault: "FileVault is On.",
    gatekeeper: "assessments enabled",
    activation_lock: "activation_lock_disabled",
    mdm_enrollment:
      "Enrolled via DEP: Yes; MDM enrollment: Yes (User Approved); MDM server: https://acme.awmdm.com/DeviceServices/...",
    configuration_profile_count: 3,
  },
  panics: 4,
  cpuSpeedLimit: 72,
};
