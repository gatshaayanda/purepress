import type { PurePressLocale } from "./locales";
const TIME_ZONE = "Africa/Gaborone";
export function formatPurePressMoney(locale: PurePressLocale, minor?: number) {
  if (typeof minor !== "number" || !Number.isFinite(minor)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BWP", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
}
export function formatPurePressDate(locale: PurePressLocale, value?: string) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00+02:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(parsed);
}
export function formatPurePressDateTime(locale: PurePressLocale, value?: string) {
  if (!value) return "—";
  const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(parsed);
}
export function formatPurePressNumber(locale: PurePressLocale, value: number) { return new Intl.NumberFormat(locale).format(value); }
export function purePressPluralCategory(locale: PurePressLocale, value: number) { return new Intl.PluralRules(locale).select(value); }
