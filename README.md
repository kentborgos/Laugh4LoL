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

- **Free tab:** a short daily set with Jester Bones (default 5 AI chats/day). Vault browsing and Hit me stay free.
- **Email confirm:** new email/password accounts get a Resend verification letter. Free chats still work; PayPal seats wait for the click.
- **Paid seats:** monthly and annual memberships billed through PayPal. House admin sets both prices.
- Sign in with Google, X, or email & password. House admin uses email and password.
- **Admin** sets monthly price, annual price, and daily chat caps.
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
