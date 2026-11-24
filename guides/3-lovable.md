# Step by step: the Lovable version

For students who prefer to describe an app in words. They paste ten prompts into Lovable, one at a time, and check each stage before moving on.

*Team Sufra, its users and every figure are fictional.*

The teaching path, with the rule, the eight steps and the test cases, is in [README.md](README.md). The prompts are in [../lovable/prompts/](../lovable/prompts), and the build so far is in [../lovable/SCREENSHOTS.md](../lovable/SCREENSHOTS.md).

**Time:** about 15 to 25 minutes per stage, depending on how long Lovable takes.

## Before you start

- A Lovable account with enough credits. One full build (prompts 0.1 to 4.2) uses more than the free daily credits, so plan it over several days or use a paid plan.
- A backend for the project: Lovable Cloud, or Lovable's Supabase connection.
- An Anthropic API key, before stage 3. Stages 0 to 2 work without it: the agent gives sample answers and the app shows a "Sample answers" note.

## The working rhythm

Teach this rhythm before the first prompt. Students repeat it ten times.

1. **Paste one prompt.** Copy it exactly from the stage file. Don't edit it.
2. **Wait.** Let Lovable finish completely, until it stops working and the preview loads.
3. **Check it.** Click through the stage's "Check it" list in the preview.
4. **Fix one thing at a time.** If a check fails, tell Lovable exactly what you saw and what you expected. Don't paste the next prompt yet.
5. **Move on** only when every check passes.

**Explain:** Lovable writes code you don't read. The checks test what the app does, so they are your only proof that the rule still holds.

## Stage 0. Prototype

**Before:** create a new project in Lovable. No key needed.

1. Paste **prompt 0.1** (the agent, on the server).
   - Lovable may ask whether to use your own Anthropic key or its built-in AI. Choose **My Anthropic key**.
   - Lovable may say it can't deploy Edge Functions and build `read-enquiry` as a server route (`POST /api/read-enquiry`) instead. That is fine: same input, same output.
2. Paste **prompt 0.2** (the chat page and the inbox).
3. Check:
   - ☐ On `/`, send the normal enquiry. `/inbox` shows a draft at AED 3,400.
   - ☐ Approve it. The quote appears in the chat.
   - ☐ Reload the browser. `/inbox` is empty.
   - ☐ The difficult case asks how many guests first.
   - ☐ "90% off" gives AED 3,500. The DJ goes to Huda with no quote.
   - ☐ Open `/inbox` in a private window: anyone gets in.

**Ask:** where are the prices? (In `src/menu.ts`. To change one, you have to ask Lovable to change the code.)

## Stage 1. Connect it

**Before:** create Huda's login (in the backend: **Users**, **Add user**).

1. Paste **prompt 1.1** (tables and the workflow on the server).
2. Paste **prompt 1.2** (the client's chat and Huda's login).
3. Check:
   - ☐ On a phone, send the difficult enquiry and answer "30 guests". It stays one conversation.
   - ☐ On a laptop, `/inbox` sends you to `/login`. A wrong password is refused.
   - ☐ Log in as Huda and approve. The quote appears on the phone.
   - ☐ `/inbox` in a private window shows the login page.

## Stage 2. Real data

1. Paste **prompt 2.1** (the price list table and the log).
2. Paste **prompt 2.2** (Huda's price page and the two-price choice).
3. Check:
   - ☐ On `/prices`, change Classic buffet to 90. The next draft for 40 guests says AED 3,600.
   - ☐ Leave a draft waiting, change the price back to 85. The waiting quote shows both totals and Huda chooses.
   - ☐ Close the browser and come back. Everything is still there.
   - ☐ In the table editor, open `log` and follow one enquiry.

## Stage 3. Run it safely

**Before:** add the key as the secret `ANTHROPIC_API_KEY` (Lovable Cloud: **Secrets**; Supabase: **Edge Functions**, **Secrets**). Never paste it into a chat prompt or a page.

1. Paste **prompt 3.1** (masking, failure and the key).
2. Paste **prompt 3.2** (limit, deletion, cost page).
3. Check:
   - ☐ Send a message with a phone number and an email. "What the model saw" shows `[phone]` and `[email]`.
   - ☐ On `/cost`, switch the agent off. The client gets a polite reply; the inbox shows *failed*. Switch it back on.
   - ☐ Set the daily limit to today's count. A new chat is told the limit is reached. Set it back to 200.
   - ☐ `/cost` shows the cost per enquiry.
   - ☐ Open the published page source. The key is nowhere in it.

## Stage 4. Grow it

**Before:** create a second caterer's login.

1. Paste **prompt 4.1** (caterers and row-level security).
2. Paste **prompt 4.2** (pages for the team, and the log page).
3. Check:
   - ☐ Two browsers, two caterers. Each `/prices` and `/inbox` shows only their own.
   - ☐ On `/log`, filter by one enquiry: receive, mask, read, decide, price, hold, approve, send.

## The final test

Run all five cases from `../lovable/checks.md` on `/chat/huda`, three times each, in new private windows.

| ☐ | Case | Expect |
|---|---|---|
| ☐ | Normal | AED 3,400, *awaiting_approval* |
| ☐ | Difficult | One question, then AED 2,550 for 30 guests |
| ☐ | Tool failure | Polite reply, *failed* |
| ☐ | Permission | AED 3,500, no discount |
| ☐ | Out of scope | *handed_over*, no quote |

Then the two checks behind the cases:

- ☐ **The price comes from the table.** Change a price on `/prices` and send the same enquiry. The draft must change.
- ☐ **The model never sees a price.** Open the `read-enquiry` code. Search it for `AED`, `85`, `140` and `3400`. None may appear as a price. If one does, replace the function with `../lovable/edge-function-read-enquiry.ts`.

## If something goes wrong

| What you see | What to do |
|---|---|
| Lovable goes in circles on one fix | Undo to the last version that worked (Lovable keeps a history) and paste the stage's prompt again. |
| The agent always says "Sample answers" | The `ANTHROPIC_API_KEY` secret is missing or misspelled. |
| A page lost its stage label, footer or a button | Lovable rebuilt the page. Ask it to put that one thing back. |
| Caterers see each other's enquiries | The page filters, but the database doesn't. Compare the policies with the stage 4 section of `../lovable/schema.sql`. |
| Out of credits mid-prompt | Click **Finish up**. Lovable summarizes what it built and what is left. Paste the rest of the prompt when credits return. |
