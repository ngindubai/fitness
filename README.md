# Fitness

A food and training log with a coach that doesn't flatter you.

Type what you ate in plain English, type what training you did, and at the end
of the day it tells you — bluntly — whether the day moved you forward or not.

- **Type it like you'd say it.** "2 eggs, 3 rashers bacon and wholemeal toast",
  "ran 5k in 26 min", "9,000 steps". Everything is parsed into weighed food
  items and MET-based energy costs, and the portion it assumed is shown so you
  can correct it in one tap.
- **Structured lifting.** "bench 3x8 80kg, lat pulldown 4x12 70kg" parses into
  exercises with sets, reps, load and session tonnage, tracked weekly by
  movement pattern (push / pull / legs / core).
- **Knows your environment.** Outdoor training in a hot climate carries a
  modest heat uplift on the burn estimate, and the hydration target scales
  with body weight, climate and training load. Protein targets use adjusted
  body weight above BMI 30, so they are demanding but achievable.
- **Calendar, and daily / weekly / monthly summaries.** A month calendar sits
  in the sidebar (or a sheet on the phone), every day is one tap away, and the
  Stats tab rolls the log up by day, week or calendar month - including a
  deficit/surplus heatmap and the weight trend.
- **Dark and light themes**, styled like something you would pay for.
- **One-tap "Copy day for coach"** produces a compact text summary of the day
  to paste at a human (or AI) coach.
- **An honest daily review.** A score out of 100 and a set of findings ordered
  by how much they cost you. It calls out surpluses, low protein, alcohol, junk
  share, missed training, and days where you clearly stopped logging halfway.
- **Meal suggestions that learn.** Ranked on what you actually eat, what fits
  your remaining calories, and what you haven't had recently.
- **Works from your phone.** Add to home screen and it behaves like an app.
- **Free to run.** No hosting cost on the recommended setup.
- **Multi-user.** "New here? Create your passcode" on the login screen gives
  someone their own account in one step. The passcode is the identity; every
  account's food, training, water, profile and reviews are fully separate.
- **Did-you-mean.** Typos and near-misses get suggestion chips instead of a
  dead end - "chiken brest" offers Chicken breast; one tap fixes the entry.

---

## Hosting: the honest answer

You asked about Render and Hostinger. Neither is the right home for this:

| Option | Verdict |
|---|---|
| **Cloudflare Workers + D1** | **Use this.** Free permanently, no cold starts, a real SQLite database that persists, and a free `*.workers.dev` URL that works from your phone. |
| Render free tier | Will lose your data. Free web services have an ephemeral filesystem, so anything written disappears on every restart, redeploy or spin-down — and free Postgres expires 30 days after creation. It also sleeps after 15 minutes idle, so the first load after a gap is slow. |
| Hostinger temp link | The preview/temporary domain itself works fine and lasts as long as your subscription. The problem is the runtime: Hostinger's shared hosting is built for PHP and doesn't run Node, which needs a long-lived process. You'd need their VPS, which isn't free. |

So: **Cloudflare for the real thing.** If you'd rather stay on hardware you
already pay for, a Hostinger VPS runs `server.js` fine (see *Self-hosting*).

---

## Deploy it (about 10 minutes, free)

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up).

```bash
npm install

npx wrangler login                     # opens a browser; sign in and approve
npm run setup                          # creates the database, wires up
                                       # wrangler.toml, creates the tables
npx wrangler secret put APP_PASSCODE    # the code that unlocks the app
npm run deploy
```

Wrangler prints a URL like `https://fitness.<your-account>.workers.dev`. Open
it on your phone, enter the passcode, then **Share → Add to Home Screen**.

**Upgrading an existing single-user database to multi-user** is a one-time
step, run before deploying the multi-user code:

```bash
npm run db:migrate
```

All existing data stays owned by the APP_PASSCODE account. Running it a
second time fails with "duplicate column name" - that just means it has
already been applied.

`npm run setup` is safe to re-run — it reuses an existing database rather than
making a second one, and stops without touching anything if you aren't signed
in. If it can't read the database id automatically it tells you the two
commands to finish by hand rather than half-completing.

### Automatic deploys

Once it is running, you do not need the command line again. In the Cloudflare
dashboard: **Workers & Pages → your worker → Settings → Builds → Connect**,
authorise the GitHub app, and point it at this repository and branch. Every
push then builds and deploys by itself, on Cloudflare's own builders (3,000
build minutes a month are included on the free plan).

The worker's name in the dashboard has to match `name` in `wrangler.toml`, or
the build fails.

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is kept as a manual
fallback under the repository's Actions tab. It is deliberately not run on
push: GitHub-hosted runners would not pick up jobs for a newly created account
here — three runs queued for fifteen minutes with no runner assigned and were
auto-cancelled before executing a single step — so Cloudflare's own build
service is the dependable path.

### Optional secrets

```bash
npx wrangler secret put SESSION_SECRET     # any long random string; lets you
                                           # invalidate sessions without
                                           # changing the passcode

npx wrangler secret put ANTHROPIC_API_KEY  # enables AI-written commentary
```

