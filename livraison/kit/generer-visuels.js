// Génère les visuels de lancement (posts, stories, flyers) en PNG et PDF
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
// Usage : node generer-visuels.js <dossier des polices et de qrcodejs> (voir README)
const L = process.argv[2] || __dirname + '/libs', OUT = __dirname + '/visuels';
const APP = 'https://hop-livraison.vercel.app/';
// QR des visuels clients : d'abord la page « Ce qu'on livre » (pas la commande directement), dans la langue du visuel
const ON_LIVRE = lang => APP + 'on-livre.html' + (lang === 'he' ? '?lang=he' : '');
// Numéro du patron sur les visuels « argumentaires » (config.js : whatsapp)
const TEL = (d => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`)('0' + fs.readFileSync(__dirname + '/../config.js', 'utf8').match(/whatsapp:\s*"972(\d+)"/)[1]);
// Polices intégrées (les fichiers locaux ne se chargent pas depuis une page générée)
const font = (fam, file, w, range) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(`${L}/${fam === 'Fredoka' ? 'fr' : 'ru'}/package/files/${file}`).toString('base64')}) format('woff2');unicode-range:${range}}`;
const LAT = 'U+0000-024F,U+20AA,U+2013-2019,U+00A0', HEB = 'U+0590-05FF';
const FONTS = [
  font('Fredoka', 'fredoka-latin-700-normal.woff2', 700, LAT), font('Fredoka', 'fredoka-hebrew-700-normal.woff2', 700, HEB),
  font('Fredoka', 'fredoka-latin-600-normal.woff2', 600, LAT), font('Fredoka', 'fredoka-hebrew-600-normal.woff2', 600, HEB),
  font('Rubik', 'rubik-latin-400-normal.woff2', 400, LAT), font('Rubik', 'rubik-hebrew-400-normal.woff2', 400, HEB),
  font('Rubik', 'rubik-latin-700-normal.woff2', 700, LAT), font('Rubik', 'rubik-hebrew-700-normal.woff2', 700, HEB),
  font('Rubik', 'rubik-latin-800-normal.woff2', 800, LAT), font('Rubik', 'rubik-hebrew-800-normal.woff2', 800, HEB)
].join('\n');
const LOGO = fs.readFileSync(__dirname + '/../logo.svg', 'utf8');
const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const SCOOTER = idx.slice(idx.indexOf('<svg class="scooter"'), idx.indexOf('</svg>', idx.indexOf('<svg class="scooter"')) + 6).replace('class="scooter"', 'class="scoot"');
const CSS = `${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Rubik,Arial,sans-serif;color:#fff}
.page{position:relative;overflow:hidden;background:radial-gradient(120% 80% at 80% 0%,#24407A 0%,#0F1F3D 55%,#0A1630 100%);display:flex;flex-direction:column}
.he{direction:rtl}
.top{display:flex;align-items:center;gap:22px}
.top .lg{width:110px;height:110px}.top .lg svg{width:100%;height:100%}
.wm{font-family:Fredoka;font-weight:700;font-size:96px;line-height:1;letter-spacing:1px}
.wm i{font-style:normal;color:#FF6A13;display:inline-block;transform:rotate(10deg)}
.wm small{display:block;font-family:Rubik;font-weight:700;font-size:26px;letter-spacing:8px;opacity:.75;margin-top:6px}
.he .wm small{letter-spacing:2px}
h1{font-family:Fredoka;font-weight:700;line-height:1.02}
h1 em{font-style:normal;color:#FF6A13}
.sub{font-weight:700;opacity:.9}
.chips{display:flex;flex-wrap:wrap;gap:14px}
.chip{background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.18);border-radius:99px;padding:12px 24px;font-weight:700}
.price{background:#fff;color:#0F1F3D;border-radius:36px;padding:26px 34px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.price>span{white-space:nowrap}.price>span:first-child{white-space:normal}
.scoot{direction:ltr}
.price b{font-family:Fredoka;font-weight:700;color:#FF6A13;line-height:1}
.price s{color:#98A2B3;font-weight:700}
.badge{background:#FF6A13;color:#fff;border-radius:22px;padding:12px 22px;font-family:Fredoka;font-weight:700;white-space:nowrap}
.qrbox{background:#fff;border-radius:28px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px;color:#0F1F3D;font-weight:800}
.qrbox canvas,.qrbox img{display:block}
.foot{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.url{font-weight:700;opacity:.75;direction:ltr}
.scoot{position:absolute}
.road{position:absolute;left:0;right:0;border-bottom:6px dashed rgba(255,255,255,.18)}
ul.ok{list-style:none;display:grid;gap:16px}
ul.ok li{font-weight:700}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex-shrink:0}
.steps span{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.16);border-radius:24px;padding:8px 14px 8px 8px;font-weight:700;line-height:1.15}
.he .steps span{padding:8px 8px 8px 14px}
.steps b{flex:none;display:grid;place-items:center;width:1.7em;height:1.7em;border-radius:50%;background:#FF6A13;font-family:Fredoka}
.cgrid{display:grid;gap:18px;flex:1;min-height:0;grid-auto-rows:1fr}
.foot,.top,h1{flex-shrink:0}
.ctile{position:relative;background:#fff;border-radius:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#0F1F3D;text-align:center;padding:10px;box-shadow:0 14px 30px rgba(0,0,0,.28)}
.ctile b{font-family:Rubik;font-weight:800;line-height:1.1}
.ctile .cart{height:62%;aspect-ratio:1;display:grid;place-items:center;border-radius:26px;background:radial-gradient(circle at 30% 25%,hsl(var(--h) 100% 97%),hsl(var(--h) 85% 84%) 70%)}
.ctile .cart img{width:80%;height:80%;object-fit:contain;filter:drop-shadow(0 8px 10px hsl(var(--h) 60% 30% / .3))}
.ctile.tap{outline:6px solid #FF6A13;outline-offset:-6px;transform:scale(1.04)}
.finger{position:absolute;font-style:normal;font-size:64px;bottom:-26px;right:-6px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))}
.page.sh{background:radial-gradient(120% 80% at 85% 0%,#5B2D8E 0%,#231A4F 45%,#0A1630 100%)}
.page.sh:before{content:"";position:absolute;inset:auto -20% -30% -20%;height:55%;background:radial-gradient(50% 50% at 50% 50%,rgba(255,184,77,.28),transparent 70%)}
.page.sh>*{position:relative}
.page.sh>.candles{position:absolute;top:30px;inset-inline-end:44px;font-style:normal;line-height:1.25;filter:drop-shadow(0 0 28px rgba(255,184,77,.65));opacity:.95}
.kick{display:inline-flex;align-self:flex-start;align-items:center;gap:12px;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.22);color:#fff;font-family:Fredoka;font-weight:700;border-radius:99px;padding:8px 24px}
.page.sh h1 em{color:#FFC46B}
.badge.gold{background:linear-gradient(135deg,#FFB84D,#FF8A2B);color:#2A1A05}
.page.sh .ctile{box-shadow:0 14px 30px rgba(0,0,0,.35)}
.he .finger{right:auto;left:-6px}
`;
const qr = (id, size) => `<div class="qrbox"><div id="${id}"></div><span style="font-size:${Math.round(size / 9)}px">{{scan}}</span></div>`;
// --- Contenus ------------------------------------------------------------------------
const T = {
  client: {
    fr: { h1: 'Et hop,<br><em>c\'est livré !</em>', sub: 'Colis · Poste · Super-Pharm · Restaurants · Courses', chips: ['🛵 Dans tout le Sharon', '📍 Suivi en direct', '💵 Espèces ou Bit', '🧾 0 frais cachés'],
      price: '<span>Course dans Netanya</span><span><s>25 ₪</s> <b>15 ₪</b></span>', badge: '🎁 Première course', scan: 'Tout ce qu\'on livre', url: 'Commandez en 1 minute' },
    he: { h1: 'הופ,<br><em>וזה אצלך!</em>', sub: 'חבילות · דואר · סופר-פארם · מסעדות · קניות', chips: ['🛵 בכל השרון', '📍 מעקב בזמן אמת', '💵 מזומן או ביט', '🧾 0 עמלות נסתרות'],
      price: '<span>משלוח בתוך נתניה</span><span><s>25 ₪</s> <b>15 ₪</b></span>', badge: '🎁 משלוח ראשון', scan: 'כל מה שאנחנו מביאים', url: 'מזמינים תוך דקה' },
    link: ON_LIVRE
  },
  shop: {
    fr: { h1: 'Votre commerce<br><em>livre avec HOP!</em>', sub: 'Restaurants · Boutiques · Pharmacies · Bureaux', chips: ['💸 0 % sur vos ventes', '🛵 Le livreur arrive quand c\'est prêt', '📱 Votre QR pour vos clients', '🧾 Reçu pour chaque course'],
      price: '<span>Course dans Netanya</span><span><b>25 ₪</b></span>', badge: '⭐ Catalogue HOP! Pro : 299 ₪ / mois', scan: 'Inscription gratuite', url: 'Votre espace pro en 1 minute' },
    he: { h1: 'העסק שלכם<br><em>שולח עם הופ!</em>', sub: 'מסעדות · חנויות · בתי מרקחת · משרדים', chips: ['💸 0% עמלה על המכירות', '🛵 השליח מגיע כשמוכן', '📱 קוד QR ללקוחות שלכם', '🧾 קבלה על כל משלוח'],
      price: '<span>משלוח בתוך נתניה</span><span><b>25 ₪</b></span>', badge: '⭐ קטלוג אונליין: 299 ₪ לחודש', scan: 'הרשמה בחינם', url: 'אזור עסקי תוך דקה' },
    link: APP + 'commerce.html?inscription=1'
  },
  rider: {
    fr: { h1: 'Deviens livreur<br><em>partenaire HOP!</em>', sub: 'Scooter, voiture ou vélo · Netanya et le Sharon', chips: ['✅ Tu choisis tes courses', '🟢 En ligne quand tu veux', '💝 Pourboires 100 % pour toi', '🔔 Ça sonne même écran éteint'],
      price: '<span>Commission HOP</span><span><b>15 %</b></span>', badge: '🛵 Pas d\'abonnement', scan: 'Inscris-toi', url: 'Permis, top case, עוסק' },
    he: { h1: 'בואו להיות<br><em>שליחים בהופ!</em>', sub: 'קטנוע, רכב או אופניים · נתניה והשרון', chips: ['✅ בוחרים את המשלוחים', '🟢 מתחברים מתי שרוצים', '💝 הטיפים 100% שלכם', '🔔 מצלצל גם כשהמסך כבוי'],
      price: '<span>עמלת הופ</span><span><b>15%</b></span>', badge: '🛵 בלי מנוי', scan: 'להרשמה', url: 'רישיון, ארגז, עוסק' },
    link: APP + 'coursier.html'
  },
  // Argumentaires « qui font appeler » : un chiffre qui frappe, une offre claire, le numéro du patron
  resto: {
    fr: { h1: 'Gardez <em>100&nbsp;%</em><br>de vos ventes', sub: 'Les grandes applis prennent jusqu\'à 30 % par commande. HOP! : 0 %.', chips: ['💸 0 % de commission', '🛵 1 commande = 1 livreur', '🔥 Le plat arrive chaud', '📍 Suivi en direct', '🤝 Sans engagement'],
      price: '<span>Commission sur 100 commandes de 80 ₪</span><span><s>2 400 ₪</s> <b>0 ₪</b></span>', badge: '📞 ' + TEL, scan: 'Installé en 10 min', url: 'Appelez-nous aujourd\'hui' },
    he: { h1: 'שומרים <em>100%</em><br>מהמכירות', sub: 'האפליקציות הגדולות לוקחות עד 30% מכל הזמנה. הופ!: 0%.', chips: ['💸 0% עמלה', '🛵 הזמנה אחת = שליח אחד', '🔥 האוכל מגיע חם', '📍 מעקב בזמן אמת', '🤝 בלי התחייבות'],
      price: '<span>עמלה על 100 הזמנות של 80 ₪</span><span><s>2,400 ₪</s> <b>0 ₪</b></span>', badge: '📞 ' + TEL, scan: 'מותקן תוך 10 דקות', url: 'התקשרו אלינו היום' },
    link: APP + 'commerce.html?inscription=1', hs: 0.74, hsPost: 1.1, postChips: 3
  },
  pro: {
    fr: { h1: 'Vos clients veulent<br><em>être livrés ?</em>', sub: 'Restaurants · Boutiques · Pharmacies · Pressings', chips: ['🛵 Un livreur en quelques minutes', '💸 0 % sur vos ventes', '📍 Suivi en direct pour le client', '📝 Sans contrat'],
      price: '<span>Livraison dans Netanya, prix fixe</span><span><b>25 ₪</b></span>', badge: '📞 ' + TEL, scan: 'On en parle 2 min ?', url: 'Connu d\'avance, sans surprise' },
    he: { h1: 'הלקוחות שלכם<br><em>רוצים משלוח?</em>', sub: 'מסעדות · חנויות · בתי מרקחת · ניקוי יבש', chips: ['🛵 שליח תוך דקות', '💸 0% עמלה על המכירות', '📍 מעקב בזמן אמת ללקוח', '📝 בלי חוזה'],
      price: '<span>משלוח בתוך נתניה, מחיר קבוע</span><span><b>25 ₪</b></span>', badge: '📞 ' + TEL, scan: 'מדברים 2 דקות?', url: 'ידוע מראש, בלי הפתעות' },
    link: APP + 'commerce.html?inscription=1', hs: 0.66, hsPost: 1.22, postChips: 3
  },
  quartier: {
    fr: { h1: 'Vendez aussi à ceux<br><em>qui ne viennent pas</em>', sub: 'Pharmacie · Fleuriste · Pressing · Boutique', chips: ['📦 Livré le jour même', '👔 Pressing : on récupère et on ramène', '💰 0 % · pas d\'abonnement', '📍 Le client suit sa livraison'],
      price: '<span>Livraison dans Netanya</span><span><b>25 ₪</b></span>', badge: '📞 ' + TEL, scan: 'Dès votre prochaine commande', url: 'Boutique en ligne en option : 299 ₪ / mois' },
    he: { h1: 'מוכרים גם למי<br><em>שלא מגיע</em>', sub: 'בית מרקחת · פרחים · ניקוי יבש · חנות', chips: ['📦 משלוח באותו יום', '👔 ניקוי יבש: אוספים ומחזירים', '💰 0% · בלי מנוי', '📍 הלקוח עוקב אחרי המשלוח'],
      price: '<span>משלוח בתוך נתניה</span><span><b>25 ₪</b></span>', badge: '📞 ' + TEL, scan: 'כבר בהזמנה הבאה', url: 'חנות אונליין באופציה: 299 ₪ לחודש' },
    link: APP + 'commerce.html?inscription=1', hs: 0.6, hsPost: 1.23, postChips: 2
  },
  relance: {
    fr: { h1: 'On est passés<br><em>vous voir !</em>', sub: 'Votre prochaine commande à livrer : appelez-nous et jugez vous-même.', chips: ['💸 0 % de commission', '🛵 1 livreur par commande', '📍 Suivi en direct', '📝 Sans contrat'],
      price: '<span>Livraison dans Netanya</span><span><b>25 ₪</b></span>', badge: '📞 ' + TEL, scan: 'Essayez dès aujourd\'hui', url: 'Merci pour votre accueil' },
    he: { h1: 'עברנו<br><em>אצלכם!</em>', sub: 'בהזמנה הבאה שצריך להביא: מתקשרים אלינו ושופטים בעצמכם.', chips: ['💸 0% עמלה', '🛵 שליח לכל הזמנה', '📍 מעקב בזמן אמת', '📝 בלי חוזה'],
      price: '<span>משלוח בתוך נתניה</span><span><b>25 ₪</b></span>', badge: '📞 ' + TEL, scan: 'נסו כבר היום', url: 'תודה על קבלת הפנים' },
    link: APP + 'commerce.html?inscription=1', hs: 0.8, hsPost: 1.05, postChips: 3
  }
};
// « On fait toutes vos courses » : la grille des catégories de l'appli (mêmes illustrations 3D), en 3 étapes
T.courses = {
  fr: { h1: 'On fait <em>toutes<br>vos courses</em>', sub: 'Ouvrez l\'appli, touchez une catégorie, écrivez ce qu\'il vous faut : on achète et on livre.',
    steps: ['Ouvrez l\'appli', 'Touchez une catégorie', 'On achète et on livre'],
    price: '<span>Achat + livraison dans Netanya</span><span><b>30 ₪</b></span>', badge: '🧾 Prix du magasin, 0 frais de service', scan: 'Voir ce qu\'on livre', url: 'Tous les magasins, même les petits' },
  he: { h1: 'אנחנו עושים<br><em>את כל הקניות</em>', sub: 'פותחים את האפליקציה, בוחרים קטגוריה, כותבים מה צריך: אנחנו קונים ומביאים.',
    steps: ['פותחים את האפליקציה', 'בוחרים קטגוריה', 'קונים ומביאים לכם'],
    price: '<span>קנייה + משלוח בתוך נתניה</span><span><b>30 ₪</b></span>', badge: '🧾 מחיר החנות, 0 דמי שירות', scan: 'מה אנחנו מביאים', url: 'כל החנויות, גם הקטנות' },
  link: ON_LIVRE,
  cats: [['cart', 140, 'Supérette', 'מכולת'], ['pill', 160, 'Pharmacie', 'בית מרקחת'], ['croissant', 38, 'Boulangerie', 'מאפייה'], ['burger', 25, 'Restaurants', 'מסעדות'],
    ['mailbox', 205, 'Colis à la poste', 'חבילה בדואר'], ['basket', 35, 'Pressing', 'ניקוי יבש'], ['flowers', 330, 'Fleurs & cadeaux', 'פרחים ומתנות'], ['baby', 280, 'Bébé & enfants', 'תינוקות וילדים'],
    ['dog', 30, 'Animaux', 'חיות מחמד'], ['plug', 210, 'Maison', 'לבית ותיקונים'], ['docs', 215, 'Documents', 'מסמכים'], ['key', 45, 'Clés oubliées', 'מפתחות']]
};
// « L'appli évolue » : de nouveaux commerces se rajoutent, invitation à revenir voir (QR vers l'accueil de l'appli)
T.visite = {
  fr: { h1: 'L\'appli évolue :<br><em>de nouveaux commerces chaque semaine</em>', sub: 'Restaurants, épiceries, boulangeries, boutiques de Netanya : ils arrivent sur HOP! les uns après les autres. Pensez à nous visiter !',
    chips: ['🆕 Nouvelles enseignes chaque semaine', '🍣🍔🥐 Leur carte dans l\'appli', '📍 Suivi en direct', '💵 Espèces ou Bit'],
    price: '<span>Livraison dans Netanya</span><span><b>25 ₪</b></span>', badge: '👀 Pensez à nous visiter', scan: 'Voir les nouveautés', url: 'hop-livraison.vercel.app' },
  he: { h1: 'האפליקציה מתפתחת:<br><em>עסקים חדשים כל שבוע</em>', sub: 'מסעדות, מכולות, מאפיות וחנויות בנתניה מצטרפות להופ! אחת אחרי השנייה. בואו לבקר אותנו!',
    chips: ['🆕 עסקים חדשים כל שבוע', '🍣🍔🥐 התפריט שלהם באפליקציה', '📍 מעקב בזמן אמת', '💵 מזומן או ביט'],
    price: '<span>משלוח בתוך נתניה</span><span><b>25 ₪</b></span>', badge: '👀 בואו לבקר אותנו', scan: 'מה חדש', url: 'hop-livraison.vercel.app' },
  hs: 0.78, hsPost: 0.9, postChips: 3,
  link: lang => APP + (lang === 'he' ? '?lang=he' : '')
};
// Avant Chabbat : trois pubs chaleureuses (courses de dernière minute, hallot, table de Chabbat), avec les illustrations de l'appli
const SH_PRICE = { fr: '<span>Achat + livraison dans Netanya</span><span><b>30 ₪</b></span>', he: '<span>קנייה + משלוח בתוך נתניה</span><span><b>30 ₪</b></span>' };
T.chabbat = { shabbat: true, link: ON_LIVRE,
  fr: { kicker: '🕯️ Vendredi', h1: 'Courses de dernière minute<br><em>avant Chabbat ?</em>', sub: 'Pas le temps de courir ? Dites-nous ce qu\'il vous faut : on achète et on vous livre, vous préparez tranquille.',
    tiles: [['bread', 38, 'Hallot'], ['chicken', 25, 'Poulet, viande'], ['wine', 350, 'Vin, jus de raisin'], ['flowers', 330, 'Fleurs']],
    price: SH_PRICE.fr, badge: '🕯️ Chabbat chalom !', scan: 'Commander en 1 minute', url: 'Tous les magasins de Netanya, même les petits' },
  he: { kicker: '🕯️ יום שישי', h1: 'קניות של הרגע האחרון<br><em>לפני שבת?</em>', sub: 'אין זמן לרוץ? כתבו לנו מה צריך: אנחנו קונים ומביאים, ואתם מכינים בשקט.',
    tiles: [['bread', 38, 'חלות'], ['chicken', 25, 'עוף, בשר'], ['wine', 350, 'יין, מיץ ענבים'], ['flowers', 330, 'פרחים']],
    price: SH_PRICE.he, badge: '🕯️ שבת שלום!', scan: 'מזמינים תוך דקה', url: 'כל החנויות בנתניה, גם הקטנות' } };
T.halot = { shabbat: true, link: ON_LIVRE,
  fr: { kicker: '🥖 Boulangerie', h1: 'Pensez à<br><em>vos hallot !</em>', sub: 'Hallot fraîches de la boulangerie, livrées chez vous le vendredi. Et avec, le gâteau du Chabbat 😉',
    tiles: [['bread', 38, 'Hallot tressées'], ['cake', 340, 'Gâteaux'], ['cookie', 30, 'Biscuits'], ['croissant', 42, 'Viennoiseries']],
    price: SH_PRICE.fr, badge: '🥖 Livrées le vendredi', scan: 'Commander en 1 minute', url: 'La boulangerie que vous voulez' },
  he: { kicker: '🥖 מאפייה', h1: 'אל תשכחו<br><em>את החלות!</em>', sub: 'חלות טריות מהמאפייה, עד הבית ביום שישי. ועם זה, עוגה לשבת 😉',
    tiles: [['bread', 38, 'חלות קלועות'], ['cake', 340, 'עוגות'], ['cookie', 30, 'עוגיות'], ['croissant', 42, 'מאפים']],
    price: SH_PRICE.he, badge: '🥖 מגיעות ביום שישי', scan: 'מזמינים תוך דקה', url: 'מהמאפייה שאתם אוהבים' } };
T.table = { shabbat: true, link: ON_LIVRE,
  fr: { kicker: '🍷 Table de Chabbat', h1: 'Tout pour la table<br><em>de Chabbat</em>', sub: 'Vin, fleurs, pâtisserie, épicerie : on fait vos courses dans tous les magasins de Netanya et on livre à votre porte.',
    tiles: [['wine', 350, 'Vin'], ['flowers', 330, 'Fleurs'], ['cake', 340, 'Pâtisserie'], ['salad', 120, 'Salades, mezzés']],
    price: SH_PRICE.fr, badge: '🕯️ Vendredi, jusqu\'à la dernière minute', scan: 'Commander en 1 minute', url: 'Suivi en direct · espèces ou Bit' },
  he: { kicker: '🍷 שולחן שבת', h1: 'הכול לשולחן<br><em>השבת</em>', sub: 'יין, פרחים, קינוחים, מכולת: עושים לכם את הקניות בכל החנויות בנתניה ומביאים עד הדלת.',
    tiles: [['wine', 350, 'יין'], ['flowers', 330, 'פרחים'], ['cake', 340, 'קינוחים'], ['salad', 120, 'סלטים, מזה']],
    price: SH_PRICE.he, badge: '🕯️ יום שישי, עד הרגע האחרון', scan: 'מזמינים תוך דקה', url: 'מעקב בזמן אמת · מזומן או ביט' } };
const ART = k => 'data:image/webp;base64,' + fs.readFileSync(`${__dirname}/../img/items/${k}.webp`).toString('base64');
function coursesPage(lang, fmt) {
  const t = T.courses[lang], he = lang === 'he', post = fmt === 'post';
  const W = fmt === 'flyer' ? 1240 : 1080, H = fmt === 'story' ? 1920 : fmt === 'flyer' ? 1754 : 1080;
  const k = post ? 1 : fmt === 'story' ? 1.3 : 1.25, pad = post ? 56 : 80, qrSize = post ? 170 : 240;
  // Story : 9 catégories (3 × 3), post : 8 (4 × 2), flyer : 12 (4 × 3) ; la grille prend toute la place qui reste
  const cats = T.courses.cats.slice(0, post ? 8 : fmt === 'story' ? 9 : 12), cols = fmt === 'story' ? 3 : 4;
  const html = `<div class="page ${he ? 'he' : ''}" style="width:${W}px;height:${H}px;padding:${pad}px;gap:${post ? 20 : 34}px">
    <div class="top" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:22px"><div class="lg" ${post ? 'style="width:88px;height:88px"' : ''}>${LOGO}</div>
      <div class="wm" ${post ? 'style="font-size:76px"' : ''}>${he ? 'הופ' : 'HOP'}<i>!</i><small>${he ? 'משלוחים' : 'LIVRAISON'}</small></div></div>
      ${post ? '' : `<span class="badge" style="font-size:${Math.round(30 * k)}px">🛒 ${he ? 'קונים בשבילכם' : 'J\'achète pour vous'}</span>`}</div>
    <h1 style="font-size:${post ? 64 : Math.round(88 * k)}px">${post ? t.h1.replace('<br>', ' ') : t.h1}</h1>
    <div class="steps" style="font-size:${post ? 22 : Math.round(22 * k)}px">${t.steps.map((x, i) => `<span><b>${i + 1}</b>${x}</span>`).join('')}</div>
    <div class="cgrid" style="grid-template-columns:repeat(${cols},1fr)">${cats.map(([img, h, fr, hb], i) => `<div class="ctile${i === 1 ? ' tap' : ''}" style="--h:${h}">
        <span class="cart"><img src="${ART(img)}" alt="" /></span>
        <b style="font-size:${post ? 21 : Math.round((cols === 3 ? 25 : 21) * k)}px">${he ? hb : fr}</b>${i === 1 ? '<i class="finger">👆</i>' : ''}</div>`).join('')}</div>
    <div class="foot">
      <div style="display:grid;gap:16px;flex:1;min-width:0">
        <div class="price" style="font-size:${Math.round((post ? 26 : 28) * k)}px;padding:${post ? '16px 26px' : '22px 32px'}">${t.price.replace('<b>', `<b style="font-size:${Math.round((post ? 56 : 70) * k)}px">`)}</div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="badge" style="font-size:${Math.round((post ? 24 : 28) * k)}px">${t.badge}</span>
          ${post ? '' : `<span class="url" style="font-size:${Math.round(24 * k)}px">${t.url}</span>`}</div>
      </div>
      ${qr('q', qrSize).replace('{{scan}}', t.scan)}
    </div>
  </div>`;
  return { html, W, H, qrSize, link: ON_LIVRE(lang) };
}
// Mise en page « avant Chabbat » : fond chaud (bougies, lueur dorée), en-tête, titre, 4 tuiles d'articles, prix, QR
function shabbatPage(kind, lang, fmt) {
  const t = T[kind][lang], he = lang === 'he', post = fmt === 'post';
  const W = fmt === 'flyer' ? 1240 : 1080, H = fmt === 'story' ? 1920 : fmt === 'flyer' ? 1754 : 1080;
  const k = post ? 1 : fmt === 'story' ? 1.3 : 1.25, pad = post ? 56 : 80, qrSize = post ? 170 : 240;
  const cols = fmt === 'story' ? 2 : 4;
  const html = `<div class="page sh ${he ? 'he' : ''}" style="width:${W}px;height:${H}px;padding:${pad}px;gap:${post ? 18 : 30}px">
    <i class="candles" style="font-size:${post ? 110 : Math.round(150 * k)}px">🕯️🕯️</i>
    <div class="top" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:22px"><div class="lg" ${post ? 'style="width:88px;height:88px"' : ''}>${LOGO}</div>
      <div class="wm" ${post ? 'style="font-size:76px"' : ''}>${he ? 'הופ' : 'HOP'}<i>!</i><small>${he ? 'משלוחים' : 'LIVRAISON'}</small></div></div></div>
    <span class="kick" style="font-size:${Math.round((post ? 26 : 30) * k)}px">${t.kicker}</span>
    <h1 style="font-size:${post ? 72 : Math.round(92 * k)}px">${post ? t.h1.replace('<br>', ' ') : t.h1}</h1>
    <div class="sub" style="font-size:${Math.round((post ? 27 : 29) * k)}px;max-width:${post ? 940 : 1000}px">${t.sub}</div>
    <div class="cgrid" style="grid-template-columns:repeat(${cols},1fr)">${t.tiles.map(([img, h, label]) => `<div class="ctile" style="--h:${h}">
        <span class="cart"><img src="${ART(img)}" alt="" /></span>
        <b style="font-size:${post ? 21 : Math.round((cols === 2 ? 27 : 22) * k)}px">${label}</b></div>`).join('')}</div>
    <div class="foot">
      <div style="display:grid;gap:16px;flex:1;min-width:0">
        <div class="price" style="font-size:${Math.round((post ? 26 : 28) * k)}px;padding:${post ? '16px 26px' : '22px 32px'}">${t.price.replace('<b>', `<b style="font-size:${Math.round((post ? 56 : 70) * k)}px">`)}</div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="badge gold" style="font-size:${Math.round((post ? 24 : 28) * k)}px">${t.badge}</span>
          ${post ? '' : `<span class="url" style="font-size:${Math.round(24 * k)}px">${t.url}</span>`}</div>
      </div>
      ${qr('q', qrSize).replace('{{scan}}', t.scan)}
    </div>
  </div>`;
  return { html, W, H, qrSize, link: ON_LIVRE(lang) };
}
function page(kind, lang, fmt) {
  const t = T[kind][lang], he = lang === 'he';
  const W = fmt === 'story' ? 1080 : fmt === 'flyer' ? 1240 : 1080, H = fmt === 'story' ? 1920 : fmt === 'flyer' ? 1754 : 1080;
  const big = fmt === 'post' ? 1 : fmt === 'story' ? 1.4 : 1.25;
  const qrSize = fmt === 'post' ? 200 : 280;
  const pad = fmt === 'post' ? 64 : 84;
  const scoot = (w, style) => SCOOTER.replace('width="118" height="83"', `width="${w}" height="${Math.round(w * 0.7)}"`).replace('class="scoot"', `class="scoot" style="${style}"`);
  const sw = fmt === 'story' ? 320 : 280;
  const html = `<div class="page ${he ? 'he' : ''}" style="width:${W}px;height:${H}px;padding:${pad}px;gap:${fmt === 'post' ? 26 : 38}px">
    <div class="top"><div class="lg">${LOGO}</div><div class="wm">${he ? 'הופ' : 'HOP'}<i>!</i><small>${he ? 'משלוחים' : 'LIVRAISON'}</small></div></div>
    ${fmt !== 'post' ? `<div style="height:${Math.round(sw * 0.7) + 16}px;position:relative;flex-shrink:0"><div class="road" style="bottom:6px"></div>${scoot(sw, `bottom:2px;${he ? 'right' : 'left'}:30px`)}</div>` : ''}
    <h1 style="font-size:${Math.round(110 * big * (T[kind].hs || 1) * (fmt === 'post' ? (T[kind].hsPost || 1) : 1))}px">${t.h1}</h1>
    <div class="sub" style="font-size:${Math.round(31 * big)}px">${t.sub}</div>
    <div class="chips" style="font-size:${Math.round(27 * big)}px">${(fmt === 'post' && T[kind].postChips ? t.chips.slice(0, T[kind].postChips) : t.chips).map(c => `<span class="chip">${c}</span>`).join('')}</div>
    <div style="flex:1"></div>
    ${fmt !== 'post' ? `<div class="price" style="font-size:${Math.round(32 * big)}px">${t.price.replace('<b>', `<b style="font-size:${Math.round(80 * big)}px">`)}</div>` : ''}
    <div class="foot">
      <div style="display:grid;gap:16px;flex:1">
        ${fmt === 'post' ? `<div class="price" style="font-size:${Math.round(32 * big)}px">${t.price.replace('<b>', `<b style="font-size:${Math.round(80 * big)}px">`)}</div>` : ''}
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span class="badge" style="font-size:${Math.round(30 * big)}px">${t.badge}</span>
          <span class="url" style="font-size:${Math.round(24 * big)}px">${t.url}</span></div>
      </div>
      ${qr('q', qrSize).replace('{{scan}}', t.scan)}
    </div>
    ${fmt === 'post' ? scoot(250, `top:70px;${he ? 'left' : 'right'}:64px`) : ''}
  </div>`;
  return { html, W, H, qrSize, link: typeof T[kind].link === 'function' ? T[kind].link(lang) : T[kind].link };
}
(async () => {
  const b = await chromium.launch();
  const qrJs = fs.readFileSync(L + '/q/package/qrcode.min.js', 'utf8');
  const made = [];
  // Usage : node generer-visuels.js <libs> [types séparés par des virgules] (par défaut : tous)
  const kinds = process.argv[3] ? process.argv[3].split(',') : Object.keys(T);
  for (const kind of kinds) for (const lang of ['fr', 'he']) for (const fmt of ['post', 'story', 'flyer']) {
    const p = kind === 'courses' ? coursesPage(lang, fmt) : T[kind].shabbat ? shabbatPage(kind, lang, fmt) : page(kind, lang, fmt);
    const ctx = await b.newContext({ viewport: { width: p.W, height: p.H }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${p.html}<script>${qrJs}</script>
      <script>new QRCode(document.getElementById('q'), { text: ${JSON.stringify(p.link)}, width: ${p.qrSize}, height: ${p.qrSize}, correctLevel: QRCode.CorrectLevel.M });</script></body></html>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    const name = `${kind}-${fmt}-${lang}`;
    await pg.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: p.W, height: p.H } });
    if (fmt === 'flyer') await pg.pdf({ path: `${OUT}/${name}.pdf`, width: '148mm', height: '210mm', printBackground: true, pageRanges: '1',
      scale: 148 / 25.4 * 96 / p.W });
    made.push(name);
    await ctx.close();
  }
  console.log(made.join(' '));
  await b.close();
})();
