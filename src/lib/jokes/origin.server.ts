import { getRequest } from "@tanstack/react-start/server";

/** Public origin for verify links and PayPal return URLs. */
export function publicOrigin(): string {
  const fromEnv = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  try {
    const req = getRequest();
    if (!req) return "http://localhost:8080";
    const url = new URL(req.url);
    const proto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0]?.trim() || "https";
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host).split(",")[0]?.trim();
    if (!host) return "http://localhost:8080";
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:8080";
  }
}
