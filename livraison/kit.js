// ============================================================================
// Kit de lancement : lien, QR code, grille de prix, messages FR/HE prêts à copier, flyer.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const url = UI.appUrl();
// Lien des flyers et des textes clients : la page « Ce qu'on livre » (on-livre.html), pas la commande directement
const livre = new URL("on-livre.html", url).href, livreHe = livre + "?lang=he";
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
$("#livreLink").textContent = livre;
$("#livreLinkHe").textContent = livreHe;
// QR codes : la visite est comptée « flyer » dans les visites du site (panel patron)
if (window.QRCode) new QRCode($("#qr"), { text: livre + "?src=qr", width: 164, height: 164, correctLevel: QRCode.CorrectLevel.M });

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
  // Le carnet de courses seulement s'il est proposé (mis de côté par le patron) ; HOP! Pro avec son prix
  ...PR.business.filter(b => !b.carnet || CONFIG.partners.carnet.offered)
    .map(b => `<b>Pro</b> : ${UI.esc(b.fr)} — ${UI.esc(b.pro ? `${UI.money(CONFIG.pro.monthly)} / mois, 1er mois offert` : typeof b.price === "object" ? b.price.fr : b.price)}`)
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
👉 Tout ce qu'on livre (et commander en 1 minute) : ${livre}` },

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
👈 כל מה שאנחנו מביאים (ולהזמין תוך דקה): ${livreHe}` },

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
👉 ${livre}` },

  { title: "מיוחד לדואר (עברית)", dir: "rtl", text:
`📮 קיבלתם הודעה על חבילה בדואר ואין לכם זמן לעמוד בתור?
אנחנו אוספים בשבילכם ומביאים עד הבית, החל מ-${pickupFrom} בתוך העיר.
צריך רק ייפוי כוח חתום וצילום תעודת זהות.
👈 ${livreHe}` },

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
`🛵 Société de livraison dans tout le Sharon · prix fixe · suivi en direct · espèces/Bit · ${livre}
🛵 שליחויות בכל השרון · מחיר קבוע · מעקב בזמן אמת · מזומן/ביט` },

  { title: "Description Google Business Profile", dir: "ltr", text:
`${nameHe} | ${nameFr} – שירותי שליחויות בנתניה ובכל השרון: חבילות, מסמכים, איסוף מהדואר ומסופר-פארם, משלוחים למסעדות ולעסקים. מחיר קבוע, מעקב בזמן אמת, תשלום במזומן או בביט.
Société de livraison à Netanya et dans tout le Sharon : colis, documents, retrait à la poste et chez Super-Pharm, livraisons pour restaurants et commerces. Prix fixe, suivi en direct, espèces ou Bit. On parle français.` }
];

