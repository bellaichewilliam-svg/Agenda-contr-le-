// ============================================================================
// Kit de lancement : lien, QR code, grille de prix, messages FR/HE prêts à copier, flyer.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const url = UI.appUrl();
const home = CONFIG.homeCity;
const price = to => UI.money(Pricing.cityToCity(CONFIG, home, to));
const P = CONFIG.pricing;
const PR = CONFIG.promos;
const nameFr = CONFIG.businessName, nameHe = CONFIG.businessNameHe;
const heHome = CONFIG.cities.find(c => c.id === home).he;
const welcome = UI.money(Pricing.cityToCity(CONFIG, home, home) - PR.codes.BIENVENUE.amount);
const pickupFrom = UI.money(Pricing.cityToCity(CONFIG, home, home) + P.pickupPoint);

$("#appLink").textContent = url;
if (window.QRCode) new QRCode($("#qr"), { text: url, width: 164, height: 164, correctLevel: QRCode.CorrectLevel.M });

// Seulement le Sharon pour l'instant (Tel Aviv et Gush Dan : bientôt)
const featured = ["netanya", "nordia", "even-yehuda", "kadima", "kfar-yona", "hadera", "raanana", "kfar-saba", "herzliya"];
$("#kitPrices").innerHTML = `<tr><th>Trajet</th><th>Prix</th></tr>` + featured.map(id =>
  `<tr><td>${id === home ? "Dans " + UI.cityFr(home) : `${UI.cityFr(home)} ⇄ ${UI.cityFr(id)}`}</td><td><b>${price(id)}</b></td></tr>`).join("")
  + `<tr><td>Suppléments</td><td>express +${UI.money(P.express)} · poste/Super-Pharm +${UI.money(P.pickupPoint)} · achat +${UI.money(P.purchase)} · colis moyen +${UI.money(P.sizes.moyen)}</td></tr>`;

$("#kitOffers").innerHTML = [
  `<b>BIENVENUE</b> (français) / <b>BRUCHIM</b> (hébreu) : -${UI.money(PR.codes.BIENVENUE.amount)} sur la première course (${welcome} dans ${UI.cityFr(home)}), une seule fois par numéro, téléphone et IP.`,
  `<b>NETANYA</b> : -${UI.money(PR.codes.NETANYA.amount)} sur n'importe quelle course — à imprimer comme « bon de réduction » sur les flyers laissés chez les commerçants.`,
  `<b>Parrainage</b> : chaque client a son code ${PR.referral.prefix} + 4 chiffres (-${UI.money(PR.referral.amount)} pour le filleul ; offrez aussi ${UI.money(PR.referral.amount)} au parrain sur sa course suivante en ajustant le prix ✏️).`,
  `<b>Fidélité</b> : la ${PR.loyalty.every}e course est offerte automatiquement (max ${UI.money(PR.loyalty.max)}).`,
  ...PR.business.map(b => `<b>Pro</b> : ${UI.esc(b.fr)} — ${UI.esc(typeof b.price === "object" ? b.price.fr : b.price)}`)
].map(x => `<li>${x}</li>`).join("");

