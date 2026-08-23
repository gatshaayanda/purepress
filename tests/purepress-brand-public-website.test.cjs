const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function pngSize(file) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.toString("ascii", 1, 4), "PNG");
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

const visiblePurePressSurfaces = [
  "src/app/page.tsx",
  "src/app/services/page.tsx",
  "src/app/gallery/page.tsx",
  "src/app/about/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/request-a-quote/page.tsx",
  "src/app/client/login/page.tsx",
  "src/app/admin/page.tsx",
  "src/components/PurePressAdminFirebaseGate.tsx",
  "src/components/purepress/PurePressHeader.tsx",
  "src/components/purepress/PurePressFooter.tsx",
  "src/components/purepress/PurePressStudioPrimer.tsx",
].map((file) => [file, read(file)]);

const forbiddenVisibleLanguage = [
  /Patch A/i,
  /Patch B/i,
  /Patch C/i,
  /\bcandidate\b/i,
  /compatibility layer/i,
  /password-map/i,
  /private-media architecture/i,
  /inherited implementation/i,
  /future patch/i,
  /workflow patch/i,
  /owner-approved media only/i,
  /Inherited operations compatibility/i,
  /Founder Newsroom/i,
  /Review pipeline/i,
  /\bPlayers\b/,
];

test("PurePress public brand uses the profile cyan, magenta, yellow and charcoal", () => {
  const css = read("src/app/purepress-studio.css");
  for (const value of ["#00aeef", "#ec168c", "#ffe500", "#232323"]) {
    assert.match(css, new RegExp(value, "i"));
  }
});

test("PurePress mark follows the supplied circular P construction instead of a cyan block", () => {
  const mark = read("public/purepress/brand/purepress-mark.svg");
  assert.match(mark, /circle[^>]+fill="#EC168C"/);
  assert.match(mark, /circle[^>]+fill="#FFE500"/);
  assert.match(mark, /circle[^>]+fill="#00AEEF"/);
  assert.match(mark, /path[^>]+fill="#FFFFFF"/);
  assert.match(mark, /rect[^>]+fill="#EC168C"/);
  assert.doesNotMatch(mark, /<rect[^>]+fill="#00AEEF"/);

  const logo = read("public/purepress/brand/purepress-logo.svg");
  assert.match(logo, /Purepress Printers/);
  assert.match(logo, /Your Vision, Fully Printed/);
});

test("PurePress app icons are real-size derivatives of the supplied mark", () => {
  assert.deepEqual(
    pngSize("public/purepress/brand/purepress-app-192.png"),
    { width: 192, height: 192 },
  );
  assert.deepEqual(
    pngSize("public/purepress/brand/purepress-app-512.png"),
    { width: 512, height: 512 },
  );
  assert.deepEqual(
    pngSize("public/purepress/brand/purepress-maskable-512.png"),
    { width: 512, height: 512 },
  );
  assert.notDeepEqual(
    fs.readFileSync(
      path.join(root, "public/purepress/brand/purepress-app-512.png"),
    ),
    fs.readFileSync(
      path.join(root, "public/purepress/brand/purepress-maskable-512.png"),
    ),
  );
});