**The API key is genuinely optional and most people should skip it.** Without
it the app is fully functional: the daily review, the score and every finding
come from the rules engine and cost nothing to run. Setting it only changes
*who writes the prose* — the same findings get rewritten in longer form, plus
a few extra meal ideas beyond the built-in library.

If you'd rather get commentary by pasting your day into a Claude chat, leave
this unset. Requests, when enabled, use `claude-opus-5` with server-side
fallbacks so a safety classifier declining one gets re-run on a fallback model
rather than failing.

### Free-tier headroom

D1's free tier covers 5 GB of storage, 5 M row reads/day and 100 K row
writes/day. One person logging half a dozen entries a day is nowhere near it.

---

## Running it locally

```bash
npm install
APP_PASSCODE=letmein npm start
# → http://localhost:8787
```

Local data goes to `data/fitness.json`.

```bash
npm test        # 60 tests over the parser, auth, multi-user isolation,, energy maths, coach and recommender
```

## Self-hosting (VPS, home server, anything that runs Node)

`server.js` is dependency-light and serves both the API and the UI. Set
`APP_PASSCODE`, optionally `PORT` and `DATA_FILE`, and put it behind HTTPS
(the session cookie is marked `Secure`). Back up the JSON data file.

---

## How the numbers are worked out

Everything here is an estimate. The app is decisive about conclusions and
honest about precision.

**Resting metabolic rate** uses the Mifflin-St Jeor equation, which predicts
within roughly ±10% for most adults and is more accurate than the older
Harris-Benedict formula, particularly for heavier and more sedentary people.

**Maintenance** multiplies that by an activity factor describing your life
*outside* training (1.2 desk-bound to 1.6 manual work). Logged training is then
added on top. This split matters: picking a "very active" multiplier *and*
logging your gym session is the single most common way people accidentally
overestimate their burn by several hundred calories a day.

**Exercise energy** uses MET values from the 2024 Adult Compendium of Physical
Activities, and subtracts the resting energy you'd have burned anyway, so
sitting still never scores as exercise. When you give both a distance and a
time, pace is computed and mapped onto the compendium's ladder rather than
using a generic value.

**Targets**
- Deficit capped at 25% of maintenance and never below 1,500 kcal (men) /
  1,200 kcal (women). Health bodies converge on 0.5–1 kg per week as the
  sustainable ceiling; faster costs muscle and rebounds.
- Protein 2.0 g/kg when cutting, 1.8 building, 1.6 maintaining — the upper end
  of the 1.6–2.2 g/kg range that the ISSN position stand supports, because a
  deficit is exactly when lean mass is at risk.
- Fat floored at 0.6 g/kg to protect hormone production.
- Fibre at 14 g per 1,000 kcal, the standard population recommendation.

**Weekly view** is the one that matters. Daily balance is noisy — water,
glycogen and gut contents swamp a few hundred calories — so the seven-day
average is what should drive decisions.

### Sources

- [2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/)
- [ISSN Position Stand: Protein and Exercise](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/)
- [ISSN Position Stand: Diets and Body Composition](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5470183/)
- [Harvard Health: a realistic rate of weight loss](https://www.health.harvard.edu/weight-loss/what-does-a-healthy-realistic-rate-of-weight-loss-look-like-and-why-does-it-matter)
- [Mifflin-St Jeor vs Harris-Benedict accuracy](https://www.calculatemytdee.org/blog/mifflin-vs-harris-benedict)
- [Cloudflare Workers + D1 free tier](https://www.buildmvpfast.com/blog/cloudflare-workers-hono-d1-r2-free-fullstack-2026)
- [Render free tier limits](https://render.com/docs/free)
- [Hostinger temporary domain](https://www.hostinger.com/support/2489693-how-to-access-your-website-content-without-a-domain-in-hostinger/)

---

## What's in here

```
src/
  data/foods.js       188 foods, per-100 g macros + natural portion weights
  data/activities.js  65 activities with MET values and pace ladders
  data/meals.js       54 meal templates built from real weighed ingredients
  parse.js            free-text → weighed food items / structured workouts
  engine.js           BMR, maintenance, targets, daily and weekly roll-ups
  coach.js            the review: scoring and the blunt findings
  recommend.js        taste profile + meal ranking
  ai.js               optional Anthropic-written commentary
  api.js              HTTP routes, shared by both runtimes
  auth.js             HMAC-signed session tokens
  store/              D1 and JSON-file storage adapters
  worker.js           Cloudflare entry point
server.js             Node entry point
public/               the phone UI (no build step)
```

## Privacy

Single user, passcode-protected, HMAC-signed session tokens that expire after
60 days. Your log never leaves your own Cloudflare account unless you set an
Anthropic API key, in which case the day's totals are sent to the API to write
the commentary.

## Limits worth knowing

- The food database is a curated 188 items, not a barcode scanner. Anything it
  can't match is flagged in the preview and excluded from the total rather than
  silently guessed — the review tells you when that happened.
- Restaurant and takeaway figures are averages and are the least reliable
  numbers in the app.
- Exercise burn estimates run optimistic across the board. Treat the training
  figure as a ceiling, not a budget to spend.
