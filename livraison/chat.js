// ============================================================================
// Messagerie dans l'application (aucun dialogue par WhatsApp) : fenêtre de
// conversation partagée par toutes les pages — texte, photos (réduites avant
// l'envoi), étapes de la course affichées automatiquement, messages non lus.
// ============================================================================

(function () {
"use strict";

const LS_SEEN = "livraison.chatSeen.v1";
const POLL_MS = 4000;
let cur = null;      // conversation ouverte : { opts, msgs, timer }
let dom = null;

function readSeen() { try { return JSON.parse(localStorage.getItem(LS_SEEN)) || {}; } catch (e) { return {}; } }
function markSeen(thread, iso) {
  const s = readSeen();
  if (!s[thread] || s[thread] < iso) { s[thread] = iso; try { localStorage.setItem(LS_SEEN, JSON.stringify(s)); } catch (e) { /* ignore */ } }
}

// Nombre de messages non lus par fil (messages des autres arrivés après la dernière lecture)
function unread(msgs, me) {
  const s = readSeen(), out = {};
  (msgs || []).forEach(m => {
    if (m.author === me || (m.author === "system" && me !== "client")) return;
    if (!s[m.thread] || m.created_at > s[m.thread]) out[m.thread] = (out[m.thread] || 0) + 1;
  });
  return out;
}

const tr = (lang, key, vars) => I18N.forLang(lang, key, vars);

function ensureDom() {
  if (dom) return dom;
  const wrap = document.createElement("div");
  wrap.className = "modal hidden chat-modal";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `<div class="modal-box chat-box">
      <div class="chat-head"><div><b class="chat-title"></b><small class="chat-sub"></small></div><button type="button" class="chat-x" aria-label="Fermer">✕</button></div>
      <div class="chat-list"></div>
      <p class="chat-err hidden"></p>
      <form class="chat-form" action="javascript:void(0)">
        <label class="chat-photo" title="Photo">📷<input type="file" accept="image/*" hidden /></label>
        <textarea rows="1"></textarea>
        <button class="btn btn-primary chat-send" type="submit">➤</button>
      </form>
    </div>`;
  document.body.appendChild(wrap);
  dom = {
    wrap, title: wrap.querySelector(".chat-title"), sub: wrap.querySelector(".chat-sub"), list: wrap.querySelector(".chat-list"),
    err: wrap.querySelector(".chat-err"), form: wrap.querySelector(".chat-form"), text: wrap.querySelector("textarea"),
    file: wrap.querySelector("input[type=file]"), send: wrap.querySelector(".chat-send")
  };
  wrap.querySelector(".chat-x").addEventListener("click", close);
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
  dom.form.addEventListener("submit", e => { e.preventDefault(); sendText(); });
  dom.text.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } });
  dom.file.addEventListener("change", () => { const f = dom.file.files[0]; dom.file.value = ""; if (f) sendPhoto(f); });
  return dom;
}

