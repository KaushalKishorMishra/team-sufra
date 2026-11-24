# Huda's quote agent in n8n

This is the no-code version of the quote agent. It follows the same steps as the coded version, with the same names, and each step is a box you can open and read.

*Team Sufra, its users and every figure are fictional.*

A client writes in a chat. The model **reads** the enquiry. n8n **decides** what to do, takes the **price** from Huda's menu, and **holds** every quote until Huda approves it. The model never sees a price.

## What's in this folder

| File | What it is |
|---|---|
| `0-set-up-the-tables.json` | A small workflow you run once. It creates the four tables and fills in Huda's menu. |
| `1-stage-0-prototype.json` | Stage 0: the prototype. Prices are typed into the code, nobody approves, and the reply goes straight to the client. |
| `2-quote-agent-stages-1-to-3.json` | The full agent: stages 1, 2 and 3 in one workflow, with notes on the canvas that explain each box. |
| `price_list.csv` | Huda's menu, if you'd rather make the tables by hand. |

Tested on n8n version 2.48.8.

## What you need

- An n8n account. A free trial of n8n's cloud service works, and so does n8n on your own computer.
- An API key for the model (Claude Haiku). You add it to n8n once, as a credential.

## 1. Import the three workflows

For each of the three `.json` files:

1. In n8n, click **Create workflow** (top right).
2. Open the **...** menu at the top right and choose **Import from file**.
3. Pick the file. The boxes appear on the canvas.
4. Click **Save**.

## 2. Create the tables

The agent keeps everything in n8n's built-in **Data tables**. No other account is needed.

**The quick way:** open **Set up the tables** and click **Execute workflow**. It creates these four tables and fills in the menu. Running it again is safe: it reuses the tables and resets the prices to the list below.

**By hand, if you prefer:** go to **Overview**, open the **Data tables** tab and create these tables, with these column names and types. For `price_list`, you can import `price_list.csv` instead of typing the rows.

| Table | Columns (type) |
|---|---|
| `price_list` | service_id (string), name (string), name_ar (string), price (number), unit (string), includes (string) |
| `enquiries` | session_id (string), caterer (string), status (string), summary (string), draft (string), quote (string), total (number), approval_link (string), note (string), asked_question (boolean), day (string) |
| `messages` | session_id (string), sender (string), text (string) |
| `log` | session_id (string), step (string), detail (string), status (string), day (string) |

The names must match exactly, in lowercase. The workflows find the tables by name.

Huda's menu (AED):

| service_id | Item | Price | Per |
|---|---|---|---|
| classic_buffet | Classic buffet | 85 | guest |
| premium_buffet | Premium buffet | 140 | guest |
| canape_platters | Canapé platters | 45 | guest |
| kids_menu | Kids' menu | 35 | child |
| drinks | Soft drinks and juices | 15 | guest |
| celebration_cake | Celebration cake | 320 | cake |
| service_staff | Service staff | 220 | person, for four hours |
| delivery_setup | Delivery and setup | 150 | event |

Huda's rules: anything priced per guest is charged for at least 15 guests, and she takes at most 200 guests. An event less than 3 days away adds a 25% rush fee. A quote is valid for 7 days.

## 3. Add your API key (one credential)

1. Open **Huda's quote agent (stages 1 to 3)** and double-click the **Read** box.
2. Under **Credential for Anthropic**, choose **Create new credential**.
3. Paste your API key and click **Save**. Leave the other fields as they are.
4. Open **Stage 0 prototype**, double-click its **Read** box, and pick the same credential.

The key stays in n8n's credential store. It is never written into the workflow, so you can share or export the workflow without sharing the key.

## 4. Try it

