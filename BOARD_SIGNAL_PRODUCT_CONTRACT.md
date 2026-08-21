# BoardSignal product contract

## Product promise

BoardSignal is the personal sports desk for everyday Chess.com players. A player gives BoardSignal one public Chess.com username. BoardSignal retrieves the available public games, closes one fixed seven-day episode, reconstructs the chess evidence, reviews selected positions, and returns a player-centred story, diagnosis, and useful action.

The customer experience must not depend on BAT or PowerShell downloads, routine PGN uploads, Founder Lab chats, or the player understanding the internal pipeline. Manual PGN upload remains an exceptional recovery tool for the Founder.

## Permanent priority

`PLAYER → THEIR WEEK → THEIR SIGNALS → THEIR ACTION → BOARDSIGNAL UNIVERSE`

The brand, other players, product proof, pricing, and community features must never displace the current player from the centre of their experience.

## Complete player journey

### 1. Find me

- The first primary action is `Enter your Chess.com username`.
- Ask for no Chess.com password, API key, PGN file, email address, or payment before the player sees their first useful Desk.
- Confirm Chess.com's canonical username and stable player ID when available.
- Surface ambiguous-character corrections for confirmation; never silently assume identity.

### 2. Build my Desk

- Retrieve only the Chess.com monthly archives overlapping the required period.
- Select the latest completed fixed seven-calendar-day episode according to the configured cadence.
- Never create sliding daily duplicates.
- If the newest completed period has no games, search backward through non-overlapping complete periods and clearly label the result as the last active week.
- Validate games, separate pools, reconstruct positions, calculate the factual record, and review ranked candidate positions with Stockfish.
- Show calm, useful progress language. Do not expose internal chat names, Fact Pack filenames, seed status, beta case numbers, engine plumbing, or implementation phases.

### 3. My Room

The Player Room is the private home of the product. It contains:

- Player identity and Chess.com confirmation.
- The newest Desk and its week headline.
- A short week-at-a-glance scoreboard.
- Clear paths to `My week`, `My weakness`, `My guidance`, and `My evidence`.
- A moving archive of up to four monthly episodes when persistence is enabled.
- Player-controlled sharing and profile settings when those capabilities are enabled.

The Room must provide direction. It must not feel like a database, admin dashboard, PDF folder, or gallery of other people.

### 4. My Desk

Each Desk is one complete progressive reading experience:

1. Replay — what kind of week it was and how it moved.
2. Turning point — the most meaningful change supported by the evidence.
3. Green — what to preserve.
4. Amber — what to monitor or keep in context.
5. Red — what to fix first.
6. Blue — the short action to carry into the next games.
7. Evidence — selected positions, game links, evaluation context, and limitations.
8. Pocket card — the shortest usable reminder from the episode.

The Blue Signal is advice from this episode. The base workflow is stateless and does not grade it as a cross-week mission.

### 5. BoardSignal Universe, public player pages, and share cards

- Public pages are opt-in athlete pages, not public weakness files.
- A public page may show chosen identity, avatar, current/recent positive coverage, weekly headline, scoreboard, Moment of the Week, and selected share cards.
- Never auto-publish Red weaknesses, Amber concerns, private Blue guidance, detailed development positions, reflections, journal entries, or embarrassing negative material.
- The player chooses whether a post uses their Chess.com username, a display name, or another allowed identity.
- Other-player coverage appears only after the current player's personal journey and remains secondary.
- `BoardSignal Universe` is the permanent name of the public player-centred sports world. The main navigation label is `Universe`.
- The Universe grows from approved highlights into featured players, rivalries, rankings, Player of the Week, and later player voting. These features must remain grounded in completed Desk evidence and player sharing choices.

#### Recognition and return loop V1

- Universe achievement titles are deterministic factual comparisons, never generic editorial categories. Rating comparisons remain inside Rapid, Blitz or Bullet; no cross-pool rating table is allowed.
- The public Universe shows positive Top 3 performances only. Bottom rankings and private Red, Amber, Blue or position evidence are never published.
- The first comparison source is the approved SEED Desk field. FIXTURE data never enters rankings. A LIVE Desk may join only that player's private comparison until shared persistence and publication consent exist.
- The field is labelled `FOUNDING BETA FIELD — Based on the approved BoardSignal Desks currently represented.` It must not be described as a real-time global leaderboard.
- Private standings may show rank, denominator, percentile and sports-media labels only when the comparable sample supports them. A field below three comparable Desks is described as forming rather than awarded a podium label.
- Between completed Desks, the latest supported Blue may remain as an ungraded `CARRY WITH YOU` reminder and the latest supported Amber may remain as awareness. Red does not nag between episodes. Every new Desk determines its own signals independently.
- The presentation adapter may prepare `previousBlue`, `amberWatch`, `nextDeskDueAt` and `universeStanding` without adding notifications, email, push delivery, an LLM, or paid infrastructure.

### 6. Founder control tower

Founder/admin surfaces manage:

- Player identity exceptions.
- Collection and processing status.
- Validation failures and rate limits.
- Low-confidence interpretation and quality review.
- Publishing and private-link delivery.
- Privacy controls and public-highlight approval.