// Nouveaux partenaires (kit/nouveaux/partenaires.json) : les phrases à publier avec les visuels et les vidéos
const NEW_POSTS = [
  { title: "Nouveaux partenaires : post Facebook / WhatsApp (français)", dir: "ltr", text:
`🆕 Nouveau sur ${nameFr} : on vous livre maintenant vos adresses préférées à ${UI.cityFr(home)} !

🍣 Nina Sushi, Kikar HaAtsmaout · ✡️ casher
🍔 Paris Texas, Kiryat HaSharon · ✡️ casher
🍔 Smash It, smash burgers · ✡️ casher
🥐 Le Marché Français, l'épicerie française (Bonne Maman, LU, Président…)
🍕 Pizza Crush, rue David Remez · ✡️ casher

➕ Et des centaines d'autres enseignes : restaurants, Super-Pharm, poste, supermarchés…
🛵 Livraison dans ${UI.cityFr(home)} : ${price(home)} · suivi en direct · espèces ou Bit
👉 Tout ce qu'on livre (et commander en 1 minute) : ${livre}` },
  { title: "שותפים חדשים: פוסט לפייסבוק / וואטסאפ (עברית)", dir: "rtl", text:
`🆕 חדש ב${nameHe}: עכשיו מביאים לכם את המקומות שאתם אוהבים ב${heHome}!

🍣 נינה סושי, כיכר העצמאות · ✡️ כשר
🍔 פריז טקסס, קריית השרון · ✡️ כשר
🍔 סמאש איט, סמאש בורגרים · ✡️ כשר
🥐 השוק הצרפתי, מכולת צרפתית (בון מאמן, LU, פרזידנט…)
🍕 פיצה קראש, רחוב דוד רמז · ✡️ כשר

➕ ועוד מאות עסקים: מסעדות, סופר-פארם, דואר, סופרמרקטים…
🛵 משלוח בתוך ${heHome}: ${price(home)} · מעקב בזמן אמת · מזומן או ביט
👈 כל מה שאנחנו מביאים (ולהזמין תוך דקה): ${livreHe}` },
  { title: "Phrases courtes (story, statut, légende de vidéo)", dir: "ltr", text:
`🛵 Nina Sushi, Paris Texas, Smash It, Le Marché Français et Pizza Crush : maintenant livrés par ${nameFr} !
🍣🍔🥐🍕 Vos sushis, vos burgers et vos pizzas casher, vos produits français, livrés chez vous à ${UI.cityFr(home)} en un clic.
✡️ Nos restaurants casher sont marqués d'un sceau dans l'appli : facile à trouver.
🛵 נינה סושי, פריז טקסס, סמאש איט, השוק הצרפתי ופיצה קראש: עכשיו במשלוח עם ${nameHe}!
🍣🍔🥐🍕 הסושי, ההמבורגרים והפיצות הכשרים והמוצרים הצרפתיים שלכם, עד הבית ב${heHome} בלחיצה.
👉 ${livre}` }
];
// « On fait toutes vos courses » : textes qui vont avec les visuels et la vidéo des catégories
const COURSES_POSTS = [
  { title: "🛒 On fait toutes vos courses (français)", dir: "ltr", text:
`🛒 Pas le temps d'aller au magasin ? ${nameFr} fait toutes vos courses à ${UI.cityFr(home)} !

1️⃣ Ouvrez l'appli et touchez une catégorie
2️⃣ Écrivez ce qu'il vous faut (marque, taille, quantité)
3️⃣ Le livreur achète et vous livre, vous le suivez sur la carte

💊 Pharmacie · 🛒 Supérette · 🥐 Boulangerie · 🍔 Restaurants · 📮 Poste · 👔 Pressing · 💐 Fleurs · 👶 Bébé · 🐾 Animaux
🧾 Le prix réel du magasin + la livraison, 0 frais de service
👉 Tout ce qu'on livre : ${livre}` },
  { title: "🛒 אנחנו עושים את כל הקניות (עברית)", dir: "rtl", text:
`🛒 אין זמן ללכת לחנות? ${nameHe} עושים לכם את כל הקניות ב${heHome}!

1️⃣ פותחים את האפליקציה ובוחרים קטגוריה
2️⃣ כותבים מה צריך (מותג, גודל, כמות)
3️⃣ השליח קונה ומביא, ואתם עוקבים על המפה

💊 בית מרקחת · 🛒 מכולת · 🥐 מאפייה · 🍔 מסעדות · 📮 דואר · 👔 ניקוי יבש · 💐 פרחים · 👶 תינוקות · 🐾 חיות מחמד
🧾 המחיר האמיתי של החנות + המשלוח, 0 דמי שירות
👈 כל מה שאנחנו מביאים: ${livreHe}` }
];
// Commerces partenaires : la liste (même fichier que le générateur de visuels), et leurs textes FR / HE
const PARTNERS = [
  { code: "MARCHEFR", name: { fr: "Le Marché Français", he: "השוק הצרפתי" }, tagline: { fr: "L'épicerie française de Netanya : Bonne Maman, LU, Président, Andros…", he: "המכולת הצרפתית של נתניה: בון מאמן, LU, פרזידנט, אנדרוס…" },
    fr: `🥐 Le Marché Français vous livre !

Envie de produits français sans bouger de chez vous ? Bonne Maman, LU, Président, Andros, et toute l'épicerie fine du Marché Français : sa carte est maintenant dans l'appli ${nameFr}.
🛒 Commandez en 1 minute · 📍 suivez le livreur en direct · 💵 espèces ou Bit
🛵 Livraison dans ${UI.cityFr(home)} : ${price(home)}, livré au plus vite

👉 Commander chez Le Marché Français : ${url}?c=MARCHEFR`,
    he: `🥐 השוק הצרפתי מגיע אליכם!

בא לכם מוצרים צרפתיים בלי לצאת מהבית? בון מאמן, LU, פרזידנט, אנדרוס וכל המעדנייה של השוק הצרפתי: התפריט עכשיו באפליקציית ${nameHe}.
🛒 מזמינים תוך דקה · 📍 עוקבים אחרי השליח בזמן אמת · 💵 מזומן או ביט
🛵 משלוח בתוך ${heHome}: ${price(home)}, מגיע הכי מהר

👈 להזמין מהשוק הצרפתי: ${url}?c=MARCHEFR&lang=he`,
    short: `🥐 Le Marché Français vous livre ! Produits français, commandés en 1 minute, livrés au plus vite : ${url}?c=MARCHEFR
🥐 השוק הצרפתי מגיע אליכם! מוצרים צרפתיים, הזמנה תוך דקה, משלוח הכי מהר: ${url}?c=MARCHEFR&lang=he` }
];
const PARTNER_POSTS = PARTNERS.flatMap(p => [
  { title: `🏪 ${p.name.fr} vous livre ! (français)`, dir: "ltr", text: p.fr },
  { title: `🏪 ${p.name.he} מגיע אליכם! (עברית)`, dir: "rtl", text: p.he },
  { title: `🏪 ${p.name.fr} : phrases courtes (story, statut)`, dir: "ltr", text: p.short }
]);
// « L'appli évolue » et « Avant Chabbat » : textes qui vont avec les visuels
const VISITE_POSTS = [
  { title: "👀 L'appli évolue : pensez à nous visiter (français)", dir: "ltr", text:
`👀 Vous connaissez ${nameFr} ? L'appli évolue toutes les semaines !

🆕 De nouveaux commerces de ${UI.cityFr(home)} se rajoutent les uns après les autres : restaurants, épiceries, boulangeries, boutiques…
🛒 Leur carte est dans l'appli : vous commandez en 1 minute, le livreur vous apporte tout.
📍 Suivi en direct · 💵 Espèces ou Bit · 🧾 0 frais de service

👉 Pensez à nous visiter, il y a du nouveau : ${url}` },
  { title: "👀 האפליקציה מתפתחת: בואו לבקר אותנו (עברית)", dir: "rtl", text:
`👀 מכירים את ${nameHe}? האפליקציה מתפתחת כל שבוע!

🆕 עסקים חדשים מ${heHome} מצטרפים אחד אחרי השני: מסעדות, מכולות, מאפיות, חנויות…
🛒 התפריט שלהם באפליקציה: מזמינים תוך דקה, והשליח מביא הכול.
📍 מעקב בזמן אמת · 💵 מזומן או ביט · 🧾 0 דמי שירות

👈 בואו לבקר אותנו, יש חדש: ${url}?lang=he` },
  { title: "👀 Phrases courtes « L'appli évolue » (story, statut)", dir: "ltr", text:
`🆕 Du nouveau sur ${nameFr} : de nouveaux commerces chaque semaine. Pensez à nous visiter 👀 ${url}
🍣🍔🥐 Restaurants, épiceries, boulangeries de ${UI.cityFr(home)} : ils arrivent sur HOP! les uns après les autres.
🆕 חדש ב${nameHe}: עסקים חדשים כל שבוע. בואו לבקר אותנו 👀 ${url}?lang=he
🍣🍔🥐 מסעדות, מכולות ומאפיות ב${heHome} מצטרפות להופ! אחת אחרי השנייה.` }
];
const CHABBAT_POSTS = [
  { title: "🕯️ Courses de dernière minute avant Chabbat (français)", dir: "ltr", text:
`🕯️ Vendredi, courses de dernière minute avant Chabbat ?

Pas le temps de courir ? Dites-nous ce qu'il vous faut, on achète et on vous livre : vous préparez tranquille.
🥖 Hallot · 🍗 Poulet, viande · 🍷 Vin, jus de raisin · 💐 Fleurs · 🍰 Pâtisserie
🛒 Tous les magasins de ${UI.cityFr(home)}, même les petits : le prix réel du magasin + la livraison, 0 frais de service
📍 Suivi en direct · 💵 Espèces ou Bit

Chabbat chalom ! 🕯️ 👉 Commander en 1 minute : ${livre}` },
  { title: "🕯️ קניות של הרגע האחרון לפני שבת (עברית)", dir: "rtl", text:
`🕯️ יום שישי, קניות של הרגע האחרון לפני שבת?

אין זמן לרוץ? כתבו לנו מה צריך, אנחנו קונים ומביאים: ואתם מכינים בשקט.
🥖 חלות · 🍗 עוף, בשר · 🍷 יין, מיץ ענבים · 💐 פרחים · 🍰 קינוחים
🛒 כל החנויות ב${heHome}, גם הקטנות: המחיר האמיתי של החנות + המשלוח, 0 דמי שירות
📍 מעקב בזמן אמת · 💵 מזומן או ביט

שבת שלום! 🕯️ 👈 מזמינים תוך דקה: ${livreHe}` },
  { title: "🥖 Pensez à vos hallot ! (français)", dir: "ltr", text:
`🥖 Pensez à vos hallot !

Hallot fraîches de la boulangerie que vous aimez, livrées chez vous le vendredi. Et avec, le gâteau du Chabbat 😉
🥐 Viennoiseries · 🍪 Biscuits · 🍰 Gâteaux : écrivez votre liste, on passe la prendre.
🛵 Achat + livraison dans ${UI.cityFr(home)} : ${UI.money(Pricing.cityToCity(CONFIG, home, home) + P.purchase)}

Chabbat chalom ! 👉 ${livre}` },
  { title: "🥖 אל תשכחו את החלות! (עברית)", dir: "rtl", text:
`🥖 אל תשכחו את החלות!

חלות טריות מהמאפייה שאתם אוהבים, עד הבית ביום שישי. ועם זה, עוגה לשבת 😉
🥐 מאפים · 🍪 עוגיות · 🍰 עוגות: כתבו את הרשימה, אנחנו עוברים לקחת.
🛵 קנייה + משלוח בתוך ${heHome}: ${UI.money(Pricing.cityToCity(CONFIG, home, home) + P.purchase)}

שבת שלום! 👈 ${livreHe}` },
  { title: "🍷 Tout pour la table de Chabbat (français)", dir: "ltr", text:
`🍷 Tout pour la table de Chabbat, livré à votre porte.

Vin, fleurs, pâtisserie, salades et mezzés, épicerie : on fait vos courses dans tous les magasins de ${UI.cityFr(home)} et on livre le vendredi, jusqu'à la dernière minute.
🧾 Le prix réel du magasin + la livraison, 0 frais de service
📍 Suivi en direct · 💵 Espèces ou Bit

Chabbat chalom ! 🕯️ 👉 ${livre}` },
  { title: "🍷 הכול לשולחן השבת (עברית)", dir: "rtl", text:
`🍷 הכול לשולחן השבת, עד הדלת.

יין, פרחים, קינוחים, סלטים ומזה, מכולת: עושים לכם את הקניות בכל החנויות ב${heHome} ומביאים ביום שישי, עד הרגע האחרון.
🧾 המחיר האמיתי של החנות + המשלוח, 0 דמי שירות
📍 מעקב בזמן אמת · 💵 מזומן או ביט

שבת שלום! 🕯️ 👈 ${livreHe}` },
  { title: "🕯️ Phrases courtes « avant Chabbat » (story, statut, légende)", dir: "ltr", text:
`🕯️ Vendredi, pas le temps de courir ? On fait vos courses et on vous livre avant Chabbat. Chabbat chalom ! ${livre}
🥖 Vos hallot, livrées le vendredi. Pensez-y ! 😉
🍷 Vin, fleurs, gâteau : la table de Chabbat arrive par HOP!
🕯️ יום שישי, אין זמן לרוץ? אנחנו עושים לכם את הקניות ומביאים לפני שבת. שבת שלום! ${livreHe}
🥖 החלות שלכם, עד הבית ביום שישי. אל תשכחו! 😉
🍷 יין, פרחים, עוגה: שולחן השבת מגיע עם הופ!` }
];
// Pour qui est chaque texte de POSTS (dans l'ordre) : clients, commerces ou livreurs
const POST_AUD = ["client", "client", "shop", "shop", "client", "client", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "rider", "rider", "client", "client"];
const ALL_POSTS = PARTNER_POSTS.concat(CHABBAT_POSTS, VISITE_POSTS, COURSES_POSTS, NEW_POSTS).map(p => Object.assign({ aud: "client" }, p))
  .concat(POSTS.map((p, i) => Object.assign({ aud: POST_AUD[i] || "client" }, p)));

