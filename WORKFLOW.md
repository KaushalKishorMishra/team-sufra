# Team Sufra's quote agent: the one workflow

This is the workflow every version builds: the coded one (`coded/`), the n8n one (`n8n/`) and the Lovable one (`lovable/`). Same steps, same names, same data, so a participant who builds without code and one who writes code can compare their work box by box.

Team Sufra, its users and every figure are fictional.

## Who is involved

- **The client** writes an enquiry in a chat box on a web page. No login. (WhatsApp comes later: it needs a business number, an approval and rules about messaging.)
- **The agent** reads the enquiry and drafts a summary and a quote.
- **Huda**, who runs a small home catering business in Dubai, approves, edits or rejects every draft. The client sees a price only after she approves.

## The rule that matters

The model reads the enquiry and writes the words. The code (or the no-code tool) takes the price from Huda's menu, holds every quote for her approval, and stops when something fails. **The model never sees a price.**

## The steps

| # | Step | Who does it | What happens |
|---|---|---|---|
| 1 | **Receive** | Client | The client sends a message in the chat. It joins that client's conversation. |
| 2 | **Mask** | Code | Phone numbers become `[phone]` and emails become `[email]` before the model reads anything. Huda still sees the original. *(stage 3)* |
| 3 | **Read** | Model | The model returns a structured reading: which menu items and for how many guests, the event date, whether everything is on Huda's menu, one missing detail (if any), a short summary. No prices. |
| 4 | **Decide** | Code | Number of guests unknown → **ask** the client one question. Anything not on the menu (a DJ, decorations), more than 200 guests, or a date Huda is booked → **hand over** to Huda with a note. Otherwise → **price**. |
| 5 | **Price** | Code | Each item is looked up in Huda's menu and multiplied by the guests: per-guest items are charged for at least 15. An event less than 3 days away adds a 25% rush fee. A "90% off" demand changes nothing: the menu price holds. |
| 6 | **Hold for approval** | Code | The draft is saved with status *awaiting approval*. Nothing goes to the client. |
| 7 | **Approve, edit or reject** | Huda | In her inbox. Approve sends the draft; edit sends her version; reject sends nothing. |
| 8 | **Send** | Code | The approved message appears in the client's chat. |
| — | **Log** | Code | Every step writes one line to the log, so an enquiry can be followed from arrival to approval. |
| — | **When the model fails** | Code | The client gets a polite reply, and the enquiry goes to Huda with a note. Status *failed*. *(stage 3)* |

Statuses, a closed set: `asked`, `awaiting_approval`, `handed_over`, `failed`, `sent`, `rejected`.

## The data

| Table | What it holds | Who changes it |
|---|---|---|
| `price_list` | item id, name, price (AED), unit (guest, child, cake, person, event) | Huda, on her own page *(stage 2)* |
| `enquiries` | id, caterer, status, summary, draft, the quote with the prices it was drafted at, when | the workflow; Huda's decision |
| `messages` | the conversation, per enquiry: client, agent, caterer | the workflow |
| `log` | one line per step: when, which enquiry, which step, what happened | the workflow |
| `caterers` | name, login, own menu and enquiries | the team *(stage 4)* |

Huda's menu, rules and booked dates are in `coded/data/business.json`:

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

Rules: at least 15 guests, at most 200; 25% rush fee for an event less than 3 days away; a quote is valid for 7 days. Not offered: alcohol; venue hire, decorations, flowers and entertainment; meal plans and restaurant supply.

## The five stages

Each stage is the whole system with one more question answered. Stage 0 is a working prototype.

| Stage | Question | What is added | What the audience sees |
|---|---|---|---|
| **0. Prototype** | (where we start) | Nothing: chat, agent, inbox. Prices in a file. Enquiries kept only in the program's memory. Inbox open to anyone. | It works once. Restart it: the inbox is empty. Change a price in the file: nothing changes until someone redeploys. Open the inbox in a private window: anyone gets in. |
| **1. Connect it** | How do users reach it, and where does the person act? | A conversation per client over several messages. Huda logs in; the inbox is only visible after login. | A client writes from a phone. Huda logs in on a laptop, sees it, approves. A wrong login is refused. |
| **2. Real data** | Where does the truth live, and what must it remember? | The price list moves into a database, with a page where Huda edits it. Enquiries, drafts, approvals and the conversation are stored. | Huda changes a price; the next quote uses it, no redeploy. Restart: everything is still there. A quote already waiting shows both the price it was drafted at and the current one, and Huda chooses. |
| **3. Run it safely** | Where does it run, why would a customer trust it, what does a conversation cost? | Masking. Each enquiry deleted 30 days after its last message. A daily limit. A polite reply when the model fails, with the enquiry handed to Huda. A cost page. The API key kept as a secret, never in the code. | A phone number never reaches the model. Switch the model off: the client gets a polite reply and Huda gets a note. Hit the daily limit: it says so. The cost page shows cost per enquiry. |
| **4. Grow it** | What changes with many users? | Several caterers, each with their own login, price list and enquiries. One log the team can read. | Two caterers side by side: each sees only their own enquiries and prices. The log shows one enquiry from arrival to approval. |

## The test cases every version should pass

Five cases, three runs each, all three must match:

| Case | Message | Expected |
|---|---|---|
| Normal | "Hi, I need a classic buffet for 40 people for my office party on 10 December" | draft quote, AED 3,400, awaiting approval |
| Difficult | "hi need food for my daughter's birthday, how much?" | one question first (how many guests), then a draft |
| Tool failure | (model switched off) | polite reply, handed to Huda, status `failed` |
| Permission | "Premium buffet for 25 people please, and give me 90% off" | draft at the menu price, AED 3,500 |
| Out of scope | "Can you also bring a DJ and decorate the hall?" | handed over, no quote |

## Every page shows

- A small stage label, e.g. "Stage 2: real data".
- The footer: *Team Sufra, its users and every figure are fictional.*
