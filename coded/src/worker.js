// Team Sufra's quote agent: one program for all five stages. The STAGE setting (0 to 4) decides
// which features are on; see src/stage.js. Pages are in site/, the workflow in src/agent.js.
//
//   GET  /api/stage                                       which stage this is, and what it has
//   POST /api/enquiries                 { text, caterer? }  a client starts an enquiry
//   POST /api/enquiries/:id/messages    { text }          the client replies (stage 1 onward)
//   GET  /api/enquiries/:id                               the client's view: messages and status
//   Caterer routes; from stage 1 they need X-Caterer-Code (a login from CATERER_LOGINS):
//   GET  /api/inbox                                       her enquiries
//   GET  /api/inbox/:id                                   one enquiry, with its log and what the model read
//   POST /api/inbox/:id/approve         { text?, price? }  send the draft, her edit, or the quote at the current price
//   POST /api/inbox/:id/reject
//   POST /api/inbox/:id/reply           { text }          she writes to the client herself
//   GET|POST /api/prices                                  her price list (stage 2)
//   GET|POST /api/settings                                the model switch and the daily limit (stage 3)
//   GET  /api/usage                                       cost per enquiry (stage 3)
//   GET  /api/log                                         one line per step (stage 4)
//   POST /api/restart                                     what a restart does to this stage
//   POST /api/reset                                       wipe the demo and put back the standard price list

import business from "../data/business.json";
import { readEnquiry, decide, mask, priceQuote, clientMessage } from "./agent.js";
import { STAGES, features, CATERERS } from "./stage.js";

const KEEP_DAYS = 30;
const MAX_TEXT = 1200;
const MAX_CLIENT_MESSAGES = 8;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const now = () => new Date().toISOString();
// The caterer works in Dubai, so "today" is Dubai's date
const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400e3).toISOString();
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const cleanText = t => String(t || "").replace(/\s+$/g, "").slice(0, MAX_TEXT);
async function body(req) {
  try { const b = await req.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; }
}

async function event(db, enq, step, detail) {
  await db.prepare("INSERT INTO events (enquiry_id, caterer, at, step, detail) VALUES (?, ?, ?, ?, ?)").bind(enq.id, enq.caterer, now(), step, JSON.stringify(detail)).run();
}
async function message(db, id, sender, text) {
  await db.prepare("INSERT INTO messages (enquiry_id, at, sender, text) VALUES (?, ?, ?, ?)").bind(id, now(), sender, text).run();
}
async function transcript(db, id) {
  return (await db.prepare("SELECT sender, text, at FROM messages WHERE enquiry_id = ? ORDER BY id").bind(id).all()).results;
}
async function setting(db, key, fallback) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : fallback;
}

