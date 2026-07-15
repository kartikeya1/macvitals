"use client";

import { useState } from "react";

export default function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. insecure context) — select-to-copy still works.
    }
  };

  return (
    <div className="cmd">
      <code>{command}</code>
      <button className="copybtn" onClick={copy}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
