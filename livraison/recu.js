// ============================================================================
// Reçu (קבלה) bilingue hébreu / français d'une course livrée et payée (?t=…)
// ou d'un carnet pro payé d'avance (?c=…).
// Un עוסק פטור émet des reçus sans TVA (pas de חשבונית מס).
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const B = CONFIG.business;
const params = new URLSearchParams(location.search);
const token = params.get("t");
const carnetToken = params.get("c");
const topupToken = params.get("k");
const month = params.get("m");

function cityBoth(id) {
  const c = CONFIG.cities.find(x => x.id === id);
  return c ? `${c.he} / ${c.fr}` : id;
}

function date(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: CONFIG.timezone, day: "2-digit", month: "2-digit", year: "numeric" });
}

// En-tête : HOP, ou le livreur quand c'est lui qui a encaissé la course (paiement direct)
function head(number, issuer) {
  const who = issuer ? `
        <h1>${UI.esc(issuer.name || "")}</h1>
        <div>עוסק מס' · <span dir="ltr">N° d'עוסק</span> <b>${UI.esc(issuer.business || "—")}</b></div>
        <div>${UI.esc(issuer.city ? cityBoth(issuer.city) : "")}</div>
        <div dir="ltr" style="text-align:end">${UI.esc(issuer.phone || "")}</div>
        <div class="rc-small">שליח עצמאי, באמצעות ${UI.esc(CONFIG.businessNameHe || CONFIG.businessName)} · <span dir="ltr">Livreur indépendant, via ${UI.esc(CONFIG.businessName)}</span></div>` : `
        <h1>${UI.esc(B.tradeName || CONFIG.businessName)}</h1>
        <div>${UI.esc(B.legalName)}</div>
        <div>${UI.esc(B.status)} מס' <b>${UI.esc(B.number)}</b></div>
        <div>${UI.esc(B.address)}</div>
        <div dir="ltr" style="text-align:end">${UI.esc(CONFIG.phoneDisplay)}${B.email ? " · " + UI.esc(B.email) : ""}</div>`;
  return `
    <div class="rc-head">
      <div>${who}
      </div>
      <div class="rc-title">
        <b>קבלה מס' ${number}</b>
        <span dir="ltr">Reçu n° ${number}</span>
        <small>מקור · Original</small>
      </div>
    </div>`;
}

const FOOT = `
    <p class="rc-note">עוסק פטור — העסקה פטורה ממע"מ. · <span dir="ltr">Exonéré de TVA</span></p>
    <p class="rc-note">תודה! · Merci !</p>`;
// Reçu du livreur : il est responsable de sa déclaration (עוסק פטור ou מורשה)
const FOOT_COURIER = `
    <p class="rc-note">הקבלה הופקה עבור השליח, שמדווח בעצמו על הכנסותיו. · <span dir="ltr">Reçu émis pour le livreur, qui déclare lui-même ses revenus.</span></p>
    <p class="rc-note">תודה! · Merci !</p>`;
const notFound = () => { $("#receipt").innerHTML = `<p class="empty">הקבלה לא נמצאה · Reçu introuvable</p>`; };
const pay = m => m === "bit" ? "ביט / פייבוקס · Bit / PayBox" : m === "carnet" ? "כרטיסייה · Carnet" : "מזומן / Espèces";

// Reçu de HOP pour une recharge du crédit d'un livreur (HOP encaisse sa rémunération)
function renderTopup(v) {
  if (!v || !v.receipt_number) return notFound();
  document.title = `קבלה ${v.receipt_number} · Reçu ${v.receipt_number}`;
  $("#receipt").innerHTML = head(v.receipt_number) + `
    <div class="rc-meta">
      <div><small>תאריך · Date</small><b>${date(v.receipt_at)}</b></div>
      <div><small>לכבוד · Client</small><b>${UI.esc(v.courier_name || "")}${v.business_number ? ` · עוסק ${UI.esc(v.business_number)}` : ""}</b></div>
      <div><small>טלפון · Tél.</small><b dir="ltr">${UI.esc(v.phone || "")}</b></div>
    </div>
    <table class="rc-table">
      <thead><tr><th>תיאור · Description</th><th class="num">סכום · Montant</th></tr></thead>
      <tbody><tr>
        <td>טעינת קרדיט לעמלות שירות הופ · <span dir="ltr">Recharge du crédit HOP (commissions de mise en relation)</span><br>
          <small>העמלה על כל משלוח מנוכה מהקרדיט · <span dir="ltr">La commission de chaque course est déduite du crédit</span></small></td>
        <td class="num" dir="ltr">${UI.money(v.amount)}</td>
      </tr></tbody>
      <tfoot>
        <tr><th>סה"כ שולם · Total payé</th><th class="num" dir="ltr">${UI.money(v.amount)}</th></tr>
        <tr><td>אמצעי תשלום · Paiement</td><td class="num">ביט / Bit</td></tr>
      </tfoot>
    </table>` + FOOT;
}