// Campagnes de visuels : chaque carte = un message, avec ses formats (post carré, story, flyer A5) et sa vidéo
const APP_URL = location.origin + location.pathname.replace(/[^/]*$/, "");
const CAPTION = {
  fr: `HOP! 🛵 Livraison à Netanya : restaurants, courses, colis… livrés au plus vite, encore chauds.\n👉 ${APP_URL}\n#Netanya #livraison #HOP`,
  he: `HOP! 🛵 משלוחים בנתניה: מסעדות, קניות, חבילות… מגיעים הכי מהר, עדיין חמים.\n👉 ${APP_URL}\n#נתניה #משלוחים #HOP`,
};
// Légende prête pour chaque campagne et chaque vidéo (Instagram, TikTok, Facebook) : copiée toute seule au moment de publier
const buyFr = UI.money(Pricing.cityToCity(CONFIG, home, home) + P.purchase), delFr = price(home);
const TAGS = { fr: "#Netanya #נתניה #livraison #HOP", he: "#נתניה #משלוחים #HOP #Netanya" };
const CAPS = {
  "partenaire-marchefr": {
    fr: `🥐 Le Marché Français chez vous !\nBonne Maman, LU, Président, Andros… toute l'épicerie française de Netanya, livrée avec HOP!\n🛵 Livraison à Netanya : ${delFr} · livré au plus vite\n📍 Suivi en direct · 💵 Espèces ou Bit\n👉 Commander : ${url}?c=MARCHEFR\n${TAGS.fr} #produitsfrançais`,
    he: `🥐 השוק הצרפתי מגיע אליכם הביתה!\nבון מאמן, LU, פרזידנט, אנדרוס… כל המכולת הצרפתית של נתניה, עד הבית עם HOP!\n🛵 משלוח בנתניה: ${delFr} · מגיע הכי מהר\n📍 מעקב בזמן אמת · 💵 מזומן או ביט\n👈 להזמנה: ${url}?c=MARCHEFR&lang=he\n${TAGS.he}` },
  "hoppy-magasins": {
    fr: `🛍️ On va dans vos magasins préférés !\nVêtements, chaussures, cadeaux, déco… Hoppy y va pour vous et vous les rapporte.\n🛒 Le prix du magasin + la livraison, 0 frais de service\n👉 ${livre}\n${TAGS.fr} #shopping`,
    he: `🛍️ הולכים בשבילכם לחנויות שאתם אוהבים!\nבגדים, נעליים, מתנות, עיצוב… הופי הולך ומביא לכם.\n🛒 מחיר החנות + משלוח, 0 ₪ דמי שירות\n👈 ${livreHe}\n${TAGS.he}` },
  "hoppy-fleurs": {
    fr: `💐 On livre aussi vos fleurs !\nAnniversaire, Chabbat ou juste pour dire merci : Hoppy arrive avec le bouquet.\n🛒 Le fleuriste de votre choix à Netanya, livré au plus vite\n👉 ${livre}\n${TAGS.fr} #fleurs`,
    he: `💐 מביאים גם פרחים!\nיום הולדת, שבת או סתם להגיד תודה: הופי מגיע עם הזר.\n🛒 חנות הפרחים שבחרתם בנתניה, הכי מהר\n👈 ${livreHe}\n${TAGS.he}` },
  hoppy: {
    fr: `🦘 Voici Hoppy, la mascotte HOP!\nIl saute partout dans Netanya et livre votre commande… dans sa poche !\n👉 ${APP_URL}\n${TAGS.fr}`,
    he: `🦘 תכירו את הופי, הקנגורו של HOP!\nקופץ בכל נתניה ומביא לכם את ההזמנה… בכיס!\n👈 ${APP_URL}?lang=he\n${TAGS.he}` },
  chabbat: {
    fr: `🕯️ Courses de dernière minute avant Chabbat ?\nDites-nous ce qu'il vous faut : on achète et on vous livre, vous préparez tranquillement.\n🥖 Hallot · 🍗 Poulet et viande · 🍷 Vin · 💐 Fleurs\n🛒 Achat + livraison à Netanya : ${buyFr}\n👉 ${livre}\nChabbat chalom ! ${TAGS.fr} #Chabbat`,
    he: `🕯️ קניות של הרגע האחרון לפני שבת?\nכתבו לנו מה צריך: אנחנו קונים ומביאים, ואתם מתכוננים בנחת.\n🥖 חלות · 🍗 עוף ובשר · 🍷 יין · 💐 פרחים\n🛒 קנייה ומשלוח בנתניה: ${buyFr}\n👈 ${livreHe}\nשבת שלום! ${TAGS.he} #שבת` },
  halot: {
    fr: `🥖 Vos hallot livrées pour Chabbat !\nHallot, gâteaux, biscuits et viennoiseries de la boulangerie que vous voulez.\n🛒 Achat + livraison à Netanya : ${buyFr} · le vendredi\n👉 ${livre}\n${TAGS.fr} #Chabbat #hallot`,
    he: `🥖 החלות שלכם מגיעות לשבת!\nחלות, עוגות, עוגיות ומאפים מהמאפייה שאתם אוהבים.\n🛒 קנייה ומשלוח בנתניה: ${buyFr} · ביום שישי\n👈 ${livreHe}\n${TAGS.he} #שבת #חלות` },
  table: {
    fr: `🍷 Tout pour votre table de Chabbat\nVin, fleurs, pâtisserie, salades : on fait vos courses à Netanya et on vous livre.\n🛒 Achat + livraison : ${buyFr} · vendredi jusqu'à la dernière minute\n📍 Suivi en direct · 💵 Espèces ou Bit\n👉 ${livre}\n${TAGS.fr} #Chabbat`,
    he: `🍷 כל מה שצריך לשולחן השבת\nיין, פרחים, עוגות, סלטים: עושים לכם את הקניות בנתניה ומביאים עד הבית.\n🛒 קנייה ומשלוח: ${buyFr} · ביום שישי, עד הרגע האחרון\n📍 מעקב בזמן אמת · 💵 מזומן או ביט\n👈 ${livreHe}\n${TAGS.he} #שבת` },
  courses: {
    fr: `🛒 Vous demandez, HOP! on livre.\nCourses, pharmacie, restaurants, colis et bien plus, dans tous les magasins de Netanya, même les petits.\n🧾 Le prix du magasin · 0 frais de service\n🛵 Achat + livraison à Netanya : ${buyFr}\n👉 ${livre}\n${TAGS.fr}`,
    he: `🛒 אתם מבקשים, HOP! מביאים.\nסופר, פארם, מסעדות, חבילות ועוד, מכל החנויות בנתניה, גם הקטנות.\n🧾 מחיר החנות · 0 ₪ דמי שירות\n🛵 קנייה ומשלוח בנתניה: ${buyFr}\n👈 ${livreHe}\n${TAGS.he}` },
  visite: {
    fr: `👀 L'appli HOP! évolue chaque semaine !\nDe nouveaux commerces de Netanya arrivent les uns après les autres : venez voir ce qu'il y a de nouveau.\n👉 ${APP_URL}\n${TAGS.fr}`,
    he: `👀 האפליקציה של HOP! מתפתחת כל שבוע!\nעסקים חדשים מנתניה מצטרפים אחד אחרי השני: בואו לראות מה חדש.\n👈 ${APP_URL}?lang=he\n${TAGS.he}` },
  nouveaux: {
    fr: `🆕 Nouveaux partenaires sur HOP! : Nina Sushi, Paris Texas, Smash It, Le Marché Français, Pizza Crush…\nLeur carte est dans l'appli : commandez en 1 minute, suivez le livreur en direct.\n👉 ${APP_URL}\n${TAGS.fr}`,
    he: `🆕 שותפים חדשים ב-HOP!: נינה סושי, פריז טקסס, סמאש איט, השוק הצרפתי, פיצה קראש…\nהתפריט שלהם באפליקציה: מזמינים בדקה, עוקבים אחרי השליח בזמן אמת.\n👈 ${APP_URL}?lang=he\n${TAGS.he}` },
  adopte: {
    fr: `💸 Arrête de payer plus cher. Adopte HOP!\nLe prix du resto, une livraison à prix fixe, 0 frais de service. Et ton plat arrive chaud.\n👉 ${APP_URL}\n${TAGS.fr}`,
    he: `💸 די לשלם יותר. עוברים ל-HOP!\nמחיר המסעדה, משלוח במחיר קבוע, 0 ₪ דמי שירות. והאוכל מגיע חם.\n👈 ${APP_URL}?lang=he\n${TAGS.he}` },
  tout: {
    fr: `🛍️ On livre TOUT, partout à Netanya !\nRestaurants, courses, pressing, colis, pharmacie, fleurs… vous demandez, HOP! on livre.\n👉 ${livre}\n${TAGS.fr}`,
    he: `🛍️ מביאים הכול, לכל נתניה!\nמסעדות, קניות, ניקוי יבש, חבילות, פארם, פרחים… אתם מבקשים, HOP! מביאים.\n👈 ${livreHe}\n${TAGS.he}` },
  cycle: {
    fr: `🔁 On commande, on suit, c'est livré… et votre plat arrive chaud.\nHOP!, la livraison de Netanya, au plus vite.\n👉 ${APP_URL}\n${TAGS.fr}`,
    he: `🔁 מזמינים, עוקבים, וזה כבר אצלכם… והאוכל מגיע חם.\nHOP!, המשלוחים של נתניה, הכי מהר.\n👈 ${APP_URL}?lang=he\n${TAGS.he}` },
};
const capFor = id => { const c = CAPS[id]; return (c && (c[ui.lang] || c.fr)) || CAPTION[ui.lang] || CAPTION.fr; };
const UPLOAD = [["Instagram", "https://www.instagram.com/"], ["TikTok", "https://www.tiktok.com/tiktokstudio/upload"], ["Facebook", "https://www.facebook.com/"]];
const V = "kit/visuels/";
const CAMPS = [
  // Commerces partenaires (kit/partenaire/liste.json) : « X vous livre ! » avec le vrai logo, post et story
  ...PARTNERS.map(p => ({ id: `partenaire-${p.code.toLowerCase()}`, aud: "client", isNew: true, title: `🏪 ${p.name.fr} vous livre !`, desc: `${p.tagline.fr} Le QR ouvre sa page dans l'appli.`, formats: ["post", "story"] })),
  { id: "hoppy-magasins", aud: "client", isNew: true, thumb: "post", title: "🛍️ Hoppy va dans vos magasins préférés", desc: "Vêtements, chaussures, cadeaux, déco… Hoppy vous les rapporte.", formats: ["post"] },
  { id: "hoppy-fleurs", aud: "client", isNew: true, thumb: "post", title: "💐 Hoppy livre aussi vos fleurs", desc: "Anniversaire, Chabbat ou juste pour dire merci : Hoppy arrive avec le bouquet. Le modèle de style pour tous les visuels réseaux.", formats: ["post"] },
  { id: "hoppy", aud: "client", isNew: true, title: "🦘 Notre mascotte : Hoppy (הופי)", thumb: "fiche", desc: "Le kangourou HOP! : l'image officielle (à joindre à ChatGPT pour chaque nouveau visuel, voir le prompt dans video/HOPPY.md) et Hoppy sans fond.", formats: ["fiche", "detoure"] },
  { id: "grille2", aud: "client", isNew: true, thumb: "apercu", title: "🔠 Grille Instagram, 2e rangée : ce qu'on fait", desc: "3 publications sous « H · O · P! » : Tout Netanya livré · Comment ça marche · Pourquoi HOP!. Publiez d'abord « Pourquoi », puis « Comment », puis « Tout Netanya ». Si « H · O · P! » est déjà en ligne : épinglez ensuite P!, puis O, puis H pour qu'ils restent en haut.", formats: ["g6", "g5", "g4"] },
  { id: "grille", aud: "client", isNew: true, thumb: "apercu", title: "🔠 Grille Instagram « H · O · P! »", desc: "3 publications qui forment le logo sur votre profil. Publiez dans cet ordre : d'abord P!, puis O, puis H (la dernière publiée se met à gauche).", formats: ["g3", "g2", "g1"] },
  { id: "chabbat", aud: "client", isNew: true, title: "🕯️ Courses de dernière minute avant Chabbat", desc: "Le vendredi : hallot, poulet, vin, fleurs… « Dites-nous ce qu'il vous faut, on achète et on livre. »", formats: ["post", "story", "flyer"] },
  { id: "halot", aud: "client", isNew: true, title: "🥖 Pensez à vos hallot !", desc: "Boulangerie livrée le vendredi : hallot tressées, gâteaux, biscuits, viennoiseries.", formats: ["post", "story", "flyer"] },
  { id: "table", aud: "client", isNew: true, title: "🍷 Tout pour la table de Chabbat", desc: "Vin, fleurs, pâtisserie, salades : courses dans tous les magasins de Netanya, livrées à la porte.", formats: ["post", "story", "flyer"] },
  { id: "visite", aud: "client", isNew: true, title: "👀 L'appli évolue : pensez à nous visiter", desc: "De nouveaux commerces se rajoutent chaque semaine : invitation à revenir voir l'appli. Le QR ouvre l'accueil.", formats: ["post", "story", "flyer"] },
  { id: "courses", aud: "client", title: "🛒 On fait toutes vos courses", desc: "Les catégories de l'appli en 3 étapes. Le QR ouvre « Ce qu'on livre ».", formats: ["post", "story", "flyer"], video: true },
  { id: "nouveaux", aud: "client", title: "🆕 Nouveaux partenaires", desc: "Nina Sushi, Paris Texas, Smash It, Le Marché Français, Pizza Crush, avec leurs vrais logos.", formats: ["post", "story"], video: true },
  { id: "client", aud: "client", title: "🎁 Première course à 15 ₪", desc: "Le message de lancement : prix, suivi en direct, espèces ou Bit.", formats: ["post", "story", "flyer"] },
  { id: "resto", aud: "shop", title: "🔥 Restaurants : « Gardez 100 % de vos ventes »", desc: "Le calcul qui fait réagir : 0 % de commission.", formats: ["post", "story", "flyer"] },
  { id: "pro", aud: "shop", title: "⚡ Tout commerce : « Vos clients veulent être livrés ? »", desc: "Un livreur en quelques minutes, sans contrat.", formats: ["post", "story", "flyer"] },
  { id: "quartier", aud: "shop", title: "🏪 Commerces de quartier", desc: "« Vendez aussi à ceux qui ne viennent pas » : pharmacie, fleuriste, pressing…", formats: ["post", "story", "flyer"] },
  { id: "relance", aud: "shop", title: "🤝 Relance après une visite", desc: "« On est passés vous voir ! » à laisser ou envoyer après le passage.", formats: ["post", "story", "flyer"] },
  { id: "shop", aud: "shop", title: "🏪 Votre commerce livre avec HOP!", desc: "La présentation générale pour les commerces.", formats: ["post", "story", "flyer"] },
  { id: "rider", aud: "rider", title: "🛵 Deviens livreur partenaire", desc: "Le recrutement : tu choisis tes courses, pourboires 100 % pour toi.", formats: ["post", "story", "flyer"] }
];
const FMT = { fiche: "🦘 Image officielle", detoure: "✂️ Sans fond (PNG)", post: "◻️ Post carré", story: "📱 Story", flyer: "🖨️ Flyer A5", g3: "1. Publier « P! »", g2: "2. Puis « O »", g1: "3. Puis « H »",
  g6: "1. « Pourquoi HOP! »", g5: "2. « Comment ça marche »", g4: "3. « Tout Netanya »" };
