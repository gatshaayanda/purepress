const PUREPRESS_PUBLIC_PREFIXES = [
  "/services",
  "/gallery",
  "/our-work",
  "/about",
  "/contact",
  "/request-a-quote",
] as const;

const PUREPRESS_ADMIN_LOGIN_PREFIX = "/login-secret-login-for-admins97F4B2NXQ";

export function isPurePressPublicRoute(pathname: string | null | undefined) {
  if (!pathname) return false;
  if (pathname === "/" || pathname === "/home" || pathname === "/client/login") {
    return true;
  }

  return PUREPRESS_PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPurePressInternalRoute(pathname: string | null | undefined) {
  if (!pathname) return false;

  const privateClientRoute =
    pathname === "/client" ||
    (pathname.startsWith("/client/") && pathname !== "/client/login");

  return (
    privateClientRoute ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith(PUREPRESS_ADMIN_LOGIN_PREFIX)
  );
}
