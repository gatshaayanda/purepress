export type VercelTrafficRange = 7 | 30;
export type TrafficBreakdownRow = { label: string; visitors: number; pageviews: number };

export function isFounderIrrelevantRoute(value: string) {
  const path = value.trim();
  return path === "/login-secret-login-for-admins97F4B2NXQ"
    || path === "/admin" || path.startsWith("/admin/")
    || path === "/api" || path.startsWith("/api/")
    || path === "/ayanda" || path.startsWith("/ayanda/")
    || path.startsWith("/_next/") || path.startsWith("/_vercel/")
    || path === "/favicon.ico" || path === "/robots.txt" || path === "/manifest.webmanifest"
    || /\.(?:js|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i.test(path);
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function sanitizeTrafficBreakdown(rows: unknown[], dimension: "requestPath" | "referrerHostname" | "deviceType", limit = 10): TrafficBreakdownRow[] {
  return rows.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const label = typeof row[dimension] === "string" ? String(row[dimension]).trim() : "";
    if (!label || (dimension === "requestPath" && isFounderIrrelevantRoute(label))) return [];
    return [{ label, visitors: numeric(row.visitors), pageviews: numeric(row.pageviews) }];
  }).sort((a, b) => b.pageviews - a.pageviews || b.visitors - a.visitors || a.label.localeCompare(b.label)).slice(0, limit);
}

export function safeVercelErrorMessage(status: number) {
  if (status === 401 || status === 403) return "Traffic analytics credentials need attention.";
  if (status === 429) return "Traffic analytics rate limited. Try again shortly.";
  return "Traffic analytics temporarily unavailable.";
}

export function trafficDateRange(days: VercelTrafficRange, nowInput: Date | string = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(until.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

export type VercelTrafficCoreResult = {
  connection: "connected" | "not_connected" | "unavailable" | "credentials" | "rate_limited";
  message?: string;
  range: VercelTrafficRange;
  since: string;
  until: string;
  totals?: { visitors: number; pageviews: number };
  daily?: Array<{ date: string; visitors: number; pageviews: number }>;
  routes?: TrafficBreakdownRow[];
  referrers?: TrafficBreakdownRow[];
  devices?: TrafficBreakdownRow[];
  partial: boolean;
};

type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

class SafeTrafficError extends Error { constructor(public status: number) { super(safeVercelErrorMessage(status)); } }

function rowsFromResponse(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const data = (value as { data?: unknown }).data;
  return Array.isArray(data) ? data : [];
}

function totalsFromResponse(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const row = data as Record<string, unknown>;
  return { visitors: numeric(row.visitors), pageviews: numeric(row.pageviews) };
}

export async function queryVercelTrafficCore(input: {
  token?: string;
  projectId: string;
  teamId: string;
  range: VercelTrafficRange;
  now?: Date | string;
}, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<VercelTrafficCoreResult> {
  const { since, until } = trafficDateRange(input.range, input.now);
  if (!input.token?.trim()) return {
    connection: "not_connected",
    message: "Add BOARDSIGNAL_VERCEL_ANALYTICS_TOKEN to enable Founder traffic data.",
    range: input.range, since, until, partial: false,
  };
  const base = "https://api.vercel.com/v1/query/web-analytics/visits";
  const request = async (kind: "count" | "aggregate", by?: string, limit?: number) => {
    const params = new URLSearchParams({ projectId: input.projectId, teamId: input.teamId, since, until });
    if (by) params.set("by", by);
    if (limit) params.set("limit", String(limit));
    const response = await fetchImpl(`${base}/${kind}?${params.toString()}`, { headers: { Authorization: `Bearer ${input.token}` } });
    if (!response.ok) throw new SafeTrafficError(response.status);
    return response.json();
  };
  const results = await Promise.allSettled([
    request("count"),
    request("aggregate", "day", input.range),
    request("aggregate", "requestPath", 25),
    request("aggregate", "referrerHostname", 15),
    request("aggregate", "deviceType", 10),
  ]);
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (rejected.length === results.length) {
    const statuses = rejected.map((result) => result.reason instanceof SafeTrafficError ? result.reason.status : 500);
    const status = statuses.includes(401) ? 401 : statuses.includes(403) ? 403 : statuses.includes(429) ? 429 : 500;
    return {
      connection: status === 401 || status === 403 ? "credentials" : status === 429 ? "rate_limited" : "unavailable",
      message: safeVercelErrorMessage(status), range: input.range, since, until, partial: false,
    };
  }
  const fulfilled = (index: number) => results[index]?.status === "fulfilled" ? (results[index] as PromiseFulfilledResult<unknown>).value : undefined;
  const daily = rowsFromResponse(fulfilled(1)).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const timestamp = typeof row.timestamp === "string" ? row.timestamp : "";
    return timestamp ? [{ date: timestamp.slice(0, 10), visitors: numeric(row.visitors), pageviews: numeric(row.pageviews) }] : [];
  });
  return {
    connection: "connected",
    range: input.range,
    since,
    until,
    totals: totalsFromResponse(fulfilled(0)),
    daily,
    routes: sanitizeTrafficBreakdown(rowsFromResponse(fulfilled(2)), "requestPath"),
    referrers: sanitizeTrafficBreakdown(rowsFromResponse(fulfilled(3)), "referrerHostname"),
    devices: sanitizeTrafficBreakdown(rowsFromResponse(fulfilled(4)), "deviceType"),
    partial: rejected.length > 0,
    ...(rejected.length > 0 ? { message: "Some traffic breakdowns are temporarily unavailable." } : {}),
  };
}
