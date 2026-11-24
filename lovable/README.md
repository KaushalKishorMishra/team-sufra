# Team Sufra's quote agent in Lovable: the prompt pack

Team Sufra, its users and every figure are fictional.

This pack builds Team Sufra's quote agent in Lovable, a no-code app builder, without writing code yourself. A client writes an enquiry in a chat box. The agent reads it and drafts a summary and a quote. Huda, who runs a small home catering business in Dubai, approves, edits or rejects every draft before the client sees a price.

You build it in five stages, the same five as the coded and the no-code workflow versions. Each stage answers one more question and ends with a short demo you can click through.

## The rule that matters

**The model never sees a price. The code prices from the table.**

The model reads the enquiry and writes the words: which menu items, how many guests, the event date, a short summary. The app's own code takes each price from Huda's price list, multiplies it by the guests, adds a rush fee when the event is close, holds the quote for her approval, and stops when something fails. Every prompt in this pack repeats this rule. When you check a stage, check this first.

## What is in the pack

| File | What it is |
|---|---|
| `prompts/stage-0.md` to `prompts/stage-4.md` | The prompts to paste into Lovable, one file per stage, with a "Check it" list at the end of each |
| `edge-function-read-enquiry.ts` | A reference version of the server function that calls the model. Paste it if Lovable's own version drifts |
| `schema.sql` | The database tables, stage by stage, with Huda's price list and the stage 4 security rules. Use it to check or repair what Lovable built |
| `checks.md` | The five test cases every version must pass, as a checklist |

## Huda's menu

| Item | Price (AED) | Per |
|---|---|---|
| Classic buffet | 85 | guest |
| Premium buffet | 140 | guest |
| Canapé platters | 45 | guest |
| Kids' menu | 35 | child |
| Soft drinks and juices | 15 | guest |
| Celebration cake | 320 | cake |
| Service staff | 220 | person, four hours |
| Delivery and setup | 150 | event |

The rules, all in the app's code: number of guests unknown → ask the client one question. Anything not on the menu (a DJ, decorations), more than 200 guests, or a day Huda is booked → hand over to Huda. Per-guest items are charged for at least 15 guests. An event less than 3 days away adds a 25% rush fee. A quote is valid for 7 days. Huda's booked days: 2 and 3 December 2026, 12 December 2026, and 24 December 2026 to 2 January 2027.

## Before you start

- A Lovable account, and a backend for the project: Lovable Cloud, or Lovable's Supabase connection. Both give you a database, logins and Edge Functions (small programs that run on the server).
- An Anthropic API key, when you have one. Stages 0 to 2 work without it: the agent then gives sample answers from simple keyword rules, and the app shows a small "Sample answers" note. Add the key as the secret `ANTHROPIC_API_KEY` (Lovable Cloud: Secrets; Supabase: Edge Functions > Secrets) before stage 3. It is never in the app's pages.

## The order to paste

Paste one prompt at a time. Wait until Lovable has finished and the preview works before you paste the next. If something breaks, ask Lovable to fix that one thing before you move on.

| Stage | Prompts | Before you paste | After it, check |
|---|---|---|---|
| 0. Prototype | 0.1, then 0.2 | Nothing (no key needed) | A draft at AED 3,400 for a classic buffet for 40. Reload: the inbox is empty. The inbox opens for anyone. |
| 1. Connect it | 1.1, then 1.2 | Create Huda's login (Users > Add user) | A client writes from a phone; Huda logs in on a laptop and approves. A wrong password is refused. |
| 2. Real data | 2.1, then 2.2 | Nothing | Change a price on `/prices`: the next quote uses it. A waiting quote shows both prices, and Huda chooses. |
| 3. Run it safely | 3.1, then 3.2 | Add the API key, if not yet done | A phone number reaches the model as `[phone]`. Agent switched off: a polite reply and a note for Huda. The daily limit says so. `/cost` shows cost per enquiry. |
| 4. Grow it | 4.1, then 4.2 | Create a second caterer's login | Two caterers side by side see only their own enquiries and prices. `/log` follows one enquiry from arrival to approval. |

Then run the five cases in `checks.md`, three times each.

Every page carries a small stage label (for example "Stage 2: real data") and the footer "Team Sufra, its users and every figure are fictional." If a page lacks either, ask Lovable to add it.

## How the pack maps to the workflow

