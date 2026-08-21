export function isStandalonePublicRoute(pathname?: string | null) {
  return pathname === "/ayanda" || pathname?.startsWith("/ayanda/") === true;
}
