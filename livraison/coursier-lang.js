// HOP! Livreur : langue de l'appli (Français / עברית), choisie dans Réglages (ou sur l'écran de connexion).
// Gardée à part de l'appli client (clé livraison.courierLang.v1). Par défaut : la langue du téléphone.
// En hébreu : la page passe de droite à gauche et chaque texte affiché est traduit avec coursier-he-dict.js
// (phrases entières, puis morceaux de phrase autour des nombres et des noms).
(function () {
  "use strict";
  var KEY = "livraison.courierLang.v1";
  var l = null;
  try {
    var asked = new URLSearchParams(location.search).get("lang");
    if (asked === "he" || asked === "fr") { localStorage.setItem(KEY, asked); l = asked; }
    if (!l) l = localStorage.getItem(KEY);
  } catch (e) { /* ignore */ }
  if (l !== "he" && l !== "fr") l = /^(he|iw)/i.test(navigator.language || "") ? "he" : "fr";
  window.COURIER_LANG = l;
  window.courierSetLang = function (v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ }
    location.reload();
  };
  if (l !== "he") return;

  document.documentElement.lang = "he";
  document.documentElement.dir = "rtl";
  if (!window.COURIER_HE) document.write('<script src="coursier-he-dict.js?v=' + (document.currentScript && /v=(\d+)/.test(document.currentScript.src) ? RegExp.$1 : "1") + '"><\/script>');

  var exact = null, re = null, cache = new Map();
  var norm = function (s) { return s.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim(); };
  function build() {
    if (exact || !window.COURIER_HE) return !!exact;
    exact = new Map();
    var parts = [];
    window.COURIER_HE.forEach(function (p) {
      var k = norm(p[0]);
      exact.set(k, p[1]);
      // Dans une phrase : seulement les morceaux de plusieurs mots (ou un long mot), jamais « Le », « Pour »…
      if (/ /.test(k) ? /\p{L}.*\p{L}.*\p{L}/u.test(k) : k.length >= 9 || /^(Merci|Bonjour|Salut|Bravo)$/.test(k)) parts.push(k);
    });
    parts.sort(function (a, b) { return b.length - a.length; });
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    // Bord de mot seulement quand le morceau commence / finit par une lettre (« . Il reste… » se colle à un nom)
    var W = /^[\p{L}\p{N}]/u, Z = /[\p{L}\p{N}]$/u;
    re = new RegExp(parts.map(function (k) {
      return (W.test(k) ? "(?<![\\p{L}\\p{N}])" : "") + esc(k) + (Z.test(k) ? "(?![\\p{L}\\p{N}])" : "");
    }).join("|"), "gu");
    return true;
  }
  var DAYS = { lundi: "שני", mardi: "שלישי", mercredi: "רביעי", jeudi: "חמישי", vendredi: "שישי", samedi: "שבת", dimanche: "ראשון" };
  function tr(s) {
    if (!s || !/[A-Za-zÀ-ÿ]{2}/.test(s) || !build()) return s;
    var c = cache.get(s);
    if (c !== undefined) return c;
    var lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    var n = norm(s), out;
    if (exact.has(n)) out = exact.get(n);
    else {
      out = n.replace(re, function (m) { return exact.get(m); });
      // Unités et jours encore en français autour des nombres
      out = out.replace(/(\d) ?min\b/g, "$1 דק׳").replace(/(\d) ?km\b/g, "$1 ק״מ").replace(/(\d) courses?\b/g, "$1 משלוחים").replace(/(\d) commandes?\b/g, "$1 הזמנות")
        .replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, function (m) { return DAYS[m.toLowerCase()]; })
        .replace(/\bn°\s?/g, "מס׳ ");
    }
    out = out.replace(/־ (?=[\p{L}\p{N}«(])/gu, "־");
    out = out === n ? s : lead + out + tail;
    if (cache.size > 4000) cache.clear();
    cache.set(s, out);
    return out;
  }
  window.courierTr = tr;

  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE|NOSCRIPT)$/;
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  function doText(t) {
    var p = t.parentNode;
    if (!p || SKIP.test(p.nodeName) || (p.closest && p.closest("[contenteditable],.chat-list,.no-tr"))) return;
    var v = t.data, w = tr(v);
    if (w !== v) t.data = w;
  }
  function doEl(el) {
    if (SKIP.test(el.nodeName) && el.nodeName !== "INPUT" && el.nodeName !== "TEXTAREA") return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (a) { var b = tr(a); if (b !== a) el.setAttribute(ATTRS[i], b); }
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (root.nodeName === "SCRIPT" || root.nodeName === "STYLE") return; doEl(root); }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doEl(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  });
  function start() {
    walk(document.body);
    if (document.title) document.title = tr(document.title);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

  // Fenêtres du téléphone (alerte, confirmation, question) : traduites aussi, ligne par ligne
  var trLines = function (s) { return String(s == null ? "" : s).split("\n").map(tr).join("\n"); };
  var A = window.alert, C = window.confirm, P = window.prompt;
  window.alert = function (s) { return A.call(window, trLines(s)); };
  window.confirm = function (s) { return C.call(window, trLines(s)); };
  window.prompt = function (s, d) { return P.call(window, trLines(s), d); };
})();
