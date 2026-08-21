const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  deriveFounderOperation,
  filterFounderOperationRows,
  sortFounderOperationRows,
  summarizeValidationEvidence,
  resolveOriginalBetaSourcePlayerKey,
} = require('../.test-dist-g2/lib/boardsignal/founderOperationsLogic.js');
const {
  isFounderIrrelevantRoute,
  queryVercelTrafficCore,
  sanitizeTrafficBreakdown,
} = require('../.test-dist-g2/lib/boardsignal/vercelTrafficLogic.js');

const NOW = '2026-08-19T12:00:00.000Z';
const day = 24 * 60 * 60 * 1000;
const isoBefore = (days, hours = 0) => new Date(Date.parse(NOW) - days * day - hours * 60 * 60 * 1000).toISOString();
const isoAfter = (days, hours = 0) => new Date(Date.parse(NOW) + days * day + hours * 60 * 60 * 1000).toISOString();
function base(overrides = {}) { return { uid:'u', username:'player', unreadReplies:0, pendingRequest:false, exceptionCount:0, identityConflict:false, forming:false, ...overrides }; }
function row(overrides = {}) {
  const input = base(overrides);
  return { ...deriveFounderOperation(input, NOW), uid: input.uid, username: input.username, preferredContactValue: input.preferredContactValue, reviewCount: overrides.reviewCount ?? 0, nextDeskDueAt: input.nextDeskDueAt, lastSeenAt: input.lastSeenAt, unreadReplies: input.unreadReplies, exceptionCount: input.exceptionCount, identityConflict: input.identityConflict, pendingRequest: input.pendingRequest, forming: input.forming };
}

test('follow-up: unread reply is immediate attention above normal forming state', () => {
  const result = deriveFounderOperation(base({ unreadReplies: 1, unreadReplyAt: isoBefore(1), forming:true, lastSeenAt: isoBefore(1) }), NOW);
  assert.equal(result.currentState, 'UNREAD REPLY');
  assert.equal(result.attentionReasons[0], 'UNREAD_REPLY');
});

test('follow-up: pending request is explicit NEW REQUEST', () => {
  const result = deriveFounderOperation(base({ pendingRequest:true, pendingRequestAt:isoBefore(2) }), NOW);
  assert.equal(result.currentState, 'NEW REQUEST');
  assert.ok(result.attentionReasons.includes('NEW_REQUEST'));
  assert.equal(result.oldestActionAt, isoBefore(2));
});

test('follow-up: Review ready and unseen is truthful and due after 24 hours', () => {
  const publishedAt = isoBefore(2);
  const result = deriveFounderOperation(base({ latestReview:{ publishedAt }, lastSeenAt:isoBefore(4) }), NOW);
  assert.equal(result.currentState, 'REVIEW READY · NOT SEEN');
  assert.equal(result.readyNotSeen, true);
  assert.equal(result.followUpStatus, 'due');
  assert.equal(result.followUpDueAt, new Date(Date.parse(publishedAt) + day).toISOString());
});

test('follow-up: contacted after Review moves next follow-up to 72 hours after contact', () => {
  const publishedAt = isoBefore(4);
  const lastContactedAt = isoBefore(2);
  const result = deriveFounderOperation(base({ latestReview:{ publishedAt }, lastSeenAt:isoBefore(6), founderOps:{ lastContactedAt, lastContactMethod:'email' } }), NOW);
  assert.equal(result.readyNotSeen, true);
  assert.equal(result.followUpDueAt, new Date(Date.parse(lastContactedAt) + 3 * day).toISOString());
  assert.equal(result.followUpStatus, 'upcoming');
});

test('follow-up: snooze hides normal due flag but keeps independent unread/identity/exception attention', () => {
  const publishedAt = isoBefore(3);
  const result = deriveFounderOperation(base({ latestReview:{ publishedAt }, lastSeenAt:isoBefore(5), unreadReplies:1, identityConflict:true, exceptionCount:1, founderOps:{ followUpSnoozedUntil:isoAfter(3) } }), NOW);
  assert.equal(result.followUpStatus, 'snoozed');
  assert.ok(!result.attentionReasons.includes('FOLLOW_UP_DUE'));
  assert.deepEqual(result.attentionReasons.slice(0,3), ['EXCEPTION','IDENTITY','UNREAD_REPLY']);
});

test('follow-up: not seen 7d+ remains operational attention', () => {
  const result = deriveFounderOperation(base({ lastSeenAt:isoBefore(8) }), NOW);
  assert.equal(result.currentState, 'NOT SEEN RECENTLY');
  assert.ok(result.attentionReasons.includes('NOT_SEEN'));
});

