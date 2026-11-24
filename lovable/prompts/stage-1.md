# Stage 1: connect it

**Question:** How do users reach it, and where does the person act?
**What is added:** a conversation per client over several messages. Huda logs in; the inbox is visible only after login.

Lovable has no server that remembers anything between requests, so the conversation has to go into the database already at this stage. Prices stay hard-coded until stage 2.

Before you paste: create Huda's login (an email and a password you choose). In Lovable Cloud: Users > Add user. In Supabase: Authentication > Users > Add user. There is no sign-up page.

---

## Prompt 1.1: tables and the workflow on the server

```text
Move the workflow from the browser to the server.

Create two tables (row-level security on):
- enquiries: id uuid primary key, client_token text not null, status text not null default 'asked' (one of: asked, awaiting_approval, handed_over, failed, sent, rejected), asked boolean default false, summary text, draft text, note text, created_at timestamptz, updated_at timestamptz.
- messages: id, enquiry_id uuid references enquiries on delete cascade, sender text (client, agent or caterer), text text, created_at timestamptz.
Policies: signed-in users can read and update enquiries, read messages and add messages with sender agent or caterer. Anonymous visitors get no access to either table.

Create an Edge Function handle-message. Input: { enquiry_id (optional), client_token, text }.
- If there is no enquiry_id, create an enquiry with that client_token. If there is one, check the client_token matches; refuse otherwise.
- Save the client's message, load the whole conversation, call read-enquiry, then run exactly the same Decide, Price and Hold rules as before. Move src/menu.ts into this function as constants (menu, rules and booked days): prices are still hard-coded.
- Save the agent's reply (if any) as a message with sender agent. Save status, asked, summary, draft and note on the enquiry.
- Return { enquiry_id, sample } (sample is what read-enquiry returned).

Create an Edge Function get-conversation. Input: { enquiry_id, client_token }. Returns the messages of that enquiry only if the token matches.

Both functions use the service role key on the server. The browser never reads the tables as an anonymous visitor.

THE RULE: the model never sees a price. Only handle-message prices, from its menu constants.
```

---

## Prompt 1.2: the client's chat and Huda's login

```text
Change the pages.

Every page shows a small label at the top: "Stage 1: connect it", and this footer: "Team Sufra, its users and every figure are fictional." Keep the small "Sample answers" note when the agent has no API key.

"/" (client chat, no login): on first visit, make a random client_token and keep it, with the enquiry_id, in localStorage, so the same browser always continues the same conversation. Send messages through handle-message. Show the conversation from get-conversation and refresh it every few seconds, so Huda's approved reply appears without a reload. Make it work well on a phone. Remove the link to /inbox.

"/login": email and password. No sign-up link, no sign-up page. A wrong email or password shows "Wrong email or password."

"/inbox": only for a signed-in user; anyone else is sent to /login. Read enquiries and messages from the tables, newest first, awaiting_approval at the top. Approve inserts the draft as a message with sender agent, sets status sent and clears the draft. Edit inserts Huda's text with sender caterer, sets status sent. Reject sets status rejected and sends nothing. A Sign out button.
```

---

## Check it

1. On a phone, open the published `/` and send "hi need food for my daughter's birthday, how much?". The chat asks how many guests. Answer "30 guests": it joins the same conversation.
2. On a laptop, open `/inbox`: you are sent to `/login`. Try a wrong password: refused.
3. Log in as Huda: the enquiry is there with a draft. Approve it. On the phone, the quote appears in the chat.
4. In a private window (a new chat), send "Hi, I need a classic buffet for 40 people for my office party on 10 December": the draft in `/inbox` says AED 3,400.
5. Open `/inbox` in a private window: you see the login page, not the inbox.
6. Run the four test cases from `checks.md` in private windows: the normal case gives AED 3,400; the difficult case asks how many guests first; "90% off" still gives AED 3,500; the DJ and decorations are handed over with no quote.