function bubble(m, o) {
  const lang = o.lang;
  const time = new Date(m.created_at).toLocaleTimeString(lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (m.author === "system") {
    const st = String(m.body || "").replace(/^status:/, "");
    return `<div class="chat-sys">${UI.esc(tr(lang, "cs_" + st))} · ${time}</div>`;
  }
  const mine = m.author === o.me;
  const who = mine ? tr(lang, "chYou") : (m.author_name && m.author !== "admin" ? m.author_name + " · " : "") + tr(lang, "a_" + m.author);
  return `<div class="chat-msg ${mine ? "mine" : ""} from-${UI.esc(m.author)}">
      <small>${UI.esc(who)} · ${time}</small>
      ${m.image ? `<a href="${UI.esc(m.image)}" target="_blank" rel="noopener"><img src="${UI.esc(m.image)}" alt="" /></a>` : m.has_image ? `<span class="muted">📷</span>` : ""}
      ${m.body ? `<p>${UI.esc(m.body).replace(/\n/g, "<br>")}</p>` : ""}
    </div>`;
}

function render() {
  const o = cur.opts, list = dom.list;
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  list.innerHTML = cur.msgs.length ? cur.msgs.map(m => bubble(m, o)).join("")
    : `<p class="chat-empty">${UI.esc(o.empty || tr(o.lang, "chEmpty"))}</p>`;
  if (atBottom || cur.first) { list.scrollTop = list.scrollHeight; cur.first = false; }
  const last = cur.msgs[cur.msgs.length - 1];
  if (last) markSeen(o.thread, last.created_at);
}

async function refresh() {
  if (!cur) return;
  const mine = cur;
  try {
    const msgs = await mine.opts.fetch();
    if (cur !== mine) return;
    const changed = msgs.length !== mine.msgs.length;
    mine.msgs = msgs || [];
    if (changed || mine.first) render();
    if (mine.opts.onUpdate) mine.opts.onUpdate();
  } catch (e) { /* nouvel essai au prochain tour */ }
}

function showErr(msg) { dom.err.textContent = msg || ""; dom.err.classList.toggle("hidden", !msg); }

async function sendText() {
  const body = dom.text.value.trim();
  if (!body || !cur) return;
  dom.send.disabled = true;
  showErr("");
  try {
    await cur.opts.send(body, null);
    dom.text.value = "";
    await refresh();
    dom.list.scrollTop = dom.list.scrollHeight;
  } catch (e) { showErr(tr(cur.opts.lang, "chErr")); }
  finally { dom.send.disabled = false; dom.text.focus(); }
}

// Photo réduite (1280 px, JPEG) pour rester légère
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      for (const [max, q] of [[1280, 0.72], [960, 0.6], [720, 0.5]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL("image/jpeg", q);
        if (data.length < 650000) return resolve(data);
      }
      reject(new Error("too_big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}

async function sendPhoto(file) {
  if (!cur) return;
  dom.send.disabled = true;
  showErr("");
  try {
    const data = await compress(file);
    await cur.opts.send(dom.text.value.trim() || null, data);
    dom.text.value = "";
    await refresh();
    dom.list.scrollTop = dom.list.scrollHeight;
  } catch (e) { showErr(tr(cur.opts.lang, e.message === "too_big" ? "chBig" : "chErr")); }
  finally { dom.send.disabled = false; }
}

// opts : { thread, title, sub, me, lang, fetch(), send(body, image), prefill, photo, empty, onUpdate }
function open(opts) {
  ensureDom();
  close();
  cur = { opts: Object.assign({ lang: (window.I18N && I18N.lang) || "fr" }, opts), msgs: [], first: true };
  const lang = cur.opts.lang;
  dom.wrap.dir = lang === "he" ? "rtl" : "ltr";
  dom.title.textContent = opts.title || "";
  dom.sub.textContent = opts.sub || "";
  dom.text.placeholder = tr(lang, "chPh");
  dom.text.value = opts.prefill || "";
  showErr("");
  dom.list.innerHTML = `<p class="chat-empty">…</p>`;
  dom.wrap.classList.remove("hidden");
  refresh();
  cur.timer = setInterval(refresh, POLL_MS);
  if (opts.photo) setTimeout(() => dom.file.click(), 150);
  else setTimeout(() => dom.text.focus(), 150);
}

function close() {
  if (!cur) return;
  clearInterval(cur.timer);
  const done = cur.opts.onClose;
  cur = null;
  if (dom) dom.wrap.classList.add("hidden");
  if (done) done();
}

// Petite liste « avec qui voulez-vous parler ? »
function choose(title, items) {
  const wrap = document.createElement("div");
  wrap.className = "modal chat-modal";
  wrap.innerHTML = `<div class="modal-box chat-choose"><h3>${UI.esc(title)}</h3>
      ${items.map((it, i) => `<button type="button" class="btn btn-block" data-i="${i}">${UI.esc(it.label)}${it.badge ? ` <span class="chat-badge">${it.badge}</span>` : ""}</button>`).join("")}
      <button type="button" class="btn btn-link" data-x="1">✕</button></div>`;
  wrap.dir = document.documentElement.dir;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b && e.target !== wrap) return;
    wrap.remove();
    if (b && b.dataset.i != null) items[Number(b.dataset.i)].onClick();
  });
}

window.Chat = { open, close, choose, unread, markSeen, compress, get openThread() { return cur && cur.opts.thread; } };

})();