test('follow-up: absent lastSeenAt yields CHECK rather than invented timestamp', () => {
  const result = deriveFounderOperation(base(), NOW);
  assert.equal(result.notSeenRecently, true);
  assert.equal(result.followUpStatus, 'check');
  assert.equal(result.followUpDueAt, undefined);
});

test('follow-up: overdue nextDeskDueAt beyond 12h grace becomes REVIEW CHECK REQUIRED', () => {
  const result = deriveFounderOperation(base({ nextDeskDueAt:isoBefore(1), lastSeenAt:isoBefore(1) }), NOW);
  assert.equal(result.reviewCheckRequired, true);
  assert.equal(result.currentState, 'REVIEW CHECK REQUIRED');
  assert.equal(result.attentionReasons[0], 'EXCEPTION');
});

test('follow-up: normal forming player is FORMING without system exception', () => {
  const result = deriveFounderOperation(base({ nextDeskDueAt:isoBefore(1), lastSeenAt:isoBefore(1), forming:true }), NOW);
  assert.equal(result.reviewCheckRequired, false);
  assert.equal(result.currentState, 'FORMING');
});

function validationSource(handle, periodStart = '2026-08-03', periodEnd = '2026-08-09', stablePlayerId) {
  return { handle, normalizedHandle: handle.toLowerCase(), periodStart, periodEnd, ...(stablePlayerId ? { stablePlayerId } : {}) };
}
function validationAccount(playerId, canonicalUsername, eligibleCoverageKeys = []) {
  return { uid:`chesscom_${playerId}`, chessCom:{playerId, canonicalUsername}, eligibleCoverageKeys };
}

test('validation identity: two different Original Beta players sharing one period remain two players', () => {
  const a = validationSource('SourceA');
  const b = validationSource('SourceB');
  const aKey = resolveOriginalBetaSourcePlayerKey(a, []);
  const bKey = resolveOriginalBetaSourcePlayerKey(b, []);
  const v = summarizeValidationEvidence([
    {playerKey:aKey,periodStart:a.periodStart,periodEnd:a.periodEnd,source:'original'},
    {playerKey:bKey,periodStart:b.periodStart,periodEnd:b.periodEnd,source:'original'},
  ], []);
  assert.equal(v.playersServed, 2);
  assert.equal(v.verifiedReviews, 2);
  assert.equal(v.originalReviews, 2);
});

test('validation identity: same-period source A/B stay independent without identity evidence', () => {
  const a = validationSource('SourceA');
  const b = validationSource('SourceB');
  assert.equal(resolveOriginalBetaSourcePlayerKey(a, []), 'original:sourcea');
  assert.equal(resolveOriginalBetaSourcePlayerKey(b, []), 'original:sourceb');
  assert.notEqual(resolveOriginalBetaSourcePlayerKey(a, []), resolveOriginalBetaSourcePlayerKey(b, []));
});

test('validation identity: exact canonical username or eligible coverage identity maps to the stable player', () => {
  const canonical = validationAccount(11, 'HistoricalName');
  const renamed = validationAccount(22, 'CurrentName', ['22', 'OldHandle']);
  assert.equal(resolveOriginalBetaSourcePlayerKey(validationSource('historicalname'), [canonical, renamed]), 'id:11');
  assert.equal(resolveOriginalBetaSourcePlayerKey(validationSource('oldhandle'), [canonical, renamed]), 'id:22');
});

test('validation identity: a valid playerIdentityAliases mapping resolves a historical handle', () => {
  const account = validationAccount(42, 'RenamedPlayer');
  const aliases = [{normalizedHandle:'old-handle',uid:'chesscom_42',playerId:42}];
  assert.equal(resolveOriginalBetaSourcePlayerKey(validationSource('old-handle'), [account], aliases), 'id:42');
});

test('validation identity: reconciled seedHandle provenance deduplicates the Original source and stored live copy', () => {
  const account = validationAccount(77, 'CurrentHandle');
  const source = validationSource('legacy-handle', '2026-08-03', '2026-08-09');
  const provenance = [{uid:'chesscom_77',playerId:77,seedHandle:'legacy-handle',periodStart:source.periodStart,periodEnd:source.periodEnd}];
  const key = resolveOriginalBetaSourcePlayerKey(source, [account], [], provenance);
  assert.equal(key, 'id:77');
  const v = summarizeValidationEvidence([
    {playerKey:key,periodStart:source.periodStart,periodEnd:source.periodEnd,source:'original'},
    {playerKey:'id:77',periodStart:source.periodStart,periodEnd:source.periodEnd,source:'live'},
  ], ['id:77']);
  assert.equal(v.verifiedReviews, 1);
  assert.equal(v.originalReviews, 1);
  assert.equal(v.liveReviews, 0);
});

