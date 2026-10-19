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
const pickupFrom = UI.money(Pricing.cityToCity(CONFIG, home, home) + P.pickupPoint);

$("#appLink").textContent = url;
if (window.QRCode) new QRCode($("#qr"), { text: url, width: 164, height: 164, correctLevel: QRCode.CorrectLevel.M });

const featured = ["netanya", "even-yehuda", "hadera", "raanana", "kfar-saba", "herzliya", "tel-aviv", "ramat-gan", "petah-tikva"];
$("#kitPrices").innerHTML = `<tr><th>Trajet</th><th>Prix</th></tr>` + featured.map(id =>
  `<tr><td>${id === home ? "Dans " + UI.cityFr(home) : `${UI.cityFr(home)} ⇄ ${UI.cityFr(id)}`}</td><td><b>${price(id)}</b></td></tr>`).join("")
  + `<tr><td>Suppléments</td><td>express +${UI.money(P.express)} · poste/Super-Pharm +${UI.money(P.pickupPoint)} · achat +${UI.money(P.purchase)} · colis moyen +${UI.money(P.sizes.moyen)}</td></tr>`;

$("#kitOffers").innerHTML = [
  `<b>BIENVENUE</b> (français) / <b>BRUCHIM</b> (hébreu) : 1re course à -${PR.codes.BIENVENUE.percent} % (max ${UI.money(PR.codes.BIENVENUE.max)}).`,
  `<b>NETANYA</b> : -${UI.money(PR.codes.NETANYA.amount)} sur n'importe quelle course — à imprimer comme « bon de réduction » sur les flyers laissés chez les commerçants.`,
  `<b>Parrainage</b> : chaque client a son code ${PR.referral.prefix} + 4 chiffres (-${UI.money(PR.referral.amount)} pour le filleul ; offrez aussi ${UI.money(PR.referral.amount)} au parrain sur sa course suivante en ajustant le prix ✏️).`,
  `<b>Fidélité</b> : la ${PR.loyalty.every}e course est offerte automatiquement (max ${UI.money(PR.loyalty.max)}).`,
  ...PR.business.map(b => `<b>Pro</b> : ${UI.esc(b.fr)} — ${UI.esc(b.price)}`)
].map(x => `<li>${x}</li>`).join("");