const VIDEOS = [
  // Le showreel HOP! (15 s) : pour tout le monde, en tête de chaque public
  // Nouveau : « On livre TOUT, partout à Netanya » (15 s)
  { id: "tout", aud: "client", title: "🛍️ Nouveau · On livre TOUT, partout à Netanya (15 s)" },
  { id: "tout", aud: "shop", title: "🛍️ Nouveau · On livre TOUT, partout à Netanya (15 s)" },
  // Nouveau : « Arrête de payer plus cher. Adopte HOP! » (15 s, fun)
  { id: "adopte", aud: "client", title: "💸 Nouveau · Arrête de payer plus cher. Adopte HOP! (15 s)" },
  // Nouveau : « Le cycle HOP! » (20 s en boucle, Insta / TikTok), en tête
  { id: "cycle", aud: "client", title: "🔁 Nouveau · Le cycle HOP! : livré au plus vite, encore chaud (20 s, en boucle)" },
  { id: "cycle", aud: "shop", title: "🔁 Nouveau · Le cycle HOP! : livré au plus vite, encore chaud (20 s, en boucle)" },
  { id: "showreel", aud: "client", title: "⚡ HOP! en 15 secondes" },
  { id: "showreel", aud: "shop", title: "⚡ HOP! en 15 secondes" },
  { id: "showreel", aud: "rider", title: "⚡ HOP! en 15 secondes" },
  // Survol 3D de la page d'accueil (format 5:4, pour Facebook, LinkedIn, présentation, site)
  { id: "survol", aud: "client", title: "🎥 La page HOP! en 3D", ratio: "5 / 4" },
  { id: "survol", aud: "shop", title: "🎥 La page HOP! en 3D", ratio: "5 / 4" },

  { id: "itineraire", aud: "client", title: "🗺️ Vite, suivi, simple : l'itinéraire HOP!" },
  { id: "itineraire", aud: "shop", title: "🗺️ Vite, suivi, simple : l'itinéraire HOP!" },
  { id: "paiement", aud: "client", title: "💳 Payé à la livraison : Bit, PayBox, espèces" },
  { id: "courses", aud: "client", title: "🛒 On fait toutes vos courses" },
  { id: "nouveaux", aud: "client", title: "🆕 Nouveaux partenaires" }
];