test('validation identity: invalid or ambiguous alias evidence does not merge historical players', () => {
  const account42 = validationAccount(42, 'Current42');
  const account43 = validationAccount(43, 'Current43');
  const source = validationSource('old-handle');
  assert.equal(
    resolveOriginalBetaSourcePlayerKey(source, [account42], [{normalizedHandle:'old-handle',uid:'missing',playerId:42}]),
    'original:old-handle',
  );
  assert.equal(
    resolveOriginalBetaSourcePlayerKey(source, [account42], [{normalizedHandle:'old-handle',uid:'chesscom_42',playerId:43}]),
    'original:old-handle',
  );
  assert.equal(
    resolveOriginalBetaSourcePlayerKey(source, [account42,account43], [
      {normalizedHandle:'old-handle',uid:'chesscom_42',playerId:42},
      {normalizedHandle:'old-handle',uid:'chesscom_43',playerId:43},
    ]),
    'original:old-handle',
  );
});

test('validation identity: R2/R3/R4 remain correct when player keys come from safe identity resolution', () => {
  const accounts = [
    validationAccount(1,'alpha'), validationAccount(2,'beta'), validationAccount(3,'gamma'), validationAccount(4,'delta'),
  ];
  const evidence = [];
  for (const [handle,count] of [['alpha',4],['beta',3],['gamma',2],['delta',1]]) {
    for (let i=1;i<=count;i++) {
      const source = validationSource(handle, `2026-0${i}-01`, `2026-0${i}-07`);
      evidence.push({
        playerKey: resolveOriginalBetaSourcePlayerKey(source, accounts),
        periodStart: source.periodStart,
        periodEnd: source.periodEnd,
        source: 'original',
      });
    }
  }
  const v = summarizeValidationEvidence(evidence, []);
  assert.equal(v.verifiedReviews, 10);
  assert.equal(v.playersServed, 4);
  assert.equal(v.r2Plus, 3);
  assert.equal(v.r3Plus, 2);
  assert.equal(v.r4, 1);
});

test('validation: original-only Review is counted once', () => {
  const v = summarizeValidationEvidence([{playerKey:'id:1',periodStart:'2026-01-01',periodEnd:'2026-01-07',source:'original'}], []);
  assert.deepEqual({verified:v.verifiedReviews, original:v.originalReviews, live:v.liveReviews, served:v.playersServed}, {verified:1,original:1,live:0,served:1});
});

test('validation: live-only Review is counted once', () => {
  const v = summarizeValidationEvidence([{playerKey:'id:1',periodStart:'2026-02-01',periodEnd:'2026-02-07',source:'live'}], []);
  assert.equal(v.verifiedReviews, 1); assert.equal(v.liveReviews, 1); assert.equal(v.originalReviews, 0);
});

test('validation: reconciled original/live same player-period is deduplicated and preserves original provenance', () => {
  const evidence = [
    {playerKey:'id:1',periodStart:'2026-03-01',periodEnd:'2026-03-07',source:'live'},
    {playerKey:'id:1',periodStart:'2026-03-01',periodEnd:'2026-03-07',source:'original'},
  ];
  const v = summarizeValidationEvidence(evidence, ['id:1']);
  assert.equal(v.verifiedReviews, 1); assert.equal(v.originalReviews, 1); assert.equal(v.liveReviews, 0); assert.equal(v.originalToLive, 1);
});

test('validation: same player/period counts once and R2/R3/R4 thresholds are player counts', () => {
  const evidence = [];
  for (const [playerKey,count] of [['p1',4],['p2',3],['p3',2],['p4',1]]) for (let i=1;i<=count;i++) {
    evidence.push({playerKey,periodStart:`2026-0${i}-01`,periodEnd:`2026-0${i}-07`,source:'live'});
  }
  evidence.push({...evidence[0]});
  const v = summarizeValidationEvidence(evidence, []);
  assert.equal(v.verifiedReviews, 10); assert.equal(v.r2Plus, 3); assert.equal(v.r3Plus, 2); assert.equal(v.r4, 1);
});

