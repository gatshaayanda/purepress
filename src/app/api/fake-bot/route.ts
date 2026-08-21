import { NextResponse } from "next/server";

type BotResponse = {
  reply: string;
  suggestions?: string[];
};

const CONTACT = {
  whatsappNumber: "+26772971852",
};

const SOCIALS = {
  instagram: "https://www.instagram.com/p/DUTTKQjCCG6/",
  tiktok:
    "https://www.tiktok.com/@sparklelegacyinsurancebr/video/7568941327816068364",
  facebook:
    "https://www.facebook.com/p/Sparkle-Legacy-Insurance-Brokers-61557773288268/",
};

const PATHS = {
  shortTerm: "/c/short-term",
  longTerm: "/c/long-term",
  retirement: "/c/retirement",
  business: "/c/business",
  claims: "/claims",
  contact: "/contact",
  clientLogin: "/client/login",
};

const SUGG = {
  GET_QUOTE: "Get a quote",
  SHORT: "Short-Term cover",
  LONG: "Long-Term cover",
  RETIRE: "Retirement",
  SME: "SME cover",
  CLAIMS: "Claims help",
  WHATSAPP: "Talk on WhatsApp",
  CONTACT: "Contact",
  DOCS: "What documents are needed?",
  LOGIN: "Client login help",
} as const;

const SHORT_TERM_PRODUCTS = [
  "motor",
  "car",
  "vehicle",
  "home",
  "household contents",
  "travel",
  "gadgets",
  "liability",
];

const LONG_TERM_PRODUCTS = [
  "life",
  "funeral",
  "disability",
  "credit life",
  "dread disease",
  "income protection",
];

const BUSINESS_PRODUCTS = [
  "business assets",
  "commercial cover",
  "liability",
  "fleet",
  "employee benefits",
];

const RETIREMENT_PRODUCTS = [
  "retirement planning",
  "pensions",
  "annuities",
  "long-term planning",
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const reply = (text: string, suggestions?: string[]): BotResponse => ({
  reply: text.trim(),
  suggestions,
});

const normalize = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (text: string, patterns: (string | RegExp)[]) =>
  patterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern)
  );

const joinList = (items: string[]) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

function getProductHints(text: string) {
  const hits: string[] = [];

  if (containsAny(text, [/\b(motor|car|vehicle|third party|comprehensive)\b/])) {
    hits.push("motor");
  }
  if (containsAny(text, [/\b(home|house|contents|property)\b/])) {
    hits.push("home");
  }
  if (containsAny(text, [/\b(travel)\b/])) {
    hits.push("travel");
  }
  if (containsAny(text, [/\b(gadget|phone|laptop|device)\b/])) {
    hits.push("gadgets");
  }
  if (containsAny(text, [/\b(life)\b/])) {
    hits.push("life");
  }
  if (containsAny(text, [/\b(funeral)\b/])) {
    hits.push("funeral");
  }
  if (containsAny(text, [/\b(disability|income protection|income)\b/])) {
    hits.push("disability / income protection");
  }
  if (containsAny(text, [/\b(retirement|pension|annuity|wealth)\b/])) {
    hits.push("retirement");
  }
  if (containsAny(text, [/\b(business|sme|commercial|fleet|office|company)\b/])) {
    hits.push("business / SME");
  }

  return [...new Set(hits)];
}

