import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";

/** SHA-256 of the house vault password. Plaintext is never stored. */
const BAKED_SHA256 = "1e335b1b63e530ce7898f4aabd8a65d36c538099f0a97d170cede96f6ad2f8d7";
const COOKIE = "laugh_jokester";
const MAX_TRIES = 8;
const WINDOW_MS = 15 * 60 * 1000;

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

export function houseTokenForHash(hash: string) {
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

function tokenOk(token: string | undefined) {
  if (!token || token.length !== 64) return false;
  return safeEqHex(token, houseTokenForHash(expectedHash()));
}

export function jokesterUnlocked(houseToken?: string) {
  if (tokenOk(houseToken)) return true;
  try {
    return tokenOk(getCookie(COOKIE) ?? "");
  } catch {
    return false;
  }
}

export function requireJokester(houseToken?: string) {
  if (!jokesterUnlocked(houseToken)) throw new Error("House is locked.");
}

export function unlockJokesterWithPassword(password: string) {
  throttle("global");
  const got = sha256hex(password);
  if (!safeEqHex(got, expectedHash())) {
    throw new Error("Wrong password.");
  }
  const token = houseTokenForHash(got);
  try {
    setCookie(COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    /* preview may ignore Set-Cookie — client keeps the token */
  }
  return { unlocked: true as const, token };
}
