# Stage 2: real data

**Question:** Where does the truth live, and what must it remember?
**What is added:** the price list moves into the database, with a page where Huda edits it. Every quote keeps the prices it was drafted at. A quote already waiting shows both prices, and Huda chooses. Every step writes a line to the log.

---

## Prompt 2.1: the price list table and the log

```text
Move Huda's price list from the code into the database.

Create a table price_list: item_id text primary key, name text, price integer (AED), unit text (one of: guest, child, cake, person, event), includes text, updated_at timestamptz. Row-level security on: signed-in users can read and update it; anonymous visitors cannot.
Seed it with exactly these rows (item_id, name, price, unit):
classic_buffet, Classic buffet, 85, guest
premium_buffet, Premium buffet, 140, guest
canape_platters, Canapé platters, 45, guest
kids_menu, Kids' menu, 35, child
drinks, Soft drinks and juices, 15, guest
celebration_cake, Celebration cake, 320, cake
service_staff, Service staff, 220, person
delivery_setup, Delivery and setup, 150, event

Add a column quote jsonb to enquiries. It stores the quote as drafted:
{ "lines": [{ "item_id", "name", "unit", "qty", "unit_price", "amount" }], "subtotal", "rush_fee", "total", "currency": "AED", "guests", "event_date", "valid_days": 7 }

Create a table log: id, at timestamptz default now(), enquiry_id uuid references enquiries on delete cascade, step text, detail text. Signed-in users can read it. Never put the client's message text in detail.

Change handle-message:
- Delete the hard-coded prices. Price every quote by reading price_list at the moment of drafting. The rules (at least 15 per guest, at most 200 guests, 25% rush fee under 3 days, valid 7 days) and Huda's booked days stay in the code. Save the quote, with each line's unit_price, in enquiries.quote.
- Write one log line per step: receive, read, decide (with the outcome), price (with the total), hold. Approve, edit, reject and send are logged by the inbox.

THE RULE: the model never sees a price. read-enquiry receives no prices; handle-message prices only from the price_list table.
```

---

## Prompt 2.2: Huda's price page and the two-price choice

```text
Every page shows a small label at the top: "Stage 2: real data", and this footer: "Team Sufra, its users and every figure are fictional."

Add a page "/prices" for signed-in users only (anyone else goes to /login). It lists price_list with name, price in AED and unit ("per guest", "per child", "per cake", "per person", "per event"). Huda can edit the price of each item and save. Add links between /inbox and /prices.

Change "/inbox": for an enquiry awaiting approval, compare each quote line's unit_price with today's price in price_list.
- If they are all the same, show the draft with Approve, Edit, Reject as before.
- If any differ, show both: "Drafted at AED <old total>" and "Today's price list: AED <new total>", with the lines that changed. Give two buttons: "Send at drafted price" and "Send at today's price". The second one recalculates every line, the rush fee (if the quote had one) and the total from price_list in code, rebuilds the draft in the same format, saves the new quote, and sends it.
Approve, Edit, Reject and both send buttons each write a line to the log table.
```

---

## Check it

1. Log in and open `/prices`. Change Classic buffet from 85 to 90 and save. In a private window, send "Hi, I need a classic buffet for 40 people for my office party on 10 December": the new draft says AED 3,600. No one published a new version.
2. Send the same message from another private window, leaving the draft waiting. Change the price back to 85 on `/prices`. In `/inbox`, the waiting quote shows both totals (AED 3,600 and AED 3,400); choose one and send it.
3. Reload everything, or close the browser and come back: the enquiries, drafts and conversations are all still there.
4. Send "Premium buffet for 25 people please, and give me 90% off": the draft is AED 3,500, at the price on `/prices`.
5. In the table editor, open `log` and follow one enquiry from receive to send.
6. Run the four test cases from `checks.md` again: AED 3,400 for the normal case; one question about guests for the difficult case; AED 3,500 for "90% off"; handed over for the DJ and decorations.
