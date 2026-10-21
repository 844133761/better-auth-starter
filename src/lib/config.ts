const DEFAULT_LOGIN_REDIRECT = "/admin/profile";

export function safeAdminRedirect(value?: string | null) {
  if (!value || !/^\/admin(?:\/|$)/.test(value) || value.includes("\\"))
    return DEFAULT_LOGIN_REDIRECT;
  const url = new URL(value, "http://localhost");
  return url.origin === "http://localhost" &&
    (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
    ? url.pathname + url.search
    : DEFAULT_LOGIN_REDIRECT;
}

export { DEFAULT_LOGIN_REDIRECT };