// Onglet, public et langue choisis : gardés sur ce téléphone
const UI_KEY = "livraison.kit.ui.v1";
const ui = (() => { try { return Object.assign({ tab: "visuels", aud: "client", lang: "fr" }, JSON.parse(localStorage.getItem(UI_KEY)) || {}); } catch (e) { return { tab: "visuels", aud: "client", lang: "fr" }; } })();
const TABS = ["visuels", "videos", "textes", "lien", "guide"];
if (TABS.includes(location.hash.slice(1))) ui.tab = location.hash.slice(1);
else if (location.hash === "#nouveaux") ui.tab = "visuels";
function renderKit() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* navigation privée */ }
  document.querySelectorAll("[data-ktab]").forEach(b => b.classList.toggle("on", b.dataset.ktab === ui.tab));
  document.querySelectorAll("[data-kpane]").forEach(p => p.classList.toggle("hidden", p.dataset.kpane !== ui.tab));
  document.querySelectorAll("[data-aud]").forEach(b => b.classList.toggle("on", b.dataset.aud === ui.aud));
  document.querySelectorAll("[data-klang]").forEach(b => b.classList.toggle("on", b.dataset.klang === ui.lang));
  $("#kitFilters").classList.toggle("hidden", !["visuels", "videos", "textes"].includes(ui.tab));
  // Les visuels portent la version de la page : un visuel refait est rechargé, pas repris du cache du téléphone
  const VQ = (() => { const sc = document.querySelector('script[src*="kit.js"]'); const m = sc && /v=(\d+)/.exec(sc.getAttribute("src") || ""); return m ? `?v=${m[1]}` : ""; })();
  const L = ui.lang, f = (id, fmt) => `${V}${id}-${fmt}-${L}.png${VQ}`;
  $("#kitCamps").innerHTML = CAMPS.filter(c => c.aud === ui.aud).map(c => `<div class="camp">
      <a class="camp-thumb" href="${f(c.id, c.thumb || "story")}" data-vis data-src="${f(c.id, c.thumb || "story")}"><img src="${f(c.id, c.thumb || "story")}" alt="" loading="lazy" />${c.isNew ? `<em class="camp-new">Nouveau</em>` : ""}</a>
      <div class="camp-info"><b>${UI.esc(c.title)}</b><small>${UI.esc(c.desc)}</small>
        <div class="camp-btns">${c.formats.map(x => `<a class="btn btn-sm" href="${x === "flyer" ? f(c.id, x).replace(/\.png(\?[^"]*)?$/, ".pdf$1") : f(c.id, x)}" data-vis data-src="${f(c.id, x)}">${FMT[x]}</a>`).join("")}
          ${c.video ? `<a class="btn btn-sm" href="${V}${c.id}-video-${L}.mp4${VQ}" target="_blank" rel="noopener">🎬 Vidéo</a>` : ""}
          ${c.formats.includes("post") ? shareBtn(f(c.id, "post"), `hop-${c.id}-post-${L}.png`, "📲 Publier le post", c.id) : ""}
          ${c.formats.includes("story") ? shareBtn(f(c.id, "story"), `hop-${c.id}-story-${L}.png`, "📲 Publier la story", c.id) : ""}</div>
        ${CAPS[c.id] ? `<details class="camp-cap"><summary>✍️ Sa légende (copiée toute seule en publiant)</summary><div class="post" id="cap-${c.id}" dir="${L === "he" ? "rtl" : "ltr"}">${UI.esc(capFor(c.id))}</div><button type="button" class="btn btn-sm btn-primary" data-copy="cap-${c.id}">Copier la légende</button></details>` : ""}</div></div>`).join("")
    || `<p class="muted small">Rien pour l'instant.</p>`;
  const vids = VIDEOS.filter(v => v.aud === ui.aud);
  $("#kitVideos").innerHTML = vids.map(v => `<figure${v.ratio ? ' class="wide"' : ""}><video src="${V}${v.id}-video-${L}.mp4${VQ}" controls playsinline preload="metadata"${v.ratio ? ` style="aspect-ratio:${v.ratio}"` : ""}></video>
      <figcaption><b>${UI.esc(v.title)}</b><span class="kshare-row">${shareBtn(`${V}${v.id}-video-${L}.mp4${VQ}`, `hop-${v.id}-${L}.mp4`, "", v.id)}<a class="btn btn-sm" href="${V}${v.id}-video-${L}.mp4${VQ}" download="hop-${v.id}-${L}.mp4">⬇ Enregistrer</a></span></figcaption></figure>`).join("")
    || `<p class="muted small">Pas encore de vidéo pour eux : les visuels sont dans l'onglet 🖼️.</p>`;
  // Les textes bilingues (statut, phrases courtes, fiche Google) apparaissent dans les deux langues
  const bi = p => p.dir === "ltr" && /[\u0590-\u05FF]/.test(p.text);
  const posts = ALL_POSTS.filter(p => p.aud === ui.aud && (bi(p) || (L === "he") === (p.dir === "rtl")));
  $("#posts").innerHTML = posts.map((p, i) => `<div class="kpost">
      <b>${UI.esc(p.title)}</b>
      <div class="post" id="post${i}" dir="${p.dir}">${UI.esc(p.text)}</div>
      <div class="kpost-btns"><button class="btn btn-sm btn-primary" data-copy="post${i}">Copier</button>
        ${navigator.share ? `<button class="btn btn-sm btn-share" data-share-text="post${i}">📲 Partager</button>` : ""}
        <a class="btn btn-sm btn-fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}" target="_blank" rel="noopener" data-fb-copy="post${i}">Facebook</a>
        <a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal("", p.text))}">Partager sur WhatsApp</a></div></div>`).join("")
    || `<p class="muted small">Pas de texte pour eux dans cette langue.</p>`;
}
document.addEventListener("click", e => {
  const tb = e.target.closest("[data-ktab]"), au = e.target.closest("[data-aud]"), lg = e.target.closest("[data-klang]");
  if (tb) { ui.tab = tb.dataset.ktab; history.replaceState(null, "", "#" + ui.tab); renderKit(); window.scrollTo({ top: 0 }); }
  if (au) { ui.aud = au.dataset.aud; renderKit(); }
  if (lg) { ui.lang = lg.dataset.klang; renderKit(); }
});
renderKit();