const POSTS = [
  { title: "Post pour les groupes Facebook / WhatsApp (français)", dir: "ltr", text:
`🛵 Et hop, c'est livré ! Nouveau à ${UI.cityFr(home)} : ${nameFr}, le coursier francophone à prix fixe.

📦 Colis et documents
📮 Je récupère vos colis à la poste (fini la queue !)
💊 Commandes Super-Pharm, pharmacie
🍔 Livraisons pour les restaurants et commerces
🛒 J'achète pour vous et je livre

💰 Dans ${UI.cityFr(home)} : ${price(home)} · Even Yehuda : ${price("even-yehuda")} · Ra'anana, Kfar Saba, Herzliya : ${price("raanana")}
🛒 On fait vos courses : le prix réel du magasin + la livraison. 0 frais de service, 0 frais de petite commande
📍 Vous suivez la course en direct sur la carte
💵 Paiement en espèces ou par Bit

🏪 Tous les magasins, même les petits : on y va pour vous !
🎁 Votre première course dans ${UI.cityFr(home)} à ${welcome} avec le code BIENVENUE
👉 Commandez en 1 minute : ${url}` },

  { title: "פוסט לקבוצות פייסבוק / וואטסאפ (עברית)", dir: "rtl", text:
`🛵 הופ, וזה אצלך! חדש ב${heHome}: ${nameHe}, משלוחים במחיר קבוע.

📦 חבילות ומסמכים
📮 איסוף חבילות מהדואר (בלי לעמוד בתור!)
💊 איסוף הזמנות מסופר-פארם ומבית המרקחת
🍔 משלוחים למסעדות ולעסקים
🛒 קונים בשבילכם ומביאים

💰 בתוך ${heHome}: ${price(home)} · לאבן יהודה: ${price("even-yehuda")} · לרעננה, כפר סבא, הרצליה: ${price("raanana")}
🛒 אנחנו עושים לכם קניות: המחיר האמיתי של החנות + המשלוח. 0 דמי שירות, 0 דמי הזמנה קטנה
📍 מעקב אחרי השליח על המפה בזמן אמת
💵 תשלום במזומן או בביט

🏪 כל החנויות, גם הקטנות: אנחנו מגיעים בשבילכם!
🎁 משלוח ראשון בתוך ${heHome} ב-${welcome} עם הקוד BRUCHIM
👈 להזמנה תוך דקה: ${url}` },

  { title: "Message direct à un commerce (français)", dir: "ltr", text:
`Bonjour, je suis coursier indépendant à ${UI.cityFr(home)} (${nameFr}).
Je propose aux commerces des livraisons à prix fixe (${price(home)} dans ${UI.cityFr(home)}), sans commission et sans engagement.
Votre client reçoit un lien pour suivre la livraison en direct, et paie en espèces ou par Bit.
Je vous offre 3 courses d'essai à moitié prix. Pour commander : ${url}
Au plaisir de travailler avec vous !` },

  { title: "הודעה ישירה לבית עסק (עברית)", dir: "rtl", text:
`שלום, אני שליח עצמאי ב${heHome} (${nameHe}).
אני מציע לעסקים משלוחים במחיר קבוע (${price(home)} בתוך העיר), בלי עמלות ובלי התחייבות.
הלקוח שלכם מקבל קישור למעקב בזמן אמת, ומשלם במזומן או בביט.
אשמח לתת לכם 3 משלוחי ניסיון בחצי מחיר. להזמנה: ${url}
תודה ובהצלחה!` },

  { title: "Spécial poste (français)", dir: "ltr", text:
`📮 Un avis de passage de la poste et pas le temps de faire la queue ?
Je récupère votre colis et je vous l'apporte à la maison, dès ${pickupFrom} dans ${UI.cityFr(home)}.
Il faut juste une procuration signée + la copie de la carte d'identité.
👉 ${url}` },

  { title: "מיוחד לדואר (עברית)", dir: "rtl", text:
`📮 קיבלתם הודעה על חבילה בדואר ואין לכם זמן לעמוד בתור?
אני אוסף בשבילכם ומביא עד הבית, החל מ-${pickupFrom} בתוך העיר.
צריך רק ייפוי כוח חתום וצילום תעודת זהות.
👈 ${url}` },

  { title: "Argumentaire pour un restaurant (français)", dir: "ltr", text:
`Bonjour ! Je suis ${nameFr}, livreur à ${UI.cityFr(home)}.
Avec moi :
• 0 % de commission sur vos commandes : vous payez seulement la course (${price(home)} dans ${UI.cityFr(home)}).
• Chaque commande part directement chez votre client, sans être groupée avec d'autres : elle arrive chaude.
• Votre client reçoit un lien pour suivre la livraison en direct.
• Paiement en espèces ou Bit, reçu à chaque course.
On essaie avec 3 livraisons à moitié prix ? ${url}` },

  { title: "טיעונים למסעדה (עברית)", dir: "rtl", text:
`שלום! אני מ${nameHe}, שליח ב${heHome}.
איתי:
• 0% עמלה על ההזמנות: משלמים רק על המשלוח (${price(home)} בתוך העיר).
• כל הזמנה יוצאת ישר ללקוח, בלי לאחד עם הזמנות אחרות: האוכל מגיע חם.
• הלקוח מקבל קישור למעקב בזמן אמת.
• תשלום במזומן או בביט, קבלה על כל משלוח.
ננסה עם 3 משלוחים בחצי מחיר? ${url}` },

  { title: "Recruter des livreurs (français)", dir: "ltr", text:
`🛵 ${nameFr} recrute des livreurs indépendants à ${UI.cityFr(home)} et environs !
✅ Vous choisissez vos courses, quand vous voulez
✅ Vous encaissez le client directement (espèces ou Bit)
✅ Faites votre marketing, gagnez plus : seulement ${CONFIG.platform.networkPercent} % de commission sur les courses des commerces que vous amenez (${CONFIG.platform.commissionPercent} % sur les autres)
✅ ${CONFIG.pro.referrerPercent} % des abonnements HOP! Pro que vous faites signer, et les pourboires 100 % pour vous
✅ Pas d'abonnement, pas de frais d'inscription
Il faut : permis valide, véhicule assuré (simple déclaration), un top case, statut d'עוסק פטור ou מורשה.
👉 Inscription : ${UI.appUrl("coursier.html")}` },

  { title: "גיוס שליחים (עברית)", dir: "rtl", text:
`🛵 ${nameHe} מגייסת שליחים עצמאיים ב${heHome} והסביבה!
✅ בוחרים משלוחים מתי שרוצים
✅ גובים ישירות מהלקוח (מזומן או ביט)
✅ עושים שיווק ומרוויחים יותר: רק ${CONFIG.platform.networkPercent}% עמלה על משלוחים של עסקים שהבאתם (${CONFIG.platform.commissionPercent}% על השאר)
✅ ${CONFIG.pro.referrerPercent}% מהמנוי של HOP! Pro של עסקים שהחתמתם, והטיפים 100% שלכם
✅ בלי מנוי ובלי דמי הרשמה
דרוש: רישיון נהיגה בתוקף, רכב מבוטח (הצהרה בלבד), ארגז, עוסק פטור או מורשה.
👈 להרשמה: ${UI.appUrl("coursier.html")}` },

  { title: "Statut WhatsApp / bio Instagram", dir: "ltr", text:
`🛵 Coursier dans tout le Sharon · prix fixe · suivi en direct · espèces/Bit · ${url}
🛵 שליחויות בכל השרון · מחיר קבוע · מעקב בזמן אמת · מזומן/ביט` },

  { title: "Description Google Business Profile", dir: "ltr", text:
`${nameHe} | ${nameFr} – שירותי שליחויות בנתניה ובכל השרון: חבילות, מסמכים, איסוף מהדואר ומסופר-פארם, משלוחים למסעדות ולעסקים. מחיר קבוע, מעקב בזמן אמת, תשלום במזומן או בביט.
Coursier à Netanya et dans tout le Sharon : colis, documents, retrait à la poste et chez Super-Pharm, livraisons pour restaurants et commerces. Prix fixe, suivi en direct, espèces ou Bit. On parle français.` }
];

