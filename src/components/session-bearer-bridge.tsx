import { useEffect } from "react";
import { authClient, authEnabled, getBearerToken } from "@/lib/auth/client";
import { rememberSessionToken } from "@/lib/jokes/remember-session";

/**
 * Email/password sign-in never stored the preview bearer token (OAuth popup did).
 * Copy Better Auth's session token into the same slot so Stage server functions
 * get a user, not "Sign in first."
 */
export function SessionBearerBridge() {
  if (!authEnabled) return null;
  return <Bridge />;
}

function Bridge() {
  const { data, isPending } = authClient.useSession();
  const token = data?.session?.token;

  useEffect(() => {
    if (isPending || !token) return;
    if (!getBearerToken()) rememberSessionToken(token);
  }, [isPending, token]);

  return null;
}
