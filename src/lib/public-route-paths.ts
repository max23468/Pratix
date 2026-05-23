const PUBLIC_ROUTE_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/recupera-password",
  "/reimposta-password",
  "/privacy",
  "/termini",
]);

function normalizeRoutePath(pathname: string) {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function isPublicRoutePath(pathname: string) {
  return PUBLIC_ROUTE_PATHS.has(normalizeRoutePath(pathname));
}