// --- Publier en direct sur Instagram, TikTok, Facebook (et WhatsApp…) ----------------------------------
// Sur téléphone : la feuille de partage du téléphone, avec le fichier déjà joint (Instagram Reels / Story,
// TikTok, Facebook, WhatsApp y apparaissent). Sur ordinateur, ces applis n'acceptent pas d'envoi depuis une
// page web : on enregistre le fichier et on ouvre leur page d'envoi. La légende est copiée pour être collée.
function shareBtn(url, name, label, cap) {
  return `<button type="button" class="btn btn-sm btn-share" data-share="${UI.esc(url)}" data-name="${UI.esc(name)}"${cap ? ` data-cap="${UI.esc(cap)}"` : ""}>${label || "📲 Insta · TikTok · Facebook"}</button>`;
}
const shareFiles = new Map();
const copyCaption = id => { try { navigator.clipboard && navigator.clipboard.writeText(capFor(id)).catch(() => {}); } catch (_) { /* rien */ } };
function shareHelp(btn, url, name, mobile) {
  const old = btn.parentElement.querySelector(".kshare-help");
  if (old) old.remove();
  const box = document.createElement("div");
  box.className = "kshare-help";
  box.innerHTML = mobile
    ? `Ce téléphone ne permet pas l'envoi direct : le fichier est enregistré. Ouvrez l'appli et choisissez-le dans votre galerie. <b>Légende copiée</b> : collez-la.`
    : `✓ Fichier enregistré, <b>légende copiée</b>. Ouvrez la page d'envoi, choisissez le fichier, collez la légende :
      <span>${UPLOAD.map(([n, u]) => `<a class="btn btn-sm" href="${u}" target="_blank" rel="noopener">${n}</a>`).join("")}</span>`;
  btn.insertAdjacentElement("afterend", box);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
async function shareMedia(btn) {
  const url = btn.dataset.share, name = btn.dataset.name;
  copyCaption(btn.dataset.cap);
  if (!navigator.share || !navigator.canShare) return shareHelp(btn, url, name, false);
  let file = shareFiles.get(url);
  const label = btn.dataset.label || btn.innerHTML;
  btn.dataset.label = label;
  if (!file) {
    btn.disabled = true; btn.textContent = "⏳ Préparation…";
    try {
      const blob = await (await fetch(url)).blob();
      file = new File([blob], name, { type: blob.type || (/\.mp4$/i.test(name) ? "video/mp4" : "image/png") });
      shareFiles.set(url, file);
    } catch (_) { btn.disabled = false; btn.innerHTML = label; return alert("Pas de connexion : réessayez."); }
    btn.disabled = false;
  }
  if (!navigator.canShare({ files: [file] })) { btn.innerHTML = label; return shareHelp(btn, url, name, true); }
  try { await navigator.share({ files: [file], text: capFor(btn.dataset.cap) }); btn.innerHTML = label; }
  catch (ex) {
    // Le téléchargement a pris trop de temps : le téléphone demande un 2e toucher pour ouvrir le partage
    if (ex && ex.name === "NotAllowedError") { btn.innerHTML = "📲 Publier maintenant"; btn.classList.add("ready"); }
    else btn.innerHTML = label;
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-share]");
  if (b) { e.preventDefault(); e.stopPropagation(); return shareMedia(b); }
  const t = e.target.closest("[data-share-text]");
  if (t) { const el = document.getElementById(t.dataset.shareText); if (el && navigator.share) navigator.share({ text: el.textContent }).catch(() => {}); return; }
  const fb = e.target.closest("[data-fb-copy]");
  if (fb) { const el = document.getElementById(fb.dataset.fbCopy); try { el && navigator.clipboard && navigator.clipboard.writeText(el.textContent).catch(() => {}); } catch (_) { /* rien */ } }
}, true);

