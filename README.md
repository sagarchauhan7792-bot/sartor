# Sartor

A personal AI wardrobe manager. Photograph your clothes, and it works out what
goes with what — colour combinations explained in plain English, complete outfits
built for the occasion, and a visual preview of the look.

Live: **https://sagarchauhan7792-bot.github.io/sartor/**

Everything that looks like AI runs **free**: background removal and colour
analysis happen in your browser, and the styling engine is real colour theory
rather than an API call.

## What it does

**Closet** — Snap or bulk-upload clothes. The background is removed on-device,
dominant colours are detected and named, and you confirm the category in two
taps. Search and filter by category, colour or occasion; mark items clean,
in-laundry or washing.

**Dress me** — One tap builds a full outfit (top, bottom, shoes, optional layer
and accessory) for your chosen occasion, skipping anything in the wash. Every
suggestion explains *why* it works, and flags the mistakes it avoided. Shuffle
for alternatives, or rate looks 👍/👎 and it learns your taste.

**Your colours** — A daylight selfie plus four questions places you in a seasonal
palette (warm/cool, light/deep). From then on, suggestions favour the colours
that suit you and quietly down-rank the ones that don't.

**Lookbook** — Save outfits you like. Build looks by hand with live harmony
scoring and critique.

## How the styling engine works

- **Colour harmony** (`src/lib/harmony.ts`) — classifies every pair of garment
  colours as monochrome, analogous, complementary, triadic, neutral-anchored or
  clashing, and writes the explanation you read.
- **Outfit scoring** (`src/lib/outfit.ts`) — blends colour harmony (50%),
  occasion fit (32%) and style integrity (18%). Formality is modelled per
  garment type on a 1–5 scale, so a blazer over joggers is caught even when the
  colours are fine. Definite mistakes cap the score rather than averaging away.
- **Personal palette** (`src/lib/season.ts`) — samples skin and hair tone from a
  selfie, combines it with the quiz, and weights colours accordingly.
- **Learning** — each 👍/👎 nudges per-colour and per-type weights. Items shared
  between a liked and a disliked outfit cancel out, so only the distinguishing
  pieces move.

## Stack

Vite · React · TypeScript · Tailwind v4 · Supabase (Postgres + private Storage +
Auth) · vite-plugin-pwa. Deployed to GitHub Pages by GitHub Actions on every
push to `main`.

Your PIN is the password of a single Supabase account behind the scenes, so the
data is protected by real authentication and row-level security — not by hiding
a URL. All wardrobe images live in a private bucket and are served through
short-lived signed URLs.

## Running locally

```bash
npm install
npm run dev
```

Point it at your own Supabase project by setting `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, or editing `src/config.ts`. Create the schema by
running [`supabase/sartor-schema.sql`](supabase/sartor-schema.sql) in the
Supabase SQL editor, then disable "Confirm email" under Authentication so PIN
setup completes immediately.

The anon key is public by design; row-level security is what protects the data.

## Install on your phone

Open the live URL in Chrome or Safari and choose **Add to Home Screen**. It runs
full-screen like a native app, and your closet stays browsable offline.

## Roadmap

- Outfit calendar, wear logging and laundry reminders
- Wardrobe insights: colour balance, most/least worn, gap analysis, declutter
- Extract garments from selfies; virtual try-on on a model body; import from a
  store URL
