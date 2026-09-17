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