// Visuels : ouverts en grand dans la page, avec Fermer / Enregistrer / Partager (plus de nouvel onglet sans retour)
function openVisual(a, qrName) {
  // QR code du kit (image générée dans la page) ou visuel prêt
  const img = a.querySelector("img") || a, canvas = a.querySelector("canvas");
  const src = a.dataset.src || (canvas && !(img.getAttribute("src") || "").startsWith("data:") ? canvas.toDataURL("image/png") : img.getAttribute("src"));
  const href = a.getAttribute("href") || src;
  const pdf = /\.pdf(\?|$)/i.test(href), name = qrName || src.split("/").pop().split("?")[0];
  const box = document.createElement("div");
  box.className = "vis-view";
  box.innerHTML = `<div class="vv-bar">
      <a class="btn btn-sm btn-primary" href="${src}" download="${name}">⬇ Enregistrer</a>
      ${pdf ? `<a class="btn btn-sm" href="${href}" download="${href.split("/").pop().split("?")[0]}">📄 PDF à imprimer</a>` : ""}
      ${pdf ? "" : shareBtn(src, name)}
      <button type="button" class="btn btn-sm" data-vv-close>✕ Fermer</button>
    </div>
    <img src="${src}" alt="" />`;
  box.addEventListener("click", async e => {
    if (e.target.closest("[data-vv-close]") || e.target === box) return history.back();
  });
  document.body.appendChild(box);
  history.pushState({ vis: 1 }, "");
  const back = () => { box.remove(); removeEventListener("popstate", back); };
  addEventListener("popstate", back);
}
document.addEventListener("click", e => {
  const v = e.target.closest(".vis-grid a, a[data-vis]");
  if (v) { e.preventDefault(); openVisual(v); }
  // QR codes (lien de l'appli et flyer) : aussi en grand, à enregistrer ou partager
  const q = e.target.closest("#qr, #flyerQr");
  if (q && q.querySelector("img, canvas")) openVisual(q, "hop-qr-code.png");
});

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
if (window.QRCode) new QRCode($("#flyerQr"), { text: livre + "?src=flyer", width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });

})();
