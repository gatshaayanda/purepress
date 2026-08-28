import { PUREPRESS_EN_CATALOG } from "./catalog.en";
import { PUREPRESS_TN_BW_CATALOG } from "./catalog.tn-BW";
import type { PurePressLocale } from "./locales";
export * from "./format";
export * from "./locales";
export * from "./terms";
export type PurePressTranslationKey = keyof typeof PUREPRESS_EN_CATALOG;
export type PurePressTemplateValues = Record<string, string | number>;
type CatalogShape = Record<PurePressTranslationKey, string>;
const TN_CATALOG: CatalogShape = PUREPRESS_TN_BW_CATALOG;
export const PUREPRESS_CATALOGS: Record<PurePressLocale, CatalogShape> = { "en-BW": PUREPRESS_EN_CATALOG, "tn-BW": TN_CATALOG };
function interpolate(template: string, values?: PurePressTemplateValues) {
  if (!values) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]));
}
export function translatePurePress(locale: PurePressLocale, key: PurePressTranslationKey, values?: PurePressTemplateValues) {
  return interpolate(PUREPRESS_CATALOGS[locale][key], values);
}
function normalizeSpace(value: string) { return value.replace(/\s+/g, " ").trim(); }
const englishToKey = new Map<string, PurePressTranslationKey>();
for (const key of Object.keys(PUREPRESS_EN_CATALOG) as PurePressTranslationKey[]) {
  const value = normalizeSpace(PUREPRESS_EN_CATALOG[key]);
  if (value && !englishToKey.has(value)) englishToKey.set(value, key);
}
export function localizePurePressFixedText(locale: PurePressLocale, source: string) {
  if (locale === "en-BW") return source;
  const key = englishToKey.get(normalizeSpace(source));
  return key ? TN_CATALOG[key] : source;
}
export function purePressCatalogKeyForEnglishText(source: string) { return englishToKey.get(normalizeSpace(source)) ?? null; }
export function purePressPlaceholderNames(value: string) { return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m => m[1]).sort(); }
