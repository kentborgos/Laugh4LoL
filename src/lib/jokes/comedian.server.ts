import { getSql } from "@/lib/db";

const CLEAN_SYSTEM = `You are Jester Bones, house comic of Laugh4.LoL — a skull-faced jester with a cigar and a green hat. You are a full-blown stand-up conversationalist, not a search box.

Voice: swaggering club comic, warm, quick, a little dangerous with wordplay. Clean room only. Family-friendly. No slurs, no sexual bits, no punching down at kids.

How you work:
- Talk like a comic riffing with the room, not a customer-support bot.
- Tell jokes, callbacks, one-liners, and short bits. 2–8 sentences unless they ask for a longer set.
- The vault is a huge open-source joke library (Wocka, StupidStuff, r/Jokes SocialGrep + taivop, amoudgl short jokes, Official Joke API, JokeAPI, dad dumps). Use the vault material below when it fits. You may retell, remix, or chain jokes.
- Prefer the vault bits that match the guest's topic. Don't dump them as a numbered list unless asked.
- Ask a follow-up so the conversation keeps rolling ("Want a darker clean one? A dad joke? A roast?")
- If they ask for dirty / adult / NSFW jokes, refuse with a clean roast: they need the age gate. Do not tell adult material.
- Never involve anyone under 18 in a joke that is sexual or violent.

Slogans you can land: "We Could All Use A Little Laugh!" and "What did you Laugh For?"`;

const ADULT_SYSTEM = `You are Jester Bones, house comic of Laugh4.LoL — skull-faced jester, cigar, green hat. This is the LATE SHOW. The guest is 18+ and verified.

Voice: blue-comedy club comic. Swearing, innuendo, dirty jokes, adult dating/marriage bits are in play. Still a comedian, not an erotica writer — keep it punchy, not pornographic.

Hard lines:
- NEVER sexual or exploitative content involving minors. If asked, shut it down and roast the asker, then go clean.
- No slurs targeting race, and no real-world harm instructions.
- Riff, callback, roast (kind), tell dirty jokes from the vault, invent new ones in that register.
- The vault is a huge open-source joke library (Wocka, StupidStuff, r/Jokes, amoudgl, Official Joke API). Use matching vault bits. Don't dump a numbered list unless asked.
- 2–8 sentences unless they want a longer set.
- End with a little hook so they stay in the room.

Slogans: "We Could All Use A Little Laugh!" and "What did you Laugh For?"`;

type VaultRow = { setup: string; punchline: string; body: string; category: string; score: number };

const STOP = new Set([
  "joke", "jokes", "tell", "make", "laugh", "funny", "please", "about", "with", "that", "this",
  "have", "just", "give", "another", "more", "your", "from", "what", "when", "want", "would",
  "like", "some", "them", "they", "clean", "dirty", "adult", "nsfw", "late", "show", "jester",
  "bones", "something", "anything", "gimme", "need", "hello", "hey", "roast", "bit", "bits",
  "set", "standup", "stand", "one", "some", "into", "over", "then", "than", "because",
]);

function hintTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .slice(0, 5);
}

function uniqRows(rows: VaultRow[]) {
  const seen = new Set<string>();
  const out: VaultRow[] = [];
  for (const row of rows) {
    const key = row.body.slice(0, 180);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function pickMaterial(adult: boolean, n = 14, hint = ""): Promise<VaultRow[]> {
  const sql = await getSql();
  const terms = hintTerms(hint);
  const ratingOk = adult
    ? sql<VaultRow>`select setup, punchline, body, category, score from jokes order by ln(2 + score) * random() desc limit ${n}`
    : sql<VaultRow>`select setup, punchline, body, category, score from jokes where rating = ${"clean"} order by ln(2 + score) * random() desc limit ${n}`;

  if (!terms.length) return ratingOk;

  const like = `%${terms[0]?.replace(/[%_]/g, "") ?? ""}%`;
  const matched = adult
    ? await sql<VaultRow>`
        select setup, punchline, body, category, score from jokes
        where body ilike ${like} or setup ilike ${like} or category ilike ${like}
        order by score desc
        limit ${Math.max(8, n)}
      `
    : await sql<VaultRow>`
        select setup, punchline, body, category, score from jokes
        where rating = ${"clean"}
          and (body ilike ${like} or setup ilike ${like} or category ilike ${like})
        order by score desc
        limit ${Math.max(8, n)}
      `;

  const random = await ratingOk;
  return uniqRows([...matched, ...random]).slice(0, n + 4);
}

function formatMaterial(rows: VaultRow[]) {
  if (!rows.length) return "(vault warming up — use your own material)";
  return rows
    .map((j, i) => {
      const line = j.setup ? `${j.setup} ${j.punchline}` : j.body;
      return `${i + 1}. [${j.category}] ${line}`;
    })
    .join("\n");
}

export async function riffWithGrok(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  adult: boolean;
}): Promise<{ ok: true; text: string } | { ok: false; error: string; fallback: string }> {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const material = await pickMaterial(input.adult, 10, lastUser);
  const fallbackJoke = material[0];
  const fallback = fallbackJoke
    ? fallbackJoke.setup
      ? `${fallbackJoke.setup} ${fallbackJoke.punchline}`
      : fallbackJoke.body
    : "I'd tell you a joke about the vault, but it's still stretching backstage.";

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI is not available", fallback };
  }

  const system = `${input.adult ? ADULT_SYSTEM : CLEAN_SYSTEM}

Tonight's vault material (riff, don't dump as a numbered list unless asked):
${formatMaterial(material)}`;

  const clipped = input.messages.slice(-12).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 800),
  }));

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.95,
        max_tokens: 380,
        messages: [{ role: "system", content: system }, ...clipped],
      }),
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { ok: false, error: `xAI API error ${res.status}`, fallback };
    }

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "empty", fallback };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "timeout", fallback };
  }
}
