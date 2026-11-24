// Offline stand-in for the model, used only when no ANTHROPIC_API_KEY is set, so the screens and the
// workflow can be tried locally without spending anything. Keyword rules, not intelligence: every
// enquiry it handles is marked "mock" in the trace, and the test runner refuses to log mock results.

const RULES = [
  ["premium_buffet", /premium|grill|مميز/i],
  ["classic_buffet", /buffet|food|lunch|dinner|catering|بوفيه|طعام|غداء|عشاء/i],
  ["canape_platters", /canap|finger food|bites|reception|مقبلات/i],
  ["kids_menu", /kids'? menu|children'?s menu|قائمة الأطفال/i],
  ["drinks", /drinks|juice|مشروبات|عصير/i],
  ["celebration_cake", /cake|كعكة|كيك/i],
  ["service_staff", /staff|server|waiter|طاقم/i],
  ["delivery_setup", /deliver|set ?up|توصيل/i],
];
const OUT = /alcohol|wine|beer|\bdj\b|decorat|flowers|venue|hall hire|entertain|meal plan|subscription|weekly|كحول|زينة|ديكور/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function dateIn(text, today) {
  if (/tomorrow|بكرة|غدا/i.test(text)) { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  const m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i)
    || text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
  if (!m) return "";
  const [day, mon] = /\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
  let year = Number(today.slice(0, 4));
  const iso = y => `${y}-${String(MONTHS.indexOf(mon.toLowerCase().slice(0, 3)) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (iso(year) < today) year++;
  return iso(year);
}

export function mockReading(business, transcript, alreadyAsked, today = new Date().toISOString().slice(0, 10)) {
  const client = transcript.filter(m => m.sender === "client").map(m => m.text).join(" \n");
  const last = (transcript.filter(m => m.sender === "client").pop() || { text: "" }).text;
  const ar = /[؀-ۿ]/.test(client);
  const blank = { reply: "", language: ar ? "ar" : "en", in_scope: true, handover_reason: "", items: [], guests: 0, event_date: "", occasion: "", missing: [], clarifying_question: "", summary: "", holding_message: "" };
  const intent = /^(thanks|thank you|ok|okay|great|شكرا)/i.test(last.trim()) ? "thanks"
    : /what (do you|can you|can i get)|your menu|what.*offer/i.test(last) ? "services"
    : /^(hi|hello|hey|salam|مرحبا|السلام عليكم)[!. ]*$/i.test(last.trim()) ? "greeting"
    : /cheaper|for less|discount|invoice|how do i pay/i.test(last) ? "quote_question" : "request";
  if (intent !== "request") return { ...blank, intent, reply: intent === "greeting" ? (ar ? "أهلاً وسهلاً!" : "Hi there!") : intent === "thanks" ? (ar ? "على الرحب والسعة!" : "You're welcome!") : "" };

  const num = re => Number((client.match(re) || [])[1]) || 0;
  let guests = num(/(\d+)\s*(?:people|guests|persons|pax|adults|ضيف|شخص)/i);
  const kids = num(/(\d+)\s*(?:kids|children|أطفال)/i);
  if (!guests && kids) guests = kids;
  if (!guests && alreadyAsked) guests = Number((last.match(/\d+/) || [])[0]) || 0;
  const items = [];
  for (const [id, re] of RULES) {
    if (!re.test(client) || (id === "classic_buffet" && items.some(i => i.service_id === "premium_buffet"))) continue;
    const quantity = id === "kids_menu" ? kids || guests : ["premium_buffet", "classic_buffet", "canape_platters", "drinks"].includes(id) ? guests : 1;
    items.push({ service_id: id, quantity });
  }
  const out = OUT.test(client);
  const ask = !alreadyAsked && !out && !guests && items.length > 0;
  const name = business.caterer.name;
  return {
    ...blank, intent,
    in_scope: !out && items.length > 0,
    handover_reason: out ? "Asks for something not on the menu" : items.length ? "" : "No menu item identified",
    items, guests,
    event_date: dateIn(client, today),
    occasion: (client.match(/birthday|wedding|office|party|graduation|عيد ميلاد/i) || [""])[0].toLowerCase(),
    missing: ask ? ["number of guests"] : [],
    clarifying_question: ask ? (ar ? "كم عدد الضيوف المتوقع؟" : "How many guests are you expecting?") : "",
    summary: !items.length ? (ar ? "طلب خارج القائمة." : "A request for something not on the menu.") : ar ? `طلب: ${items.map(i => business.services.find(s => s.id === i.service_id).name_ar).join("، ")}.` : `You asked for: ${items.map(i => business.services.find(s => s.id === i.service_id).name.toLowerCase()).join(", ")}${guests ? ` for ${guests} guests` : ""}.`,
    holding_message: out || !items.length ? (ar ? "شكراً لرسالتك! ستتواصل معك هدى شخصياً قريباً." : `Thanks for your message! ${name} will reply to you personally soon.`) : "",
  };
}
