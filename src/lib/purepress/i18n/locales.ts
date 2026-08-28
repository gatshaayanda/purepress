export const PUREPRESS_LOCALES = ["en-BW", "tn-BW"] as const;
export type PurePressLocale = (typeof PUREPRESS_LOCALES)[number];
export const PUREPRESS_DEFAULT_LOCALE: PurePressLocale = "en-BW";
export const PUREPRESS_LOCALE_STORAGE_KEY = "purepress:locale:v1";

export function normalizePurePressLocale(input: unknown): PurePressLocale | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if (value === "tn" || value.startsWith("tn-")) return "tn-BW";
  if (value === "en" || value.startsWith("en-")) return "en-BW";
  return null;
}
export function resolvePurePressLocale(input: { explicit?: unknown; stored?: unknown; url?: unknown; browser?: readonly string[] | null }): PurePressLocale {
  const explicit = normalizePurePressLocale(input.explicit); if (explicit) return explicit;
  const stored = normalizePurePressLocale(input.stored); if (stored) return stored;
  const url = normalizePurePressLocale(input.url); if (url) return url;
  for (const candidate of input.browser ?? []) if (normalizePurePressLocale(candidate) === "tn-BW") return "tn-BW";
  return PUREPRESS_DEFAULT_LOCALE;
}
export function readPurePressLocalePreference(): PurePressLocale | null {
  if (typeof window === "undefined") return null;
  try { return normalizePurePressLocale(window.localStorage.getItem(PUREPRESS_LOCALE_STORAGE_KEY)); } catch { return null; }
}
export function writePurePressLocalePreference(locale: PurePressLocale) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PUREPRESS_LOCALE_STORAGE_KEY, locale); } catch {}
}
export function purePressLocaleFromUrl(search: string): PurePressLocale | null {
  try { return normalizePurePressLocale(new URLSearchParams(search).get("lang")); } catch { return null; }
}
export function isPurePressLocaleSurface(pathname: string | null | undefined) {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/home" || pathname === "/services" || pathname === "/gallery" ||
    pathname === "/our-work" || pathname === "/about" || pathname === "/contact" || pathname === "/request-a-quote" ||
    pathname === "/client/login" || pathname === "/my-purepress" || pathname.startsWith("/my-purepress/") ||
    pathname === "/offline/my-purepress" || pathname === "/admin" || pathname === "/admin/login" ||
    pathname.startsWith("/admin/purepress/") || pathname === "/offline/purepress-studio" ||
    pathname.startsWith("/quote/") || pathname.startsWith("/proof/");
}
