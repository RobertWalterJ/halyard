# Halyard

Rapid-fire flag recognition, with progress that carries over between sessions.
Personal project — not GPA.

Double-click **`Launch Halyard.bat`** (or the Desktop shortcut). It starts a
local server and opens <http://localhost:8790>.

---

## The two modes

**Quick Play** — a fixed round against a 12-second-per-question clock. Scored:
100 a correct answer, up to 100 more for speed, and a bonus that grows with your
streak. Arcade-style, but the answers still feed your long-term progress.

The clock is read **visually**, not by digits. A bar drains left-to-right
directly under the flag — where your eye already is — shifting yellow → amber at
4 seconds elapsed → orange → red as it empties. From 4 seconds the screen edges
warm amber, and in the last 3 seconds they turn red and pulse. The numeric
readout is still there but deliberately understated until it matters.

Urgency is signalled at the **edges** rather than as a wash over the whole
screen: tinting the background of a flag-recognition game would change the
colours you are being asked to judge. The drain is one CSS animation carrying
both the scale and the colour, so there is no per-frame JavaScript, and it is
explicitly exempted from the reduced-motion rule — the bar is information, and
zeroing its duration would empty it instantly.

**Training** — untimed. Halyard chooses the questions using a Leitner spaced-
repetition schedule: flags you are due to review come first (most overdue
first), then ones you have never seen, then the ones you keep getting wrong.

A flag counts as **mastered** at box 3 — three consecutive correct answers,
spaced out over at least a few days. A wrong answer drops it two boxes, so
mastery has to be re-earned rather than being a one-off lucky guess.

Review intervals per box: immediate · 10 min · 1 day · 3 days · 7 days ·
21 days · 60 days.

## The other modes

All five share one engine. Every question kind still resolves to *four flag
records, one of which is right*, so grading, the Leitner schedule and every
statistic work identically no matter what is being asked. Only the prompt and
what is printed on the buttons change (`KINDS` in `app/app.js`).

**Capitals** — flag → capital city, or capital → flag via the flip toggle. Uses
the capital already carried in the dataset, so it is a second knowledge domain
for no new data. Only entries that actually have a capital are eligible.

**Lookalikes** — drawn only from flags with a catalogued twin, and the wrong
answers come from that twin list first. The confusable table already existed to
season the distractors; this makes it the whole round. Cruel distractors are
forced on, so that toggle is hidden.

**Zoom out** — opens at 5.5x on a random point and pulls back over the question,
easing so it opens quickly then settles. Answering early is worth more.
Deliberately *not* deeper than 5.5x and the origin is held near the middle: a
hard zoom into the corner of a plain stripe is a blank rectangle, which is not a
question. On answering, it snaps to the full flag so you see what it was.

---

## Packs

Round one ships countries and the seed sets that came free with the flag data.

| Pack | Count | Notes |
|---|---|---|
| Countries | 194 | 193 UN member states + Vatican City |
| Territories | 54 | Dependencies and overseas territories |
| Disputed | 4 | Kosovo, Taiwan, Palestine, Western Sahara |
| Organisations | 7 | UN, EU, ASEAN, Arab League, CEFTA, EAC, Pacific Community |
| Sub-national | 11 | UK home nations, Spanish autonomies, St Helena constituents |
| Canada | 16 | 13 provinces & territories + Toronto, Ottawa, Montreal · *lazy* |
| Germany | 14 | States · *lazy* |
| United States | 50 | States · *lazy* |

### Lazy packs

The sub-national sets are **not** in the core bundle. The US states alone are
7.7MB — four times the whole rest of the app — because most are a detailed seal
on a plain field. Each set is a separate file fetched the first time you switch
the pack on; the service worker then caches it, so it is offline from the second
use onward. The chip shows the download size before you commit to it, and
`sw.js` deliberately does not precache them so a fresh install does not pay for
sets it may never use.

Harvested from Wikimedia Commons by `build/harvest-subnational.py`. Two things
that pass matter there: every SVG is given a `viewBox` if it lacks one (or it
will not scale into the card), and **every internal id is namespaced by flag
code**. Browse renders hundreds of flags into one document, and Commons files
reuse generic ids like `a` — without namespacing, `url(#a)` in one flag resolves
against another flag's gradient and the artwork corrupts. Verified: 1,786 ids
across 336 rendered flags, zero collisions.

Because these keep their real proportions (unlike the 4:3-normalised country
set), they letterbox in the card — Ontario shows as the 1:2 flag it actually is.

Capitals mode works on these for free: provinces and states carry their capital,
so it asks "Ontario → Toronto" and "Bavaria → Munich". The three city flags have
no capital, so Capitals silently skips them.

