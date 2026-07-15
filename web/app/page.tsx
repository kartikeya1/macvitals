import MacCheck from "./MacCheck";
import GetCollector from "./GetCollector";

const CHECKS = [
  { ic: "🔋", title: "Battery", desc: "Cycle count, maximum capacity, condition and wear — plus a raw health figure from the hardware registers." },
  { ic: "💾", title: "Storage / SSD", desc: "SMART self-check status, TRIM, capacity and APFS layout — the early-warning signs of a failing drive." },
  { ic: "🔐", title: "Ownership & security", desc: "Activation Lock, leftover MDM enrollment and configuration profiles, FileVault, SIP and Gatekeeper." },
  { ic: "🌡️", title: "Thermal", desc: "CPU thermal throttling and temperatures — clues to dried paste, dust or a tired fan." },
  { ic: "📜", title: "Stability", desc: "Kernel panics, abnormal shutdown causes and wake/sleep history from the system logs." },
  { ic: "🔩", title: "Hardware", desc: "Model, chip, core counts, firmware/Boot ROM, serial number and hardware IDs." },
  { ic: "🧠", title: "Memory", desc: "Installed RAM, swap usage and memory pressure." },
  { ic: "📡", title: "Connectivity", desc: "Wi-Fi, Bluetooth, Thunderbolt and USB controllers, ports and network interfaces." },
  { ic: "🎥", title: "Camera & audio", desc: "Presence and identifiers of the camera, speakers and microphones." },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="pill">🔒 100% private · analyzed in your browser · nothing uploaded</div>
        <h1>
          Is this Mac <span className="grad">actually healthy?</span>
        </h1>
        <p className="sub">
          Run one <strong>read-only</strong> command on the Mac, then drop the report here for a
          plain-English verdict — battery, SSD, hidden enterprise management, kernel panics and more.
          Perfect for vetting a used MacBook or checking your own.
        </p>
        <div className="btn-row">
          <a className="btn" href="#get">Get the tool</a>
          <a className="btn secondary" href="/report/">I already have a report →</a>
        </div>
      </section>

      <MacCheck />

      <section className="steps" data-reveal>
        <div className="step">
          <div className="n">1</div>
          <h3>Get the collector</h3>
          <p>Copy one command (or download the script). It&apos;s open source — read it first if you like.</p>
        </div>
        <div className="step">
          <div className="n">2</div>
          <h3>Run it on the Mac</h3>
          <p>It reads the machine (no changes, no installs) and writes a report folder + a <code>.zip</code>.</p>
        </div>
        <div className="step">
          <div className="n">3</div>
          <h3>See the verdict</h3>
          <p>Drop the report onto this site for a visual health dashboard — all in your browser.</p>
        </div>
      </section>

      <h2 className="section-title" data-reveal>What it checks</h2>
      <p className="section-sub" data-reveal>
        Eleven categories of read-only diagnostics, each turned into a clear finding with a buy /
        don&apos;t-buy verdict and a 0–100 score.
      </p>
      <div className="features" data-reveal>
        {CHECKS.map((c) => (
          <div className="feature" key={c.title}>
            <div className="ic">{c.ic}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>

      <GetCollector />

      <div className="privacy" data-reveal>
        <div className="ico">🔒</div>
        <div>
          <b>Your data never leaves your device.</b>
          <p>
            The report contains your serial number, hardware IDs and network addresses. MacVitals has
            no backend — the analysis runs entirely in your browser, so none of it is ever uploaded.
          </p>
        </div>
      </div>
    </main>
  );
}
