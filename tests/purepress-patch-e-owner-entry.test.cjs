const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const login = () => read("src/app/admin/login/page.tsx");
const middleware = () => read("middleware.ts");

test("normal PurePress owner login route exists", () => {
  assert.ok(fs.existsSync(path.join(root, "src/app/admin/login/page.tsx")));
});

test("owner login is visibly PurePress Studio only", () => {
  const source = login();
  assert.match(source, /PUREPRESS STUDIO/);
  assert.match(source, /OWNER SIGN IN|Owner sign in/);
  assert.match(source, /Secure access to the PurePress production desk/);
  assert.doesNotMatch(source, /Sparkle Legacy/i);
  assert.doesNotMatch(source, /BoardSignal/i);
  assert.doesNotMatch(source, /AdminHub/i);
});

test("owner login reuses the existing protected login endpoint", () => {
  const source = login();
  assert.match(source, /fetch\("\/api\/login"/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /credentials: "include"/);
  const api = read("src/app/api/login/route.ts");
  assert.match(api, /process\.env\.ADMIN_PASSWORD/);
  assert.match(api, /createFounderSession/);
  assert.match(api, /FOUNDER_SESSION_COOKIE/);
});

test("successful owner login returns to canonical PurePress Studio", () => {
  const source = login();
  assert.match(source, /router\.replace\("\/admin"\)/);
  assert.doesNotMatch(source, /\/admin\/dashboard/);
});

test("middleware gates unauthenticated admin before Studio rendering", () => {
  const source = middleware();
  assert.match(source, /verifyFounderAuthorization/);
  assert.match(source, /pathname === "\/admin"/);
  assert.match(source, /PUREPRESS_OWNER_LOGIN_PATH = "\/admin\/login"/);
  assert.match(source, /NextResponse\.redirect\(loginUrl\)/);
  assert.match(source, /if \(pathname === PUREPRESS_OWNER_LOGIN_PATH\) return false/);
});

test("login page bypasses only the client Firebase bridge, not server authorization", () => {
  const gate = read("src/components/PurePressAdminFirebaseGate.tsx");
  assert.match(gate, /usePathname/);
  assert.match(gate, /pathname === PUREPRESS_OWNER_LOGIN_PATH/);
  assert.match(gate, /\/api\/admin\/purepress\/firebase-session/);
  assert.match(read("src/app/api/admin/purepress/firebase-session/route.ts"), /requirePurePressAdmin/);
});

test("protected PurePress quotation APIs still require PurePress admin", () => {
  for (const file of [
    "src/app/api/admin/purepress/jobs/[projectId]/quotes/route.ts",
    "src/app/api/admin/purepress/jobs/[projectId]/quotes/[quoteId]/route.ts",
    "src/app/api/admin/purepress/jobs/[projectId]/quotes/[quoteId]/pdf/route.ts",
    "src/app/api/admin/purepress/quotation-states/route.ts",
  ]) assert.match(read(file), /requirePurePressAdmin/);
});

test("legacy secret owner URL is compatibility redirect only", () => {
  const source = read("src/app/login-secret-login-for-admins97F4B2NXQ/page.tsx");
  assert.match(source, /redirect\("\/admin\/login"\)/);
  assert.doesNotMatch(source, /Sparkle Legacy|BoardSignal|AdminHub/i);
  assert.doesNotMatch(source, /password|\/api\/login/i);
});

test("PurePress routing recognizes owner entry without making it a public customer surface", () => {
  const routes = read("src/lib/purepress/publicRoutes.ts");
  assert.match(routes, /PUREPRESS_OWNER_LOGIN_PATH = "\/admin\/login"/);
  const publicBlock = routes.slice(routes.indexOf("PUREPRESS_PUBLIC_PREFIXES"), routes.indexOf("] as const;") + 11);
  assert.doesNotMatch(publicBlock, /admin\/login/);
  assert.match(routes, /pathname\.startsWith\("\/admin\/"\)/);
});

test("owner-entry cleanup does not introduce a new identity or password system", () => {
  const combined = [login(), middleware(), read("src/components/PurePressAdminFirebaseGate.tsx")].join("\n");
  assert.doesNotMatch(combined, /createUserWithEmailAndPassword|sendPasswordResetEmail|signInWithPopup|OAuth|customer password/i);
  assert.doesNotMatch(combined, /NEW_ADMIN_PASSWORD|OWNER_PASSWORD|PUREPRESS_PASSWORD/);
});

test("Firestore permissions are unchanged by owner-entry cleanup", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/purepressQuoteRequests\/\{requestId\}[\s\S]*allow read, create, update, delete: if isPurePressAdmin\(\);/);
  assert.match(rules, /match \/projects\/\{projectId\}[\s\S]*allow read, create, update, delete: if isPurePressAdmin\(\);/);
  assert.doesNotMatch(rules, /match \/quotes\/\{quoteId\}/);
});

test("Patch E permanent gate includes owner-entry regression coverage", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["test:purepress-patch-e"], /purepress-patch-e-owner-entry\.test\.cjs/);
});
