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
scoring and critique. Save reference images to the inspiration board and it
tells you which of your own clothes get closest to the look.

**Calendar & insights** — Log what you wore with one tap, plan outfits for
future days, and see where your wardrobe stands: colour balance, most and least
worn, what to let go of, and which single purchase would unlock the most new
outfits.

**From a photo of you** — Upload a photo of yourself in an outfit and Sartor
segments it into individual garments, cuts each one out, and adds them to your
closet separately. The model runs in your browser; the photo is never uploaded.

**From a link** — Paste a product URL and it pulls in the image and name,
removes the background, and reads the colours (ignoring the model's skin tone).

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

## What runs where

Nothing in Sartor costs money to run. Concretely:

| Job | How |
| --- | --- |
| Background removal | `@imgly/background-removal`, WASM, in-browser |
| Colour detection | k-means on a canvas, in-browser |
| Garment segmentation | `Xenova/segformer_b2_clothes` via transformers.js, in-browser |
| Styling decisions | Hand-written colour theory + menswear rules, no model |
| Virtual try-on | Free Hugging Face Spaces, tried in order — the one part that needs network, queues, and can fail |
| Product-link import | `r.jina.ai` to read the page, `images.weserv.nl` to fetch the image with CORS |

The ML runtimes are excluded from the service worker precache, so installing the
app stays light and the heavy assets download only when you first use the
feature that needs them.

## Known limits

- Virtual try-on runs on shared free hardware. It queues, and sometimes it is
  simply offline. The outfit collage is the reliable preview; try-on is a bonus.
  Sartor tries two Spaces: the open one (Miragic) currently refuses requests
  from India, and the better one (Kolors) refuses anonymous requests with a 403.
  Adding a free Hugging Face read token under **You** unlocks the latter.
  Failures name the service and the reason rather than a generic error.
- Selfie extraction occasionally reads hair or skin as a hat or belt, so
  accessories are left unticked by default for you to opt in.
- Product-link import depends on two public services and on the site being
  readable; some retailers block it. Saving the image and adding it from your
  gallery always works.
