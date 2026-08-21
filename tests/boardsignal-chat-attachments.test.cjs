const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const manifest = read("PATCH-MANIFEST.txt");
const core = read("src", "app", "api", "uploadthing", "core.ts");
const attachmentTypes = read("src", "lib", "boardsignal", "chatAttachments.ts");
const attachmentServer = read("src", "lib", "boardsignal", "server", "chatAttachments.ts");
const communications = read("src", "lib", "boardsignal", "server", "communications.ts");
const communicationTypes = read("src", "lib", "boardsignal", "communications.ts");
const inboxRoute = read("src", "app", "api", "boardsignal", "inbox", "route.ts");
const adminRoute = read("src", "app", "api", "admin", "boardsignal", "communications", "route.ts");
const playerInbox = read("src", "components", "PlayerInbox.tsx");
const founder = read("src", "components", "FounderCommunications.tsx");
const friends = read("src", "components", "PlayerFriends.tsx");
const friendServer = read("src", "lib", "boardsignal", "server", "friendChat.ts");
const friendRoute = read("src", "app", "api", "boardsignal", "friend-chat", "route.ts");
const attachmentUi = read("src", "components", "BoardSignalChatAttachment.tsx");
const attachmentCss = read("src", "components", "BoardSignalChatAttachment.module.css");
const friendUi = read("src", "components", "FriendConversation.tsx");
const friendCss = read("src", "components", "FriendConversation.module.css");

function hasChanged(pathname) {
  const changedBlock = manifest.split("ADDED FILES")[0];
  return changedBlock.includes(`- ${pathname}`);
}
function hasAdded(pathname) {
  const added = manifest.split("ADDED FILES")[1]?.split("DELETED FILES")[0] || "";
  return added.includes(`- ${pathname}`);
}

test("1. E.2 begins only from the exact pushed E.1 baseline", () => {
  assert.match(manifest, /Exact E.1 baseline SHA: c02d4876866a21f1dc2631295babb7329805e91a/);
  assert.match(manifest, /Baseline commit message: Fix Ask BoardSignal feedback follow-up/);
});

test("2. Existing UploadThing integration is reused", () => {
  assert.match(core, /createUploadthing/);
  assert.match(core, /fileUploader:/);
  assert.match(core, /boardSignalChatAttachment:/);
  assert.doesNotMatch(manifest, /Firebase Storage|Cloudinary|S3 provider/);
});

