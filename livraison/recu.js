// ============================================================================
// Reçu (קבלה) bilingue hébreu / français d'une course livrée et payée.
// Un עוסק פטור émet des reçus sans TVA (pas de חשבונית מס).
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const B = CONFIG.business;
const token = new URLSearchParams(location.search).get("t");

function cityBoth(id) {
  const c = CONFIG.cities.find(x => x.id === id);
  return c ? `${c.he} / ${c.fr}` : id;
}

function date(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: CONFIG.timezone, day: "2-digit", month: "2-digit", year: "numeric" });
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
  box.innerHTML = `
    <div class="rc-head">
      <div>
        <h1>${UI.esc(B.tradeName || CONFIG.businessName)}</h1>
        <div>${UI.esc(B.legalName)}</div>
        <div>${UI.esc(B.status)} מס' <b>${UI.esc(B.number)}</b></div>
        <div>${UI.esc(B.address)}</div>
        <div dir="ltr" style="text-align:end">${UI.esc(CONFIG.phoneDisplay)}${B.email ? " · " + UI.esc(B.email) : ""}</div>
      </div>
      <div class="rc-title">
        <b>קבלה מס' ${o.receipt_number}</b>
        <span dir="ltr">Reçu n° ${o.receipt_number}</span>
        <small>מקור · Original</small>
      </div>
    </div>
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
    </table>
    <p class="rc-note">עוסק פטור — העסקה פטורה ממע"מ. · <span dir="ltr">Exonéré de TVA</span></p>
    <p class="rc-note">תודה! · Merci !</p>`;
}

Store.trackOrder(token).then(render, () => render(null));

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
