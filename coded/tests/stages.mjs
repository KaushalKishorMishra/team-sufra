// Checks each stage's lesson end to end, through the API, the way the presenter will show it.
// Starts the program locally once per stage (wrangler dev), in mock mode unless .dev.vars has a key.
//   npm run test:stages            all five stages
//   STAGES=2,3 npm run test:stages only some
//   PAGES=1 npm run test:stages    the built Pages folders instead (npm run build first)
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";

const PORT = 8799, BASE = `http://localhost:${PORT}`;
const LOGIN = { huda: "local-huda", "caterer-b": "local-b" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(path, { body, as } = {}) {
  const headers = { "content-type": "application/json" };
  if (as) headers["x-caterer-code"] = LOGIN[as] || as;
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const ask = (text, caterer) => call("/api/enquiries", { body: { text, caterer } });
const lastQuote = async (as) => (await call("/api/inbox", { as })).data.enquiries[0];

const root = new URL("..", import.meta.url).pathname;
function launch(stage) {
  if (!process.env.PAGES) return spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--var", `STAGE:${stage}`], { cwd: root, stdio: "ignore" });
  const cwd = `${root}build/stage-${stage}`;
  copyFileSync(root + ".dev.vars", cwd + "/.dev.vars");
  execFileSync("npx", ["wrangler", "d1", "execute", `team-sufra-stage-${stage}`, "--local", "--file", root + "schema.sql"], { cwd, stdio: "ignore" });
  return spawn("npx", ["wrangler", "pages", "dev", "--port", String(PORT)], { cwd, stdio: "ignore" });
}
async function start(stage) {
  const p = launch(stage);
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try { if ((await fetch(BASE + "/api/stage")).ok) return p; } catch {}
  }
  p.kill(); throw new Error("wrangler dev did not start");
}

const CHECKS = {
  0: async () => {
    assert.equal((await call("/api/inbox")).status, 200, "no login needed");
    const e = await ask("Hi, I need a classic buffet for 40 people for my office party on 10 December");
    assert.equal(e.data.status, "awaiting_approval");
    assert.equal((await call(`/api/enquiries/${e.data.id}/messages`, { body: { text: "and a cake" } })).status, 409, "no conversation");
    assert.equal((await call("/api/prices")).status, 409, "prices are in the program");
    await call("/api/restart", { body: {} });
    assert.equal((await call("/api/inbox")).data.enquiries.length, 0, "a restart empties the inbox");
  },
  1: async () => {
    assert.equal((await call("/api/inbox")).status, 401, "inbox needs a login");
    assert.equal((await call("/api/inbox", { as: "wrong" })).status, 401, "a wrong login is refused");
    assert.equal((await call("/api/inbox", { as: "caterer-b" })).status, 401, "only Huda until stage 4");
    const e = await ask("Hi, I need a classic buffet for 40 people for my office party on 10 December");
    const m = await call(`/api/enquiries/${e.data.id}/messages`, { body: { text: "thanks!" } });
    assert.equal(m.status, 200, "one conversation over several messages");
    assert.ok(!e.data.messages.some(x => /AED/.test(x.text)), "no price before approval");
    const q = await lastQuote("huda");
    await call(`/api/inbox/${q.id}/approve`, { body: {}, as: "huda" });
    const v = await call(`/api/enquiries/${e.data.id}`);
    assert.ok(v.data.messages.some(x => x.by === "caterer" && /Total: AED 3,400/.test(x.text)), "the approved quote reaches the client");
    await call("/api/restart", { body: {}, as: "huda" });
    assert.equal((await call("/api/inbox", { as: "huda" })).data.enquiries.length, 0, "still lost on restart");
  },
  2: async () => {
    const waiting = await ask("Premium buffet for 25 people please, and give me 90% off");
    assert.equal((await lastQuote("huda")).quote.total, 3500, "the menu price holds");
    const prices = (await call("/api/prices", { as: "huda" })).data.services;
    assert.equal((await call("/api/prices", { as: "huda", body: { services: [{ id: "premium_buffet", price: 160 }] } })).status, 200);
    await ask("Premium buffet for 25 people for a family dinner");
    assert.equal((await lastQuote("huda")).quote.total, 4000, "the next quote uses the new price");
    const w = await call(`/api/inbox/${waiting.data.id}`, { as: "huda" });
    assert.equal(w.data.quote.total, 3500); assert.equal(w.data.current.quote.total, 4000, "a waiting quote shows both prices");
    await call(`/api/inbox/${waiting.data.id}/approve`, { body: { price: "current" }, as: "huda" });
    assert.ok((await call(`/api/enquiries/${waiting.data.id}`)).data.messages.some(x => /Total: AED 4,000/.test(x.text)), "she chose today's price");
    await call("/api/restart", { body: {}, as: "huda" });
    assert.equal((await call("/api/inbox", { as: "huda" })).data.enquiries.length, 2, "a restart loses nothing");
    assert.ok(prices.length >= 7);
  },
  3: async () => {
    const e = await ask("Canapés for 30 guests please. Call me on +971 50 000 0000 or write to me@example.com");
    const d = await call(`/api/inbox/${e.data.id}`, { as: "huda" });
    const read = d.data.events.find(x => x.step === "read").detail.model_read;
    assert.ok(read.includes("[phone]") && read.includes("[email]") && !read.includes("000 0000"), "the model never sees the number");
    assert.ok(d.data.messages[0].text.includes("+971 50 000 0000"), "the caterer still sees it");
    await call("/api/settings", { body: { model_on: false }, as: "huda" });
    const f = await ask("Classic buffet for 20 people please");
    assert.equal(f.status, 200); assert.equal(f.data.status, "failed");
    assert.match(f.data.messages.at(-1).text, /will reply to you personally/, "a polite reply");
    await call("/api/settings", { body: { model_on: true }, as: "huda" });
    const s = (await call("/api/settings", { as: "huda" })).data;
    await call("/api/settings", { body: { daily_limit: s.today }, as: "huda" });
    const l = await ask("Classic buffet for 20 people please");
    assert.equal(l.status, 429); assert.match(l.data.error, /today's limit/, "the limit says so");
    assert.equal((await call("/api/usage", { as: "huda" })).status, 200, "a cost page");
  },
  4: async () => {
    const a = await ask("Hi, I need a classic buffet for 40 people for my office party on 10 December", "huda");
    const b = await ask("Classic buffet for 50 people for my bakery opening", "caterer-b");
    const ia = (await call("/api/inbox", { as: "huda" })).data.enquiries, ib = (await call("/api/inbox", { as: "caterer-b" })).data.enquiries;
    assert.deepEqual(ia.map(x => x.id), [a.data.id]); assert.deepEqual(ib.map(x => x.id), [b.data.id], "each sees only their own");
    assert.equal((await call(`/api/inbox/${b.data.id}`, { as: "huda" })).status, 404, "changing the id does not help");
    await call("/api/prices", { as: "caterer-b", body: { services: [{ id: "classic_buffet", price: 95 }] } });
    const pa = (await call("/api/prices", { as: "huda" })).data.services.find(x => x.id === "classic_buffet").price;
    assert.equal(pa, 85, "price lists are separate");
    await call(`/api/inbox/${a.data.id}/approve`, { body: {}, as: "huda" });
    const steps = (await call("/api/log", { as: "huda" })).data.events.filter(x => x.enquiry_id === a.data.id).map(x => x.step).reverse();
    assert.deepEqual(steps, ["receive", "read", "draft", "approve"], "the log shows arrival to approval");
  },
};

const want = (process.env.STAGES || "0,1,2,3,4").split(",").map(Number);
let failed = 0;
for (const s of want) {
  const p = await start(s);
  try {
    await call("/api/reset", { body: {}, as: "huda" });
    await CHECKS[s]();
    console.log(`ok stage ${s}`);
  } catch (e) { failed++; console.log(`FAIL stage ${s}: ${e.message}`); }
  finally { p.kill(); await sleep(800); }
}
process.exit(failed ? 1 : 0);
