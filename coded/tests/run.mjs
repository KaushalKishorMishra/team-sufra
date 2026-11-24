// The test run behind the Agent Card's test log: every enquiry in data/test-enquiries.json, three runs
// each, against a running stage 3 or 4 (local `wrangler dev` or a live link). Writes tests/test-log.json
// and tests/test-log.csv.
//
//   BASE=https://team-sufra-stage-4.pages.dev CATERER_CODE=<Huda's code> node tests/run.mjs [--runs 3] [--allow-mock]
//
// A run passes when the agent ends where the case expects (a draft awaiting approval, or a handover),
// asks its one question when the case expects one, and drafts exactly an accepted set of services.
// Prices come from the price list, so a draft with the wrong services or quantities is a wrong price.
// Every run spends real model calls: the runner prints the cost when it finishes.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const RUNS = Number(args[args.indexOf("--runs") + 1]) || 3;
const ALLOW_MOCK = args.includes("--allow-mock");
const BASE = (process.env.BASE || "http://localhost:8787").replace(/\/$/, "");
const CODE = process.env.CATERER_CODE || "local-huda";
const { cases } = JSON.parse(readFileSync(new URL("../data/test-enquiries.json", import.meta.url)));
const business = JSON.parse(readFileSync(new URL("../data/business.json", import.meta.url)));

const post = (path, body) => fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const caterer = path => fetch(BASE + path, { headers: { "x-caterer-code": CODE } }).then(r => r.json());

const usage = await caterer("/api/usage");
usage.mock = /^mock/.test(usage.model || "");
if (usage.error) { console.error("Caterer code rejected:", usage.error); process.exit(1); }
if (usage.mock && !ALLOW_MOCK) { console.error("The agent is in mock mode (no ANTHROPIC_API_KEY). Set the key, or pass --allow-mock to check the runner itself; mock results are never published."); process.exit(1); }

const same = (got, want) => { const k = Object.keys(want); return k.length === Object.keys(got).length && k.every(x => got[x] === want[x]); };

async function runCase(c) {
  let v = await post("/api/enquiries", { text: c.text });
  if (v.error) return { ok: false, why: v.error };
  let asked = false;
  if (v.status === "asked" || v.status === "open") {
    asked = true;
    if (c.reply) v = await post(`/api/enquiries/${v.id}/messages`, { text: c.reply });
  }
  let first = null;
  if (c.then) {
    first = await caterer(`/api/inbox/${v.id}`);
    v = await post(`/api/enquiries/${v.id}/messages`, { text: c.then });
  }
  const d0 = await caterer(`/api/inbox/${v.id}`);
  const d = first || d0;
  // A question held for the caterer (Arabic) counts as asking, not as a draft
  const status = d.status === "awaiting_approval" ? (d.quote ? "draft" : "asked") : d.status === "handed_over" ? "handover" : d.status;
  if (status === "asked") asked = true;
  const items = {};
  for (const l of (d.quote && d.quote.lines) || []) items[l.id] = (items[l.id] || 0) + l.qty;
  const read = d.events.find(e => e.step === "read");
  const r = { id: d.id, status, asked, items, total: d.quote ? d.quote.total : null, rush: d.quote ? d.quote.rush : null, language: d.language, flags: d.flags, cost: d.cost_usd, masked: read && read.detail.model_read ? /\[phone\]/.test(read.detail.model_read) : null };
  const why = [];
  const want = c.expect === "ask" ? "draft" : c.expect === "services" ? "open" : c.expect;
  if (status !== want && !(c.or_handover && status === "handover")) why.push(`ended ${status}, expected ${want}`);
  if (c.expect === "services") {
    const last = [...d.messages].reverse().find(m => m.sender === "agent");
    const named = last ? business.services.filter(s => last.text.includes(s.name)).length : 0;
    if (named < 3) why.push("did not list the services");
  }
  if (c.then && d0.status !== c.then_status) why.push(`after "${c.then}" ended ${d0.status}, expected ${c.then_status}`);
  if (c.then && c.then_status !== "handed_over" && d0.messages[d0.messages.length - 1].sender !== "agent") why.push(`did not answer "${c.then}"`);
  if (c.expect === "ask" && !asked) why.push("did not ask its question");
  if (c.expect === "draft" && asked) why.push("asked a question it did not need");
  let wrongPrice = false;
  if (status === "draft" && c.items && !c.items.some(w => same(items, w))) { why.push(`drafted ${JSON.stringify(items)}`); wrongPrice = true; }
  if (c.rush !== undefined && status === "draft" && r.rush !== c.rush) why.push(`rush ${r.rush}`);
  if (c.language && r.language !== c.language) why.push(`language ${r.language}`);
  if (c.language === "ar" && !r.flags.some(f => f.startsWith("Arabic"))) why.push("no Arabic flag");
  if (c.masked && !r.masked) why.push("phone number not masked");
  return { ...r, ok: why.length === 0, why: why.join("; "), wrongPrice };
}

