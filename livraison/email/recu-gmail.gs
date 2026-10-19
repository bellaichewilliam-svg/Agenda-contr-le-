// ============================================================================
// Envoi automatique du reçu (קבלה) par mail, depuis VOTRE Gmail.
// À coller dans https://script.google.com (voir README-mail.md).
// Supabase appelle ce script à chaque modification d'une commande ; le mail part
// une seule fois, quand la course reçoit son numéro de reçu (livrée + payée).
// ============================================================================

// 1. Choisissez un mot secret (le même que dans l'adresse du webhook Supabase)
const SECRET = "CHANGEZ-MOI";

// 2. Vos informations (identiques à config.js)
const APP_URL = "https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/";
const BUSINESS = {
  tradeName: "DIGITAL AND CO",
  brand: "HOP! Livraison",
  legalName: "בלאיש ויליאם אברהם",
  status: "עוסק פטור",
  number: "332342807",
  address: "יהודה הלוי 20, נתניה",
  phone: "050-000-0000"
};

function doPost(e) {
  if (!e || !e.parameter || e.parameter.secret !== SECRET) return text("refusé");
  const payload = JSON.parse(e.postData.contents);
  const o = payload.record;
  const old = payload.old_record || {};
  // Un seul envoi : au moment où le numéro de reçu apparaît
  if (payload.type !== "UPDATE" || !o || !o.receipt_number || old.receipt_number || !o.contact_email) return text("rien à envoyer");
  MailApp.sendEmail({
    to: o.contact_email,
    subject: `קבלה מס' ${o.receipt_number} · Reçu n° ${o.receipt_number} — ${BUSINESS.brand}`,
    htmlBody: receiptHtml(o),
    name: BUSINESS.brand
  });
  return text("envoyé");
}

function text(s) { return ContentService.createTextOutput(s); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function receiptHtml(o) {
  const d = iso => Utilities.formatDate(new Date(iso), "Asia/Jerusalem", "dd/MM/yyyy");
  const money = n => Number(n).toFixed(2).replace(/\.00$/, "") + " ₪";
  const pay = o.payment_method === "bit" ? "ביט / Bit" : "מזומן / Espèces";
  const client = [o.company, o.contact_name].filter(Boolean).join(" · ");
  const link = `${APP_URL}recu.html?t=${o.token}`;
  return `
  <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #E4E7EC;border-radius:12px;padding:22px;color:#101828">
    <div style="border-bottom:3px solid #FF6A13;padding-bottom:12px;margin-bottom:12px">
      <div style="font-size:20px;font-weight:bold">${esc(BUSINESS.tradeName)} · ${esc(BUSINESS.brand)}</div>
      <div>${esc(BUSINESS.legalName)} · ${esc(BUSINESS.status)} מס' ${esc(BUSINESS.number)}</div>
      <div>${esc(BUSINESS.address)} · <span dir="ltr">${esc(BUSINESS.phone)}</span></div>
    </div>
    <div style="font-size:20px;font-weight:bold">קבלה מס' ${o.receipt_number} · <span dir="ltr">Reçu n° ${o.receipt_number}</span></div>
    <p>תאריך / Date : ${d(o.receipt_at)}<br>לכבוד / Client : ${esc(client)}</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px;border-bottom:1px solid #E4E7EC">שירות משלוח · Service de livraison<br>
        <small>הזמנה מס' ${esc(o.ref)} · <span dir="ltr">Commande n° ${esc(o.ref)}</span> · ${d(o.pickup_at)}</small></td>
        <td style="padding:8px;border-bottom:1px solid #E4E7EC;text-align:left" dir="ltr">${money(o.price)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold">סה"כ שולם · Total payé</td><td style="padding:8px;font-weight:bold;text-align:left" dir="ltr">${money(o.price)}</td></tr>
      <tr><td style="padding:8px">אמצעי תשלום · Paiement</td><td style="padding:8px;text-align:left">${pay}</td></tr>
    </table>
    <p style="color:#5B6476;font-size:13px">עוסק פטור — העסקה פטורה ממע"מ · Exonéré de TVA (עוסק פטור)</p>
    <p><a href="${link}" style="background:#FF6A13;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">לצפייה והדפסה · Voir et imprimer</a></p>
    <p style="color:#5B6476;font-size:13px">תודה! · Merci et à bientôt !</p>
  </div>`;
}

// Pour tester : sélectionnez cette fonction en haut puis cliquez sur « Exécuter »
// (remplacez l'email par le vôtre) — Google vous demandera l'autorisation d'envoyer des mails.
function testEnvoi() {
  MailApp.sendEmail({ to: "votre-email@gmail.com", subject: "Test reçu", htmlBody: receiptHtml({
    receipt_number: 1, receipt_at: new Date().toISOString(), pickup_at: new Date().toISOString(), ref: "C000000-TEST",
    price: 25, payment_method: "bit", contact_name: "Client test", token: "test"
  }), name: BUSINESS.brand });
}
