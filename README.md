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
- **Email confirm:** Resend letter required before AI chats. House admin is auto-verified.
  API (TanStack Start handlers, same job as Next.js Route Handlers):
  `GET /api/resend`, `POST /api/resend/send` (signed in), `POST /api/resend/confirm` `{ token }`.
- **Donations:** optional PayPal donate button to **kent.borgos22@gmail.com**. No monthly or annual seats. Guests can tip without signing in.
- Sign in with email and password. Resend sends a confirm letter before AI chats. House admin is auto-verified.
- **Admin** sets suggested donation amounts and the daily AI chat cap.
- **/jokester** is the house key vault. Sign in as admin, then unlock with the 40-character vault password (shown once in the Grok chat that created it). Optional override: `JOKESTER_PASSWORD`.

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

### GitHub push is not deploying

The repo is **private**. Vercel only builds on push if the **Vercel GitHub App** can see `kentborgos/Laugh4LoL`. Right now GitHub has no Vercel checks on `main`, so the live site is stale.

Fix it once:

1. Open the [laugh4lol project on Vercel](https://vercel.com/codenamesonar-vercel/laugh4lol).
2. **Settings → Git → Connect Git Repository** → `kentborgos/Laugh4LoL` → production branch `main`.
3. If the repo is missing: [GitHub → Applications → Vercel](https://github.com/apps/vercel) → **Configure** → grant access to **Laugh4LoL** (or all repos).
4. **Deployments → Redeploy** the latest `main` commit (or push any new commit).

Backup: add a GitHub Actions secret `VERCEL_TOKEN` (create at [Vercel tokens](https://vercel.com/account/tokens)). Workflow: `.github/workflows/deploy-vercel.yml`.

Raw joke dumps (`data/jokes/raw`, ~162MB) are GitHub-only. Vercel ignores them via `.vercelignore` and reads `public/jokes/vault.jsonl.gz`.

## Joke database (in the repo)

- Unique vault Jester reads: [`public/jokes/vault.jsonl.gz`](public/jokes/vault.jsonl.gz) — **131,920** hashed bits
- Raw open dumps (taivop, SocialGrep 1M r/Jokes, amoudgl, JokeAPI, dad dumps): [`data/jokes/`](data/jokes/)
- Schema: [`migrations/`](migrations/)
- House starter set: [`src/lib/jokes/seed.ts`](src/lib/jokes/seed.ts)