test('traffic: irrelevant admin/api/ayanda/static routes are excluded', () => {
  assert.equal(isFounderIrrelevantRoute('/login-secret-login-for-admins97F4B2NXQ'), true);
  assert.equal(isFounderIrrelevantRoute('/admin'), true);
  assert.equal(isFounderIrrelevantRoute('/admin/players'), true);
  assert.equal(isFounderIrrelevantRoute('/api/admin/boardsignal/traffic'), true);
  assert.equal(isFounderIrrelevantRoute('/ayanda'), true);
  const rows = sanitizeTrafficBreakdown([
    {requestPath:'/admin',visitors:9,pageviews:12}, {requestPath:'/api/foo',visitors:3,pageviews:4}, {requestPath:'/ayanda',visitors:8,pageviews:9}, {requestPath:'/boardsignal',visitors:5,pageviews:7}
  ], 'requestPath');
  assert.deepEqual(rows, [{label:'/boardsignal',visitors:5,pageviews:7}]);
});

function response(status, body) { return { ok: status >= 200 && status < 300, status, async json(){ return body; } }; }
function successFetch(url) {
  const u = new URL(url); const by = u.searchParams.get('by');
  if (url.includes('/count?')) return Promise.resolve(response(200,{data:{visitors:12,pageviews:34}}));
  if (by === 'day') return Promise.resolve(response(200,{data:[{timestamp:'2026-08-19T00:00:00.000Z',visitors:7,pageviews:11}]}));
  if (by === 'requestPath') return Promise.resolve(response(200,{data:[{requestPath:'/admin',visitors:10,pageviews:12},{requestPath:'/',visitors:7,pageviews:10}]}));
  if (by === 'referrerHostname') return Promise.resolve(response(200,{data:[{referrerHostname:'google.com',visitors:4,pageviews:5}]}));
  return Promise.resolve(response(200,{data:[{deviceType:'desktop',visitors:6,pageviews:8}]}));
}

test('traffic: token is sent only as Authorization and never present in returned safe result', async () => {
  const token = 'super-secret-token';
  const result = await queryVercelTrafficCore({token,projectId:'prj',teamId:'team',range:7,now:NOW}, successFetch);
  assert.equal(result.connection, 'connected');
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.deepEqual(result.routes, [{label:'/',visitors:7,pageviews:10}]);
});

test('traffic: missing token is graceful and exact', async () => {
  const result = await queryVercelTrafficCore({projectId:'prj',teamId:'team',range:7,now:NOW}, successFetch);
  assert.equal(result.connection, 'not_connected');
  assert.equal(result.message, 'Add BOARDSIGNAL_VERCEL_ANALYTICS_TOKEN to enable Founder traffic data.');
});

test('traffic: partial Vercel failure preserves successful metrics', async () => {
  const partial = async (url) => url.includes('by=referrerHostname') ? response(500,{secret:'nope'}) : successFetch(url);
  const result = await queryVercelTrafficCore({token:'t',projectId:'p',teamId:'team',range:7,now:NOW}, partial);
  assert.equal(result.connection, 'connected'); assert.equal(result.partial, true); assert.equal(result.totals.pageviews, 34); assert.deepEqual(result.referrers, []);
});

test('traffic: 401/403 failures return safe credential message', async () => {
  for (const status of [401,403]) {
    const result = await queryVercelTrafficCore({token:'t',projectId:'p',teamId:'team',range:7,now:NOW}, async () => response(status,{token:'should-not-leak'}));
    assert.equal(result.connection, 'credentials');
    assert.equal(result.message, 'Traffic analytics credentials need attention.');
    assert.equal(JSON.stringify(result).includes('should-not-leak'), false);
  }
});

test('traffic: 429 failure returns safe rate-limit message', async () => {
  const result = await queryVercelTrafficCore({token:'t',projectId:'p',teamId:'team',range:7,now:NOW}, async () => response(429,{raw:'ignore'}));
  assert.equal(result.connection, 'rate_limited');
  assert.equal(result.message, 'Traffic analytics rate limited. Try again shortly.');
});

test('operations sort: exception above normal and unread above forming', () => {
  const normal = row({uid:'normal',username:'Normal',lastSeenAt:isoBefore(1),forming:true});
  const unread = row({uid:'unread',username:'Unread',lastSeenAt:isoBefore(1),unreadReplies:1,unreadReplyAt:isoBefore(1),forming:true});
  const exception = row({uid:'exception',username:'Exception',lastSeenAt:isoBefore(1),exceptionCount:1,exceptionAt:isoBefore(2)});
  assert.deepEqual(sortFounderOperationRows([normal,unread,exception],'attention').map(r=>r.uid), ['exception','unread','normal']);
});