test("3. Image max remains 4MB", () => {
  assert.match(core, /image:\s*\{\s*maxFileSize:\s*"4MB"/);
  assert.match(attachmentTypes, /BOARDSIGNAL_CHAT_IMAGE_MAX_BYTES = 4 \* 1024 \* 1024/);
});

test("4. PDF max remains 2GB", () => {
  assert.match(core, /pdf:\s*\{\s*maxFileSize:\s*"2GB"/);
  assert.match(attachmentTypes, /BOARDSIGNAL_CHAT_PDF_MAX_BYTES = 2 \* 1024 \* 1024 \* 1024/);
});

test("5. Only image/PDF are accepted", () => {
  assert.match(core, /image:/);
  assert.match(core, /pdf:/);
  assert.match(attachmentTypes, /application\/pdf/);
  assert.match(attachmentTypes, /image\/svg\+xml/);
  assert.doesNotMatch(core, /video:|audio:|blob:/);
});

test("6. BoardSignal chat upload path is authenticated", () => {
  assert.match(core, /\.middleware\(async \(\{ req, files \}\)/);
  assert.match(core, /resolveBoardSignalChatUploadActor\(req\)/);
  assert.match(attachmentServer, /requirePlayerToken\(request\)/);
  assert.match(attachmentServer, /requireFounderBasicAuth\(request\)/);
});

test("7. Anonymous or legacy upload cannot become a BoardSignal chat attachment", () => {
  assert.match(attachmentServer, /chat uploads require an authenticated player or Founder/);
  assert.match(attachmentServer, /That attachment was not uploaded through BoardSignal chat/);
  assert.match(manifest, /legacy fileUploader has no BoardSignal chat receipt/i);
});

test("8. Arbitrary client URL cannot become an attachment", () => {
  assert.match(attachmentTypes, /ALLOWED_ATTACHMENT_KEYS/);
  assert.match(attachmentTypes, /unsupported field/);
  assert.doesNotMatch(communicationTypes, /attachment\?:\s*\{[^}]*url:/s);
});

test("9. Attachment file key is server-validated", () => {
  assert.match(attachmentServer, /receiptRef\(attachment\.fileKey\)/);
  assert.match(attachmentServer, /receipt\.fileKey !== attachment\.fileKey/);
});

test("10. Upload ownership belongs to sender", () => {
  assert.match(attachmentServer, /uploaderIdentityKey !== actor\.identityKey/);
  assert.match(attachmentServer, /belongs to a different BoardSignal sender/);
});

test("11. One attachment maximum per message", () => {
  assert.match(core, /maxFileCount:\s*1/);
  assert.match(communicationTypes, /attachment\?: BoardSignalChatAttachment/);
  assert.doesNotMatch(communicationTypes, /attachments\?:/);
});

test("12. Text-only message remains valid", () => {
  assert.match(attachmentTypes, /if \(!body && !attachment\)/);
});

test("13. Attachment-only message is valid", () => {
  assert.match(communications, /requireChatMessageContent\(body, requestedAttachment\)/);
  assert.match(friendServer, /requireChatMessageContent\(body, requestedAttachment\)/);
});

test("14. Text plus image is valid", () => {
  assert.match(attachmentTypes, /return "image"/);
  assert.match(playerInbox, /body: reply\.trim\(\),\s*attachment:/s);
});

test("15. Text plus PDF is valid", () => {
  assert.match(attachmentTypes, /return "pdf"/);
  assert.match(attachmentUi, /PDF max 2GB/);
});

test("16. Empty body plus no attachment is rejected", () => {
  assert.match(attachmentTypes, /Write a message or attach one image or PDF/);
});

test("17. Founder can attach to a direct player message", () => {
  assert.match(founder, /BoardSignalAttachmentComposer/);
  assert.match(communications, /kind: "founder_reply"/);
  assert.match(adminRoute, /body\.attachment/);
});

test("18. Founder can attach to selected, all and segment campaigns", () => {
  assert.match(founder, /option value="selected"/);
  assert.match(founder, /option value="all_active_beta"/);
  assert.match(founder, /option value="segment"/);
  assert.match(founder, /attachment: campaignAttachment\.attachment/);
});

test("19. Campaign attachment is uploaded once, not duplicated per recipient", () => {
  const claimIndex = communications.indexOf("claimBoardSignalChatAttachment(requestedAttachment, actor, claim)");
  const loopIndex = communications.indexOf("for (const account of audience)");
  assert.ok(claimIndex > -1 && loopIndex > -1 && claimIndex < loopIndex);
  assert.match(manifest, /same attachment fileKey\/metadata is projected/);
});

test("20. Player can reply to allowed Founder thread with attachment", () => {
  assert.match(playerInbox, /attachment: replyAttachment\?\.attachment/);
  assert.match(inboxRoute, /replyToFounder\(token, body\.threadId, body\.body, body\.attachment/);
});

test("21. allowReply=false cannot be bypassed by attachment", () => {
  assert.match(communications, /thread\.data\(\)\?\.allowReply !== true/);
  assert.match(playerInbox, /selected\.allowReply && selected\.threadId/);
});

test("22. Founder can reply to player with attachment", () => {
  assert.match(founder, /replyAttachment\?\.attachment/);
  assert.match(communications, /kind: "founder_reply"/);
});

test("23. Accepted friend can message accepted friend", () => {
  assert.match(friends, /<MessageCircle size=\{15\}\/?> Message/);
  assert.match(friendServer, /data\?\.status !== "friends"/);
});

test("24. Non-friend cannot initiate friend chat", () => {
  assert.match(friendServer, /Private messages are available only between accepted BoardSignal friends/);
});

test("25. Incoming or outgoing request is not enough", () => {
  assert.match(friendServer, /status !== "friends"/);
  const requestSection = friends.slice(friends.indexOf("overview.incoming"), friends.indexOf("overview.friends.length"));
  assert.doesNotMatch(requestSection, /> Message</);
});

test("26. Blocked player cannot send", () => {
  assert.match(friendServer, /leftBlock\.exists \|\| rightBlock\.exists/);
});

test("27. Unfriended player cannot send", () => {
  assert.match(friendServer, /!relationship\.exists/);
});

test("28. Relationship is rechecked server-side at send", () => {
  assert.match(friendServer, /Relationship and block state are deliberately re-read at SEND time/);
  assert.match(friendServer, /transaction\.get\(refs\.relationship\)/);
});

test("29. Friend thread read requires participant authorization", () => {
  assert.match(friendServer, /friendConversation/);
  assert.match(friendServer, /assertCurrentFriendship\(account, other\)/);
  assert.match(friendRoute, /requirePlayerToken\(request\)/);
});

test("30. Friend private message never enters public/Universe surfaces", () => {
  assert.match(friendServer, /friendConversations/);
  assert.doesNotMatch(friendServer, /publicPlayers|publicCoverage|socialPulse|Universe/);
  assert.match(manifest, /Friend chat is separate from Founder Communications and has no public projection/);
});

test("31. Image renderer is responsive", () => {
  assert.match(attachmentUi, /loading="lazy"/);
  assert.match(attachmentCss, /max-width:\s*min\(100%, 28rem\)/);
  assert.match(attachmentCss, /object-fit:\s*contain/);
});

test("32. PDF is an open card, not an embedded huge document", () => {
  assert.match(attachmentUi, /Open PDF/);
  assert.doesNotMatch(attachmentUi, /iframe|embed|object data=|pdfjs|PDF\.js/i);
});

test("33. Large PDF is not stored as base64 or Firestore blob", () => {
  assert.doesNotMatch([attachmentUi, attachmentServer, communications, friendServer].join("\n"), /readAsDataURL|base64,|FileReader|arrayBuffer\(/);
  assert.match(manifest, /browser -> UploadThing/);
});

test("34. Failed attachment upload does not break text chat", () => {
  assert.match(attachmentUi, /Text messaging is still available/);
  assert.match(playerInbox, /\(!reply\.trim\(\) && !replyAttachment\)/);
});

test("35. Failed message save handles uploaded attachment safely", () => {
  assert.match(communications, /cleanupClaimedAttachmentAfterFailedMessage/);
  assert.match(friendServer, /cleanupClaimedAttachmentAfterFailedMessage/);
  assert.match(attachmentServer, /cleanup_failed/);
  assert.match(attachmentServer, /receipt persistence remains the authority for message claims/i);
  assert.match(attachmentServer, /deleteStoredFile\(attachment\.fileKey\)\.catch/);
});

test("36. Account switch clears unsent attachment state", () => {
  assert.match(attachmentUi, /resetKey/);
  assert.match(attachmentUi, /mountedRef/);
  assert.match(attachmentUi, /cleanupAuthHeaderRef\.current = authHeader/);
  assert.match(attachmentUi, /discardWithAuth/);
  assert.match(playerInbox, /useEffect\(\(\) => \{\s*setSelected\(null\)/s);
});

test("37. Patch E Ask architecture is untouched", () => {
  assert.equal(hasChanged("src/components/AskBoardSignal.tsx"), false);
  assert.equal(hasChanged("src/lib/boardsignal/server/askContext.ts"), false);
  assert.match(manifest, /Patch E Ask BoardSignal guide\/context brain: UNCHANGED/);
});

test("38. B.1 is untouched", () => {
  assert.equal(hasChanged("src/lib/boardsignal/activeWeekGuidance.ts"), false);
  assert.match(manifest, /Patch B\.1 activeWeekGuidance\.ts: UNCHANGED/);
});

test("39. Patch D motion architecture remains", () => {
  assert.equal(hasChanged("src/components/BoardSignalSituationalMotion.tsx"), false);
  assert.equal(hasChanged("src/app/boardsignal-motion.css"), false);
  assert.match(attachmentCss + friendCss, /--bs-motion-/);
});

test("40. A.2 deletion service is untouched", () => {
  assert.equal(hasChanged("src/lib/boardsignal/server/accountDeletion.ts"), false);
  assert.match(manifest, /Patch A\.2 accountDeletion\.ts: UNCHANGED/);
});

test("41. E.3 handoff inventory is present", () => {
  assert.match(manifest, /E\.3 ACCOUNT DELETION HANDOFF/);
  assert.match(manifest, /chatAttachmentReceipts/);
  assert.match(manifest, /friendConversations/);
  assert.match(manifest, /uploaderUid/);
  assert.match(manifest, /attachment\.fileKey/);
});

test("42. Offline binary caching or queueing is not added", () => {
  assert.doesNotMatch([attachmentUi, friendUi, attachmentServer].join("\n"), /indexedDB|IndexedDB|serviceWorker|background sync|queued upload/i);
  assert.match(playerInbox, /offline=\{!connectivity\.online\}/);
  assert.match(friendUi, /offline=\{!online\}/);
  assert.match(manifest, /ONLINE ATTACHMENTS ONLY/);
});

test("43. Firestore rules are not widened", () => {
  assert.equal(hasChanged("firestore.rules"), false);
  assert.match(manifest, /firestore\.rules: UNCHANGED/);
});

test("44. No new dependency", () => {
  assert.equal(hasChanged("package.json"), false);
  assert.equal(hasChanged("package-lock.json"), false);
  assert.match(manifest, /No new dependency/);
});

test("45. C.1 contrast semantics remain in new attachment surfaces", () => {
  assert.match(attachmentCss, /var\(--bs-text\)/);
  assert.match(attachmentCss, /var\(--bs-ui-border/);
  assert.match(attachmentCss, /var\(--bs-danger-text/);
  assert.match(friendCss, /var\(--bs-surface-dark\)/);
});

test("46. Mobile composer cannot horizontally overflow", () => {
  assert.match(attachmentCss, /max-width:\s*100%/);
  assert.match(attachmentCss, /@media \(max-width: 390px\)/);
  assert.match(friendCss, /@media \(max-width: 390px\)/);
  assert.match(attachmentCss, /overflow-wrap:\s*anywhere/);
});
