import "server-only";

import { queryVercelTrafficCore, type VercelTrafficCoreResult, type VercelTrafficRange } from "../vercelTrafficLogic";

const DEFAULT_PROJECT_ID = "prj_54gboYTbEBPHSwGZ12w5H20KRaD8";
const DEFAULT_TEAM_ID = "team_yrHsDKn6b68zNvvd4otNaS3z";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: VercelTrafficCoreResult }>();

export async function getFounderTraffic(range: VercelTrafficRange, options: { refresh?: boolean; now?: Date } = {}) {
  const projectId = process.env.BOARDSIGNAL_VERCEL_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;
  const teamId = process.env.BOARDSIGNAL_VERCEL_TEAM_ID?.trim() || DEFAULT_TEAM_ID;
  const token = process.env.BOARDSIGNAL_VERCEL_ANALYTICS_TOKEN?.trim();
  const key = `${range}:${projectId}:${teamId}`;
  const current = Date.now();
  if (!options.refresh) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > current) return cached.value;
  }
  const value = await queryVercelTrafficCore({ token, projectId, teamId, range, now: options.now });
  if (value.connection === "connected") cache.set(key, { expiresAt: current + CACHE_TTL_MS, value });
  return value;
}
