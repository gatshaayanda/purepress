# BoardSignal identity configuration

BoardSignal keeps the Chess.com provider disabled unless `CHESSCOM_OAUTH_ENABLED=true` and every required server value exists.

Required server configuration:

- `CHESSCOM_CLIENT_ID`
- `CHESSCOM_CLIENT_SECRET`
- `CHESSCOM_AUTHORIZE_URL`
- `CHESSCOM_TOKEN_URL`
- `CHESSCOM_PROFILE_URL`
- `CHESSCOM_SCOPES`
- `CHESSCOM_REDIRECT_URI`
- `BOARDSIGNAL_AUTH_STATE_SECRET` (at least 32 characters)
- `FIREBASE_ADMIN_KEY`

Expected production redirect URI:

`https://www.adminhub-global.com/api/auth/chesscom/callback`

This is the canonical production callback submitted to Chess.com and should be the production value of `CHESSCOM_REDIRECT_URI`. The redirect resolver is locked to the unchanged `/api/auth/chesscom/callback` route and also recognizes the registered apex compatibility URI:

`https://adminhub-global.com/api/auth/chesscom/callback`

Outside production, HTTP localhost and loopback variants on that exact route are supported (for example `http://localhost:3000/api/auth/chesscom/callback` and `http://127.0.0.1:3000/api/auth/chesscom/callback`). Arbitrary domains, alternate paths, credentials, query strings and fragments are rejected.

Set `CHESSCOM_PKCE_ENABLED=true` only if the official Chess.com OAuth documentation requires or supports PKCE for this client. The provider abstraction adds the verifier/challenge only under that explicit flag.

No client secret or Firebase Admin credential belongs in a `NEXT_PUBLIC_*` variable or committed file.

## Founding Beta Access while OAuth is pending

Founding Beta Access uses the same existing Firebase Admin configuration and stable account mapping as Chess.com OAuth. It does not add Google sign-in, email/password, magic links, or a second identity.

The founder manages access at `/admin/players`, which is protected by the existing Admin Hub Basic Auth middleware. Creating or resetting access returns a high-entropy code once. Only a salted scrypt hash is stored in the server-only `/betaAccess/{chessPlayerId}` collection. Deploy the included Firestore rules so clients can never read or write that collection.

Players sign in at `/boardsignal/player-room`. The server resolves the canonical public Chess.com profile first, verifies the code against the stable player ID, and creates a short-lived Firebase custom token for `chesscom_<playerId>`. Firebase keeps the normal browser session until the player signs out.

## OAuth-pending development identity

A controlled development identity is available only outside production and only when explicitly enabled:

- `BOARDSIGNAL_DEV_AUTH_ENABLED=true`
- `BOARDSIGNAL_DEV_CHESS_PLAYER_ID`
- `BOARDSIGNAL_DEV_CHESS_USERNAME`

The UI labels this as a development identity. It never claims that Chess.com authenticated the test session.

## Required Firebase deployment

Deploy the included `firestore.rules` with the existing Firebase project. Private `/users/{uid}` account, Desk and evidence documents are owner-only. `/publicPlayers` and `/publicCoverage` are publicly readable but client writes require the admin claim; normal trusted server writes use Firebase Admin.
