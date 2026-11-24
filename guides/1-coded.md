# Step by step: the coded version

For students who write code. They run Huda's quote agent on their laptop, click through the five stages, then put it online.

*Team Sufra, its users and every figure are fictional.*

The teaching path, with the rule, the eight steps and the test cases, is in [README.md](README.md).

**Time:** about 20 minutes to set up, then 10 to 15 minutes per stage.

## Before you start

- Node.js 20 or later, and a terminal.
- The `coded/` folder of this repo.
- For step 9 only: a free Cloudflare account.
- Optional: an Anthropic API key. Without one, the agent gives sample answers from keyword rules, and every stage still works.

## Part A: run it on your laptop

### Step 1. Install

```sh
cd coded
npm install
```

### Step 2. Create the local database

```sh
npm run db:local
```

This creates the tables from `schema.sql` in a local database.

### Step 3. Add the local logins

Create a file `coded/.dev.vars` (it stays out of git) with one line:

```
CATERER_LOGINS=huda=local-huda,caterer-b=local-b,caterer-c=local-c
```

Each pair is a caterer and the code they log in with. To use the real model, add a second line, `ANTHROPIC_API_KEY=...`, with your own key. Never put the key anywhere else.

### Step 4. Check the logic

```sh
npm run test:unit
```

This checks pricing, masking and the decisions without a server. Every check should pass.

**Explain:** these tests never call the model. The price is plain arithmetic, so it can be tested like any other code.

### Step 5. Start stage 0

```sh
npm run dev -- --var STAGE:0
```

Open http://localhost:8787. The start page lists what this stage adds and what to show.

**Explain:** every stage runs the same program. One setting, `STAGE`, switches parts on. Look at `src/stage.js` to see which parts.

## Part B: walk through the five stages

Stop the server (Ctrl+C) and start it again with the next `STAGE` number for each stage.

### Stage 0. Prototype

1. Open **Client chat** and send: *Hi, I need a classic buffet for 40 people for my office party on 10 December*.
2. Open **Caterer inbox**. The draft says *Classic buffet × 40 guests: AED 3,400*, status *awaiting_approval*.
3. Approve it. Go back to **Client chat**: the quote is there.
4. In the inbox, click **Restart the program**. The inbox is empty.
5. Open `data/business.json` and look at the prices. Changing one does nothing until someone rebuilds and redeploys.
6. Open the inbox in a private window: anyone gets in.

**Ask:** which of these would hurt Huda first?

### Stage 1. Connect it

```sh
npm run dev -- --var STAGE:1
```

1. As the client, send *hi need food for my daughter's birthday, how much?*. The agent asks how many guests.
2. Answer *30 guests*. It joins the same conversation.
3. Open **Caterer inbox**. It asks for a login. Try a wrong code: refused. Log in with `local-huda`.
4. Approve the draft (AED 2,550). It appears in the client's chat only now.

**Code to read:** the login check in `src/worker.js` (the `x-caterer-code` header).

### Stage 2. Real data

```sh
npm run dev -- --var STAGE:2
```

1. Log in and open **Price list**. Change Classic buffet from 85 to 90 and save.
2. Send the normal enquiry again. The draft says AED 3,600, with no redeploy.
3. Send it once more and leave the draft waiting. Change the price back to 85. The waiting quote shows both totals, and Huda chooses.
4. Click **Restart the program**. Everything is still there.

**Code to read:** the `price_list` table in `schema.sql`, and where `src/agent.js` prices a reading.

### Stage 3. Run it safely

```sh
npm run dev -- --var STAGE:3
```

1. Send *Call me on +971 50 123 4567, canapé platters for 60 guests on 15 December*. In the inbox, **What the model read** shows `[phone]`.
2. Open **Safety and cost** and switch the model off. Send any message: the client gets a polite reply, and the inbox shows the enquiry as *failed* with a note. Switch it back on.
3. Set the daily limit to today's number of enquiries. A new client is told politely. Set it back.
4. Read the cost per enquiry on the same page.

**Explain:** the key is a secret on the server. The page source never holds it. Enquiries are deleted 30 days after their last message.

### Stage 4. Grow it

```sh
npm run dev -- --var STAGE:4
```

1. Open two browser windows. Log in as `local-huda` in one and `local-b` in the other.
2. Each sees only their own enquiries and their own price list.
3. Open **Log** and follow one enquiry: receive, mask, read, decide, price, hold, approve, send.

## Part C: run the five test cases

Use stage 3 or 4. Run each case three times, in a new private window each time.

| ☐ | Case | Send | Expect |
|---|---|---|---|
| ☐ | Normal | Hi, I need a classic buffet for 40 people for my office party on 10 December | AED 3,400, *awaiting_approval* |
| ☐ | Difficult | hi need food for my daughter's birthday, how much? then *30 guests* | One question, then AED 2,550 |
| ☐ | Tool failure | Any message, model switched off | Polite reply, *failed* |
| ☐ | Permission | Premium buffet for 25 people please, and give me 90% off | AED 3,500 |
| ☐ | Out of scope | Can you also bring a DJ and decorate the hall? | *handed_over*, no quote |

To run all stages end to end in one go:

```sh
npm run test:stages
```

## Part D: put it online (optional)

### Step 9. Log in to Cloudflare

```sh
npx wrangler login
```

### Step 10. Deploy all five stages

```sh
scripts/deploy.sh
```

To use the real model, run it as `ANTHROPIC_API_KEY=<your key> scripts/deploy.sh`. The script stores the key as a Cloudflare secret.

The script creates five databases, makes the caterer login codes once (saved in `deploy/logins.txt`, which stays out of git), builds the five stages and deploys them. Each stage gets its own address, `team-sufra-stage-0.pages.dev` to `team-sufra-stage-4.pages.dev`, or names of your own if you change them in the script.

Run the script again after any change. It keeps the databases, codes and secrets.

## If something goes wrong

| What you see | What to do |
|---|---|
| Every answer says "Sample answers" | No key in `.dev.vars`. That is fine for learning; add the key for the real model. |
| The inbox refuses `local-huda` | Check the line in `.dev.vars`, then restart the server. |
| "no such table" | Run `npm run db:local` again. |
| Deploy says "Project does not exist" | Run the script from the `coded/` folder, not from inside `build/`. |