test("PurePress Apple icon uses the corrected company-profile mark colours", () => {
  const apple = read("src/app/apple-icon.tsx");

  assert.match(apple, /#00AEEF/i);
  assert.match(apple, /#EC168C/i);
  assert.match(apple, /#FFE500/i);
  assert.match(apple, /#FFFFFF/i);
  assert.doesNotMatch(apple, /#3157ff|#c9f65d|>B</i);
  assert.doesNotMatch(apple, /BoardSignal|AdminHub/i);
});

test("PurePress owns stitch, dot, thread and hoop motifs without motion dependence", () => {
  const css = read("src/app/purepress-studio.css");
  for (const token of [
    "pp-stitch-line",
    "pp-dot-grid",
    "pp-thread-chip",
    "pp-hoop",
    "pp-production-stamp",
  ]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /prefers-reduced-motion/);
});

test("public header uses PurePress navigation and My PurePress", () => {
  const source = read("src/components/purepress/PurePressHeader.tsx");
  assert.match(source, /My PurePress/);
  assert.match(source, /Request a Quote/);
  assert.match(source, /purepress-logo\.svg/);
  assert.doesNotMatch(source, /BoardSignal/);
});

test("homepage feels like an embroidery studio rather than a dashboard", () => {
  const source = read("src/app/page.tsx");
  for (const phrase of [
    "What are you branding?",
    "From idea to finished stitch",
    "Made to be worn. Made to represent you.",
    "Request a Quote",
  ]) {
    assert.match(source, new RegExp(phrase.replace(/[?]/g, "\\?")));
  }
  assert.doesNotMatch(source, /Projects 23|Users 14|Messages 5/);
});

test("all genuine PurePress service categories remain present", () => {
  const source = read("src/lib/purepress/brand.ts");
  for (const title of [
    "Computerized Embroidery on Garments and Leather",
    "Embroidery on Jute Bags and Towels",
    "School Badges and Monograms",
    "Corporate Uniform Branding",
    "Sportswear and Team Apparel Embroidery",
    "Custom Embroidered Gifts and Promotional Items",
  ]) {
    assert.match(source, new RegExp(title));
  }
});

test("gallery publication boundary remains strict while visitor copy stays business-facing", () => {
  const media = read("src/data/purepressPublicWork.ts");
  const gallery = read("src/app/gallery/page.tsx");

  assert.match(media, /safePublic === true/);
  assert.match(media, /published === true/);
  assert.match(media, /PUREPRESS_PUBLIC_WORK_ROOT/);
  assert.match(media, /Private customer artwork, proofs and order uploads/);

  assert.match(gallery, /Made to be worn\. Made to represent you\./);
  assert.match(gallery, /More PurePress work is coming to the gallery/);
  assert.doesNotMatch(gallery, /owner-approved|stock or invented|private customer/i);
});

test("quote entry is conversational and asks for artwork without technical explanation", () => {
  const source = read("src/app/request-a-quote/page.tsx");
  for (const phrase of [
    "What are we branding?",
    "How many?",
    "Where should the embroidery go?",
    "Do you already have a logo?",
    "When do you need it?",
    "How should we reach you?",
  ]) {
    assert.match(source, new RegExp(phrase.replace(/[?]/g, "\\?")));
  }
  assert.match(
    source,
    /Have your logo or artwork ready if you already have it\.[\s\S]*ask for it securely when we prepare your quotation/,
  );
  assert.doesNotMatch(source, /upload path|customer-file upload|Patch C/i);
});

test("customer identity is My PurePress with secure email-link sign-in copy", () => {
  const page = read("src/app/client/login/page.tsx");
  const auth = read("src/lib/purepress/auth/client.ts");

  assert.match(page, /My PurePress keeps your order, artwork approvals, updates and next/);
  assert.match(page, /Enter your email and we&apos;ll send you a secure sign-in link/);
  assert.match(page, /sendPurePressCustomerSignInLink/);
  assert.match(auth, /sendSignInLinkToEmail/);
  assert.doesNotMatch(page, /api\/client-login|password-map/i);
});

test("owner landing is only the PurePress Studio production desk with honest unconnected states", () => {
  const page = read("src/app/admin/page.tsx");
  const primer = read("src/components/purepress/PurePressStudioPrimer.tsx");

  assert.match(primer, /PUREPRESS STUDIO/);
  assert.match(primer, /PRODUCTION DESK/);
  assert.match(primer, /What needs attention next/);
  assert.match(primer, /No active production jobs are connected to the Studio yet/);
  assert.match(primer, /ATTENTION/);
  assert.match(primer, /WAITING ON CUSTOMER/);
  assert.match(primer, /IN PRODUCTION/);
  assert.match(primer, /READY \/ DUE NEXT/);
  assert.match(primer, /NOT CONNECTED YET/);

  assert.doesNotMatch(
    page,
    /AdminNav|FounderOperationsConsole|FounderTrafficAnalytics|FounderNewsroomSummary/,
  );
  assert.doesNotMatch(primer, /4 jobs|2 proofs|3 orders|1 order/);
});

test("visible PurePress entry surfaces reject engineering and legacy product language", () => {
  for (const [file, source] of visiblePurePressSurfaces) {
    for (const forbidden of forbiddenVisibleLanguage) {
      assert.doesNotMatch(source, forbidden, `${file} exposed ${forbidden}`);
    }
  }
});

test("root metadata and installed app identity are PurePress", () => {
  const layout = read("src/app/layout.tsx");
  const manifest = read("src/app/manifest.ts");

  assert.match(layout, /PurePress Printers — Your Vision, Fully Printed/);
  assert.match(layout, /purepress-mark\.svg/);
  assert.match(layout, /purepress-app-192\.png/);
  assert.match(manifest, /name:\s*"PurePress Printers/);
  assert.match(manifest, /short_name:\s*"PurePress"/);
  assert.match(manifest, /purepress-maskable-512\.png/);
  assert.doesNotMatch(manifest, /BoardSignal/);
});

test("service-worker update label is PurePress on public and owner surfaces", () => {
  const register = read("src/components/ServiceWorkerRegister.tsx");
  assert.match(register, /isPurePressPublicRoute\(pathname\)/);
  assert.match(register, /isPurePressInternalRoute\(pathname\)/);
  assert.match(register, /purePressSurface \? "PurePress" : "BoardSignal"/);
});

test("client route classification separates public sign-in from private customer work", () => {
  const routes = read("src/lib/purepress/publicRoutes.ts");

  assert.match(routes, /pathname === "\/client\/login"/);
  assert.match(routes, /pathname === "\/client"/);
  assert.match(routes, /pathname\.startsWith\("\/client\/"\)/);
  assert.match(routes, /pathname !== "\/client\/login"/);
  const publicPrefixes = routes.slice(
    routes.indexOf("const PUREPRESS_PUBLIC_PREFIXES"),
    routes.indexOf("] as const;") + "] as const;".length,
  );
  assert.doesNotMatch(publicPrefixes, /"\/client"/);
});

test("PurePress connectivity status is route-aware without changing UID cleanup", () => {
  const connectivity = read("src/components/ConnectivityProvider.tsx");

  assert.match(connectivity, /isPurePressPublicRoute\(pathname\)/);
  assert.match(connectivity, /isPurePressInternalRoute\(pathname\)/);
  assert.match(
    connectivity,
    /You're offline\. Some live PurePress features need a connection\./,
  );
  assert.match(connectivity, /PurePress is live again\./);
  assert.match(connectivity, /clearBoardSignalPrivateOfflineData\(previousUid\)/);
  assert.match(connectivity, /purePressSurface \? "OFFLINE" : "SAVED"/);
});

test("PurePress public chrome does not mount the BoardSignal install or launch handlers", () => {
  const chrome = read("src/components/RouteAwarePublicChrome.tsx");
  const purePressStart = chrome.indexOf("if (isPurePressPublicRoute(pathname))");
  const boardSignalStart = chrome.indexOf("return (", purePressStart + 1);
  const purePressBranch = chrome.slice(purePressStart, boardSignalStart);

  assert.ok(purePressStart >= 0);
  assert.doesNotMatch(purePressBranch, /<InstallPrompt\s*\/>/);
  assert.doesNotMatch(purePressBranch, /<PwaLaunchRedirect\s*\/>/);
  assert.match(chrome.slice(boardSignalStart), /<InstallPrompt \/>/);
  assert.match(chrome.slice(boardSignalStart), /<PwaLaunchRedirect \/>/);
});

test("metadata uses configured or Vercel-provided origins without inventing a custom domain", () => {
  const layout = read("src/app/layout.tsx");

  assert.match(layout, /NEXT_PUBLIC_SITE_URL/);
  assert.match(layout, /VERCEL_PROJECT_PRODUCTION_URL/);
  assert.match(layout, /VERCEL_URL/);
  assert.doesNotMatch(layout, /purepress\.co\.bw/i);
});

test("home and our-work aliases canonicalise deliberately", () => {
  assert.match(read("src/app/home/page.tsx"), /redirect\("\/"\)/);
  assert.match(read("src/app/our-work/page.tsx"), /redirect\("\/gallery"\)/);
});

test("admin browser identity is PurePress Studio while the existing auth gate remains", () => {
  const layout = read("src/app/admin/layout.tsx");
  const gate = read("src/components/PurePressAdminFirebaseGate.tsx");

  assert.match(layout, /PurePress Studio/);
  assert.match(layout, /PurePressAdminFirebaseGate/);
  assert.match(layout, /FounderDeviceMarker/);
  assert.match(gate, /Opening PurePress Studio/);
  assert.doesNotMatch(gate, /Admin data access could not be verified/);
});