function getQuoteReply(text: string): BotResponse {
  const productHints = getProductHints(text);

  if (productHints.length > 0) {
    return reply(
      [
        `I can help with a quote for ${joinList(productHints)} cover.`,
        "",
        "Please share:",
        "• your cover type",
        "• the product you need",
        "• your city or town",
        "• any useful notes",
        "",
        "For example:",
        '"Motor insurance for a 2018 Toyota Axio in Gaborone."',
        "",
        `You can also browse the relevant page first:`,
        `• Short-Term: ${PATHS.shortTerm}`,
        `• Long-Term: ${PATHS.longTerm}`,
        `• Business / SME: ${PATHS.business}`,
        `• Retirement: ${PATHS.retirement}`,
      ].join("\n"),
      [SUGG.GET_QUOTE, SUGG.WHATSAPP, SUGG.DOCS, SUGG.CONTACT]
    );
  }

  return reply(
    [
      "Absolutely — I can help you start a quote.",
      "",
      "Tell me these 4 things:",
      "• cover type",
      "• product",
      "• city / town",
      "• any extra notes",
      "",
      "If you are still deciding, I can also help you choose between:",
      `• Short-Term: ${joinList(SHORT_TERM_PRODUCTS)}`,
      `• Long-Term: ${joinList(LONG_TERM_PRODUCTS)}`,
      `• Business / SME: ${joinList(BUSINESS_PRODUCTS)}`,
      `• Retirement: ${joinList(RETIREMENT_PRODUCTS)}`,
      "",
      "Or tap “Talk on WhatsApp” and the site will prepare the message for you.",
    ].join("\n"),
    [SUGG.SHORT, SUGG.LONG, SUGG.SME, SUGG.RETIRE, SUGG.WHATSAPP]
  );
}

function getClaimsReply(text: string): BotResponse {
  const productHints = getProductHints(text);

  return reply(
    [
      "I can guide you on claims support.",
      "",
      "The best starting details are:",
      "• what happened",
      "• when it happened",
      "• which product it relates to",
      "• any photos, reports, forms, or supporting documents you already have",
      "",
      productHints.length
        ? `From your message, this sounds related to ${joinList(productHints)}.`
        : "If you tell me the product type, I can guide you more clearly.",
      "",
      `Claims page: ${PATHS.claims}`,
      "If it feels urgent, please use WhatsApp so the team can respond faster.",
    ].join("\n"),
    [SUGG.CLAIMS, SUGG.DOCS, SUGG.WHATSAPP, SUGG.CONTACT]
  );
}

function getDocumentsReply(text: string): BotResponse {
  const productHints = getProductHints(text);

  if (productHints.length > 0) {
    return reply(
      [
        `For ${joinList(productHints)}, the exact requirements can vary, but common items usually include:`,
        "• ID",
        "• the relevant form or quote details",
        "• supporting documents linked to the request",
        "",
        "For claims, that often means evidence such as photos, reports, invoices, medical information, or repair-related documents depending on the case.",
        "",
        "For a precise checklist, tell me whether this is for a quote, claim, or policy support.",
      ].join("\n"),
      [SUGG.GET_QUOTE, SUGG.CLAIMS, SUGG.WHATSAPP]
    );
  }

  return reply(
    [
      "Document requirements usually depend on the product and whether this is for a quote, claim, or policy support request.",
      "",
      "Common items often include:",
      "• ID",
      "• quote or policy details if available",
      "• completed forms where needed",
      "• supporting evidence relevant to the request",
      "",
      "Tell me the product type — for example motor, home, funeral, life, business, or retirement — and I’ll narrow it down.",
    ].join("\n"),
    [SUGG.DOCS, SUGG.SHORT, SUGG.LONG, SUGG.CLAIMS]
  );
}

function getShortTermReply(): BotResponse {
  return reply(
    [
      "Short-Term insurance usually covers things such as:",
      `• ${joinList(SHORT_TERM_PRODUCTS)}`,
      "",
      `You can browse here: ${PATHS.shortTerm}`,
      "If you want a quote, tell me what product you need and your city or town.",
    ].join("\n"),
    [SUGG.GET_QUOTE, SUGG.CLAIMS, SUGG.DOCS, SUGG.WHATSAPP]
  );
}

function getLongTermReply(): BotResponse {
  return reply(
    [
      "Long-Term insurance usually focuses on people, families, and income-related protection, including:",
      `• ${joinList(LONG_TERM_PRODUCTS)}`,
      "",
      `You can browse here: ${PATHS.longTerm}`,
      "If you tell me the product you are considering, I can help guide the next step.",
    ].join("\n"),
    [SUGG.GET_QUOTE, SUGG.RETIRE, SUGG.DOCS, SUGG.WHATSAPP]
  );
}

