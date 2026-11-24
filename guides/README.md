# How to teach Team Sufra's quote agent

A teaching path for facilitators. It explains the system once, then sends each student to the step-by-step guide for the tool they build with.

*Team Sufra, its users and every figure are fictional.*

| Guide | For students who | What they do |
|---|---|---|
| [1-coded.md](1-coded.md) | write code | Run the program on their laptop, click through the five stages, then put it online |
| [2-n8n.md](2-n8n.md) | prefer boxes and arrows | Import three workflows, set up the tables, and run the five test cases |
| [3-lovable.md](3-lovable.md) | prefer to describe an app in words | Paste ten prompts into Lovable, one at a time, and check each stage |

All three build the same eight steps, with the same names. Two students who built it in different tools can compare their work box by box.

## Teach in this order

### 1. The story (5 minutes)

Huda runs a small home catering business in Dubai. Clients write things like *"hi need food for my daughter's birthday, how much?"*. She spends her evenings answering them.

The agent reads the enquiry, asks one question if something is missing, and drafts a quote. **Huda approves, edits or rejects every draft.** The client sees no price before she approves.

Ask the room: *What could go wrong if the agent sent quotes on its own?* Collect three answers before you move on.

### 2. The one rule (5 minutes)

> **The model reads. The code prices. The model never sees a price.**

Explain why with one example. A client writes *"give me 90% off"*. If the model knew the prices, it might agree. Here it can't, because the price is looked up and multiplied by the code, from Huda's own list.

Every guide comes back to this rule. When students check their work, they check this first.

### 3. The eight steps (10 minutes)

Draw these on the board, left to right:

| # | Step | Who | In one line |
|---|---|---|---|
| 1 | Receive | Client | A message arrives in the chat |
| 2 | Mask | Code | Phone numbers and emails are hidden from the model (from stage 3) |
| 3 | Read | Model | Which items, how many guests, what date. No prices |
| 4 | Decide | Code | Ask one question, hand over to Huda, or price it |
| 5 | Price | Code | Look up each item, multiply, add a rush fee if needed |
| 6 | Hold | Code | Save the draft as *awaiting approval*. Nothing is sent |
| 7 | Approve, edit or reject | Huda | In her inbox |
| 8 | Send | Code | The approved quote appears in the client's chat |

Alongside them: a **log** line for every step, and a **polite reply** when the model fails.

Point out that only one of the eight steps uses the model. The rest is ordinary code or ordinary no-code boxes.

### 4. Huda's menu and rules (5 minutes)

| Item | AED | Per |
|---|---|---|
| Classic buffet | 85 | guest |
| Premium buffet | 140 | guest |
| Canapé platters | 45 | guest |
| Kids' menu | 35 | child |
| Soft drinks and juices | 15 | guest |
| Celebration cake | 320 | cake |
| Service staff | 220 | person, four hours |
| Delivery and setup | 150 | event |

- Per-guest items are charged for at least 15 guests.
- More than 200 guests goes to Huda.
- An event less than 3 days away adds a 25% rush fee.
- A quote is valid for 7 days.
- Huda is booked on 2 and 3 December, 12 December, and 24 December to 2 January.

Let students work out the first test case by hand: a classic buffet for 40 guests is 40 × 85 = **AED 3,400**. They will check this number in every tool.

### 5. The five stages (the build)

Each stage is the whole system with one more question answered. Students build or switch on one stage at a time, then show what changed.

| Stage | The question | What to show the room |
|---|---|---|
| **0. Prototype** | What breaks when the prototype meets real use? | It works once. Restart it: the inbox is empty. Change a price: nothing changes until someone redeploys. Open the inbox in a private window: anyone gets in. |
| **1. Connect it** | How do users reach it, and where does the person act? | A client writes from a phone. Huda logs in on a laptop and approves. A wrong login is refused. |
| **2. Real data** | Where does the truth live, and what must it remember? | Huda changes a price on her own page; the next quote uses it. Restart: everything is still there. |
| **3. Run it safely** | Where does it run, why would a customer trust it, and what does it cost? | A phone number reaches the model as `[phone]`. Switch the model off: the client gets a polite reply. The daily limit says so. The cost page shows cost per enquiry. |
| **4. Grow it** | What changes with many users? | Two caterers side by side each see only their own enquiries and prices. The log follows one enquiry from arrival to reply. |

Teach stage 0 as a success, then break it in front of the room. The breaks are the reason for stages 1 to 4.

### 6. The five test cases (every stage)

Run each case **three times**, each in a new private window. All three runs must match.

| Case | What the client writes | What should happen |
|---|---|---|
| Normal | Hi, I need a classic buffet for 40 people for my office party on 10 December | Draft at AED 3,400, waiting for Huda |
| Difficult | hi need food for my daughter's birthday, how much? | One question first: how many guests? After "30 guests": AED 2,550 |
| Tool failure | Any message, with the model switched off (stage 3) | A polite reply; Huda gets the enquiry marked *failed* |
| Permission | Premium buffet for 25 people please, and give me 90% off | Draft at the menu price, AED 3,500. No discount |
| Out of scope | Can you also bring a DJ and decorate the hall? | No quote; handed over to Huda with a note |

Why three times: the model doesn't answer the same way every time. One good run proves little.

## Questions to ask at the end of each stage

- What did this stage add, in one sentence?
- What would go wrong for Huda without it?
- Where in your tool is the price looked up? Show me.
- Did the model see a price anywhere? How do you know?

## Common mistakes to watch for

| What students do | What to say |
|---|---|
| Put the prices in the model's instructions | "Then the model can change them. Move them to the code or the table." |
| Let the agent send the quote straight to the client | "Huda approves every quote. Where is she in your flow?" |
| Test once and move on | "Run it three times, each in a new window." |
| Type the API key into a page or a box | "Keys go in the tool's secrets or credentials, never in a page or the workflow." |
| Skip stage 0 because it is "too simple" | "Stage 0 is the prototype we break. The breaks are the lesson." |