// Relevé mensuel du livreur : ses courses, la commission de HOP déduite de son crédit, ses recharges
function renderStatement(s) {
  if (!s || !s.courier) { $("#receipt").innerHTML = `<p class="empty">התחברו לאזור השליחים · Connectez-vous à l'espace livreur</p>`; return; }
  const [y, mo] = s.month.split("-");
  const label = new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const sum = (l, f) => l.reduce((a, x) => a + Number(f(x) || 0), 0);
  const due = sum(s.orders, o => o.due), tops = sum(s.topups, t => t.amount), pens = sum(s.penalties, p => p.amount);
  document.title = `Relevé ${label} · ${s.courier.name}`;
  $("#receipt").innerHTML = `
    <div class="rc-head"><div><h1>${UI.esc(CONFIG.businessName)}</h1><div>${UI.esc(B.legalName)} · ${UI.esc(B.status)} מס' <b>${UI.esc(B.number)}</b></div></div>
      <div class="rc-title"><b>דוח חודשי</b><span dir="ltr">Relevé de ${UI.esc(label)}</span><small>${UI.esc(s.courier.name)}${s.courier.business_number ? " · עוסק " + UI.esc(s.courier.business_number) : ""}</small></div></div>
    <table class="rc-table">
      <thead><tr><th>משלוח · Course</th><th class="num">שולם לשליח · Payé au livreur</th><th class="num">עמלת הופ · Commission HOP</th></tr></thead>
      <tbody>${s.orders.map(o => `<tr><td>${UI.esc(o.ref)} · ${date(o.delivered)}${o.courier_receipt_number ? ` <small>(קבלה ${o.courier_receipt_number})</small>` : ""}</td>
        <td class="num" dir="ltr">${UI.money(Number(o.price) + (o.direct_pay ? Math.max(0, Number(o.shop_share || 0) - Number(o.hop_share || 0)) : 0))}</td>
        <td class="num" dir="ltr">${UI.money(o.due)}</td></tr>`).join("") || `<tr><td colspan="3">אין משלוחים · Aucune course</td></tr>`}</tbody>
      <tfoot>
        <tr><th>סה"כ עמלות · Total des commissions</th><th></th><th class="num" dir="ltr">${UI.money(due)}</th></tr>
        ${pens ? `<tr><td>ניכויים · Retenues</td><td></td><td class="num" dir="ltr">${UI.money(pens)}</td></tr>` : ""}
        <tr><td>טעינות קרדיט · Recharges du crédit</td><td></td><td class="num" dir="ltr">${UI.money(tops)}</td></tr>
        <tr><th>יתרת קרדיט היום · Crédit aujourd'hui</th><th></th><th class="num" dir="ltr">${UI.money(s.credit)}</th></tr>
      </tfoot>
    </table>
    ${s.topups.length ? `<p class="rc-note">${s.topups.map(t => `${UI.money(t.amount)} · ${date(t.decided_at || t.created_at)}${t.receipt_number ? ` · קבלה ${t.receipt_number}` : " · מתנה / offert"}`).join("<br>")}</p>` : ""}
    <p class="rc-note">הסכומים ששולמו לשליח שייכים לשליח. הופ מקבלת רק את העמלה. · <span dir="ltr">Les sommes payées au livreur sont à lui ; HOP ne perçoit que sa commission.</span></p>`;
}