**Missing, pending Commons:** North Rhine-Westphalia and Saxony-Anhalt, and most
large Canadian cities (Calgary, Halifax, Victoria, Edmonton have no current SVG
flag on Commons at all).

Partially recognised states are deliberately their own opt-in group rather than
being silently ruled in or out of "countries".

To grow the sub-national, historical, or NGO packs, add entries to
`build/build-data.mjs` and drop their SVGs into `sources/flags-4x3/`, then
re-run the build. Nothing in the app is hard-coded to the current set.

## Difficulty

Three bands, filterable. Tier 1 is a **curated** list of ~56 genuinely iconic
flags rather than a derived one: population turned out to be a poor proxy for
flag recognisability (it ranked Burkina Faso above Austria). Tiers 2 and 3 are
ranked by population weighted toward the regions a Canadian player sees most.

## Distractors

Wrong answers are ranked by how much they actually resemble the real flag:

- a curated look-alike table (Chad/Romania, Indonesia/Monaco, Ireland/Côte
  d'Ivoire, the Nordic crosses, and so on) — heaviest weight
- same sub-region, then same region
- overlap of colour signatures, computed at build time by parsing every fill in
  each SVG and quantising to 15 palette buckets

**Cruel distractors** off: two plausible options plus a wildcard, so it does not
degenerate into a pure colour-matching puzzle. On: the three nearest
look-alikes, every time.

---

## Design

Deliberately a single light theme — white paper, warm neutrals biased toward the
accent, orange (`#ea6a17`) and yellow (`#ffc42e`) carrying the signalling. Every
colour is painted explicitly, so the page holds up on any host background rather
than borrowing one.

The home screen opens on a **halyard**: real flags from the actual data set,
strung along a catenary and hung at the curve's tangent, reshuffled on every
visit. It is drawn from `flag-svgs.json` at runtime, not a static image — which
is why the hero shows the product rather than describing it. The flag positions
are inset to `t ∈ [0.1, 0.9]` along the curve because a rotated flag reaches
further sideways than its centre point, and the outermost ones clipped.

Typefaces are **Bricolage Grotesque** (display) and **Instrument Sans** (UI),
both self-hosted in `app/fonts/` rather than pulled from Google's CDN, so the
typography survives offline and inside the artifact's content policy. The build
inlines them as data URIs for the single-file version.

## Layout

```
Halyard/
├── Launch Halyard.bat      double-click launcher
├── server.mjs              static server on :8790, no dependencies
├── app/                    the app itself (this is what gets served)
│   ├── index.html  styles.css  app.js
│   ├── sw.js               service worker — network-first, cache fallback
│   ├── manifest.webmanifest
│   ├── fonts/*.woff2           self-hosted typefaces
│   ├── data/flags.json         generated metadata (52K)
│   ├── data/flag-svgs.json     generated SVG bundle (1.9MB, one request)
│   ├── flags/*.svg             generated individual flags
│   └── icons/*.png             generated
├── build/
│   ├── build-data.mjs      joins the three sources → app/data/*
│   ├── make-icons.mjs      draws the PNG icons (hand-rolled encoder)
│   └── bundle-single.mjs   inlines everything → dist/halyard.html
├── dist/halyard.html       self-contained single file, no network at all
│                             (fonts inlined as data URIs)
└── sources/                cached raw inputs, so builds are reproducible offline
```

Rebuild after changing data or the app:

```bash
node build/build-data.mjs && node build/make-icons.mjs && node build/bundle-single.mjs
```

`sw.js` is deliberately **network-first with a cache fallback**. Cache-first is
marginally faster but pins whatever was cached first, which means running stale
code until the cache name changes. Network-first is always current when the
server is reachable and still fully offline when it is not. Bump `CACHE` in
`sw.js` when you change assets.

## Progress data

Everything lives in `localStorage` under `halyard.v1`, on that device only —
per flag: attempts, correct, Leitner box, due date, streak; plus a session
history capped at 300 rounds. There is no server and nothing leaves the device.

Settings → **Export progress** writes a JSON file in the served build. The
single-file build copies the same JSON to the clipboard instead, because the
artifact viewer never grants a page permission to hand over a file — a download
link there would be a button that silently does nothing.

## Sources and licensing

- Flags — [flag-icons](https://github.com/lipis/flag-icons) 7.5.0, MIT
- Country metadata — [world-countries](https://github.com/mledoze/countries)
  5.1.0 (mledoze), ODbL
- Population — World Bank indicator `SP.POP.TOTL`, most recent year per country
- Typefaces — Bricolage Grotesque and Instrument Sans, both SIL Open Font
  License, self-hosted from `app/fonts/`

Raw inputs are cached in `sources/` so the build does not need the network.