$("#posts").innerHTML = POSTS.map((p, i) => `
  <h3>${UI.esc(p.title)}</h3>
  <div class="post" id="post${i}" dir="${p.dir}">${UI.esc(p.text)}</div>
  <button class="btn btn-sm" data-copy="post${i}">Copier</button>
  <a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waShare(p.text)}">Partager sur WhatsApp</a>`).join("");

document.addEventListener("click", e => {
  const id = e.target.dataset && e.target.dataset.copy;
  if (!id) return;
  const text = document.getElementById(id).textContent;
  const done = () => { e.target.textContent = "Copié ✓"; };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
});

// Flyer bilingue imprimable
$("#flyer").innerHTML = `
  <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
    <div><img src="logo.svg" alt="" style="width:64px;height:64px;margin-bottom:6px"><h2>${UI.esc(nameFr)}</h2><h2 dir="rtl" style="font-family:Rubik,Arial">${UI.esc(nameHe)}</h2></div>
    <div class="qr" id="flyerQr"></div>
  </div>
  <div class="two">
    <div><b>Colis · Poste · Super-Pharm · Restaurants · Documents</b>
      <ul style="margin-top:8px">
        <li>Dans ${UI.esc(UI.cityFr(home))} : <b>${price(home)}</b></li>
        <li>→ Ra'anana : <b>${price("raanana")}</b></li>
        <li>→ Herzliya : <b>${price("herzliya")}</b></li>
        <li>→ Hadera : <b>${price("hadera")}</b></li>
      </ul></div>
    <div dir="rtl" style="font-family:Rubik,Arial"><b>חבילות · דואר · סופר-פארם · מסעדות · מסמכים</b>
      <ul style="margin-top:8px">
        <li>בתוך ${UI.esc(heHome)}: <b>${price(home)}</b></li>
        <li>לרעננה: <b>${price("raanana")}</b></li>
        <li>להרצליה: <b>${price("herzliya")}</b></li>
        <li>לחדרה: <b>${price("hadera")}</b></li>
      </ul></div>
  </div>
  <div class="two">
    <p><b>📍 Suivi en direct · 💵 Espèces / Bit</b><br><span style="font-size:19px">🎁 Première course dans ${UI.esc(UI.cityFr(home))} : <b>${welcome}</b> · code <b>BIENVENUE</b></span></p>
    <p dir="rtl" style="font-family:Rubik,Arial"><b>📍 מעקב בזמן אמת · 💵 מזומן / ביט</b><br><span style="font-size:19px">🎁 משלוח ראשון בתוך ${UI.esc(heHome)}: <b>${welcome}</b> · קוד <b>BRUCHIM</b></span></p>
  </div>
  <p style="margin-top:6px;font-size:18px"><b>Et hop, c'est livré ! · <span dir="rtl">הופ, וזה אצלך!</span></b></p>
  <p style="margin-top:10px">📞 <b dir="ltr">${UI.esc(CONFIG.phoneDisplay)}</b> · <span dir="ltr">${UI.esc(url)}</span></p>`;
if (window.QRCode) new QRCode($("#flyerQr"), { text: url, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });

})();
