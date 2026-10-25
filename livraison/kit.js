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
// Numéro du patron dans les argumentaires (0XX-XXX-XXXX)
const bossTel = (d => d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d)("0" + String(CONFIG.whatsapp || "").replace(/^972/, ""));

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
`🛵 Et hop, c'est livré ! Nouveau à ${UI.cityFr(home)} : ${nameFr}, la société de livraison francophone à prix fixe.

📦 Colis et documents
📮 On récupère vos colis à la poste (fini la queue !)
💊 Commandes Super-Pharm, pharmacie
🍔 Livraisons pour les restaurants et commerces
🛒 On achète pour vous et on livre

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
`Bonjour, ici ${nameFr}, société de livraison à ${UI.cityFr(home)}.
Nous proposons aux commerces des livraisons à prix fixe (${price(home)} dans ${UI.cityFr(home)}), sans commission et sans engagement.
Votre client reçoit un lien pour suivre la livraison en direct, et paie en espèces ou par Bit.
Pour commander : ${url}
Au plaisir de travailler avec vous,
L'équipe ${nameFr}` },

  { title: "הודעה ישירה לבית עסק (עברית)", dir: "rtl", text:
`שלום, כאן ${nameHe}, חברת שליחויות ב${heHome}.
אנחנו מציעים לעסקים משלוחים במחיר קבוע (${price(home)} בתוך העיר), בלי עמלות ובלי התחייבות.
הלקוח שלכם מקבל קישור למעקב בזמן אמת, ומשלם במזומן או בביט.
להזמנה: ${url}
תודה,
צוות ${nameHe}` },

  { title: "Spécial poste (français)", dir: "ltr", text:
`📮 Un avis de passage de la poste et pas le temps de faire la queue ?
On récupère votre colis et on vous l'apporte à la maison, dès ${pickupFrom} dans ${UI.cityFr(home)}.
Il faut juste une procuration signée + la copie de la carte d'identité.
👉 ${url}` },

  { title: "מיוחד לדואר (עברית)", dir: "rtl", text:
`📮 קיבלתם הודעה על חבילה בדואר ואין לכם זמן לעמוד בתור?
אנחנו אוספים בשבילכם ומביאים עד הבית, החל מ-${pickupFrom} בתוך העיר.
צריך רק ייפוי כוח חתום וצילום תעודת זהות.
👈 ${url}` },

  { title: "Argumentaire pour un restaurant (français)", dir: "ltr", text:
`Bonjour ! Ici ${nameFr}, la société de livraison de ${UI.cityFr(home)}.
Avec HOP! :
• 0 % de commission sur vos commandes : vous payez seulement la course (${price(home)} dans ${UI.cityFr(home)}).
• Chaque commande part directement chez votre client, sans être groupée avec d'autres : elle arrive chaude.
• Votre client reçoit un lien pour suivre la livraison en direct.
• Paiement en espèces ou Bit, reçu à chaque course.
• En option, votre catalogue en ligne HOP! Pro (vos clients commandent chez vous) : abonnement de ${UI.money(CONFIG.pro.monthly)} par mois.
On commence quand vous voulez : ${url}` },

  { title: "טיעונים למסעדה (עברית)", dir: "rtl", text:
`שלום! כאן ${nameHe}, חברת השליחויות של ${heHome}.
איתנו:
• 0% עמלה על ההזמנות: משלמים רק על המשלוח (${price(home)} בתוך העיר).
• כל הזמנה יוצאת ישר ללקוח, בלי לאחד עם הזמנות אחרות: האוכל מגיע חם.
• הלקוח מקבל קישור למעקב בזמן אמת.
• תשלום במזומן או בביט, קבלה על כל משלוח.
• אפשרות נוספת: הקטלוג שלכם באפליקציה, HOP! Pro (הלקוחות מזמינים אצלכם): מנוי של ${UI.money(CONFIG.pro.monthly)} לחודש.
מתחילים מתי שתרצו: ${url}` },

  // --- Argumentaires « qui donnent envie d'appeler tout de suite » : un chiffre qui frappe, une offre claire, un appel ---
  { title: "🔥 Restaurant : le calcul qui fait réagir (français)", dir: "ltr", text:
`Bonjour ! Une question rapide : combien vous coûtent vraiment les grandes applis de livraison ?
Elles prennent souvent jusqu'à 30 % de chaque commande. Sur 100 commandes de 80 ₪ par mois, ça fait jusqu'à 2 400 ₪ qui partent chez elles, chaque mois.

Avec ${nameFr}, la société de livraison de ${UI.cityFr(home)} :
✅ 0 % de commission sur vos ventes. Ce que le client paie pour son repas reste chez vous.
✅ Livraison à prix fixe (${price(home)} dans ${UI.cityFr(home)}), connue d'avance. Vous choisissez : le client la paie, ou vous l'offrez.
✅ Une commande = un livreur, directement chez le client : pas de tournée, le plat arrive chaud.
✅ Le client suit son livreur en direct sur la carte : moins d'appels « ça arrive quand ? ».
✅ Vos clients restent VOS clients : votre lien et votre QR code, à votre nom.
✅ Sans engagement : vous arrêtez quand vous voulez.

On vous installe en 10 minutes, aujourd'hui.
📞 Appelez ou écrivez-nous : ${bossTel}
👉 ${url}` },

  { title: "🔥 מסעדה: החשבון שמזיז (עברית)", dir: "rtl", text:
`שלום! שאלה קצרה: כמה עולות לכם באמת אפליקציות המשלוחים הגדולות?
הן לוקחות לא פעם עד 30% מכל הזמנה. על 100 הזמנות של 80 ₪ בחודש, זה עד 2,400 ₪ שהולכים אליהן, כל חודש.

עם ${nameHe}, חברת השליחויות של ${heHome}:
✅ 0% עמלה על המכירות. מה שהלקוח משלם על האוכל נשאר אצלכם.
✅ משלוח במחיר קבוע (${price(home)} בתוך העיר), ידוע מראש. אתם בוחרים: הלקוח משלם, או שאתם מפנקים.
✅ הזמנה אחת = שליח אחד, ישר ללקוח: בלי סבבים, האוכל מגיע חם.
✅ הלקוח רואה את השליח על המפה בזמן אמת: פחות טלפונים של "מתי זה מגיע?".
✅ הלקוחות שלכם נשארים שלכם: קישור וקוד QR על השם שלכם.
✅ בלי התחייבות: מפסיקים מתי שרוצים.

מתקינים לכם תוך 10 דקות, כבר היום.
📞 התקשרו או כתבו לנו: ${bossTel}
👈 ${url}` },

  { title: "⚡ Message WhatsApp court, n'importe quel commerce (français)", dir: "ltr", text:
`Bonjour 👋 ici ${nameFr}, livraison à ${UI.cityFr(home)}.
Vos clients veulent être livrés ? Nous livrons pour vous à prix fixe (${price(home)} dans la ville), sans aucune commission sur vos ventes, avec suivi en direct pour le client.
Un livreur chez vous en quelques minutes, sans contrat.
On en parle 2 minutes ? 📞 ${bossTel}` },

  { title: "⚡ הודעת וואטסאפ קצרה, לכל עסק (עברית)", dir: "rtl", text:
`שלום 👋 כאן ${nameHe}, שליחויות ב${heHome}.
הלקוחות שלכם רוצים משלוח? אנחנו מביאים בשבילכם במחיר קבוע (${price(home)} בתוך העיר), בלי שום עמלה על המכירות, עם מעקב בזמן אמת ללקוח.
שליח אצלכם תוך דקות, בלי חוזה.
מדברים 2 דקות? 📞 ${bossTel}` },

  { title: "🏪 Commerce de quartier : pharmacie, fleuriste, pressing, boutique (français)", dir: "ltr", text:
`Bonjour ! Combien de clients repartent les mains vides parce qu'ils ne peuvent pas revenir chercher leur commande ?
Avec ${nameFr}, vous vendez aussi à ceux qui ne se déplacent pas :
📦 Une commande prête ? Un livreur la porte chez le client, à prix fixe (${price(home)} dans ${UI.cityFr(home)}).
👔 Pressing : on vient chercher les vêtements chez le client et on les ramène.
💊 Pharmacie, fleurs, cadeaux : livré le jour même, souvent en moins d'une heure.
📍 Le client suit la livraison en direct, vous n'avez rien à gérer.
💰 0 % de commission, pas d'abonnement, pas de minimum.
En option, votre boutique en ligne dans l'appli HOP! (vos clients commandent chez vous, avec vos photos et vos prix) : ${UI.money(CONFIG.pro.monthly)} par mois.

Essayez dès votre prochaine commande : 📞 ${bossTel}
👉 ${url}` },

  { title: "🏪 עסק שכונתי: בית מרקחת, פרחים, ניקוי יבש, חנות (עברית)", dir: "rtl", text:
`שלום! כמה לקוחות הולכים בלי לקנות כי הם לא יכולים לחזור לאסוף?
עם ${nameHe} אתם מוכרים גם למי שלא מגיע:
📦 הזמנה מוכנה? שליח מביא אותה ללקוח, במחיר קבוע (${price(home)} בתוך העיר).
👔 ניקוי יבש: אוספים את הבגדים מהלקוח ומחזירים אותם.
💊 בית מרקחת, פרחים, מתנות: באותו יום, לרוב תוך פחות משעה.
📍 הלקוח עוקב אחרי המשלוח בזמן אמת, אתם לא צריכים לנהל כלום.
💰 0% עמלה, בלי מנוי, בלי מינימום.
אופציה: החנות שלכם באפליקציה HOP! (הלקוחות מזמינים אצלכם, עם התמונות והמחירים שלכם): ${UI.money(CONFIG.pro.monthly)} לחודש.

נסו כבר בהזמנה הבאה: 📞 ${bossTel}
👈 ${url}` },

  { title: "🤝 Relance après une visite (français)", dir: "ltr", text:
`Bonjour, c'est ${nameFr}, on est passés vous voir pour la livraison.
Pour rappel : 0 % de commission sur vos ventes, livraison à prix fixe (${price(home)} dans ${UI.cityFr(home)}), un livreur dédié à chaque commande, et vos clients qui suivent leur commande en direct.
Le plus simple : votre prochaine commande à livrer, vous nous appelez, et vous jugez sur pièce.
📞 ${bossTel} · 👉 ${url}` },

  { title: "🤝 תזכורת אחרי ביקור (עברית)", dir: "rtl", text:
`שלום, כאן ${nameHe}, עברנו אצלכם לגבי משלוחים.
להזכירכם: 0% עמלה על המכירות, משלוח במחיר קבוע (${price(home)} בתוך העיר), שליח לכל הזמנה, והלקוחות עוקבים אחרי ההזמנה בזמן אמת.
הכי פשוט: בהזמנה הבאה שצריך להביא, מתקשרים אלינו ושופטים בעצמכם.
📞 ${bossTel} · 👈 ${url}` },

  { title: "Recruter des livreurs (français)", dir: "ltr", text:
`🛵 ${nameFr} recrute des livreurs indépendants à ${UI.cityFr(home)} et environs !
✅ Vous choisissez vos courses, quand vous voulez
✅ Le client vous paie directement (espèces, Bit ou PayBox)
${CONFIG.partners.courierProgram ? `✅ Faites votre marketing, gagnez plus : seulement ${CONFIG.platform.networkPercent} % de commission sur les courses des commerces que vous amenez (${CONFIG.platform.commissionPercent} % sur les autres)\n` : `✅ Commission HOP : ${CONFIG.platform.commissionPercent} % de la course\n`}✅ ${CONFIG.pro.referrerPercent ? `${CONFIG.pro.referrerPercent} % des abonnements HOP! Pro que vous faites signer, et les pourboires` : "Les pourboires"} 100 % pour vous
✅ Pas d'abonnement, pas de frais d'inscription
Il faut : permis valide, véhicule assuré (simple déclaration), un top case, statut d'עוסק פטור ou מורשה.
👉 Inscription : ${UI.appUrl("livreur/")}` },

  { title: "גיוס שליחים (עברית)", dir: "rtl", text:
`🛵 ${nameHe} מגייסת שליחים עצמאיים ב${heHome} והסביבה!
✅ בוחרים משלוחים מתי שרוצים
✅ הלקוח משלם לכם ישירות (מזומן, ביט או פייבוקס)
${CONFIG.partners.courierProgram ? `✅ עושים שיווק ומרוויחים יותר: רק ${CONFIG.platform.networkPercent}% עמלה על משלוחים של עסקים שהבאתם (${CONFIG.platform.commissionPercent}% על השאר)\n` : `✅ עמלת הופ: ${CONFIG.platform.commissionPercent}% מהמשלוח\n`}✅ ${CONFIG.pro.referrerPercent ? `${CONFIG.pro.referrerPercent}% מהמנוי של HOP! Pro של עסקים שהחתמתם, והטיפים` : "הטיפים"} 100% שלכם
✅ בלי מנוי ובלי דמי הרשמה
דרוש: רישיון נהיגה בתוקף, רכב מבוטח (הצהרה בלבד), ארגז, עוסק פטור או מורשה.
👈 להרשמה: ${UI.appUrl("livreur/")}` },

  { title: "Statut WhatsApp / bio Instagram", dir: "ltr", text:
`🛵 Société de livraison dans tout le Sharon · prix fixe · suivi en direct · espèces/Bit · ${url}
🛵 שליחויות בכל השרון · מחיר קבוע · מעקב בזמן אמת · מזומן/ביט` },

  { title: "Description Google Business Profile", dir: "ltr", text:
`${nameHe} | ${nameFr} – שירותי שליחויות בנתניה ובכל השרון: חבילות, מסמכים, איסוף מהדואר ומסופר-פארם, משלוחים למסעדות ולעסקים. מחיר קבוע, מעקב בזמן אמת, תשלום במזומן או בביט.
Société de livraison à Netanya et dans tout le Sharon : colis, documents, retrait à la poste et chez Super-Pharm, livraisons pour restaurants et commerces. Prix fixe, suivi en direct, espèces ou Bit. On parle français.` }
];

$("#posts").innerHTML = POSTS.map((p, i) => `
  <h3>${UI.esc(p.title)}</h3>
  <div class="post" id="post${i}" dir="${p.dir}">${UI.esc(p.text)}</div>
  <button class="btn btn-sm" data-copy="post${i}">Copier</button>
  <a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal("", p.text))}">Partager sur WhatsApp</a>`).join("");

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