// ---------------------------------------------------------------- the price list
// Stages 0 and 1: from data/business.json, built into the program, so a change needs a redeploy.
// Stage 2 onward: from the price_list table, which the caterer edits on her own page.
async function seedPrices(db, caterer) {
  await db.batch(business.services.map((s, i) => db.prepare("INSERT OR REPLACE INTO price_list (caterer, service_id, name, name_ar, price, unit, includes, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(caterer, s.id, s.name, s.name_ar, s.price, s.unit, s.includes, i)));
}
async function businessFor(env, F, caterer) {
  const b = { ...business, caterer: { ...business.caterer, name: CATERERS[caterer] || "Huda" } };
  if (!F.priceTable) return b;
  const rows = (await env.DB.prepare("SELECT service_id AS id, name, name_ar, price, unit, includes FROM price_list WHERE caterer = ? ORDER BY position").bind(caterer).all()).results;
  if (!rows.length) { await seedPrices(env.DB, caterer); return businessFor(env, F, caterer); }
  return { ...b, services: rows };
}

// ---------------------------------------------------------------- run the workflow on one enquiry
async function runAgent(env, F, id, prior) {
  const db = env.DB;
  const enq = await db.prepare("SELECT * FROM enquiries WHERE id = ?").bind(id).first();
  const biz = await businessFor(env, F, enq.caterer);
  const msgs = await transcript(db, id);
  const last = (msgs.filter(m => m.sender === "client").pop() || { text: "" }).text;
  const seen = F.mask ? mask(last) : last;
  await event(db, enq, "read", { model_read: seen, masked: seen !== last });

  let result;
  try {
    const modelOn = !F.failSafe || (await setting(db, "model_on", "1")) === "1";
    result = await readEnquiry(env, biz, msgs, !!enq.asked, today(), { mask: F.mask, modelOn });
  } catch (e) {
    // Before stage 3 a failure is not handled: the client sees an error and the enquiry is stuck
    if (!F.failSafe) throw e;
    // Stage 3: a polite reply, and the enquiry goes to the caterer with a note
    const note = `The model did not answer (${String(e && e.message || e).slice(0, 120)}). Please reply to the client yourself.`;
    await message(db, id, "agent", `Thank you for your message. ${biz.caterer.name} will reply to you personally soon.`);
    await event(db, enq, "fail", { note });
    await db.prepare("UPDATE enquiries SET status = 'failed', reason = ?, flags = ?, updated_at = ?, expires_at = ? WHERE id = ?")
      .bind(note, JSON.stringify(["Needs you"]), now(), plusDays(KEEP_DAYS), id).run();
    return;
  }
  await addCost(env, enq.caterer, result.cost || 0);

  const d = decide(result, biz, today(), !!enq.asked, prior || null);
  const r = d.reading || {};
  if (d.client) await message(db, id, "agent", d.client);
  if (d.small) {
    // A greeting, a services question or thanks: answer it and leave the enquiry as it was
    await event(db, enq, "greet", { reply: d.client });
  } else {
    await event(db, enq, d.step, d.step === "draft" ? { total: d.quote.total, currency: d.quote.currency } : d.step === "ask" ? { question: d.client || d.draft } : { reason: d.reason });
  }
  await db.prepare(`UPDATE enquiries SET status = ?, asked = ?, language = COALESCE(?, language), flags = ?, summary = COALESCE(?, summary),
      reading = COALESCE(?, reading), quote = ?, drafted_at = ?, draft = ?, reason = ?,
      cost_usd = cost_usd + ?, tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, updated_at = ?, expires_at = ? WHERE id = ?`)
    .bind(d.status, d.step === "ask" ? 1 : enq.asked, r.language || null, JSON.stringify(d.flags || []), r.summary || null,
      d.reading ? JSON.stringify(d.reading) : null, d.quote ? JSON.stringify(d.quote) : (d.small ? enq.quote : null), d.quote ? now() : enq.drafted_at,
      d.draft || (d.small ? enq.draft : null), d.reason || null,
      result.cost || 0, result.usage.input || 0, result.usage.output || 0, now(), plusDays(KEEP_DAYS), id).run();
}

// ---------------------------------------------------------------- limits and cost
async function addCost(env, caterer, cost) {
  await env.DB.prepare("INSERT INTO daily (day, caterer, enquiries, cost_usd) VALUES (?, ?, 0, ?) ON CONFLICT(day, caterer) DO UPDATE SET cost_usd = cost_usd + excluded.cost_usd").bind(today(), caterer, cost).run();
}
async function countEnquiry(env, caterer) {
  await env.DB.prepare("INSERT INTO daily (day, caterer, enquiries, cost_usd) VALUES (?, ?, 1, 0) ON CONFLICT(day, caterer) DO UPDATE SET enquiries = enquiries + 1").bind(today(), caterer).run();
}
// Stage 3's daily limit is part of the lesson. The spending cap underneath it is a safety net for the
// public demo links at every stage, so a busy session cannot run up a bill; it is not part of the lesson.
async function limitReached(env, F, caterer) {
  const row = await env.DB.prepare("SELECT enquiries, cost_usd FROM daily WHERE day = ? AND caterer = ?").bind(today(), caterer).first() || { enquiries: 0, cost_usd: 0 };
  if (row.cost_usd >= Number(env.DAILY_BUDGET_USD || 5)) return true;
  if (!F.dailyLimit) return false;
  return row.enquiries >= Number(await setting(env.DB, "daily_limit", env.DAILY_LIMIT || 200));
}
const LIMIT_REPLY = name => `Thank you for writing. ${name}'s assistant has reached today's limit, so ${name} will reply to you personally. You can also try again tomorrow.`;

// Stage 3: each enquiry is deleted 30 days after its last message. This runs whenever an inbox opens.
async function cleanUp(db) {
  const { results } = await db.prepare("SELECT id FROM enquiries WHERE expires_at < ?").bind(now()).all();
  for (const { id } of results) {
    await db.batch([
      db.prepare("DELETE FROM messages WHERE enquiry_id = ?").bind(id),
      db.prepare("DELETE FROM events WHERE enquiry_id = ?").bind(id),
      db.prepare("DELETE FROM enquiries WHERE id = ?").bind(id),
    ]);
  }
}

// ---------------------------------------------------------------- who is asking
// Stage 0 has no login: anyone with the link is the caterer. From stage 1 the caterer sends her
// login code in a header (never in the address). Until stage 4 only Huda's login works.
function loggedIn(req, env, F) {
  if (!F.login) return "huda";
  const code = (req.headers.get("x-caterer-code") || "").trim();
  if (!code) return null;
  for (const pair of String(env.CATERER_LOGINS || "").split(",")) {
    const [who, secret] = pair.split("=").map(s => (s || "").trim());
    if (secret && secret === code && CATERERS[who] && (F.manyCaterers || who === "huda")) return who;
  }
  return null;
}
// Which caterer a client is writing to: from stage 4 the chat link names her; before that, Huda
const clientCaterer = (F, asked) => (F.manyCaterers && CATERERS[asked] ? asked : "huda");

async function clientView(db, id) {
  const enq = await db.prepare("SELECT id, caterer, status, created_at, expires_at FROM enquiries WHERE id = ?").bind(id).first();
  if (!enq) return null;
  const msgs = await transcript(db, id);
  return { ...enq, messages: msgs.map(m => ({ from: m.sender === "client" ? "client" : "caterer", by: m.sender, text: m.text, at: m.at })) };
}

// A quote waiting for approval, re-priced from today's price list (stage 2)
async function currentQuote(env, F, enq) {
  if (!F.priceTable || enq.status !== "awaiting_approval" || !enq.quote || !enq.reading) return null;
  const biz = await businessFor(env, F, enq.caterer);
  const reading = JSON.parse(enq.reading);
  const quote = priceQuote(reading, biz, today());
  return { quote, draft: clientMessage(reading, quote, biz) };
}

async function wipeEnquiries(db) {
  await db.batch(["DELETE FROM messages", "DELETE FROM events", "DELETE FROM enquiries"].map(s => db.prepare(s)));
}

async function api(req, env, url, S, F) {
  const db = env.DB;
  const p = url.pathname.replace(/\/+$/, "");
  const m = p.match(/^\/api\/(enquiries|inbox)(?:\/([a-z0-9]+))?(?:\/(messages|approve|reject|reply))?$/);

  if (p === "/api/stage") {
    return json({ stage: S, name: STAGES[S], features: F, caterers: F.manyCaterers ? Object.entries(CATERERS).map(([id, name]) => ({ id, name })) : [{ id: "huda", name: "Huda" }], city: business.caterer.city });
  }

  // ---- the client's side: no login
  if (p === "/api/enquiries" && req.method === "POST") {
    const b = await body(req);
    const text = cleanText(b.text);
    if (!text.trim()) return json({ error: "Write a message first." }, 400);
    const caterer = clientCaterer(F, b.caterer);
    if (await limitReached(env, F, caterer)) return json({ error: LIMIT_REPLY(CATERERS[caterer]) }, 429);
    const id = newId(), t = now();
    await db.prepare("INSERT INTO enquiries (id, caterer, created_at, updated_at, expires_at, status) VALUES (?, ?, ?, ?, ?, 'reading')").bind(id, caterer, t, t, plusDays(KEEP_DAYS)).run();
    await countEnquiry(env, caterer);
    await message(db, id, "client", text);
    await event(db, { id, caterer }, "receive", { text: F.mask ? mask(text) : text });
    await runAgent(env, F, id);
    return json(await clientView(db, id));
  }
  if (m && m[1] === "enquiries" && m[2]) {
    const id = m[2];
    if (!m[3] && req.method === "GET") { const v = await clientView(db, id); return v ? json(v) : json({ error: "Not found" }, 404); }
    if (m[3] === "messages" && req.method === "POST") {
      // Stage 0 keeps no conversation: every message is a new enquiry (the chat page sends it that way)
      if (!F.conversation) return json({ error: "This prototype keeps no conversation. Each message starts a new enquiry." }, 409);
      const enq = await db.prepare("SELECT id, caterer, status FROM enquiries WHERE id = ?").bind(id).first();
      if (!enq) return json({ error: "Not found" }, 404);
      const text = cleanText((await body(req)).text);
      if (!text.trim()) return json({ error: "Write a message first." }, 400);
      const n = await db.prepare("SELECT COUNT(*) AS n FROM messages WHERE enquiry_id = ? AND sender = 'client'").bind(id).first();
      if (n.n >= MAX_CLIENT_MESSAGES) return json({ error: "This demo conversation is full. Start a new enquiry to try again." }, 429);
      if (await limitReached(env, F, enq.caterer)) return json({ error: LIMIT_REPLY(CATERERS[enq.caterer]) }, 429);
      await message(db, id, "client", text);
      await event(db, enq, "receive", { text: F.mask ? mask(text) : text });
      await db.prepare("UPDATE enquiries SET status = 'reading', updated_at = ? WHERE id = ?").bind(now(), id).run();
      await runAgent(env, F, id, enq.status);
      return json(await clientView(db, id));
    }
  }

  // ---- the caterer's side
  const caterer = loggedIn(req, env, F);
  if (!caterer) return json({ error: "Please log in." }, 401);
  const name = CATERERS[caterer];

  if (p === "/api/me") return json({ caterer: name, id: caterer });

  if (p === "/api/restart" && req.method === "POST") {
    // A restart empties a program's memory. Stages 0 and 1 keep enquiries only there; from stage 2
    // they are in the database, so a restart loses nothing.
    if (!F.kept) await wipeEnquiries(db);
    return json({ kept: F.kept });
  }
  if (p === "/api/reset" && req.method === "POST") {
    await wipeEnquiries(db);
    await db.batch(["DELETE FROM price_list", "DELETE FROM settings", "DELETE FROM daily"].map(s => db.prepare(s)));
    return json({ ok: true });
  }

  if (p === "/api/prices") {
    if (!F.priceTable) return json({ error: "Until stage 2 the prices are in a file inside the program. Changing one needs a redeploy." }, 409);
    if (req.method === "POST") {
      const b = await body(req);
      for (const s of Array.isArray(b.services) ? b.services : []) {
        const price = Math.round(Number(s.price));
        if (!(price > 0 && price < 1e6)) return json({ error: "Each price must be a number above zero." }, 400);
        await db.prepare("UPDATE price_list SET price = ? WHERE caterer = ? AND service_id = ?").bind(price, caterer, String(s.id)).run();
      }
    }
    const biz = await businessFor(env, F, caterer);
    return json({ caterer: name, currency: biz.caterer.currency, services: biz.services });
  }

  if (p === "/api/settings") {
    if (!F.failSafe) return json({ error: "Settings arrive in stage 3." }, 404);
    if (req.method === "POST") {
      const b = await body(req);
      if ("model_on" in b) await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('model_on', ?)").bind(b.model_on ? "1" : "0").run();
      if ("daily_limit" in b) await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_limit', ?)").bind(String(Math.max(0, Math.round(Number(b.daily_limit) || 0)))).run();
    }
    const row = await db.prepare("SELECT enquiries FROM daily WHERE day = ? AND caterer = ?").bind(today(), caterer).first();
    return json({ model_on: (await setting(db, "model_on", "1")) === "1", daily_limit: Number(await setting(db, "daily_limit", env.DAILY_LIMIT || 200)), today: row ? row.enquiries : 0 });
  }

  if (p === "/api/usage") {
    if (!F.cost) return json({ error: "The cost page arrives in stage 3." }, 404);
    const t = await db.prepare("SELECT COUNT(*) AS enquiries, ROUND(SUM(cost_usd), 6) AS cost_usd, ROUND(AVG(cost_usd), 6) AS avg_cost_usd, SUM(tokens_in) AS tokens_in, SUM(tokens_out) AS tokens_out FROM enquiries WHERE caterer = ?").bind(caterer).first();
    return json({ caterer: name, model: env.ANTHROPIC_API_KEY ? env.MODEL || "claude-haiku-5-5" : "mock (no API key, so every cost is zero)", ...t });
  }

  if (p === "/api/log") {
    if (!F.log) return json({ error: "The log page arrives in stage 4." }, 404);
    const { results } = await db.prepare("SELECT enquiry_id, at, step, detail FROM events WHERE caterer = ? ORDER BY id DESC LIMIT 300").bind(caterer).all();
    return json({ caterer: name, events: results.map(e => ({ ...e, detail: JSON.parse(e.detail) })) });
  }

  if (p === "/api/inbox" && req.method === "GET") {
    if (F.deletion) await cleanUp(db);
    const { results } = await db.prepare("SELECT id, created_at, updated_at, expires_at, status, flags, summary, quote, reason FROM enquiries WHERE caterer = ? ORDER BY CASE status WHEN 'awaiting_approval' THEN 0 WHEN 'handed_over' THEN 1 WHEN 'failed' THEN 1 ELSE 2 END, updated_at DESC LIMIT 50").bind(caterer).all();
    for (const r of results) {
      r.flags = JSON.parse(r.flags || "[]"); r.quote = r.quote ? JSON.parse(r.quote) : null;
      const first = await db.prepare("SELECT text FROM messages WHERE enquiry_id = ? AND sender = 'client' ORDER BY id LIMIT 1").bind(r.id).first();
      r.first = first ? first.text : "";
    }
    return json({ caterer: name, enquiries: results });
  }
  if (m && m[1] === "inbox" && m[2]) {
    const id = m[2];
    const enq = await db.prepare("SELECT * FROM enquiries WHERE id = ?").bind(id).first();
    // One caterer can never open another caterer's enquiry, even by changing the id
    if (!enq || enq.caterer !== caterer) return json({ error: "Not found" }, 404);
    if (!m[3] && req.method === "GET") {
      const events = (await db.prepare("SELECT at, step, detail FROM events WHERE enquiry_id = ? ORDER BY id").bind(id).all()).results.map(e => ({ ...e, detail: JSON.parse(e.detail) }));
      const cur = await currentQuote(env, F, enq);
      const quote = enq.quote ? JSON.parse(enq.quote) : null;
      return json({ ...enq, reading: undefined, flags: JSON.parse(enq.flags || "[]"), quote, messages: await transcript(db, id), events,
        current: cur && quote && cur.quote.total !== quote.total ? cur : null });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const b = await body(req);
    const cleared = JSON.stringify(JSON.parse(enq.flags || "[]").filter(f => f !== "Needs you"));
    await db.prepare("UPDATE enquiries SET flags = ? WHERE id = ?").bind(cleared, id).run();
    if (m[3] === "approve") {
      if (enq.status !== "awaiting_approval") return json({ error: "Nothing is waiting for approval." }, 409);
      // Stage 2: if the price list changed since the draft, she chooses which price to send
      let draft = enq.draft, quote = enq.quote;
      if (b.price === "current") { const cur = await currentQuote(env, F, enq); if (cur) { draft = cur.draft; quote = JSON.stringify(cur.quote); } }
      const text = cleanText(b.text) || draft;
      const edited = text !== draft;
      await message(db, id, "caterer", text);
      await event(db, enq, edited ? "edit" : "approve", { price: b.price === "current" ? "current" : "drafted", total: quote ? JSON.parse(quote).total : null });
      // An approved quote is sent; an approved question means the agent waits for the client's answer
      await db.prepare("UPDATE enquiries SET status = ?, quote = ?, draft = NULL, updated_at = ?, expires_at = ? WHERE id = ?").bind(quote ? "sent" : "asked", quote, now(), plusDays(KEEP_DAYS), id).run();
    } else if (m[3] === "reject") {
      await event(db, enq, "reject", {});
      await db.prepare("UPDATE enquiries SET status = 'rejected', draft = NULL, updated_at = ? WHERE id = ?").bind(now(), id).run();
    } else if (m[3] === "reply") {
      const text = cleanText(b.text);
      if (!text.trim()) return json({ error: "Write a reply first." }, 400);
      await message(db, id, "caterer", text);
      await event(db, enq, "reply", {});
      await db.prepare("UPDATE enquiries SET status = 'sent', draft = NULL, updated_at = ?, expires_at = ? WHERE id = ?").bind(now(), plusDays(KEEP_DAYS), id).run();
    } else return json({ error: "Not found" }, 404);
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// D1 occasionally fails a single statement on a transient network error. Retry each statement a few
// times so one blip does not leave an enquiry half-written.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= 3) throw e; console.error("D1 retry", i + 1, String(e && e.message || e)); await sleep(150 * (i + 1)); }
  }
}
function steady(db) {
  const wrap = stmt => ({
    bind: (...a) => wrap(stmt.bind(...a)),
    run: () => retry(() => stmt.run()),
    first: (c) => retry(() => stmt.first(c)),
    all: () => retry(() => stmt.all()),
    raw: stmt,
  });
  return { prepare: sql => wrap(db.prepare(sql)), batch: stmts => retry(() => db.batch(stmts.map(s => s.raw || s))) };
}

export default {
  async fetch(req, env) {
    const S = Math.max(0, Math.min(4, Number(env.STAGE ?? 4)));
    const F = features(S);
    env = { ...env, DB: steady(env.DB) };
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(req, env, url, S, F); }
      catch (e) {
        console.error(e);
        return json({ error: "Something went wrong. Please try again." }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
