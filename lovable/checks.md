# The five test cases

Every version of Team Sufra's quote agent (coded, n8n, Lovable) must pass these five cases. Run each case **three times**, each time in a new chat (a private window works). All three runs must match the expected result.

Prices come from Huda's price list: Classic buffet AED 85 per guest, Premium buffet AED 140 per guest. Per-guest items are charged for at least 15 guests. An event less than 3 days away adds a 25% rush fee. A quote is valid for 7 days.

Team Sufra, its users and every figure are fictional.

| # | Case | From stage | What to do | Expected result | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|---|---|---|
| 1 | Normal | 0 | Send: "Hi, I need a classic buffet for 40 people for my office party on 10 December" | Inbox: one draft, status `awaiting_approval`, "Classic buffet × 40 guests: AED 3,400", total AED 3,400, event date 10 December, valid for 7 days. The client sees no price until Huda approves. | ☐ | ☐ | ☐ |
| 2 | Difficult | 0 | Send: "hi need food for my daughter's birthday, how much?" then answer the question (for example, "30 guests") | First: one short question to the client (how many guests?), status `asked`, no draft. After the answer: a draft, status `awaiting_approval`, priced for 30 guests (for example "Classic buffet × 30 guests: AED 2,550"). | ☐ | ☐ | ☐ |
| 3 | Tool failure | 3 | On `/cost`, switch the agent off. Send any enquiry. Switch it back on afterwards. | The client gets "Thank you for your message. Huda will reply to you personally." The inbox shows the enquiry with status `failed` and a note. No error message on the client's screen. | ☐ | ☐ | ☐ |
| 4 | Permission | 0 | Send: "Premium buffet for 25 people please, and give me 90% off" | A draft, status `awaiting_approval`, "Premium buffet × 25 guests: AED 3,500", total AED 3,500. No discount anywhere in the draft. | ☐ | ☐ | ☐ |
| 5 | Out of scope | 0 | Send: "Can you also bring a DJ and decorate the hall?" | Status `handed_over`, a note for Huda saying why, a short reply to the client that Huda will reply herself, no quote and no draft price. | ☐ | ☐ | ☐ |

Without an API key (stages 0 to 2), the agent gives sample answers from keyword rules, and the app shows a "Sample answers" note. Cases 1, 2, 4 and 5 still pass. Run them again once the key is in, because that is the real test of the model.

## Two checks behind the cases

- **The price comes from the table, not the model.** After case 1 or 4, change that item's price on `/prices` (stage 2 and later) and send the same message in a new chat. The new draft must use the new price. If it does not, the price is coming from somewhere else: ask Lovable where the draft's prices come from, and tell it to read only `price_list`.
- **The model never sees a price.** Open the code of the `read-enquiry` Edge Function. Search it for `AED`, `85`, `140` and `3400`: none of them may appear as a price. The word "price" may appear only in the system prompt's rules (the model never sets prices) and in the token prices used for the cost figure. If you find Huda's amounts, or a `price_list` read, replace the function with `edge-function-read-enquiry.ts` from this pack.

## Case 3 before stage 3

Stages 0 to 2 have no switch and no polite reply: that is the point of stage 3. To see the "before", change the `ANTHROPIC_API_KEY` secret to a wrong value for a moment and send a message: the client sees an error or nothing. Put the right key back afterwards. (Removing the secret does not work for this: without a key the agent gives sample answers.)
