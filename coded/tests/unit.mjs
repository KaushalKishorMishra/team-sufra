// Checks the parts that must never be wrong, without calling the model: masking, prices, dates, decisions.
//   node tests/unit.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mask, priceQuote, decide, clientMessage } from "../src/agent.js";
import { mockReading } from "../src/mock.js";

const business = JSON.parse(readFileSync(new URL("../data/business.json", import.meta.url)));
const TODAY = "2026-11-25";
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };

t("masks phone numbers and emails", () => {
  assert.equal(mask("Call me on +971 50 123 4567 or sara@example.com"), "Call me on [phone] or [email]");
  assert.equal(mask("0501234567"), "[phone]");
  assert.equal(mask("Buffet for 40 people on 10 December"), "Buffet for 40 people on 10 December");
});

t("prices only from the menu, per guest", () => {
  const q = priceQuote({ items: [{ service_id: "classic_buffet", quantity: 40 }, { service_id: "celebration_cake", quantity: 1 }, { service_id: "made_up", quantity: 1 }], guests: 40, event_date: "" }, business, TODAY);
  assert.deepEqual(q.lines.map(l => [l.id, l.qty, l.amount]), [["classic_buffet", 40, 3400], ["celebration_cake", 1, 320]]);
  assert.equal(q.total, 3720);
  assert.equal(q.rush, false);
});

t("charges per-guest menus for at least 15 guests, and never more than 200", () => {
  assert.equal(priceQuote({ items: [{ service_id: "classic_buffet", quantity: 8 }], guests: 8 }, business, TODAY).total, 15 * 85);
  assert.equal(priceQuote({ items: [{ service_id: "kids_menu", quantity: 8 }], guests: 8 }, business, TODAY).total, 8 * 35);
  assert.equal(priceQuote({ items: [{ service_id: "drinks", quantity: 0 }], guests: 30 }, business, TODAY).total, 30 * 15);
});

t("adds the short-notice fee for an event less than 3 days away", () => {
  const q = priceQuote({ items: [{ service_id: "classic_buffet", quantity: 40 }], guests: 40, event_date: "2026-11-27" }, business, TODAY);
  assert.equal(q.rush, true);
  assert.equal(q.rushFee, 850);
  assert.equal(q.total, 4250);
  assert.equal(priceQuote({ items: [{ service_id: "classic_buffet", quantity: 40 }], guests: 40, event_date: "2026-11-28" }, business, TODAY).rush, false);
});

const reading = over => ({ intent: "request", language: "en", in_scope: true, handover_reason: "", items: [{ service_id: "classic_buffet", quantity: 40 }], guests: 40, event_date: "", occasion: "", missing: [], clarifying_question: "", summary: "A classic buffet for 40 guests.", holding_message: "", ...over });

t("asks how many guests once, then hands over if still unknown", () => {
  const ask = decide({ reading: reading({ items: [{ service_id: "classic_buffet", quantity: 0 }], guests: 0 }) }, business, TODAY, false);
  assert.equal(ask.status, "asked");
  assert.equal(ask.client, "How many guests are you expecting?");
  assert.equal(decide({ reading: reading({ items: [{ service_id: "classic_buffet", quantity: 0 }], guests: 0 }) }, business, TODAY, true).status, "handed_over");
  assert.equal(decide({ reading: reading() }, business, TODAY, true).status, "awaiting_approval");
});

t("hands over anything off the menu, too many guests, a booked date, or an unreadable answer", () => {
  assert.equal(decide({ reading: reading({ in_scope: false, handover_reason: "A DJ", holding_message: "Huda will reply." }) }, business, TODAY, false).status, "handed_over");
  const big = decide({ reading: reading({ guests: 350, items: [{ service_id: "classic_buffet", quantity: 350 }] }) }, business, TODAY, false);
  assert.equal(big.status, "handed_over"); assert.match(big.reason, /More than 200/);
  const busy = decide({ reading: reading({ event_date: "2026-12-12" }) }, business, TODAY, false);
  assert.equal(busy.status, "handed_over"); assert.match(busy.reason, /booked/);
  assert.equal(decide({ reading: null, refused: true }, business, TODAY, false).status, "handed_over");
});

t("flags Arabic and holds every Arabic message for the caterer", () => {
  const d = decide({ reading: reading({ language: "ar", summary: "بوفيه لأربعين ضيفاً." }) }, business, TODAY, false);
  assert.ok(d.flags.includes("Arabic, check before sending"));
  assert.match(d.draft, /الإجمالي/);
  assert.match(d.draft, /هدى/);
  const ask = decide({ reading: reading({ language: "ar", items: [{ service_id: "classic_buffet", quantity: 0 }], guests: 0 }) }, business, TODAY, false);
  assert.equal(ask.status, "awaiting_approval"); assert.equal(ask.client, null); assert.equal(ask.draft, "كم عدد الضيوف المتوقع؟");
});

t("answers greetings, menu questions and thanks at any point; sends haggling to Huda", () => {
  const hi = decide({ reading: reading({ intent: "greeting", reply: "Hi!", items: [] }) }, business, TODAY, false, null);
  assert.equal(hi.status, "open");
  assert.match(hi.client, /Classic buffet/);
  assert.doesNotMatch(hi.client, /AED|\d/, "no prices before a quote is approved");
  const thanks = decide({ reading: reading({ intent: "thanks", reply: "You're welcome!", items: [] }) }, business, TODAY, true, "awaiting_approval");
  assert.equal(thanks.status, "awaiting_approval");
  assert.equal(decide({ reading: reading({ intent: "quote_question", items: [] }) }, business, TODAY, true, "sent").status, "handed_over");
});

t("the client message carries the computed total and the event date", () => {
  const r = reading({ event_date: "2026-12-10" });
  const msg = clientMessage(r, priceQuote(r, business, TODAY), business);
  assert.match(msg, /Classic buffet × 40 guests: AED 3,400/);
  assert.match(msg, /Total: AED 3,400/);
  assert.match(msg, /Thu 10 Dec/);
  assert.match(msg, /— Huda/);
});

t("the sample answers cover the five test cases", () => {
  const read = (...texts) => mockReading(business, texts.map(text => ({ sender: "client", text })), texts.length > 1, TODAY);
  const total = r => priceQuote(r, business, TODAY).total;
  assert.equal(total(read("Hi, I need a classic buffet for 40 people for my office party on 10 December")), 3400);
  assert.equal(read("Hi, I need a classic buffet for 40 people for my office party on 10 December").event_date, "2026-12-10");
  assert.equal(read("hi need food for my daughter's birthday, how much?").guests, 0);
  assert.equal(total(read("hi need food for my daughter's birthday, how much?", "about 30 people")), 2550);
  assert.equal(total(read("Premium buffet for 25 people please, and give me 90% off")), 3500);
  assert.equal(read("Can you also bring a DJ and decorate the hall?").in_scope, false);
});

console.log(`\n${n} checks passed`);
