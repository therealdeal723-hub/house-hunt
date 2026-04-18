# House Hunt

Daily cron-driven house listing monitor for the Edmonds, WA area. Scrapes
Redfin / Realtor.com / Zillow / Homes.com, dedupes, filters by my criteria,
and pushes a notification to my iPhone via a PWA installed to the home
screen. No external service signups — runs entirely on free GitHub
infrastructure (Actions, Pages, Issues).

## Setup

### 1. Generate VAPID keys

```
npx web-push generate-vapid-keys
```

Save the public and private keys — you'll use them in step 3.

### 2. Create two GitHub Issues in this repo

Create two Issues and note their numbers:

- **"Verdicts log"** — the PWA posts fenced-json comments here when you
  thumb up/down a listing. The cron job parses new comments on each run.
- **"Push subscriptions"** — the PWA posts the browser's push
  subscription here when you enable notifications on a new device.

Neither needs a body. Leave them open.

### 3. Configure repo Secrets and Variables

Under **Settings → Secrets and variables → Actions**:

**Secrets:**
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — `mailto:you@example.com`

**Variables:**
- `VERDICTS_ISSUE_NUMBER` — from step 2
- `SUBSCRIPTIONS_ISSUE_NUMBER` — from step 2

### 4. Enable GitHub Pages

**Settings → Pages → Source: GitHub Actions**.

After the first successful `deploy-pages.yml` run, the site is at
`https://therealdeal723-hub.github.io/house-hunt/`.

### 5. Create a fine-grained PAT for the PWA

**Settings → Developer settings → Personal access tokens → Fine-grained**.

- Repository access: Only this repo (`therealdeal723-hub/house-hunt`)
- Permissions:
  - Repository contents: **Read** (to load `/data/*.json` when repo is
    private)
  - Issues: **Read and write** (to post verdicts and subscriptions)
- Expiration: 1 year

Copy the token. You'll paste it into the PWA once after installing.

### 6. Install on iPhone

1. Open `https://therealdeal723-hub.github.io/house-hunt/` in Safari.
2. Share → **Add to Home Screen**.
3. Open from the home screen (not Safari — must be standalone).
4. Paste the PAT into the prompt.
5. Tap **Enable notifications** and allow the permission.

## Layout

```
scripts/
  lib/           http, address normalization, geo, store
  sources/       one scraper per site
  dedupe.mjs     cross-source merge
  filter.mjs     criteria filter
  track-watched.mjs   recheck thumbed-up listings
  send-push.mjs       web-push sender
  daily-run.mjs       cron orchestrator
  poll-verdicts.mjs   parse issue comments → json
data/            state (committed by the cron job)
src/             the PWA (React + Vite)
public/          static PWA assets
.github/workflows/  daily cron + pages deploy
```

## Local dev

```
npm install
npm run dev            # PWA dev server
npm run daily:dry      # dry run the cron locally (no push, no commits)
```

## Criteria

- Price $800k–$1,000k
- ZIPs around Edmonds (30–45 min drive): see `scripts/lib/geo.mjs`
- Single-family detached (heuristic: rejects townhouses, PUDs, zero-lot)
- ≥3 bd, ≥2 ba, garage
- ≥1500 sqft house, ≥3000 sqft lot
- GreatSchools max assigned rating ≥7
