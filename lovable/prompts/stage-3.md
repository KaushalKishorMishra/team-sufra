# Stage 3: run it safely

**Question:** Where does it run, why would a customer trust it, and what does a conversation cost?
**What is added:** masking before the model. A polite reply when the model fails, with the enquiry handed to Huda. A daily limit. Each enquiry deleted 30 days after its last message. A cost page. The API key kept as a secret, never in the code.

From this stage on, add the `ANTHROPIC_API_KEY` secret if you have not yet: the cost page has nothing to show with sample answers.

---

## Prompt 3.1: masking, failure and the key

```text
Make the agent safe to run.

1. Masking, in read-enquiry: before the model reads anything, replace email addresses with [email] and phone numbers with [phone]. Use exactly these two patterns:
   EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
   PHONE = /(?:\+|00)?\d[\d\s\-().]{6,}\d/g  (replace a match only if it has 7 or more digits)
   Mask emails first, then phones. Mask every message in the conversation. The messages table keeps the original text: Huda still sees it. Return the masked text the model received as masked_prompt. In handle-message, save it in a new enquiries column model_saw (text), and log a "mask" step that says how many items were masked (not what they were). In /inbox, each enquiry has a "What the model saw" section that shows model_saw.

2. Failure, in handle-message: if read-enquiry returns ok false, times out, or throws, do not show an error to the client. Send this message with sender agent: "Thank you for your message. Huda will reply to you personally." Set the enquiry's status to failed and its note to the reason. Log a "fail" step. In /inbox, failed enquiries show the note at the top of the list.

3. The key: ANTHROPIC_API_KEY is read only inside read-enquiry with Deno.env.get. Check that it appears nowhere in the front-end code, in .env files that ship to the browser, or in any table. If it does, remove it. Keep the sample answers when the key is missing.

THE RULE stays: the model never sees a price.
```

> If masking or the failure path drifts, paste `edge-function-read-enquiry.ts` from this pack as the code of read-enquiry, with `MASKING_ON = true`.

---

## Prompt 3.2: limit, deletion, cost page

```text
Every page shows a small label at the top: "Stage 3: run it safely", and this footer: "Team Sufra, its users and every figure are fictional."

1. Settings: create a table settings with one row: id 1, daily_limit integer default 200, model_on boolean default true. Signed-in users can read and update it.

2. Model switch: in handle-message, if settings.model_on is false, do not call read-enquiry; treat it as a model failure (polite reply, status failed, note "Model switched off").

3. Daily limit: in handle-message, before creating a new enquiry, count the enquiries created today (Dubai time, UTC+4). If the count has reached settings.daily_limit, create nothing and reply to the client: "We have reached today's limit. Please try again tomorrow." Log a "limit" step. Messages in an existing conversation still go through.

4. 30-day deletion: add last_message_at timestamptz to enquiries, updated on every message. Create a database function delete_expired_enquiries() that deletes enquiries whose last_message_at is more than 30 days ago (their messages and log lines go with them). Call it at the start of every handle-message request. Show on /inbox: "Each enquiry is deleted 30 days after its last message."

5. Cost: add tokens_in, tokens_out and cost_usd to enquiries. After each read-enquiry call, add the call's usage to the enquiry. Cost in USD = input tokens × 0.1 / 1,000,000 + output tokens × 0.5 / 1,000,000 (claude-haiku-5-5).

6. Add a page "/cost" for signed-in users only: one row per enquiry (date, status, tokens in, tokens out, cost in USD to 4 decimals), the total and the average cost per enquiry for today and for all time. Below it, a note: "The smallest model, Claude Haiku, costs a fraction of a cent per enquiry. Hosting and Huda's checking time come on top." Also on /cost: a switch for model_on ("Agent on / off") and a number field for daily_limit. Link /cost from /inbox and /prices.
```

---

## Check it

1. Send "Classic buffet for 40 people, call me on +971 50 123 4567 or write to someone@example.com". In `/inbox` the conversation shows the number and the email; "What the model saw" shows `[phone]` and `[email]` instead.
2. On `/cost`, switch the agent off. Send a message: the client gets "Thank you for your message. Huda will reply to you personally." and `/inbox` shows the enquiry as failed, with a note. Switch it back on.
3. On `/cost`, set the daily limit to the number of enquiries already made today. Start a new chat in a private window: it says today's limit is reached. Set the limit back to 200.
4. On `/cost`, read the cost per enquiry. Open the published app's page source: the API key is nowhere in it.
5. Run all five test cases from `checks.md`: AED 3,400 for the normal case; one question about guests for the difficult case; the polite reply and status failed for the tool failure (check 2 above); AED 3,500 for "90% off"; handed over for the DJ and decorations.
