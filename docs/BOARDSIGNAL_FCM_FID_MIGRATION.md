# BoardSignal FCM Registration Migration — Future Maintenance

Status: **documented only — do not perform in the Delivery + Installed-App Polish release**.

## Current stable production boundary

BoardSignal currently uses:

- `firebase` `^11.9.0`
- `firebase-admin` `^13.4.0`
- Firebase Web Messaging `getToken()` registration-token delivery
- Firebase Admin `token` targeting
- the existing `/sw.js` service-worker registration and `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

This path remains intentionally unchanged for the current polish release.

## Why a separate migration is required

Firebase now recommends Firebase Installation ID (FID) registration for Web Cloud Messaging. The Web APIs `register()`, `onRegistered()` and `onUnregistered()` were introduced after BoardSignal's currently locked Firebase Web version; Firebase JavaScript SDK 12.14.0 release notes introduced the new Cloud Messaging registration API.

Firebase Admin 14.1.0 added first-class `FidMessage` / `FidMulticastMessage` targeting and deprecated registration-token targeting. Firebase Admin 14.0.0 also dropped Node.js 18 and 20 support, requiring Node.js 22 or newer.

Therefore a correct migration is a coordinated **Firebase Web + Firebase Admin + Node runtime** maintenance release. Do not create a half-token / half-FID path.

## Deliberate migration plan

1. Confirm production runtime is Node.js 22+ everywhere BoardSignal Firebase Admin executes.
2. Upgrade Firebase Web to a version containing the FID Messaging registration APIs (12.14.0 or newer).
3. Upgrade Firebase Admin to a version with FID targeting (14.1.0 or newer).
4. Replace Web `getToken()` registration with `register()` plus `onRegistered()` / `onUnregistered()` lifecycle handling.
5. Replace the private server registration record from legacy FCM token to FID.
6. Replace Firebase Admin `token` message targeting with FID targeting.
7. Do **not** run both registration models simultaneously for the same app instance.
8. Migrate/retire legacy stored push registrations safely after new registrations are proven.
9. Keep the existing explicit player permission rule: never call `Notification.requestPermission()` without a deliberate click.
10. Preserve the single BoardSignal service worker, `push`, `notificationclick`, deep links, permission preferences and sign-out cleanup.

## Test checklist

- existing player with browser permission can register through the FID path;
- denial is respected and does not nag;
- unregister removes the server FID record;
- account switch cannot retain another player's registration association;
- Desk Ready opens the Desk tab;
- Universe achievement opens Universe;
- Friend request/accepted opens Friends;
- founder private message opens Inbox;
- invalid/unregistered FIDs are pruned;
- one-player founder delivery test reports real delivered/failed/not-eligible state;
- PWA service worker push and offline behavior still pass;
- no duplicate token + FID messages;
- full production TypeScript/build passes under Node 22+.

## Official references

- Firebase Web Cloud Messaging: https://firebase.google.com/docs/cloud-messaging/web/get-started
- Firebase JavaScript SDK release notes: https://firebase.google.com/support/release-notes/js
- Firebase Admin Node.js SDK release notes: https://firebase.google.com/support/release-notes/admin/node