The Founder control tower is never presented as part of the player's Desk. Terms such as `Founder beta`, `seeded`, `case`, `Fact Pack`, `Data Lab`, and internal game IDs belong only in development/admin contexts.

## Core pipeline

```text
Username
→ identity confirmation
→ archive collector
→ period engine
→ PGN validator and legal reconstruction
→ factual analytics
→ candidate-position finder
→ Stockfish review
→ week-shape interpreter
→ Replay compiler
→ Signal and Action selector
→ quality and privacy validator
→ private Desk publication
→ optional player-approved public highlight
```

Calculations, chess claims, decision rules, confidence, privacy, and validation must be reproducible from stored inputs. Controlled editorial templates may write the Desk from approved facts. An LLM may later polish prose, but it must never be the factual authority, product memory, or only way a Desk can be produced.

## Player-facing language rules

Use product language:

- `Your latest Desk`
- `My week`
- `My signals`
- `My weakness`
- `My guidance`
- `My evidence`
- `Position review complete`
- `Find my Desk`

Do not show development language:

- `Founder beta`
- `Completed beta Desk`
- `Live Desk built`
- `Private session Desk`
- `Check another username`
- `Seeded Desk`
- `Next conversion pass`
- `Founder Lab engine review`

When a game sequence ID is useful to a player, render `Game 8`, not unexplained shorthand such as `G08`.

## Commercial boundary

Membership, account creation, payments, and email claiming belong after the username-to-beta-quality-Desk loop is reliable. They remain part of the planned full product, but they do not interrupt the first useful experience.

## Definition of a complete core

The core is complete only when a newly entered non-seeded username can automatically produce a Desk comparable in factual depth, position evidence, narrative specificity, Signal quality, privacy safety, and presentation to the best manually produced beta reports—without moving files or instructions through ChatGPT conversations.

## Binary publication gate

A Desk has only two publication outcomes:

- `PASS`: identity and fixed period are complete; W/D/L totals reconcile; all seven dates are present; rating pools remain separate; every game legally reconstructs; selected positions finish review; Red and Blue are supported by the same evidence; no placeholder, internal, tutorial, or development copy remains.
- `FAIL`: the Desk is not published. It enters the private exception path with stable failure codes. The product must never turn missing sessions, streaks, ratings, positions, or engine results into zeroes, filler, or a generic diagnosis.

Termination counts, streaks, volume, rating movement, openings, and opponent bands may nominate questions. None of them alone proves a chess weakness. A resignation becomes guidance only when the reviewed final position was still playable; a timeout becomes clock guidance only when the reviewed board retained practical chances; a tactical theme becomes Red only after the engine-supported position evidence clears the configured threshold.

## Cadence and later episodes

- The first Desk fixes a player's cadence anchor.
- Later episodes advance in exact seven-day blocks from that anchor; they never slide with the visit date.
- A completed active block creates the next Desk idempotently.
- A completed zero-game block records no activity and does not republish an older Desk as new.
- The device-local beta cache retains at most four passing Desks per player. Durable cross-device persistence remains part of the account/persistence layer.

## Identity, ownership and four-Desk memory

- Official Chess.com OAuth is the ownership proof when its real credentials and documentation are available. Until then, the provider remains disabled and the public-username LIVE builder remains available. BoardSignal never fakes an OAuth success or asks for a Chess.com password.
- While official OAuth approval is pending, an approved player may use a privately issued Founding Beta Access code. BoardSignal resolves the submitted username through Chess.com, verifies a salted server-only credential against the stable player ID, and signs into the same `chesscom_<playerId>` Firebase account OAuth will use later. No raw access code is persisted.
- A verified account is keyed by stable Chess.com player ID plus canonical username and bridges into Firebase custom authentication through a server-only, short-lived, one-use completion ticket.
- Founding beta players use the normal entitlement model: `role: player`, `accessTier: founding_beta`, `accessStatus: active`, `billingRequired: false`, `maxActiveDesks: 4`.
- Private account, Desk and evidence documents are physically separate from public identity and positive coverage. Owner-only rules protect `/users/{uid}`. Trusted server code alone writes public coverage.
- The Player Room retains four complete passing Desks. Publishing Desk 5 updates tiny personal records, then removes Desk 1 and its heavy evidence subcollection.
- Cross-Desk progress compares stable structured facts and keeps Rapid, Blitz and Bullet rating histories separate. It never invents full-game blunder counts from selected-position review.
- Recurrence uses stable signal-family identifiers, never prose matching. A missing pattern may be described only as not repeated; BoardSignal does not claim that a player fixed, completed or learned something without future evidence.
- `CURRENT EPISODE — DESK FORMING` is separate factual state. It may show public-game progress but never mutates a completed Desk, assigns daily Red/Amber/Blue, or runs the full Stockfish diagnosis on every login.
- The previous supported Blue may carry forward as ungraded advice; the previous supported Amber may remain awareness. Previous Red does not nag.
- Notification event hooks and preferences may exist before delivery. This phase sends no email or browser push.
- Founding Beta credential records are server-only. Repeated failures cause a temporary lockout; founder create/reset reveals a cryptographically random code once, and revoke prevents further Beta Access sign-in without changing the stable player identity.
