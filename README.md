# BoardSignal v10

BoardSignal is a personal sports desk for everyday Chess.com players. This source is the current Founding Beta product: deterministic seven-day LIVE Desk generation, persistent Player Rooms, latest-four Desk memory, safe BoardSignal Universe coverage, Founding Beta access, Founder Newsroom controls, private communications and the return loop.

## Current product surfaces

- `/` and `/boardsignal` — public BoardSignal home and **Get My BoardSignal** owner journey
- `/join` — canonical Chess.com confirmation and Founding Beta access request
- `/universe`, `/feed`, `/player/[handle]` — public-safe BoardSignal Universe coverage
- `/boardsignal/player-room` — persistent authenticated My Player Room
- Player Room tabs — Desk, Progress, Universe, Inbox, Profile
- `/admin` — Founder Newsroom
- `/admin/players` — active players, pending access requests and manual Beta Access
- `/admin/communications` — private in-app founder/player communications and campaigns
- `/admin/desks` — Desk pipeline
- `/admin/coverage` — safe public Coverage Editor
- `/admin/exceptions` — operational exceptions
- `/api/cron/boardsignal-return` — one secured daily return-loop job

The deterministic chess system remains the source of truth. Public Universe coverage is physically separated from private Desk data and never publishes Red, private Amber, Blue, evidence, recurrence, private progress or private notes.

## Preserved foundation

- Next.js 15.5.15 and TypeScript
- Firebase client/admin configuration and Firebase custom-token Founding Beta authentication
- Chess.com stable player-ID identity and future OAuth provider/callback abstraction
- Chess.com public archive processing with `chess.js`
- Browser-side Stockfish 18 WASM under GPL-3.0 (`public/stockfish/Copying.txt`)
- exact seven-day episodes and fixed latest-four full-Desk retention
- deterministic BoardSignal Universe ranking
- Admin Hub / BoardSignal founder authentication
- PWA service worker, install support, analytics and existing API patterns

## Local setup

```bash
nvm use 20.19.0
npm ci
npm run dev
```

Keep `.env.local` on your machine. Never commit Firebase Admin credentials, Chess.com OAuth secrets, `CRON_SECRET`, VAPID private material or Beta Access codes.

## Communications / return-loop configuration

Required for browser alerts:

```bash
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_firebase_web_push_public_key
```


Optional server-side email delivery (in-app Inbox still works without this):

```bash
RESEND_API_KEY=your_server_only_resend_key
BOARDSIGNAL_EMAIL_FROM=BoardSignal <updates@updates.adminhub-global.com>
# Optional:
BOARDSIGNAL_EMAIL_REPLY_TO=your_reply_address
```

Email delivery is configuration-gated and consent-gated. It is used only for important eligible BoardSignal product/account messages, not every Pulse or reminder. `RESEND_API_KEY` must never be exposed through `NEXT_PUBLIC_*`.

Required to enable the secured daily return-loop route:

```bash
CRON_SECRET=generate_a_long_random_secret
```

Optional Founding Beta community link:

```bash
NEXT_PUBLIC_BOARDSIGNAL_DISCORD_INVITE_URL=https://discord.gg/your-invite
```

`NEXT_PUBLIC_FIREBASE_VAPID_KEY` is the **public** Web Push key from the same Firebase project already configured by the existing `NEXT_PUBLIC_FIREBASE_*` variables. Do not put the VAPID private key in this application or in any `NEXT_PUBLIC_*` variable.

The future coordinated Firebase FID migration is documented in `docs/BOARDSIGNAL_FCM_FID_MIGRATION.md`; this release intentionally keeps the existing registration-token path.

The app remains functional without the VAPID key: private in-app Inbox delivery works and the Profile browser-alert control reports that browser alerts are not configured. Notification permission is requested only after the player clicks **Enable browser alerts**.

The return loop is feature-gated when `CRON_SECRET` is absent. `vercel.json` declares a single daily invocation of `/api/cron/boardsignal-return`; there is no per-player cron.

## Firebase Console step for browser alerts

In the existing BoardSignal Firebase project, open **Project settings → Cloud Messaging → Web configuration → Web Push certificates**, generate (or use the existing) Web Push key pair, and copy only the displayed public key into `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in the deployment environment. The existing trusted Firebase Admin environment is used for server sends.

## Verification

```bash
npm run test:communications
npm run test:core
npm run test:stockfish
npx tsc --noEmit
npm run build
```

The communications/onboarding suite is intentionally focused on the 25 locked acceptance checks for beta requests, identity-safe approval, mandatory safe Universe participation, notification defaults, explicit browser permission, private Inbox/replies, automated-event dedupe/caps, unchanged retention/Universe/Stockfish boundaries and requested UI contrast/navigation rules.
