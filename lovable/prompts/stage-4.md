# Stage 4: grow it

**Question:** What changes with many users?
**What is added:** several caterers, each with their own login, price list and enquiries. Row-level security makes the database itself keep them apart. One log the team can read.

Before you paste: create a login for a second caterer (Lovable Cloud: Users > Add user; Supabase: Authentication > Users > Add user). Give them any fictional first name.

---

## Prompt 4.1: caterers and row-level security

```text
Turn the app from one caterer into a team.

Create a table caterers: id uuid primary key, name text, slug text unique, user_id uuid unique references auth.users, city text default 'Dubai'. Add Huda (slug huda) and link her to her existing login. Add a second caterer with the name and login I give you.

Add caterer_id (references caterers, not null) to price_list, enquiries and log. Set every existing row to Huda. price_list's primary key becomes (caterer_id, item_id). Give the second caterer a copy of Huda's price list as a starting point.

Create a SQL function my_caterer_id() that returns the caterers.id whose user_id is auth.uid().

Replace the row-level security policies:
- enquiries: a signed-in caterer reads and updates only rows where caterer_id = my_caterer_id().
- messages: only messages of their own enquiries; they may add messages with sender agent or caterer to their own enquiries.
- price_list: read and update only their own rows.
- log: every signed-in caterer can read every line (one log for the team); they may add lines only for their own caterer_id. Log lines never hold client message text.
- caterers: every signed-in caterer can read the list.
Anonymous visitors still have no access to any table.

Change handle-message: it takes a caterer slug. A new enquiry gets that caterer's id. It prices only from that caterer's rows in price_list, and passes the caterer's name and their menu (item_id, name, unit, includes; never prices) to read-enquiry as caterer_name and menu, so the system prompt says "Huda" or the other caterer's name. The booked days in the code are Huda's: check them only for Huda's enquiries. Every log line gets the caterer_id.

The settings row (daily limit, agent on/off) stays shared by the whole team: one API key, one bill.

THE RULE stays: the model never sees a price. Each caterer's code prices from their own price_list rows.
```

---

## Prompt 4.2: pages for the team, and the log page

```text
Every page shows a small label at the top: "Stage 4: grow it", and this footer: "Team Sufra, its users and every figure are fictional."

- The client chat moves to "/chat/:slug", for example /chat/huda. "/" lists the caterers with a link to each chat. The chat header shows the caterer's name.
- "/inbox", "/prices" and "/cost" show only the signed-in caterer's own rows (the database already enforces it; do not filter in the front end only). Show "Signed in as <name>" at the top.
- Add a page "/log" for signed-in caterers: every log line, newest first, with time, caterer name, enquiry id (short), step and detail. A filter by enquiry id shows one enquiry from arrival to approval in time order. Link /log from the other caterer pages.
```

---

## Check it

1. Open two browsers side by side. Log in as Huda in one and as the second caterer in the other. Each `/prices` shows only their own list; change one price in the second caterer's list and see that Huda's does not change.
2. Send "Hi, I need a classic buffet for 40 people for my office party on 10 December" on `/chat/huda` and "Premium buffet for 25 people please, and give me 90% off" on the second caterer's chat. Each inbox shows only its own enquiry, priced from its own list.
3. Approve one. On `/log`, filter by its enquiry id: it reads receive, mask, read, decide, price, hold, approve, send, in order.
4. Optional, for the curious: in the SQL editor, try reading `enquiries` as the second caterer. Row-level security returns only their rows.
5. Run all five test cases from `checks.md` on `/chat/huda`, signed in as Huda for the inbox.