const results = [];
for (const [i, c] of cases.entries()) {
  const runs = [];
  for (let k = 0; k < RUNS; k++) runs.push(await runCase(c));
  const passed = runs.filter(r => r.ok).length;
  results.push({ n: i + 1, text: c.text, expect: c.expect === "ask" ? "asks, then drafts" : c.expect === "services" ? "lists the services" : c.expect === "draft" ? (c.then ? `drafts a quote; "${c.then}" ${c.then_status === "handed_over" ? "goes to Huda" : "is answered"}` : "drafts a quote") : "hands over", runs: RUNS, passed, wrong_price: runs.filter(r => r.wrongPrice).length, failures: runs.filter(r => !r.ok).map(r => r.why), cost: runs.reduce((a, r) => a + (r.cost || 0), 0) });
  console.log(`${String(i + 1).padStart(2)} ${passed}/${RUNS} ${passed === RUNS ? "pass" : "FAIL " + runs.filter(r => !r.ok).map(r => r.why).join(" | ")}  ${c.text.slice(0, 50)}`);
}

const total = results.length * RUNS, passed = results.reduce((a, r) => a + r.passed, 0), cost = results.reduce((a, r) => a + r.cost, 0);
const log = {
  date: new Date().toISOString().slice(0, 10),
  model: usage.model + (usage.mock ? " (mock)" : ""),
  totals: { cases: results.length, runs: RUNS, total, passed, wrong_price: results.reduce((a, r) => a + r.wrong_price, 0), cost_usd: +cost.toFixed(4), avg_cost_usd: +(cost / total).toFixed(5) },
  cases: results.map(({ n, text, expect, runs, passed, wrong_price, failures }) => ({ n, text, expect, group: cases[n - 1].group, runs, passed, wrong_price, failures })),
};
// A run cut short by the server (limits, errors) is not a test result: keep it out of the published log
const broken = results.some(r => r.failures.some(f => !/ended|asked|drafted|rush|language|flag|masked|question|services|answer/.test(f)));
const out = usage.mock ? new URL("./mock-log.json", import.meta.url) : broken ? new URL("./aborted-log.json", import.meta.url) : new URL("./test-log.json", import.meta.url);
if (broken) console.error("Some runs were refused or errored by the server, so this log is not published. See tests/aborted-log.json.");
writeFileSync(out, JSON.stringify(log, null, 2) + "\n");
if (!usage.mock && !broken) writeFileSync(new URL("./test-log.csv", import.meta.url), "n,enquiry,expected,runs,passed,wrong_price,failures\n" + log.cases.map(c => [c.n, JSON.stringify(c.text), c.expect, c.runs, c.passed, c.wrong_price, JSON.stringify(c.failures.join(" | "))].join(",")).join("\n") + "\n");
console.log(`\n${passed}/${total} runs passed · ${log.totals.wrong_price} wrong prices · USD ${cost.toFixed(4)} total, USD ${log.totals.avg_cost_usd} per enquiry · written to ${out.pathname}`);