// Reçu d'un carnet pro (payé d'avance)
function renderCarnet(v) {
  const box = $("#receipt");
  if (!v || !v.receipt_number) { box.innerHTML = `<p class="empty">הקבלה לא נמצאה · Reçu introuvable</p>`; return; }
  document.title = `קבלה ${v.receipt_number} · Reçu ${v.receipt_number}`;
  const home = CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  box.innerHTML = head(v.receipt_number) + `
    <div class="rc-meta">
      <div><small>תאריך · Date</small><b>${date(v.receipt_at)}</b></div>
      <div><small>לכבוד · Client</small><b>${UI.esc([v.shop_name, v.contact_name].filter(Boolean).join(" · "))}</b></div>
      <div><small>טלפון · Tél.</small><b dir="ltr">${UI.esc(v.phone || "")}</b></div>
    </div>
    <table class="rc-table">
      <thead><tr><th>תיאור · Description</th><th class="num">סכום · Montant</th></tr></thead>
      <tbody><tr>
        <td>כרטיסיית ${v.courses} משלוחים בתוך ${UI.esc(home.he)} · <span dir="ltr">Carnet de ${v.courses} courses dans ${UI.esc(home.fr)}</span><br>
          <small>שירות משלוח, תשלום מראש · Service de livraison payé d'avance</small></td>
        <td class="num" dir="ltr">${UI.money(v.amount)}</td>
      </tr></tbody>
      <tfoot>
        <tr><th>סה"כ שולם · Total payé</th><th class="num" dir="ltr">${UI.money(v.amount)}</th></tr>
        <tr><td>אמצעי תשלום · Paiement</td><td class="num">${v.payment_method === "cash" ? "מזומן / Espèces" : "ביט / Bit"}</td></tr>
      </tfoot>
    </table>` + FOOT;
}

function render(o) {
  const box = $("#receipt");
  if (!o) { box.innerHTML = `<p class="empty">הקבלה לא נמצאה · Reçu introuvable</p>`; return; }
  if (!o.receipt_number) {
    box.innerHTML = `<p class="empty">הקבלה תהיה זמינה אחרי המסירה והתשלום.<br><span dir="ltr">Le reçu sera disponible après la livraison et le paiement.</span><br><br>הזמנה מס' / Commande n° <b dir="ltr">${UI.esc(o.ref)}</b></p>`;
    return;
  }
  const client = [o.company, o.contact_name].filter(Boolean).join(" · ");
  const issuer = o.issuer === "courier" ? { name: o.courier_name, business: o.courier_business, phone: o.courier_phone, city: o.courier_city } : null;
  document.title = `קבלה ${o.receipt_number} · Reçu ${o.receipt_number}`;
  box.innerHTML = head(o.receipt_number, issuer) + `
    <div class="rc-meta">
      <div><small>תאריך · Date</small><b>${date(o.receipt_at)}</b></div>
      <div><small>לכבוד · Client</small><b>${UI.esc(client)}</b></div>
      <div><small>טלפון · Tél.</small><b dir="ltr">${UI.esc(o.contact_phone)}</b></div>
    </div>
    <table class="rc-table">
      <thead><tr><th>תיאור · Description</th><th class="num">סכום · Montant</th></tr></thead>
      <tbody><tr>
        <td>שירות משלוח · Service de livraison<br>
          <small>${UI.esc(cityBoth(o.from_city))} ← ${UI.esc(cityBoth(o.to_city))} · ${date(o.pickup_at)}<br>
          הזמנה מס' ${UI.esc(o.ref)} · <span dir="ltr">Commande n° ${UI.esc(o.ref)}</span></small></td>
        <td class="num" dir="ltr">${UI.money(o.price)}</td>
      </tr></tbody>
      <tfoot>
        <tr><th>סה"כ שולם · Total payé</th><th class="num" dir="ltr">${UI.money(o.price)}</th></tr>
        <tr><td>אמצעי תשלום · Paiement</td><td class="num">${pay(o.payment_method)}</td></tr>
        ${Number(o.cash_goods) > 0 ? `<tr><td colspan="2"><small>מוצרים ששולמו במזומן לעסק דרך השליח · Articles payés en espèces au commerce par le livreur : <b dir="ltr">${UI.money(o.cash_goods)}</b> (קבלה נפרדת מהעסק · reçu à part du commerce)</small></td></tr>` : ""}
      </tfoot>
    </table>` + (issuer ? FOOT_COURIER : FOOT);
}

if (carnetToken) Store.carnetReceipt(carnetToken).then(renderCarnet, () => renderCarnet(null));
else if (topupToken) Store.topupReceipt(topupToken).then(renderTopup, notFound);
else if (month) { Store.useSpace("coursier"); Store.myStatement(month).then(renderStatement, () => renderStatement(null)); }
else Store.orderReceipt(token).then(render, () => render(null));

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
