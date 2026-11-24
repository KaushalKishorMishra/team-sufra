// Shared by every page: the stage label, the navigation, the footer and the caterer's login
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CODE_KEY = "team-sufra-login";
const getCode = () => { try { return sessionStorage.getItem(CODE_KEY) || ""; } catch { return window.__code || ""; } };
const setCode = v => { try { sessionStorage.setItem(CODE_KEY, v); } catch { window.__code = v; } };
// The login code travels in a header, never in the address
const api = (path, payload) => fetch(path, {
  method: payload ? "POST" : "GET",
  headers: { "x-caterer-code": getCode(), ...(payload ? { "content-type": "application/json" } : {}) },
  body: payload ? JSON.stringify(payload) : undefined,
});
const money = (n, c) => `${c || "AED"} ${Number(n).toLocaleString("en-US")}`;
const time = iso => new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dateShort = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago"; };
const STATUS = {
  awaiting_approval: ["wait", "Awaiting your approval"],
  handed_over: ["need", "Handed to you"],
  failed: ["need", "Failed: needs you"],
  asked: ["ask", "Asked the client"],
  open: ["ask", "Waiting for the client"],
  reading: ["", "Reading"],
  sent: ["sent", "Sent"],
  rejected: ["", "Rejected"],
};
const statusChip = s => { const [k, t] = STATUS[s] || ["", s]; return `<span class="chip ${k}">${esc(t)}</span>`; };

// Which stage this is. Every page waits for it, then draws the header and footer.
const STAGE = fetch("/api/stage").then(r => r.json());
async function frame(role) {
  const st = await STAGE, F = st.features;
  const links = [["./", "Start"], ["chat.html", "Client chat"], ["inbox.html", "Caterer inbox"]];
  if (F.priceTable) links.push(["prices.html", "Price list"]);
  if (F.cost) links.push(["settings.html", "Safety and cost"]);
  if (F.log) links.push(["log.html", "Log"]);
  const here = location.pathname.split("/").pop() || "./";
  document.body.insertAdjacentHTML("afterbegin", `<header class="top"><span class="mark" aria-hidden="true"></span>
    <div><b>Team Sufra</b> <span class="stage">${esc(st.name)}</span><div class="sub" id="sub">${esc(role)}</div></div>
    <nav>${links.map(([h, t]) => `<a href="${h}"${h === here || (h === "./" && here === "index.html") ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav></header>`);
  document.body.insertAdjacentHTML("beforeend", `<div class="fiction">${esc(st.name)} · Team Sufra, its users and every figure are fictional.</div>`);
  return st;
}

// The caterer's login, used by every caterer page. Stage 0 has none: anyone with the link gets in.
function loginForm(target, msg, st) {
  target.innerHTML = `<form class="card login" id="login"><h3>Log in as the caterer</h3>
    <p class="muted" style="margin:0 0 10px;font-size:14px">${st.features.manyCaterers ? "Each caterer has their own login." : "Only Huda can open her inbox."}</p>
    <input type="password" id="code" autocomplete="off" aria-label="Login code" placeholder="Login code"><p class="err">${msg ? esc(msg) : ""}</p><button class="btn">Log in</button></form>`;
  $("#login").addEventListener("submit", e => { e.preventDefault(); setCode($("#code").value.trim()); location.reload(); });
}
// Fetch a caterer API; on 401 show the login form and stop
async function catererGet(path, target, st) {
  const r = await api(path);
  if (r.status === 401) { loginForm(target, getCode() ? "That login did not work." : "", st); return null; }
  return r.json().catch(() => ({}));
}
function logOut() { setCode(""); location.reload(); }
