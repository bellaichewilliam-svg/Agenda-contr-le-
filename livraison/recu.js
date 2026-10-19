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

function cityBoth(id) {
  const c = CONFIG.cities.find(x => x.id === id);
  return c ? `${c.he} / ${c.fr}` : id;
}

function date(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: CONFIG.timezone, day: "2-digit", month: "2-digit", year: "numeric" });
}

function head(number) {
  return `
    <div class="rc-head">
      <div>
        <h1>${UI.esc(B.tradeName || CONFIG.businessName)}</h1>
        <div>${UI.esc(B.legalName)}</div>
        <div>${UI.esc(B.status)} מס' <b>${UI.esc(B.number)}</b></div>
        <div>${UI.esc(B.address)}</div>
        <div dir="ltr" style="text-align:end">${UI.esc(CONFIG.phoneDisplay)}${B.email ? " · " + UI.esc(B.email) : ""}</div>
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
  const pay = o.payment_method === "bit" ? "ביט / Bit" : "מזומן / Espèces";
  const client = [o.company, o.contact_name].filter(Boolean).join(" · ");
  document.title = `קבלה ${o.receipt_number} · Reçu ${o.receipt_number}`;
  box.innerHTML = head(o.receipt_number) + `
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
        <tr><td>אמצעי תשלום · Paiement</td><td class="num">${pay}</td></tr>
      </tfoot>
    </table>` + FOOT;
}

if (carnetToken) Store.carnetReceipt(carnetToken).then(renderCarnet, () => renderCarnet(null));
else Store.trackOrder(token).then(render, () => render(null));

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
