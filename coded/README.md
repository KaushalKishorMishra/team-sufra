# Team Sufra's quote agent: the coded version

Huda's quote agent, built in code, at five stages. The workflow it follows is in [../WORKFLOW.md](../WORKFLOW.md). The no-code versions are in [../n8n](../n8n) and [../lovable](../lovable).

Huda runs a small home catering business in Dubai. A client sends an incomplete enquiry ("need food for my daughter's birthday, how much?"). The agent reads it, asks how many guests if that's missing, and drafts a quote from Huda's menu. Huda approves, edits or rejects the draft. Nothing reaches the client before she approves it. **The model reads the words; the code sets the price.** The model never sees a price.

Team Sufra, its users and every figure are fictional.

## The five stages

Every stage runs the same program. One setting, `STAGE`, switches parts on (see `src/stage.js`). Each stage is online at its own address with its own database, so resetting one never touches another.

| Stage | Address | What it adds |
|---|---|---|
| 0. Prototype | team-sufra-stage-0.pages.dev | Chat, agent and inbox only. A restart empties the inbox, prices sit in a file, and anyone can open the inbox. |
| 1. Connect it | team-sufra-stage-1.pages.dev | One conversation per client. Huda logs in, and a wrong login is refused. |
| 2. Real data | team-sufra-stage-2.pages.dev | Prices move into the database, with a page to edit them. Everything survives a restart. A waiting quote shows both prices and Huda chooses. |
| 3. Run it safely | team-sufra-stage-3.pages.dev | Phone numbers and emails hidden from the model. A polite reply when the model fails. A daily limit, a cost page, and deletion 30 days after the last message. |
| 4. Grow it | team-sufra-stage-4.pages.dev | Three caterers, each with their own login, price list and enquiries. A log page. |

Each stage's start page lists what to show, step by step.

### Two things that differ from a real system

- **"Restart the program"** in the inbox stands in for a server restart. At stages 0 and 1 it wipes the enquiries, which is what a restart does to data kept in memory. The program really keeps them in a database at every stage, because Cloudflare runs it on many machines that don't share memory. From stage 2 the button keeps everything.
- **"Reset the demo"** clears a stage for the next run. It isn't part of the lesson.

## Where things are

| File | What it does |
|---|---|
| `src/agent.js` | Reads an enquiry with the model, decides what to do next, prices the quote, hides personal details. |
| `src/worker.js` | The server: every `/api/...` address, logins, the database, limits and the log. |
| `src/stage.js` | What each stage switches on. |
| `src/mock.js` | Sample model answers, used when there is no API key. |
| `data/business.json` | Huda's business: menu, prices in AED per guest or per item, rules, booked dates. |
| `site/` | The pages: start, client chat, caterer inbox, price list, safety and cost, log. |
| `schema.sql` | The database tables. |

## Run it on your computer

```sh
npm install
npm run db:local                      # creates the tables in a local database
npm run dev -- --var STAGE:2          # stage 2 on http://localhost:8787
```

Local logins are in `.dev.vars` (not in git):

```
CATERER_LOGINS=huda=local-huda,caterer-b=local-b,caterer-c=local-c
```

Without `ANTHROPIC_API_KEY` in `.dev.vars`, the agent uses sample answers. Add the key there to use the real model (`claude-haiku-5-5`).

## Checks

```sh
npm run test:unit                     # pricing, masking and decisions, no server
npm run test:stages                   # each stage's lesson, end to end, on a local server
npm run build && PAGES=1 npm run test:stages   # the same, on the built Pages folders
```

All three pass in mock mode.

`tests/run.mjs` sends all 21 test enquiries in `data/test-enquiries.json` three times each to a running stage 3 or 4, and writes `tests/test-log.json` and `tests/test-log.csv`. It needs the real model. With sample answers three cases fail, because the samples only match keywords:

```sh
BASE=https://team-sufra-stage-4.pages.dev CATERER_CODE=<Huda's code> node tests/run.mjs
```

## Put it online

You need a Cloudflare account. The script runs as you.

```sh
npx wrangler login
ANTHROPIC_API_KEY=<key> scripts/deploy.sh
```

The script:

1. Creates five databases (`team-sufra-stage-0` to `4`) and their tables.
2. Makes caterer login codes once and keeps them in `deploy/logins.txt` (not in git). Share them only with the presenters.
3. Builds `build/stage-0` to `build/stage-4` (`npm run build`).
4. Creates the five Pages projects, sets the two secrets (`ANTHROPIC_API_KEY`, `CATERER_LOGINS`) and deploys.

Run `scripts/deploy.sh` again after a change. It keeps the databases, login codes and secrets. Pass `ANTHROPIC_API_KEY` again only to change the key.

The API key is stored as a secret on Cloudflare, never in the code. A spending cap of USD 5 per caterer per day (`DAILY_BUDGET_USD`) runs at every stage, so a busy session can't run up a bill.

Pages has no scheduled jobs, so the 30-day deletion runs whenever the inbox opens.