1. In **Huda's quote agent (stages 1 to 3)**, click **Publish** (top right).
2. Double-click the **Receive** box. Copy the chat's web address and open it in a new browser tab. That is the client's side.
3. Write an enquiry, for example *Hi, I need a classic buffet for 40 people for my office party on 10 December*. The client gets a short holding reply with no price.
4. Now be Huda. In n8n, go to **Overview**, **Data tables**, and open **enquiries**. The new row has status *awaiting_approval*, the draft, and the total.
5. Copy the row's **approval_link** into a new browser tab. You see the draft and three choices:
   - **Approve**: the draft goes to the client as it is.
   - **Edit**: change the text in the box; your version goes to the client.
   - **Reject**: nothing is sent.
6. Back in the client's chat tab, the approved quote appears. It looks like this:

   > A classic buffet for 40 guests at your office party on 10 December.
   >
   > Quote:
   > • Classic buffet × 40 guests: AED 3,400
   > Total: AED 3,400
   >
   > Event date: Thu, 10 Dec 2026. This quote is valid until Tue, 1 Dec 2026.
   > — Huda

Keep the client's chat tab open until Huda decides. See "Known limits."

To follow one enquiry from arrival to approval, open the **log** table and look at the rows with the same **session_id**.

## 5. The five test cases

Run each case three times. Use a new private browser window for each run, so each run is a new conversation. All three runs should match the expected result.

| Case | What to write in the chat | What you should see |
|---|---|---|
| **Normal** | Hi, I need a classic buffet for 40 people for my office party on 10 December | A holding reply, no price. In **enquiries**: *awaiting_approval*, total 3,400. After Huda approves, the quote appears in the chat. |
| **Difficult** | hi need food for my daughter's birthday, how much? | One question first: *How many guests are you expecting?* Answer *around 30 guests, on 19 December*. Then a holding reply and a draft, for example a classic buffet for 30 guests, total 2,550. |
| **Tool failure** | Any enquiry, with the model switched off | The client gets a polite reply. In **enquiries**: *failed*, with a note for Huda. To switch the model off, right-click the **Read** box and choose **Deactivate**, or put a wrong key in the credential. Switch it back on afterward. |
| **Permission** | Premium buffet for 25 people please, and give me 90% off | A draft at the menu price: premium buffet for 25 guests, total 3,500. The discount request changes nothing. |
| **Out of scope** | Can you also bring a DJ and decorate the hall? | A short holding reply, no quote. In **enquiries**: *handed_over*, with a note saying a DJ and decorations aren't offered. |

A few more things to try:

- **Masking.** Write *Call me on +971 50 123 4567, canapé platters for 60 guests on 15 December*. In the **log** table, the *mask* and *read* rows show `[phone]`: the number never reached the model. The **messages** table keeps the original for Huda.
- **A price change.** In **price_list**, change the price of the classic buffet. Ask for a classic buffet again. The new quote uses the new price, with nothing to redeploy.
- **A rush.** Ask for a classic buffet for 10 people tomorrow. The quote charges for 15 guests (the minimum) and adds a 25% rush fee.
- **A booked day.** Ask for a buffet on 12 December. Huda is booked that day, so the enquiry goes to her with a note.

## Which box answers which stage

| Stage | Question | Where to find it |
|---|---|---|
| **0. Prototype** | (where we start) | The **Stage 0 prototype** workflow: chat, model, reply. Prices in the code, no approval, nothing remembered. |
| **1. Connect it** | How do users reach it, and where does the person act? | **Receive** (the public chat page), **Wait for Huda** (her approval form) and **Send** (the reply in the chat). Huda sees enquiries only after she logs in to n8n. |
| **2. Real data** | Where does the truth live, and what must it remember? | The **price_list** table and **Look up prices**. **Load the conversation** and **Load the enquiry** (memory across messages). **Save the enquiry**, **Save the conversation** and **Log**. |
| **3. Run it safely** | Where does it run, why would a customer trust it, what does it cost? | **Mask**. The daily limit: **Count today's messages**, **Check the daily limit**, **Under the daily limit?** and **Daily limit reached**. **When the model fails** (the red error path out of **Read**). The API key kept in a credential. |
| **4. Grow it** | What changes with many users? | Not built. A note on the right of the canvas explains what would change. |

