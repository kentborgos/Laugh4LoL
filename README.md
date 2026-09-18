# Laugh4.LoL

**We Could All Use A Little Laugh!**  
**What did you Laugh For?**

The living joke vault — a yellow comedy stage with a green Laugh4.LoL mark, and Jester Bones (skull-faced jester, cigar in his teeth) as house comic.

## What it is

- AI comedian conversationalist (Jester Bones) on the Stage
- Searchable joke vault that grows from public web sources
- Clean room by default
- Late-show / dirty jokes only after an 18+ State ID or Passport format check
- Under-18 guests get an age joke and stay in the clean vault
- Crawler harvests joke APIs and forums on a schedule (and whenever the app is busy)

## Accounts

- **Every account is free.** Vault browsing and Hit me stay free. Sign-in unlocks chats with Jester Bones.
- **Email confirm:** optional Resend letter for email/password accounts.
- **Donations:** one-time PayPal tips. No monthly or annual seats.
- Sign in with Google, X, or email & password. House admin uses email and password.
- **Admin** sets suggested donation amounts and the daily AI chat cap.
- **/jokester** is the house key vault: paste Resend API key + from-address and PayPal client id/secret (sandbox or live). Env vars override the form if both are set.

## House keys

Paste credentials at `/jokester`, or set these on Vercel:

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox` or `live`)
- optional `PAYPAL_WEBHOOK_ID` (webhook URL: `/api/paypal/webhook`)

Never commit secrets. Empty `/jokester` fields keep the previous values.

## Age check

The late show asks for date of birth plus a US State ID / license or Passport number. The server checks the date (must be 18+) and that the number looks like a real ID. **The ID number is never stored.** It is format-checked in memory and discarded.

This is an age gate, not a government records lookup.

## Stack

TanStack Start, React, Tailwind, Postgres (Neon on Vercel, PGLite in preview). Compatible with Vercel. Hourly crawl: `GET /api/crawl` via `vercel.json` cron.

## Local / Vercel

```
npm install
npm run dev
npm run build
```

Set `DATABASE_URL` on Vercel (Neon). `XAI_API_KEY` powers Jester Bones.

The Vercel function also ships PGLite's `pglite.data` / `.wasm` files so a missing `DATABASE_URL` does not 500 with `ENOENT … /var/task/_libs/pglite.data`. Production still wants Neon — PGLite is an in-memory fallback.

## Joke database (in the repo)

- Unique vault Jester reads: [`public/jokes/vault.jsonl.gz`](public/jokes/vault.jsonl.gz) — **131,920** hashed bits
- Raw open dumps (taivop, SocialGrep 1M r/Jokes, amoudgl, JokeAPI, dad dumps): [`data/jokes/`](data/jokes/)
- Schema: [`migrations/`](migrations/)
- House starter set: [`src/lib/jokes/seed.ts`](src/lib/jokes/seed.ts)