function getBusinessReply(): BotResponse {
  return reply(
    [
      "For businesses and SMEs, Sparkle Legacy can guide you on cover such as:",
      `• ${joinList(BUSINESS_PRODUCTS)}`,
      "",
      `Business / SME page: ${PATHS.business}`,
      "Tell me what kind of business you run and what you need protected, and I’ll guide the next step.",
    ].join("\n"),
    [SUGG.SME, SUGG.GET_QUOTE, SUGG.DOCS, SUGG.WHATSAPP]
  );
}

function getRetirementReply(): BotResponse {
  return reply(
    [
      "Retirement and long-term planning is about building future security with more clarity.",
      "",
      `This area usually includes ${joinList(RETIREMENT_PRODUCTS)}.`,
      `Browse here: ${PATHS.retirement}`,
      "",
      "If you want, tell me whether you are looking for planning support, a savings-focused option, or future income planning.",
    ].join("\n"),
    [SUGG.RETIRE, SUGG.GET_QUOTE, SUGG.WHATSAPP, SUGG.CONTACT]
  );
}

function getContactReply(): BotResponse {
  return reply(
    [
      `You can reach Sparkle Legacy on WhatsApp at ${CONTACT.whatsappNumber}.`,
      `You can also visit the contact page here: ${PATHS.contact}`,
      "",
      "If you tell me whether this is about a quote, claim, or policy question, I can help you prepare the right message first.",
    ].join("\n"),
    [SUGG.WHATSAPP, SUGG.GET_QUOTE, SUGG.CLAIMS, SUGG.CONTACT]
  );
}

function getSocialsReply(): BotResponse {
  return reply(
    [
      "Here are Sparkle Legacy’s social links:",
      `• Instagram: ${SOCIALS.instagram}`,
      `• TikTok: ${SOCIALS.tiktok}`,
      `• Facebook: ${SOCIALS.facebook}`,
    ].join("\n"),
    [SUGG.GET_QUOTE, SUGG.WHATSAPP, SUGG.CONTACT]
  );
}

function getClientLoginReply(): BotResponse {
  return reply(
    [
      "Client access is available here:",
      `${PATHS.clientLogin}`,
      "",
      "If you are trying to log in and need help, the quickest path is to contact the team on WhatsApp so they can guide you directly.",
    ].join("\n"),
    [SUGG.LOGIN, SUGG.WHATSAPP, SUGG.CONTACT]
  );
}

function getPricingReply(): BotResponse {
  return reply(
    [
      "Premiums and pricing depend on the product, your details, and insurer underwriting.",
      "",
      "The fastest way to get a useful answer is to request a quote with:",
      "• the cover type",
      "• the product",
      "• your city or town",
      "• any relevant notes",
      "",
      "Once those details are clear, the team can guide you properly.",
    ].join("\n"),
    [SUGG.GET_QUOTE, SUGG.WHATSAPP, SUGG.SHORT, SUGG.LONG]
  );
}

function getGreetingReply(): BotResponse {
  return reply(
    [
      pick([
        "Hi 👋 You’re chatting with Sparkle Legacy.",
        "Hello 👋 Sparkle Legacy here.",
        "Welcome 👋 I’m here to help with quotes, claims, and cover guidance.",
      ]),
      "",
      "What do you need help with today?",
    ].join("\n"),
    [SUGG.GET_QUOTE, SUGG.SHORT, SUGG.LONG, SUGG.CLAIMS, SUGG.WHATSAPP]
  );
}

function getComparisonReply(text: string): BotResponse {
  if (containsAny(text, [/\b(short[-\s]?term)\b/, /\b(things?)\b/])) {
    return getShortTermReply();
  }

  if (containsAny(text, [/\b(long[-\s]?term)\b/, /\b(people|income)\b/])) {
    return getLongTermReply();
  }

  return reply(
    [
      "A simple way to think about it is:",
      "• Short-Term insurance usually protects things like cars, homes, contents, travel, and gadgets.",
      "• Long-Term insurance usually protects people, families, and income through products like life, funeral, and disability cover.",
      "",
      "If you tell me what you want to protect, I’ll point you in the right direction.",
    ].join("\n"),
    [SUGG.SHORT, SUGG.LONG, SUGG.GET_QUOTE]
  );
}

