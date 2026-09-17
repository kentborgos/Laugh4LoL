import { createHmac, timingSafeEqual } from "node:crypto";

const DAY = 24 * 60 * 60 * 1000;
const TTL = 30 * DAY;

function secret() {
  return process.env.AGE_TOKEN_SECRET || process.env.XAI_API_KEY || "laugh4lol-preview-age-gate";
}

export function signAgeToken(adult: boolean) {
  const payload = `${adult ? "1" : "0"}.${Date.now()}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function readAgeToken(token: string | undefined | null): { adult: boolean } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [flag, ts, sig] = parts;
  if (!flag || !ts || !sig) return null;
  const payload = `${flag}.${ts}`;
  const expect = createHmac("sha256", secret()).update(payload).digest("hex");
  try {
    if (expect.length !== sig.length) return null;
    if (!timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  const issued = Number(ts);
  if (!Number.isFinite(issued) || Date.now() - issued > TTL) return null;
  return { adult: flag === "1" };
}