test('operations filter: follow-up due and Review-ready filters are exact', () => {
  const ready = row({uid:'ready',username:'Ready',lastSeenAt:isoBefore(4),latestReview:{publishedAt:isoBefore(2)}});
  const forming = row({uid:'forming',username:'Forming',lastSeenAt:isoBefore(1),forming:true});
  assert.deepEqual(filterFounderOperationRows([ready,forming],'follow_up_due').map(r=>r.uid), ['ready']);
  assert.deepEqual(filterFounderOperationRows([ready,forming],'reviews_ready').map(r=>r.uid), ['ready']);
});

test('operations filter: search matches username or preferred contact', () => {
  const alpha = row({uid:'a',username:'Alpha',preferredContactValue:'alpha@example.com',lastSeenAt:isoBefore(1)});
  const beta = row({uid:'b',username:'Beta',preferredContactValue:'discord:beta',lastSeenAt:isoBefore(1)});
  assert.deepEqual(filterFounderOperationRows([alpha,beta],'all','alpha').map(r=>r.uid), ['a']);
  assert.deepEqual(filterFounderOperationRows([alpha,beta],'all','discord:beta').map(r=>r.uid), ['b']);
});

test('operations filter: new request is directly addressable from Attention Now', () => {
  const request = row({uid:'request',username:'Request',pendingRequest:true,pendingRequestAt:isoBefore(1)});
  const other = row({uid:'other',username:'Other',lastSeenAt:isoBefore(1)});
  assert.deepEqual(filterFounderOperationRows([request,other],'new_requests').map(r=>r.uid), ['request']);
});

test('source contracts: static pipeline removed, traffic protected/server-only, no bounce rate or visitor identity joining', () => {
  const root = path.join(__dirname, '..');
  const admin = fs.readFileSync(path.join(root,'src/app/admin/page.tsx'),'utf8');
  const middleware = fs.readFileSync(path.join(root,'middleware.ts'),'utf8');
  const trafficServer = fs.readFileSync(path.join(root,'src/lib/boardsignal/server/vercelTraffic.ts'),'utf8');
  const trafficRoute = fs.readFileSync(path.join(root,'src/app/api/admin/boardsignal/traffic/route.ts'),'utf8');
  const trafficComponent = fs.readFileSync(path.join(root,'src/components/FounderTrafficAnalytics.tsx'),'utf8');
  const operationsComponent = fs.readFileSync(path.join(root,'src/components/FounderOperationsConsole.tsx'),'utf8');
  const playersPage = fs.readFileSync(path.join(root,'src/app/admin/players/page.tsx'),'utf8');
  const newsroomComponent = fs.readFileSync(path.join(root,'src/components/FounderNewsroomSummary.tsx'),'utf8');
  const playerAdmin = fs.readFileSync(path.join(root,'src/components/FoundingBetaPlayersAdmin.tsx'),'utf8');
  assert.equal(/\bpipeline\b/.test(admin), false);
  assert.ok(middleware.includes('/api/admin/boardsignal'));
  assert.ok(trafficServer.includes('BOARDSIGNAL_VERCEL_ANALYTICS_TOKEN'));
  assert.equal(trafficServer.includes('NEXT_PUBLIC_'), false);
  assert.ok(trafficRoute.includes('no-store, private'));
  assert.equal(/bounce rate/i.test(`${trafficServer}\n${trafficComponent}`), false);
  assert.equal(/clientIp|fingerprint|userAgent.*username|referrer.*username/i.test(`${trafficServer}\n${trafficComponent}`), false);
  assert.ok(operationsComponent.includes('const PAGE_SIZE = 20'));
  assert.ok(operationsComponent.includes('Records that you contacted this player. It does not send anything.'));
  assert.ok(operationsComponent.includes('<details className="founder-ops-details"'));
  assert.ok(playersPage.includes('HISTORICAL / ORIGINAL BETA'));
  assert.ok(playersPage.includes('DANGER ZONE'));
  assert.ok(newsroomComponent.includes('onToggle={openSecondary}'));
  assert.equal(/Review opened|opened Review/i.test(operationsComponent), false);
  for (const required of ['Confirm Identity','Revoke Access','regenerateMagic','Reset fallback code','Revoke fallback access','Repair public highlights','Show fallback access code']) {
    assert.ok(playerAdmin.includes(required), `management action retained: ${required}`);
  }
});