The steps and names match the shared workflow, so you can compare your build with the coded and no-code workflow versions box by box.

| Step | Where it happens in Lovable | From stage |
|---|---|---|
| 1. Receive | The chat page `/` (later `/chat/:slug`) sends the message to the `handle-message` Edge Function | 0 (browser), 1 (server) |
| 2. Mask | Inside `read-enquiry`, before the model call | 3 |
| 3. Read | `read-enquiry` calls the model (claude-haiku-5-5) and returns a structured reading: items with quantities, guests, event date, in scope or not, one question, a summary. No prices | 0 |
| 4. Decide | `handle-message`: ask how many guests, hand over, or price | 0 (browser), 1 (server) |
| 5. Price | `handle-message` looks up each item: in a hard-coded list (stages 0 and 1), then in the `price_list` table (stage 2 on). At least 15 per guest; 25% rush fee under 3 days | 0 |
| 6. Hold for approval | The enquiry is saved with status `awaiting_approval`; nothing goes to the client | 0 |
| 7. Approve, edit or reject | Huda's `/inbox` | 0 (open), 1 (login) |
| 8. Send | The approved text becomes a message in the client's chat | 0 |
| Log | One line per step in the `log` table; a `/log` page for the team | 2 (table), 4 (page) |
| When the model fails | A polite reply to the client, status `failed`, a note for Huda | 3 |

Tables: `enquiries` and `messages` (stage 1), `price_list` and `log` (stage 2), `caterers` (stage 4). One table is extra: `settings` (stage 3), a single row holding the daily limit and the switch that turns the agent off for the failure test.

Statuses, a closed set: `asked`, `awaiting_approval`, `handed_over`, `failed`, `sent`, `rejected`.

## Where the Lovable route differs

- **The conversation is stored from stage 1, not stage 2.** A Lovable app has no server that remembers anything between requests, so for a client on a phone and Huda on a laptop to see the same enquiry, it has to be in the database. Stage 2's lesson is then the price list and the two-price choice; "restart, and everything is still there" already holds after stage 1.
- **Stages 0 to 2 work without a key.** When the `ANTHROPIC_API_KEY` secret is missing, `read-enquiry` returns sample answers from keyword rules, and the app says so. The key goes in as a secret, never in the pages; stage 3 checks that it is nowhere else.
- **Huda's booked days stay in the code.** They are not one of the tables, so changing them means asking Lovable to change the code. In stage 4 they apply to Huda only.
- **The fixed replies are in English.** The greeting, the "Huda will reply" message and the polite failure reply are fixed English text. The summary and the question about guests follow the client's language.

## Known limits of the no-code route

- **Lovable writes code you do not read.** It may add something you did not ask for, or quietly skip a rule. The "Check it" lists test behavior, not code, so click through them every time, not only when something looks wrong.
- **Sample answers are not the model.** With no key, the keyword rules pass the test cases, but they do not understand language. Run the five cases again once the key is in.
- **Check that the price comes from the table, not the model.** Change a price on `/prices` and send the same enquiry again: the draft must change. Then open `read-enquiry` and make sure it holds no amounts in AED (see `checks.md`). If it does, paste `edge-function-read-enquiry.ts` in its place.
- **Prompts drift.** If Lovable rewrites the system prompt or the reading's fields, the agent's answers change. The reference function holds the exact system prompt, reading format and sample rules; pasting it puts the agent back on track. For stages 0 to 2, set `MASKING_ON` to `false` in it so stage 3 has something to add.
- **Security rules are only as good as the policies.** Stage 4 keeps caterers apart with row-level security in the database. A filter in the page alone is not enough. Compare Lovable's policies with the stage 4 section of `schema.sql`.
- **A regenerated page can lose details.** Lovable sometimes rebuilds a whole page for a small change, which can drop the stage label, the footer, the "Sample answers" note or a button. Check them after each prompt.
- **Lovable's version of a step may not match the coded one exactly.** The five test cases in `checks.md` are the measure, not the code.

## If you are stuck

- A table looks wrong: open the table editor and compare it with that stage's section of `schema.sql`. You can run a section in the SQL editor, once, in order.
- The agent always gives sample answers: the `ANTHROPIC_API_KEY` secret is missing or misspelled.
- The model call fails: check that the key is right, then open the Edge Function's logs.
- Lovable keeps going in circles: undo to the last version that worked (Lovable keeps a history) and paste the stage's prompt again.