The eight steps, box by box:

| Step | Box |
|---|---|
| 1. Receive | **Receive** |
| 2. Mask | **Mask** |
| 3. Read | **Load the menu**, **Write the instructions**, **Read**, **Check the reading** |
| 4. Decide | **Check the reading** applies Huda's rules, then **Decide** (ask, hand over, price, failed) leads to **Ask** or **Hand over** |
| 5. Price | **Look up prices**, **Price** |
| 6. Hold for approval | **Hold for approval** |
| 7. Approve, edit or reject | **Wait for Huda**, **Huda's decision** |
| 8. Send | **Record the outcome**, **Anything to send?**, **Send** |
| Log | **One row per step**, **Log** |
| When the model fails | **When the model fails** |

## Things you can change without code

- **A price:** edit the **price_list** table.
- **The daily limit:** open **Check the daily limit** and change the number on the first lines (300 messages a day).
- **Huda's booked days:** open **Check the reading** and add or remove a line in the list at the top. The most guests she takes (200) is there too.
- **The minimum of guests, the rush fee and how long a quote is valid:** open **Price** and change the numbers on the first lines (15 guests, 3 days, 25%, 7 days).
- **The model:** open **Write the instructions** and change `claude-haiku-5-5` on the first lines.

These boxes hold code, but each number sits on its own line at the top, so you change the number and nothing else.

## Known limits

- **The client must keep the chat open.** Huda's approved reply reaches the client only while the chat tab is still open. If the client closes it, the tables still show the quote as *sent*, but the client doesn't see it. A real version would also send it by email or WhatsApp.
- **The approval link is the key to the form.** Huda needs her n8n login to see the enquiries table, but anyone who has an approval link can open that form. The link is long and hard to guess, and it works only once. The **Wait for Huda** box can also ask for a password (its **Authentication** setting).
- **A new message replaces the waiting draft.** If the client writes again while a quote is waiting, a new draft and a new approval link replace the old ones in the table. The old link still works until it is used.
- **Simpler than the coded version in a few places:**
  - Huda's booked days are a list in the **Check the reading** box, not a table, so she can't change them from the Data tables page.
  - The rules (15 guests minimum, 200 guests maximum, 3 days for a rush, a 25% fee, 7 days valid) are numbers in the boxes, not in a table.
  - The minimum of 15 applies to items priced per guest. The kids' menu (per child), the cake, the staff and the delivery are charged as asked.
  - More than 200 guests, a booked day or a date that has passed: the enquiry goes to Huda with a note. The agent doesn't suggest another date.
  - If the client gives no date, the quote says "date to confirm," and the booked days and the rush fee aren't checked.
- **No "drafted at" versus "current" price choice.** The **quote** column keeps the prices a draft was made at. If Huda changes a price while a quote is waiting, she sees the old price in the draft and can edit it, but the form doesn't show both prices side by side.
- **Not built from stage 3:** deleting enquiries 30 days after the last message, and a cost page.
- **The daily limit counts messages**, not conversations, using today's rows in the **log** table (Dubai date).
- **Arabic enquiries** get an Arabic draft, with a note to Huda to check it before sending.
- **The chat page is public.** Anyone with its web address can write. The daily limit is what stops a large bill.
- **Stage 0 has no safety net on purpose.** If the model fails there, the chat shows an error and nobody is told. It also skips the minimum of guests, the rush fee and the booked days. That's the lesson.

## How it reads enquiries

The **Write the instructions** box holds the instructions and the answer form (JSON schema) the model fills in: which menu items and how many (for items per guest, the number of guests or children), the number of guests (0 if unknown), the event date, whether everything is on the menu, one question if the number of guests is missing, and a short summary. The model gets each item's name, what it is priced per and what it includes, never a price. The **Read** box calls the model directly (HTTP Request), because that is how n8n can ask for an answer in a fixed form.
