# The n8n build, in screenshots

These screenshots come from the three workflows in this folder, imported into n8n 2.48.8 on a laptop and run through the five test cases.

*Team Sufra, its users and every figure are fictional.*

**About the model in these runs.** No API key was used. The **Read** box was pointed at a small local stand-in that answers in the same fixed form as the model, using keyword rules. Everything else is the real workflow: the tables, the rules, the prices, the approval form and the chat. With your own key, the **Read** box calls the model instead (see the README, step 3).

## 1. Set up

The three workflows after import.

![The three workflows](screenshots/01-workflows.png)

**Set up the tables**, after one click on **Execute workflow**. It creates the four tables and writes Huda's menu: eight items.

![Set up the tables, run once](screenshots/02-set-up-the-tables.png)

The **price_list** table. Huda changes a price here, with nothing to redeploy. The model never sees this column.

![Huda's price list](screenshots/03-price-list.png)

## 2. The quote agent

The agent, left half. The colored areas follow the stages: blue for stage 1 (connect it), green for stage 2 (real data), red for stage 3 (run it safely). From left to right: **Receive**, the daily limit, **Remember the conversation**, **Mask** and **Read**.

![The agent, left half](screenshots/04-agent-left.png)

The right half. **Decide** sends each enquiry to **Ask**, **Hand over**, **Price** or **When the model fails**. A priced quote waits for Huda (**Hold for approval**, **Wait for Huda**). Then everything is saved and logged, and the reply is sent. The purple note explains stage 4, which isn't built here.

![The agent, right half](screenshots/05-agent-right.png)

## 3. One enquiry, from the client to Huda and back

The client writes. Sufra replies that Huda checks every quote. No price is shown yet.

![The client's enquiry](screenshots/06-client-enquiry.png)

In the **enquiries** table, the enquiry waits for Huda with the status *awaiting_approval*.

![The enquiry awaits approval](screenshots/07-enquiry-awaiting-approval.png)

Huda opens the approval link. She sees the draft and chooses **Approve**, **Edit** (and writes her version) or **Reject**.

![Huda's approval form](screenshots/08-huda-approves.png)

The approved quote appears in the client's chat: AED 3,400.

![The client gets the quote](screenshots/09-client-gets-quote.png)

## 4. The other four test cases

**Difficult.** No guest count in the first message, so Sufra asks one question, *How many guests are you expecting?* The answer "about 30 people" leads to a quote of AED 2,550, which Huda approves.

![The difficult case](screenshots/10-difficult-case.png)

**Permission.** The client asks for 90% off. The quote uses the menu price, AED 3,500. Only Huda can give a discount, by editing the draft.

![The permission case](screenshots/11-permission-case.png)

**Out of scope.** A DJ and decorations aren't on the menu. No quote: the client gets a short reply, and the enquiry goes to Huda with a note.

![The out-of-scope case](screenshots/12-out-of-scope.png)

**Tool failure.** The model doesn't answer. Here the stand-in was made to fail on purpose; with a real key you can switch off the **Read** box instead. The client gets a polite reply, and the enquiry goes to Huda marked *failed*.

![The model fails](screenshots/13-model-fails.png)

## 5. What Huda sees afterward

The **enquiries** table after the five cases (the first two rows are two runs of the normal case): *sent* for the three quotes, *handed_over* for the DJ and *failed* for the failure. Scroll right in n8n to see the total and the note for Huda on each row.

![Enquiries after the five cases](screenshots/14-enquiries-after-five-cases.png)

The **log** table: one row per step, so any enquiry can be followed from arrival to reply.

![The log](screenshots/15-log.png)

One run, opened from **Executions**: the green line shows the path the enquiry took through the boxes.

![One run, left half](screenshots/16-one-run-left.png)

![One run, right half](screenshots/17-one-run-right.png)
