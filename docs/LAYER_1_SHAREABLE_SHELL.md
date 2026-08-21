# Layer 1 — Shareable responsive shell

## Objective

Make the existing Vercel Preview credible to open on a phone or laptop and useful enough to show a beta tester. This layer demonstrates the intended product experience with real evidence; it does not connect the processing engine, authentication writes or payments.

## Evidence represented

The seeded beta universe contains 14 completed Desks and 695 games:

- bada_billa — 8 games
- Bekzatt1 — 18-game last-active Desk after 17 empty complete blocks
- Kylian_Mbappe_LottinREAL — 56 games
- MrInbetween23 — 19 games
- Phonkrum — 4 games
- CaptainRangade — 9 games
- I_pd_I — 36 games
- snoopyissocute — 98 games
- JefsonFS — 12 games
- IIZORGII — 89 games
- I-Know-KungFu — 24 games
- harshhmishra — 285 games
- hxertzzz — 29 total activities with human and Coach activity separated
- Alexcet8 — 8 games

The public Universe uses anonymous positive coverage only. The full handles and private Green/Amber/Red/Blue material remain data for private or founder-facing views.

## Layer 1 experience

- Responsive Universe with one ranked lead story and a living story rail.
- Aggregate beta proof strip: 14 Desks, 695 games, 4–285 games per episode.
- Coverage feed populated by all 14 real Desks.
- Player Room organized as Replay, Signal Board and positions entry points.
- Desk reader with sticky chapter navigation and progressive sections.
- Restrained route/card motion with reduced-motion support.
- Public install interruption removed; BoardSignal install prompt appears only inside the Player Room after a delay.
- Private `/app` and `/admin` responses are excluded from persistent service-worker page caches.

## Acceptance checks

- No document-level horizontal overflow on phone or desktop.
- Hero headline remains readable without clipping.
- Mobile navigation, Player Room tabs and Desk chapter navigation are horizontally self-contained.
- Public routes do not expose private weaknesses or tester identities.
- `npx tsc --noEmit` passes.
- `npm run build` passes with the configured local Firebase environment.

## Explicitly not in this layer

- Live Chess.com retrieval
- Report generation or founder import UI
- Authentication and account claims
- Firestore writes
- Payments
- Share publishing controls
- Interactive chessboard/FEN viewer

