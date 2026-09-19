import { authClient } from "@/lib/auth/client";

/** Same key the auth client uses in the Grok preview iframe. */
const BEARER_KEY = "grok-auth.bearer-token";

export function rememberSessionToken(token: string | null | undefined) {
  if (typeof window === "undefined" || !token) return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* private mode */
  }
}

export async function rememberCurrentSession() {
  const res = await authClient.getSession();
  const token = res.data?.session?.token;
  rememberSessionToken(token);
  return res;
}

export function rememberAuthResponseToken(token: string | null | undefined) {
  rememberSessionToken(token);
}