function fallbackReply(): BotResponse {
  return reply(
    pick([
      "I can help with quotes, claims, product guidance, and policy support. Tell me what you need in a few words and I’ll point you in the right direction.",
      "Tell me whether this is about a quote, a claim, or understanding cover, and I’ll guide the next step.",
      `If you prefer, you can go straight to WhatsApp on ${CONTACT.whatsappNumber}, or tell me the product you are asking about.`,
    ]),
    [SUGG.GET_QUOTE, SUGG.SHORT, SUGG.LONG, SUGG.CLAIMS, SUGG.WHATSAPP]
  );
}

function detectReply(text: string): BotResponse {
  if (!text) return getGreetingReply();

  if (
    containsAny(text, [
      /\b(hello|hi|hey|morning|afternoon|evening|start|menu)\b/,
      /\b(dumela|hola)\b/,
    ])
  ) {
    return getGreetingReply();
  }

  if (
    containsAny(text, [
      /\b(instagram|ig)\b/,
      /\b(tiktok|tik tok)\b/,
      /\b(facebook|fb)\b/,
      /\b(social|socials|links|pages)\b/,
    ])
  ) {
    return getSocialsReply();
  }

  if (
    containsAny(text, [
      /\b(login|log in|sign in|portal|client portal|client login|account)\b/,
    ])
  ) {
    return getClientLoginReply();
  }

  if (
    containsAny(text, [
      /\b(claim|claims|accident|damage|stolen|theft|lost|injury|incident)\b/,
    ])
  ) {
    return getClaimsReply(text);
  }

  if (
    containsAny(text, [
      /\b(document|documents|requirements|needed|need|forms?|id|papers?)\b/,
    ])
  ) {
    return getDocumentsReply(text);
  }

  if (
    containsAny(text, [
      /\b(quote|quotation|price|premium|cost|how much)\b/,
      /\b(i want cover|i need insurance|need cover)\b/,
    ])
  ) {
    return getQuoteReply(text);
  }

  if (
    containsAny(text, [
      /\b(short[-\s]?term|motor|car|vehicle|third party|comprehensive|home|house|contents|travel|gadget|phone|laptop|liability)\b/,
    ])
  ) {
    return getShortTermReply();
  }

  if (
    containsAny(text, [
      /\b(long[-\s]?term|life|funeral|disability|credit life|dread disease|critical illness|income protection)\b/,
    ])
  ) {
    return getLongTermReply();
  }

  if (
    containsAny(text, [
      /\b(retirement|pension|annuity|wealth|planning)\b/,
    ])
  ) {
    return getRetirementReply();
  }

  if (
    containsAny(text, [
      /\b(business|sme|commercial|company|office|fleet|employee benefits)\b/,
    ])
  ) {
    return getBusinessReply();
  }

  if (
    containsAny(text, [
      /\b(whatsapp|chat|talk to someone|speak to someone|agent|advisor)\b/,
      /\b(contact|call|phone)\b/,
    ])
  ) {
    return getContactReply();
  }

  if (
    containsAny(text, [
      /\b(compare|difference|which one|what is the difference)\b/,
      /\b(things|people|income)\b/,
    ])
  ) {
    return getComparisonReply(text);
  }

  if (
    containsAny(text, [
      /\b(price|premium|cheap|expensive|cost)\b/,
    ])
  ) {
    return getPricingReply();
  }

  return fallbackReply();
}

export async function POST(req: Request) {
  let raw = "";

  try {
    const body = await req.json();
    raw = String(body?.message ?? "");
  } catch {
    raw = "";
  }

  const text = normalize(raw);
  return NextResponse.json(detectReply(text));
}