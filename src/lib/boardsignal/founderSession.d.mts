export const FOUNDER_SESSION_COOKIE: string;
export const FOUNDER_SESSION_VERSION: number;
export const FOUNDER_SESSION_MAX_AGE_SECONDS: number;

export type FounderSessionPayload = {
  v: number;
  role: "founder";
  iat: number;
  exp: number;
  nonce: string;
};

export type FounderSession = {
  value: string;
  payload: FounderSessionPayload;
  maxAge: number;
  expires: Date;
};

export type FounderAuthorizationResult =
  | { authorized: true; method: "session" | "basic" }
  | { authorized: false; method: "none"; reason: "not_configured" | "invalid" };

export function createFounderSession(
  adminPassword: string,
  options?: { nowMs?: number; nonce?: string }
): Promise<FounderSession>;

export function verifyFounderSession(
  value: string | null | undefined,
  adminPassword: string | null | undefined,
  options?: { nowMs?: number }
): Promise<boolean>;

export function founderPasswordFromBasicHeader(
  authorization: string | null | undefined
): string | undefined;

export function verifyFounderBasicAuthorization(
  authorization: string | null | undefined,
  adminPassword: string | null | undefined
): boolean;

export function verifyFounderAuthorization(args: {
  sessionValue?: string;
  authorization?: string | null;
  adminPassword?: string;
  nowMs?: number;
}): Promise<FounderAuthorizationResult>;
