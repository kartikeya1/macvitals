# MacVitals Web

A fully **client-side** static site (Next.js) for MacVitals. Get the collector,
run it locally, then drag the report onto the site for a visual health verdict —
**nothing is ever uploaded**; parsing and analysis run in the browser.

## Develop

```bash
cd web
npm install
npm run dev      # http://localhost:3000  (runs sync-assets first)
```

## Build (static export)

```bash
npm run build    # outputs static site to web/out/
```

`npm run build` runs `scripts/sync-assets.mjs` first, which copies the repo's
`macvitals.sh`, `macvitals-analyze.sh` (into `public/`) and `shared/ruleset.json`
(into `lib/ruleset.generated.json`) so the site stays in lockstep with the CLI.

## Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel, **New Project → import the repo**.
3. Set **Root Directory** to `web`. Framework preset: **Next.js** (auto-detected).
4. Deploy. (Output is a static export; no server functions, no env vars.)
5. After the first deploy, set your domain in [`lib/site.ts`](lib/site.ts)
   (`SITE_ORIGIN` and `GITHUB_URL`) so the copy-paste command points at your host,
   and redeploy.

## Structure

```
web/
├── app/
│   ├── page.tsx          landing + "get the collector"
│   ├── report/page.tsx   drag-drop → in-browser parse + analyze → verdict
│   ├── CopyCommand.tsx    copy-to-clipboard button (client)
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── analyze.ts         health scoring — reads the shared ruleset
│   ├── parse.ts           summary.json / .zip reader (JSZip), in-browser
│   ├── site.ts            domain + GitHub URL config
│   └── ruleset.generated.json   (synced from ../shared/ruleset.json)
├── public/                (macvitals*.sh synced here for download)
└── scripts/sync-assets.mjs
```

## Roadmap (see ../docs/WEB_APP_PLAN.md)

- ✅ Phase 2: landing + get-collector, in-browser parse/analyze, verdict + score.
- ⏭ Phase 3: polished dashboard — score gauge, per-category cards with evidence,
  redact-for-sharing toggle, demo mode.
- ⏭ Phase 4: export a self-contained HTML report + PDF + "copy for AI".
