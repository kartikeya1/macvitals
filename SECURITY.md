# Security Policy

MacVitals is a **read-only, client-side** tool: the shell script only reads the
Mac and writes to its own report folder, and the web app parses reports entirely
in your browser with no backend. There is no server that stores your data.

Even so, we take security seriously — a diagnostics tool for used-hardware buyers
must be trustworthy.

## Reporting a vulnerability

If you find a security issue, please **do not open a public issue**. Instead:

- Use GitHub's **[Report a vulnerability](https://github.com/kartikeya1/macvitals/security/advisories/new)** (Security → Advisories), **or**
- Email the maintainer via the address on their GitHub profile.

Please include: what you found, steps to reproduce, affected file(s)/commit, and
the potential impact. We'll acknowledge within a few days and keep you updated
until it's resolved.

## What counts as in-scope

- The shell script doing anything **other than reading** the machine or writing
  inside its own timestamped report folder.
- The web app **transmitting** report data off the device (it must never make a
  network request with your data).
- Any code path that could execute untrusted input from a dropped report file.
- Supply-chain concerns in the build (dependencies, CI).

## What's out of scope

- The one-line `curl … | bash`-style install inherently requires trusting the
  script you download — we mitigate this by keeping it open source and short, and
  by recommending you read it first (`curl … -o macvitals.sh` then inspect).
- Findings that require an already-compromised machine or physical access.

## Good habits the tool follows

- No `sudo` for the core report; the optional deep scan is explicit (`--with-sudo`).
- No fabricated values — unreadable data is reported as `null` / `[skipped]`.
- The web app declares no network egress for report data; everything is local.
