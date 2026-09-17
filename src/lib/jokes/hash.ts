import { createHash } from "node:crypto";

export function normalizeJokeText(setup: string, punchline: string, body?: string) {
  const raw = (body && body.trim()) || `${setup} ${punchline}`;
  return raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function jokeHash(setup: string, punchline: string, body?: string) {
  return createHash("sha256").update(normalizeJokeText(setup, punchline, body)).digest("hex");
}
