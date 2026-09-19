import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";

/** SHA-256 of the house vault password. Plaintext is never stored. */
const BAKED_SHA256 = "1e335b1b63e530ce7898f4aabd8a65d36c538099f0a97d170cede96f6ad2f8d7";
const COOKIE = "laugh_jokester";
const MAX_TRIES = 8;
const WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_MS = 7 * 24 * 60 * 60 * 1000;

type Bucket = { n: number; reset: number };
const globalRef = globalThis as typeof globalThis & { __jokesterTries__?: Map<string, Bucket> };
globalRef.__jokesterTries__ ??= new Map();

function sha256hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function expectedHash() {
  const env = process.env.JOKESTER_PASSWORD?.trim();
  return env ? sha256hex(env) : BAKED_SHA256;
}

function safeEqHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function tokenForHash(hash: string) {
  return createHmac("sha256", hash).update("laugh4lol-jokester").digest("hex");
}

function throttle(key: string) {
  const now = Date.now();
  const buckets = globalRef.__jokesterTries__!;
  const cur = buckets.get(key);
  if (!cur || cur.reset < now) {
    buckets.set(key, { n: 1, reset: now + WINDOW_MS });
    return;
  }
  if (cur.n >= MAX_TRIES) {
    throw new Error("Too many tries. Wait a few minutes.");
  }
  cur.n += 1;
}

function cookieUnlocked() {
  try {
    const cookie = getCookie(COOKIE) ?? "";
    if (!cookie || cookie.length !== 64) return false;
    return safeEqHex(cookie, tokenForHash(expectedHash()));
  } catch {
    return false;
  }
}

function writeUnlockCookie() {
  try {
    setCookie(COOKIE, tokenForHash(expectedHash()), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    /* preview iframe may ignore Set-Cookie — DB row still counts */
  }
}

export async function jokesterUnlocked(userId: string) {
  if (cookieUnlocked()) return true;
  try {
    const sql = await getSql();
    const rows = await sql<{ jokester_unlocked_at: string | Date | null }>`
      select jokester_unlocked_at from profiles where user_id = ${userId}
    `;
    const at = rows[0]?.jokester_unlocked_at;
    if (!at) return false;
    const ts = at instanceof Date ? at.getTime() : Date.parse(String(at));
    return Number.isFinite(ts) && Date.now() - ts < UNLOCK_MS;
  } catch {
    return false;
  }
}

export async function requireJokester(userId: string) {
  if (!(await jokesterUnlocked(userId))) throw new Error("Jokester is locked.");
}

export async function unlockJokesterWithPassword(userId: string, password: string) {
  throttle(userId);
  const got = sha256hex(password);
  if (!safeEqHex(got, expectedHash())) {
    throw new Error("Wrong jokester password.");
  }
  const sql = await getSql();
  await sql`update profiles set jokester_unlocked_at = now() where user_id = ${userId}`;
  writeUnlockCookie();
}