const POSTS = [
  { title: "Post pour les groupes Facebook / WhatsApp (français)", dir: "ltr", text:
`🛵 Et hop, c'est livré ! Nouveau à ${UI.cityFr(home)} : ${nameFr}, le coursier francophone à prix fixe.

📦 Colis et documents
📮 Je récupère vos colis à la poste (fini la queue !)
💊 Commandes Super-Pharm, pharmacie
🍔 Livraisons pour les restaurants et commerces
🛒 J'achète pour vous et je livre

💰 Dans ${UI.cityFr(home)} : ${price(home)} · Ra'anana : ${price("raanana")} · Herzliya : ${price("herzliya")} · Tel Aviv : ${price("tel-aviv")}
📍 Vous suivez la course en direct sur la carte, comme sur Wolt
💵 Paiement en espèces ou par Bit

🎁 Votre 1re course à -50 % avec le code BIENVENUE
👉 Commandez en 1 minute : ${url}` },

  { title: "פוסט לקבוצות פייסבוק / וואטסאפ (עברית)", dir: "rtl", text:
`🛵 הופ, וזה אצלך! חדש ב${heHome}: ${nameHe}, משלוחים במחיר קבוע.

📦 חבילות ומסמכים
📮 איסוף חבילות מהדואר (בלי לעמוד בתור!)
💊 איסוף הזמנות מסופר-פארם ומבית המרקחת
🍔 משלוחים למסעדות ולעסקים
🛒 קונים בשבילכם ומביאים

💰 בתוך ${heHome}: ${price(home)} · לרעננה: ${price("raanana")} · להרצליה: ${price("herzliya")} · לתל אביב: ${price("tel-aviv")}
📍 מעקב אחרי השליח על המפה בזמן אמת, כמו בוולט
💵 תשלום במזומן או בביט

🎁 משלוח ראשון ב-50% הנחה עם הקוד BRUCHIM
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
✅ Seulement ${UI.money(CONFIG.platform.commissionPerCourse)} de commission par course, réglés une fois par semaine
✅ Pas d'abonnement, pas de frais d'inscription
Il faut : permis valide, véhicule assuré, statut d'עוסק פטור ou מורשה.
👉 Inscription : ${UI.appUrl("coursier.html")}` },

  { title: "גיוס שליחים (עברית)", dir: "rtl", text:
`🛵 ${nameHe} מגייסת שליחים עצמאיים ב${heHome} והסביבה!
✅ בוחרים משלוחים מתי שרוצים
✅ גובים ישירות מהלקוח (מזומן או ביט)
✅ רק ${UI.money(CONFIG.platform.commissionPerCourse)} עמלה למשלוח, תשלום פעם בשבוע
✅ בלי מנוי ובלי דמי הרשמה
דרוש: רישיון נהיגה בתוקף, רכב מבוטח, עוסק פטור או מורשה.
👈 להרשמה: ${UI.appUrl("coursier.html")}` },

  { title: "Statut WhatsApp / bio Instagram", dir: "ltr", text:
`🛵 Coursier ${UI.cityFr(home)} ⇄ Tel Aviv · prix fixe · suivi en direct · espèces/Bit · ${url}
🛵 שליח ${heHome} ⇄ תל אביב · מחיר קבוע · מעקב בזמן אמת · מזומן/ביט` },

  { title: "Description Google Business Profile", dir: "ltr", text:
`${nameHe} | ${nameFr} – שירותי שליחויות בנתניה, השרון ותל אביב: חבילות, מסמכים, איסוף מהדואר ומסופר-פארם, משלוחים למסעדות ולעסקים. מחיר קבוע, מעקב בזמן אמת, תשלום במזומן או בביט.
Coursier à Netanya, dans le Sharon et à Tel Aviv : colis, documents, retrait à la poste et chez Super-Pharm, livraisons pour restaurants et commerces. Prix fixe, suivi en direct, espèces ou Bit. On parle français.` }
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
        <li>→ Tel Aviv : <b>${price("tel-aviv")}</b></li>
      </ul></div>
    <div dir="rtl" style="font-family:Rubik,Arial"><b>חבילות · דואר · סופר-פארם · מסעדות · מסמכים</b>
      <ul style="margin-top:8px">
        <li>בתוך ${UI.esc(heHome)}: <b>${price(home)}</b></li>
        <li>לרעננה: <b>${price("raanana")}</b></li>
        <li>להרצליה: <b>${price("herzliya")}</b></li>
        <li>לתל אביב: <b>${price("tel-aviv")}</b></li>
      </ul></div>
  </div>
  <div class="two">
    <p><b>📍 Suivi en direct · 💵 Espèces / Bit</b><br><span style="font-size:19px">🎁 1re course <b>-50 %</b> : code <b>BIENVENUE</b></span></p>
    <p dir="rtl" style="font-family:Rubik,Arial"><b>📍 מעקב בזמן אמת · 💵 מזומן / ביט</b><br><span style="font-size:19px">🎁 משלוח ראשון <b>ב-50% הנחה</b>: קוד <b>BRUCHIM</b></span></p>
  </div>
  <p style="margin-top:6px;font-size:18px"><b>Et hop, c'est livré ! · <span dir="rtl">הופ, וזה אצלך!</span></b></p>
  <p style="margin-top:10px">📞 <b dir="ltr">${UI.esc(CONFIG.phoneDisplay)}</b> · <span dir="ltr">${UI.esc(url)}</span></p>`;
if (window.QRCode) new QRCode($("#flyerQr"), { text: url, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });

})();
