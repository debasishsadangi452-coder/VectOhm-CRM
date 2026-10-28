export function isTokenExpired(token: string | null | undefined, marginSeconds = 60): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(jsonPayload) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp - marginSeconds) * 1000;
  } catch {
    return true;
  }
}
