// Carte fidélité Wallet (projet séparé de HOP!) : page client (carte.html), espace commerçant (pro.html), accueil (index.html).
(() => {
const C = window.FCFG, ICO = window.FIcons;
async function rpc(fn, body) {
  const r = await fetch(C.sb + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: C.key, Authorization: "Bearer " + C.key, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const t = await r.text();
  if (!r.ok) { let m = t; try { m = JSON.parse(t).message || t; } catch (e) { /* brut */ } throw new Error(m); }
  return t ? JSON.parse(t) : null;
}
async function wallet(body) {
  const r = await fetch(C.fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.key }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "wallet");
  return j;
}
let ws = null;
const walletStatus = async () => ws || (ws = await fetch(C.fn).then(r => r.json()).catch(() => ({ google: false, apple: false })));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
const SITE = location.origin + location.pathname.replace(/[^/]*$/, "");

const T = {
  fr: {
    lang: "עברית", stamps: "Tampons", gifts: "Cadeaux", member: "Membre", eq: "{n} tampons =",
    joinT: "Votre carte de fidélité", joinS: "Dans votre téléphone. Jamais perdue, jamais oubliée.", name: "Votre prénom", phone: "Votre téléphone",
    bday: "Votre anniversaire", opt: "(facultatif)", bdayHint: "Un petit cadeau vous attend ce jour-là : {gift}", create: "Créer ma carte",
    wait: "Un instant…", errName: "Écrivez votre prénom.", errPhone: "Ce numéro ne semble pas correct.", errTaken: "Ce numéro a déjà une carte avec un autre prénom : écrivez celui de la première fois.",
    errGen: "Oups, ça n'a pas marché. Réessayez.", unknown: "Cette carte n'existe pas ou n'est plus active.",
    welcome: "Bienvenue ! {n} tampon(s) offert(s) pour commencer.", left: "Plus que {n} passage(s) avant : {r}", ready: "Votre cadeau vous attend ! Montrez cette carte au comptoir.",
    show: "Montrez ce QR code à chaque passage : on vous ajoute un tampon.", addG: "Ajouter à Google Wallet", addA: "Ajouter à Apple Wallet",
    soon: "L'ajout au Wallet arrive très bientôt. En attendant, gardez cette page (ajoutez-la à l'écran d'accueil).",
    call: "Appeler", wa: "WhatsApp", map: "Itinéraire", web: "Site", insta: "Instagram",
    refT: "Invitez un ami", refS: "Il reçoit sa carte, vous gagnez {n} tampon(s).", refMsg: "Je te recommande {shop} ! Prends ta carte de fidélité ici, c'est gratuit : {url}",
    revT: "Vous avez aimé ?", revS: "Un petit avis Google, ça aide beaucoup.", revB: "Laisser un avis",
    bdayOn: "Anniversaire : {gift}", keep: "Votre carte est toujours ici :", demo: "Exemple de carte", powered: "Carte fidélité dans le Wallet",
    proT: "Votre carte de fidélité", proS: "Dans le téléphone de vos clients, en 2 minutes.", shopName: "Nom du commerce", yourPhone: "Votre téléphone", kind: "Votre activité",
    start: "Créer ma carte", keepLink: "Gardez bien ce lien : c'est l'accès à votre espace.", tabStamp: "Tamponner", tabClients: "Clients", tabCard: "Ma carte", tabShare: "Mon QR code",
    findPh: "4 derniers chiffres, téléphone ou prénom", find: "Chercher", scan: "Scanner la carte du client", none: "Aucune carte trouvée.", plus1: "+1 tampon", redeem: "Cadeau donné",
    stamped: "Tampon ajouté !", won: "Carte pleine : {r} à offrir !", redeemed: "Cadeau noté.", tooFast: "Déjà tamponnée il y a quelques secondes.", camErr: "Caméra indisponible : tapez les 4 derniers chiffres du téléphone.",
    sCards: "Cartes", sMonth: "Nouveaux ce mois", sStamps: "Tampons ce mois", sGifts: "Cadeaux ce mois", sWallet: "Dans le Wallet", sRef: "Parrainages",
    msgT: "Message à tous vos clients", msgS: "Une notification sur leur téléphone (une fois par jour au plus).", msgPh: "Ex. : Ce week-end, tampons doublés !", send: "Envoyer",
    sent: "Envoyé à {n} téléphone(s).", msgWait: "Un seul message par jour : réessayez demain.", short: "Message trop court.",
    sleepT: "Clients à relancer", sleepS: "Pas venus depuis {n} jours.", sleepNone: "Personne à relancer pour l'instant.", relTxt: "Coucou {name} ! Ça fait longtemps qu'on ne vous a pas vu chez {shop}. Plus que {left} tampon(s) avant votre cadeau. À très vite !",
    last: "Dernier passage : {d}", never: "Pas encore venu", allT: "Tous vos clients ({n})",
    look: "Apparence", logo: "Logo", logoB: "Choisir une image", nameHe: "Nom en hébreu (facultatif)", color: "Couleur", theme: "Icône des tampons",
    rules: "La récompense", need: "Nombre de tampons", reward: "Le cadeau (français)", rewardHe: "Le cadeau (hébreu)", rewardPh: "Ex. : un café offert", welcomeSt: "Tampons offerts à l'inscription", refSt: "Tampons offerts au parrain",
    auto: "Messages automatiques", bdayGift: "Cadeau d'anniversaire (français)", bdayGiftHe: "Cadeau d'anniversaire (hébreu)", bdayPh: "Ex. : un dessert offert",
    relDays: "Relancer un client absent depuis (jours, 0 = jamais)", relMsg: "Message de relance (français)", relMsgHe: "Message de relance (hébreu)", relPh: "Ex. : Ça fait longtemps ! −10 % cette semaine",
    geo: "Rappel quand le client passe devant", geoS: "Le téléphone du client affiche un petit message quand il passe près de votre boutique (iPhone et Android).",
    geoB: "Je suis dans ma boutique : enregistrer ma position", geoOk: "Position enregistrée.", geoErr: "Position impossible : autorisez la localisation.", nearMsg: "Message (français)", nearMsgHe: "Message (hébreu)", nearPh: "Ex. : Un petit café ? Votre tampon vous attend",
    links: "Liens sur la carte", review: "Lien de vos avis Google", tel: "Téléphone de la boutique", whatsapp: "WhatsApp", insta2: "Instagram (@nom)", site: "Site internet", addr: "Adresse",
    save: "Enregistrer", saved: "Enregistré !", preview: "Aperçu de la carte", active: "Carte active",
    shareT: "Votre QR code de comptoir", shareS: "Posez-le près de la caisse : vos clients le scannent et ont leur carte en 20 secondes.", print: "Imprimer l'affiche", copy: "Copier le lien", copied: "Copié !",
    posterT: "Votre carte de fidélité", posterS: "Scannez-moi · sans appli · 20 secondes", walletState: "Wallet : {g} · {a}", gOn: "Google prêt", gOff: "Google en préparation", aOn: "Apple prêt", aOff: "Apple en préparation",
    badLink: "Le lien doit commencer par https://", logoBig: "Image trop lourde, choisissez-en une plus petite.",
    powered0: "Carte fidélité", prog: "{a} / {b} tampons", nextGift: "Votre cadeau", tpl: "Idées de messages", csv: "Télécharger la liste (Excel)", shareWa: "Envoyer le lien par WhatsApp",
    tpls: ["Ce week-end, tampons doublés !", "Nouveauté au menu : venez goûter !", "Happy hour de 16 h à 18 h aujourd'hui.", "Merci d'être fidèle : une surprise vous attend au comptoir."],
    joinPerks: ["Un tampon à chaque passage", "Votre cadeau au bout", "Rien à télécharger"], walletT: "Rangez-la dans votre téléphone", saveHint: "Elle se met à jour toute seule à chaque tampon."
  },
  he: {
    lang: "Français", stamps: "חותמות", gifts: "מתנות", member: "חבר/ה", eq: "{n} חותמות =",
    joinT: "כרטיס המועדון שלכם", joinS: "בטלפון. לא הולך לאיבוד, לא נשכח.", name: "השם הפרטי", phone: "הטלפון",
    bday: "יום ההולדת", opt: "(לא חובה)", bdayHint: "מתנה קטנה מחכה לכם ביום הזה: {gift}", create: "ליצור את הכרטיס שלי",
    wait: "רגע…", errName: "כתבו את השם הפרטי.", errPhone: "המספר לא נראה תקין.", errTaken: "למספר הזה כבר יש כרטיס עם שם אחר: כתבו את השם מהפעם הראשונה.",
    errGen: "אופס, משהו השתבש. נסו שוב.", unknown: "הכרטיס הזה לא קיים או לא פעיל.",
    welcome: "ברוכים הבאים! {n} חותמות מתנה להתחלה.", left: "עוד {n} ביקורים עד: {r}", ready: "המתנה מחכה לכם! הציגו את הכרטיס בקופה.",
    show: "הציגו את קוד ה-QR בכל ביקור: מוסיפים לכם חותמת.", addG: "הוספה ל-Google Wallet", addA: "הוספה ל-Apple Wallet",
    soon: "ההוספה לארנק תגיע בקרוב מאוד. בינתיים שמרו את הדף (הוסיפו למסך הבית).",
    call: "להתקשר", wa: "וואטסאפ", map: "איך מגיעים", web: "אתר", insta: "אינסטגרם",
    refT: "הזמינו חבר", refS: "הוא מקבל כרטיס, ואתם מרוויחים {n} חותמות.", refMsg: "ממליץ/ה לך על {shop}! קח/י כרטיס מועדון כאן, בחינם: {url}",
    revT: "נהניתם?", revS: "ביקורת קטנה בגוגל עוזרת לנו מאוד.", revB: "להשאיר ביקורת",
    bdayOn: "יום הולדת: {gift}", keep: "הכרטיס שלכם תמיד כאן:", demo: "כרטיס לדוגמה", powered: "כרטיס מועדון בארנק",
    proT: "כרטיס המועדון שלכם", proS: "בטלפון של הלקוחות, תוך 2 דקות.", shopName: "שם העסק", yourPhone: "הטלפון שלכם", kind: "סוג העסק",
    start: "ליצור את הכרטיס", keepLink: "שמרו את הקישור הזה: זו הכניסה לאזור שלכם.", tabStamp: "להחתים", tabClients: "לקוחות", tabCard: "הכרטיס שלי", tabShare: "קוד ה-QR",
    findPh: "4 ספרות אחרונות, טלפון או שם", find: "חיפוש", scan: "לסרוק את הכרטיס של הלקוח", none: "לא נמצא כרטיס.", plus1: "חותמת +1", redeem: "המתנה ניתנה",
    stamped: "החותמת נוספה!", won: "הכרטיס מלא: {r} במתנה!", redeemed: "המתנה נרשמה.", tooFast: "הכרטיס הוחתם לפני כמה שניות.", camErr: "המצלמה לא זמינה: הקלידו 4 ספרות אחרונות של הטלפון.",
    sCards: "כרטיסים", sMonth: "חדשים החודש", sStamps: "חותמות החודש", sGifts: "מתנות החודש", sWallet: "בארנק", sRef: "המלצות",
    msgT: "הודעה לכל הלקוחות", msgS: "התראה בטלפון שלהם (לכל היותר פעם ביום).", msgPh: "לדוגמה: בסוף השבוע חותמות כפולות!", send: "שליחה",
    sent: "נשלח ל-{n} טלפונים.", msgWait: "הודעה אחת ביום: נסו שוב מחר.", short: "ההודעה קצרה מדי.",
    sleepT: "לקוחות לתזכורת", sleepS: "לא הגיעו כבר {n} ימים.", sleepNone: "אין למי להזכיר כרגע.", relTxt: "היי {name}! מזמן לא ראינו אותך ב-{shop}. עוד {left} חותמות עד המתנה. נתראה בקרוב!",
    last: "ביקור אחרון: {d}", never: "עוד לא ביקר/ה", allT: "כל הלקוחות ({n})",
    look: "עיצוב", logo: "לוגו", logoB: "לבחור תמונה", nameHe: "השם בעברית (לא חובה)", color: "צבע", theme: "אייקון החותמות",
    rules: "המתנה", need: "מספר חותמות", reward: "המתנה (צרפתית)", rewardHe: "המתנה (עברית)", rewardPh: "לדוגמה: קפה מתנה", welcomeSt: "חותמות מתנה בהרשמה", refSt: "חותמות מתנה לממליץ",
    auto: "הודעות אוטומטיות", bdayGift: "מתנת יום הולדת (צרפתית)", bdayGiftHe: "מתנת יום הולדת (עברית)", bdayPh: "לדוגמה: קינוח מתנה",
    relDays: "תזכורת ללקוח שלא הגיע (ימים, 0 = אף פעם)", relMsg: "הודעת תזכורת (צרפתית)", relMsgHe: "הודעת תזכורת (עברית)", relPh: "לדוגמה: מתגעגעים! 10% הנחה השבוע",
    geo: "תזכורת כשהלקוח עובר ליד", geoS: "הטלפון של הלקוח מציג הודעה קטנה כשהוא עובר ליד החנות (אייפון ואנדרואיד).",
    geoB: "אני בחנות: לשמור את המיקום", geoOk: "המיקום נשמר.", geoErr: "אין מיקום: אשרו גישה למיקום.", nearMsg: "הודעה (צרפתית)", nearMsgHe: "הודעה (עברית)", nearPh: "לדוגמה: קפה? החותמת מחכה לך",
    links: "קישורים בכרטיס", review: "קישור לביקורות בגוגל", tel: "טלפון החנות", whatsapp: "וואטסאפ", insta2: "אינסטגרם (@שם)", site: "אתר", addr: "כתובת",
    save: "שמירה", saved: "נשמר!", preview: "תצוגה מקדימה", active: "הכרטיס פעיל",
    shareT: "קוד ה-QR לדלפק", shareS: "שימו ליד הקופה: הלקוחות סורקים ומקבלים כרטיס תוך 20 שניות.", print: "להדפיס את השלט", copy: "להעתיק קישור", copied: "הועתק!",
    posterT: "כרטיס המועדון שלכם", posterS: "סרקו אותי · בלי אפליקציה · 20 שניות", walletState: "ארנק: {g} · {a}", gOn: "Google מוכן", gOff: "Google בהכנה", aOn: "Apple מוכן", aOff: "Apple בהכנה",
    badLink: "הקישור צריך להתחיל ב-https://", logoBig: "התמונה כבדה מדי, בחרו קטנה יותר.",
    powered0: "כרטיס מועדון", prog: "{a} / {b} חותמות", nextGift: "המתנה שלכם", tpl: "רעיונות להודעות", csv: "להוריד את הרשימה (Excel)", shareWa: "לשלוח את הקישור בוואטסאפ",
    tpls: ["בסוף השבוע: חותמות כפולות!", "חדש בתפריט: בואו לטעום!", "האפי האוור היום 16:00–18:00.", "תודה על הנאמנות: הפתעה מחכה לכם בקופה."],
    joinPerks: ["חותמת בכל ביקור", "מתנה בסוף", "בלי להוריד כלום"], walletT: "שמרו אותו בטלפון", saveHint: "הוא מתעדכן לבד בכל חותמת."
  }
};
let L = "fr";
function initLang() {
  const q = new URLSearchParams(location.search);
  let l = q.get("lang");
  if (!l) { try { l = localStorage.getItem("fc.lang"); } catch (e) { /* bloqué */ } }
  if (!l) l = /^he|^iw/.test(navigator.language || "") ? "he" : "fr";
  setLang(l);
}
function setLang(l) {
  L = l === "he" ? "he" : "fr";
  document.documentElement.lang = L; document.documentElement.dir = L === "he" ? "rtl" : "ltr";
  try { localStorage.setItem("fc.lang", L); } catch (e) { /* bloqué */ }
}
const t = (k, v) => { const s = T[L][k] != null ? T[L][k] : T.fr[k]; return String(s == null ? k : s).replace(/\{(\w+)\}/g, (_, x) => (v && v[x] != null ? v[x] : "")); };
const ta = k => T[L][k] || T.fr[k];
const shopName = s => (L === "he" && s.name_he) || s.name;
const rewardOf = s => (L === "he" ? s.reward_he || s.reward : s.reward || s.reward_he) || (L === "he" ? "מתנה" : "un cadeau");
const giftOf = s => (L === "he" ? s.birthday_gift_he || s.birthday_gift : s.birthday_gift || s.birthday_gift_he);
const logoSrc = s => s.logo ? `${C.fn}/logo/${s.code}.png?v=${s.logo_v}` : "";

function shade(hex, k) {
  const m = parseInt(String(hex || "#7A3E1D").replace("#", ""), 16) || 0x7a3e1d;
  const ch = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return "#" + [m >> 16 & 255, m >> 8 & 255, m & 255].map(v => ch(v).toString(16).padStart(2, "0")).join("");
}
function heroSvg(s, stamps, gifts, pop) {
  const W = 1032, H = 336, n = s.stamps_needed, cols = n <= 5 ? n : n <= 12 ? Math.ceil(n / 2) : Math.ceil(n / 3), rows = Math.ceil(n / cols);
  const pad = H * 0.12, cell = Math.min((W - pad * 2) / cols, (H - pad * 2) / rows), r = cell * 0.38, gx = (W - cols * cell) / 2, gy = (H - rows * cell) / 2;
  const base = s.color || "#7A3E1D", dark = shade(base, -0.25), cream = "#FFF6EA", gold = "#FFC542", icon = ICO.I[s.theme] || ICO.I.heart;
  let cells = "";
  for (let i = 0; i < n; i++) {
    const col = L === "he" ? cols - 1 - (i % cols) : i % cols, cx = gx + col * cell + cell / 2, cy = gy + Math.floor(i / cols) * cell + cell / 2, on = i < stamps, last = i === n - 1;
    const sc = (r * 1.32) / 24, rot = on ? ((i * 37) % 13) - 6 : 0, q = r * 0.42, anim = on && i === pop ? ' class="stp"' : "";
    const ic = (st, op, d, w) => `<g transform="translate(${cx} ${cy}) rotate(${rot}) translate(${-12 * sc} ${-12 * sc}) scale(${sc})" fill="none" stroke="${st}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;
    const tile = (f, fo, st = "none", sw = 0) => `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="${q}" fill="${f}" fill-opacity="${fo}" stroke="${st}" stroke-width="${sw}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    if (on) cells += `<g${anim} style="transform-origin:${cx}px ${cy}px"><rect x="${cx - r}" y="${cy - r + r * 0.12}" width="${2 * r}" height="${2 * r}" rx="${q}" fill="${dark}" opacity=".35" transform="rotate(${rot} ${cx} ${cy})"/>${tile(cream, 1)}${ic(base, 1, icon, 2.2)}</g>`;
    else if (last) cells += tile(gold, 0.18, gold, r * 0.09) + ic(gold, 1, ICO.I.gift, 2);
    else cells += tile("#ffffff", 0.14) + ic(cream, 0.45, icon, 1.9);
  }
  const glow = gifts > 0 ? `<rect x="${W * 0.02}" y="${H * 0.04}" width="${W * 0.96}" height="${H * 0.92}" rx="${H * 0.12}" fill="none" stroke="${gold}" stroke-width="${H * 0.025}"/>` : "";
  return `<svg class="fc-hero" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><style>.stp{animation:stp .6s cubic-bezier(.2,.9,.3,1.4) both}@keyframes stp{0%{transform:scale(1.8);opacity:0}60%{transform:scale(.92);opacity:1}100%{transform:scale(1)}}</style>
    <rect width="${W}" height="${H}" fill="${base}"/>${glow}${cells}</svg>`;
}
function cardHtml(s, c, opts = {}) {
  const lg = logoSrc(s), st = c ? c.stamps : Math.min(3, s.stamps_needed - 1), gifts = c ? c.rewards_ready : 0;
  return `<div class="fc${opts.pop ? " pop" : ""}" style="--c:${esc(s.color)}">
    <div class="fc-head"><span class="fc-logo">${lg ? `<img src="${esc(lg)}" alt="">` : ICO.svg(s.theme, 28, s.color, 2)}</span>
      <b class="fc-name"><bdi>${esc(shopName(s))}</bdi></b>
      <span class="fc-kv"><small>${esc(t("stamps"))}</small><b>${ltr(st + "/" + s.stamps_needed)}</b></span></div>
    ${heroSvg(s, st, gifts, opts.popIndex)}
    <div class="fc-fields">
      <span class="fc-f"><small>${esc(t("member"))}</small><b>${esc(c ? c.name : (L === "he" ? "נועה" : "Léa"))}</b></span>
      <span class="fc-f" style="text-align:center"><small>${esc(t("gifts"))}</small><b>${gifts}</b></span>
      <span class="fc-f" style="text-align:end"><small>${esc(t("eq", { n: s.stamps_needed }))}</small><b>${esc(rewardOf(s))}</b></span></div>
    ${opts.qr ? `<div class="fc-qr"><div id="fcQr"></div></div>` : `<div style="height:14px"></div>`}
  </div>`;
}
function qr(el, text, size) { if (el && window.QRCode) { el.innerHTML = ""; new QRCode(el, { text, width: size, height: size, colorDark: "#111418", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.M }); } }
function confetti(host) {
  const cols = ["#E8590C", "#0F1F3D", "#F5C24B", "#7CC6A4", "#9DB7F5"];
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:50;overflow:hidden";
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("i"), x = Math.random() * 100, d = 1.6 + Math.random() * 1.6;
    p.style.cssText = `position:absolute;top:-20px;left:${x}%;width:10px;height:16px;border-radius:2px;background:${cols[i % 5]};animation:cf ${d}s ${Math.random() * .5}s ease-in forwards`;
    box.appendChild(p);
  }
  const st = document.createElement("style");
  st.textContent = "@keyframes cf{to{transform:translateY(110vh) rotate(720deg)}}";
  box.appendChild(st); (host || document.body).appendChild(box);
  setTimeout(() => box.remove(), 4000);
}
const sv = (d, sz = 22, st = "#111418", w = 1.9) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${st}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const P = {
  mark: "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M8.5 12.2l2.4 2.4 4.8-5",
  cam: "M4 8h3l1.5-2h7L17 8h3v11H4z M12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4",
  pin: "M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  share: "M12 3v12 M7.5 7.5 12 3l4.5 4.5 M5 13v6h14v-6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  gift: "M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6 6 0 0 1 3.5 6",
  stamp: "M9 4h6v5l3 3v3H6v-3l3-3z M5 19h14",
  card: "M3 6h18v12H3z M3 10h18",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2 M14 18h2 M18 18h2v2",
  dl: "M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 20h14",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0",
  cake: "M4 20h16v-7H4z M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0 M12 9v4 M12 5.5v.5",
  back: "M4 12a8 8 0 1 0 2.5-5.8 M4 4v4h4",
  heart: "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  send: "M4 12 20 4l-6 16-3-7z M11 13l9-9",
  lock: "M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  check: "M5 12.5l4.5 4.5L19 7.5"
};
const MARK = `<i>${sv(P.check, 20, "#fff", 2.6)}</i>`;
const GW = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="2" fill="#4285F4"/><rect x="3" y="8" width="18" height="5" rx="2" fill="#EA4335"/><rect x="3" y="12" width="18" height="5" rx="2" fill="#FBBC04"/><rect x="3" y="15" width="18" height="5" rx="2" fill="#34A853"/></svg>';
const AW = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3.5" fill="#fff"/><rect x="5" y="6.5" width="14" height="3" rx="1" fill="#34C759"/><rect x="5" y="9.5" width="14" height="3" rx="1" fill="#FF9500"/><rect x="5" y="12.5" width="14" height="3" rx="1" fill="#FF2D55"/></svg>';
const ICS = {
  call: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  wa: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1.5 2 1-.5 1.5c-3 .5-7-3.5-6.5-6.5L11 8l1 2z"/></svg>',
  map: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  web: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  insta: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="1.9"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r="1" fill="#111418"/></svg>',
};
const wa = (ph, txt) => "https://wa.me/" + (ph ? String(ph).replace(/\D/g, "").replace(/^0/, "972") : "") + "?text=" + encodeURIComponent(txt || "");

async function pageCard() {
  initLang();
  const root = document.getElementById("app"), q = new URLSearchParams(location.search);
  const code = (q.get("s") || "").toUpperCase(), ref = q.get("ref");
  const KEY = code ? "fc.card." + code : "";
  let token = q.get("c") || q.get("demo") && C.demo, data = null, shop = null, welcome = false, popIdx;
  if (!token && KEY) { try { token = localStorage.getItem(KEY); } catch (e) { /* bloqué */ } }
  const st = await walletStatus();
  const top = () => { const s = (data && data.shop) || shop; return `<div class="top"><span class="brandmini">${s ? `<span class="fc-logo" style="width:32px;height:32px;border-radius:9px;background:${esc(s.color)}">${logoSrc(s) ? `<img src="${esc(logoSrc(s))}" alt="">` : ICO.svg(s.theme, 18, "#fff", 2)}</span><bdi>${esc(shopName(s))}</bdi>` : MARK}</span>
    <span class="nav-l">${data && data.shop.code === "HOPDEMO" || q.get("demo") ? `<span class="chip demo">${esc(t("demo"))}</span>` : ""}<button class="chip" data-lang>${esc(t("lang"))}</button></span></div>`; };
  function draw() {
    if (data && data.card) return drawCard();
    if (!shop) { root.innerHTML = top() + `<div class="box"><b>${esc(t("unknown"))}</b></div>`; return; }
    const gift = giftOf(shop);
    root.innerHTML = top() + `
      <div class="rise" style="padding-top:18px"><span class="eyebrow">${esc(t("joinT"))}</span>
      <h1 class="h1" style="font-size:32px"><bdi>${esc(shopName(shop))}</bdi></h1>
      <p class="sub">${esc(t("joinS"))}</p></div>
      ${cardHtml(shop, null)}
      <div class="trust" style="justify-content:center">${ta("joinPerks").map((x, i) => `<span>${sv([P.stamp, P.gift, P.check][i], 16, "#5A6270")}${esc(x)}</span>`).join("")}</div>
      <form class="box" id="join" novalidate style="margin-top:18px">
        <label class="f"><span>${esc(t("name"))}</span><input class="in" name="name" autocomplete="given-name" maxlength="30"></label>
        <label class="f"><span>${esc(t("phone"))}</span><input class="in" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="05X XXX XXXX"></label>
        ${gift ? `<label class="f"><span>${esc(t("bday"))} <span class="muted small">${esc(t("opt"))}</span></span><input class="in" name="bday" type="date" dir="ltr"><small>${esc(t("bdayHint", { gift }))}</small></label>` : ""}
        <div class="err hidden" id="err"></div>
        <button class="btn orange big" type="submit">${esc(t("create"))}</button>
      </form>
      <p class="foot">${esc(t("powered"))}</p>`;
  }
  function drawCard() {
    const c = data.card, s = data.shop, url = SITE + "carte.html?c=" + c.token;
    const showA = isApple() || !st.google, showG = !isApple();
    const acts = [];
    if (s.phone) acts.push(`<a class="act" href="tel:${esc(s.phone)}"><span>${ICS.call}</span>${esc(t("call"))}</a>`);
    if (s.whatsapp) acts.push(`<a class="act" target="_blank" rel="noopener" href="${esc(wa(s.whatsapp, ""))}"><span>${ICS.wa}</span>${esc(t("wa"))}</a>`);
    if (s.address) acts.push(`<a class="act" target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(s.address)}"><span>${ICS.map}</span>${esc(t("map"))}</a>`);
    if (s.instagram) acts.push(`<a class="act" target="_blank" rel="noopener" href="https://instagram.com/${esc(s.instagram)}"><span>${ICS.insta}</span>${esc(t("insta"))}</a>`);
    if (s.website) acts.push(`<a class="act" target="_blank" rel="noopener" href="${esc(s.website)}"><span>${ICS.web}</span>${esc(t("web"))}</a>`);
    const gift = giftOf(s);
    root.innerHTML = top() + `
      ${welcome ? `<div class="ok pop">${esc(t("welcome", { n: s.welcome_stamps }))}</div>` : ""}
      <div style="height:10px"></div>
      ${cardHtml(s, c, { qr: true, pop: welcome, popIndex: popIdx })}
      <div class="box">
        ${c.rewards_ready > 0 ? `<div class="line-act"><span class="sq" style="background:var(--p-yellow)">${sv(P.gift)}</span><div class="grow"><b>${esc(t("ready"))}</b></div></div>`
          : `<div class="prog"><span class="bar"><i style="width:${Math.round(100 * c.stamps / s.stamps_needed)}%"></i></span><b>${ltr(t("prog", { a: c.stamps, b: s.stamps_needed }))}</b></div>
             <div style="margin-top:10px;font-weight:600">${esc(t("left", { n: s.stamps_needed - c.stamps, r: rewardOf(s) }))}</div>`}
        <div class="muted small" style="margin-top:4px">${esc(t("show"))}</div></div>
      ${showA || showG ? `<div class="box"><div class="h2">${esc(t("walletT"))}</div><p class="muted small" style="margin:0 0 4px">${esc(t("saveHint"))}</p>
        ${showA ? `<button class="wbtn" data-apple${st.apple ? "" : " disabled"}>${AW}${esc(t("addA"))}</button>` : ""}
        ${showG ? `<button class="wbtn" data-google${st.google ? "" : " disabled"}>${GW}${esc(t("addG"))}</button>` : ""}
        ${(showA && !st.apple) || (showG && !st.google) ? `<p class="muted small" style="text-align:center;margin:10px 0 0">${esc(t("soon"))}</p>` : ""}</div>` : ""}
      ${acts.length ? `<div class="box"><div class="h2" style="margin-bottom:14px"><bdi>${esc(shopName(s))}</bdi></div><div class="acts">${acts.join("")}</div></div>` : ""}
      ${s.referral_stamps > 0 ? `<div class="box line-act"><span class="sq" style="background:var(--p-violet)">${sv(P.users)}</span><div class="grow"><b>${esc(t("refT"))}</b><span class="muted small">${esc(t("refS", { n: s.referral_stamps }))}</span></div>
        <button class="btn sm" data-share>${sv(P.share, 16)}${esc(t("wa"))}</button></div>` : ""}
      ${s.review_url ? `<div class="box line-act"><span class="sq" style="background:var(--p-yellow)">${sv(P.star)}</span><div class="grow"><b>${esc(t("revT"))}</b><span class="muted small">${esc(t("revS"))}</span></div>
        <a class="btn sm" target="_blank" rel="noopener" href="${esc(s.review_url)}">${esc(t("revB"))}</a></div>` : ""}
      ${gift && c.birthday ? `<div class="box line-act"><span class="sq" style="background:var(--p-pink)">${sv(P.cake)}</span><div class="grow small">${esc(t("bdayOn", { gift }))} · ${ltr(c.birthday)}</div></div>` : ""}
      <p class="muted small" style="text-align:center;overflow-wrap:anywhere;margin-top:22px">${esc(t("keep"))}<br>${ltr(url)}</p>
      <p class="foot">${esc(t("powered"))}</p>`;
    qr(document.getElementById("fcQr"), c.token, 132);
    if (c.rewards_ready > 0) confetti();
  }
  root.addEventListener("click", async e => {
    const b = e.target.closest("button, a");
    if (!b) return;
    if (b.dataset.lang != null) { setLang(L === "he" ? "fr" : "he"); return draw(); }
    if (b.dataset.google != null) { b.disabled = true; try { location.href = (await wallet({ action: "google", token: data.card.token })).url; } catch (x) { alert(t("errGen")); } b.disabled = false; }
    if (b.dataset.apple != null) location.href = C.fn + "?apple=" + encodeURIComponent(data.card.token);
    if (b.dataset.share != null) {
      const s = data.shop, url = SITE + "carte.html?s=" + s.code + "&ref=" + data.card.token, msg = t("refMsg", { shop: shopName(s), url });
      if (navigator.share) navigator.share({ text: msg }).catch(() => {}); else window.open(wa("", msg), "_blank");
    }
  });
  root.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, err = document.getElementById("err"), btn = f.querySelector("button"), bad = m => { err.textContent = m; err.classList.remove("hidden"); };
    if (!f.name.value.trim()) return bad(t("errName"));
    const ph = f.phone.value.replace(/\D/g, "").replace(/^972/, "0");
    if (!/^0(5\d{8}|7\d{8}|[2-489]\d{7})$/.test(ph)) return bad(t("errPhone"));
    btn.disabled = true; btn.textContent = t("wait");
    try {
      data = await rpc("fid_join", { p_code: code, p_phone: ph, p_name: f.name.value.trim(), p_birthday: (f.bday && f.bday.value) || null,
        p_ref: /^[0-9a-f-]{36}$/i.test(ref || "") ? ref : null, p_lang: L });
      welcome = !data.again && data.shop.welcome_stamps > 0; popIdx = data.card.stamps - 1;
      try { localStorage.setItem(KEY, data.card.token); } catch (x) { /* bloqué */ }
      history.replaceState(null, "", "carte.html?c=" + data.card.token);
      draw(); scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      const m = String(x.message);
      bad(/phone_taken/.test(m) ? t("errTaken") : /bad_phone/.test(m) ? t("errPhone") : t("errGen"));
      btn.disabled = false; btn.textContent = t("create");
    }
  });
  try {
    if (token) data = await rpc("fid_card", { p_token: token });
    if (data && data.card && !q.get("lang") && data.card.lang && !localStorage.getItem("fc.lang")) setLang(data.card.lang);
    if (!data && code) shop = await rpc("fid_public", { p_code: code });
  } catch (x) { /* page d'erreur */ }
  draw();
}

const THEMES = ["cafe", "pizza", "burger", "sushi", "bakery", "beauty", "barber", "flower", "shop", "sport", "pet", "heart"];
const COLORS = ["#8A5A3C", "#E2574C", "#E0803A", "#C98B3E", "#2F7D6D", "#2D9C6A", "#3D5A80", "#5B6CF0", "#B05FA8", "#D9668F", "#E25775", "#111418"];
async function pagePro() {
  initLang();
  const root = document.getElementById("app"), q = new URLSearchParams(location.search);
  let k = q.get("k");
  if (!k) { try { k = localStorage.getItem("fc.pro"); } catch (e) { /* bloqué */ } if (k) history.replaceState(null, "", "pro.html?k=" + k); }
  const S = { d: null, tab: "stamp", found: null, note: "", draft: null, theme: "cafe" };
  const top = () => `<div class="top"><span class="brandmini">${MARK}${S.d ? `<bdi>${esc(shopName(S.d.shop))}</bdi>` : `<span>${esc(t("powered0"))}</span>`}</span><button class="chip" data-lang>${esc(t("lang"))}</button></div>`;
  if (!/^[0-9a-f-]{36}$/i.test(k || "")) return signup();

  function signup() {
    root.innerHTML = top() + `<div class="hero-l rise"><span class="eyebrow">${esc(L === "he" ? "חודש ראשון חינם" : "1er mois offert")}</span><h1 class="h1" style="font-size:34px">${esc(t("proT"))}</h1>
      <p class="sub">${esc(t("proS"))}</p></div>
      <form class="box" id="sign" novalidate>
        <label class="f"><span>${esc(t("shopName"))}</span><input class="in" name="name" maxlength="40"></label>
        <label class="f"><span>${esc(t("yourPhone"))}</span><input class="in" name="phone" type="tel" dir="ltr" placeholder="05X XXX XXXX"></label>
        <label class="f"><span>${esc(t("kind"))}</span><div class="themes">${THEMES.map(x => `<button type="button" data-th="${x}" class="${x === S.theme ? "on" : ""}">${ICO.svg(x, 24, "#111418", 1.8)}</button>`).join("")}</div></label>
        <div class="err hidden" id="err"></div>
        <button class="btn orange big" type="submit">${esc(t("start"))}</button></form>`;
  }
  async function load() {
    try { S.d = await rpc("fid_pro_get", { p_token: k }); try { localStorage.setItem("fc.pro", k); } catch (e) { /* bloqué */ } }
    catch (e) { try { localStorage.removeItem("fc.pro"); } catch (x) { /* bloqué */ } k = null; return signup(); }
    if (!S.d.shop.configured && !S.draft) S.tab = "card";
    S.w = await walletStatus();
    draw();
  }
  const fmtD = d => new Date(d).toLocaleDateString(L === "he" ? "he-IL" : "fr-FR");
  function memRow(c, actions) {
    const s = S.d.shop;
    return `<div class="mem" data-card="${esc(c.token)}"><span class="av">${esc((c.name || "?").trim().charAt(0).toUpperCase())}</span><div class="grow"><b>${esc(c.name || "—")}</b> <span class="muted small">${ltr("···" + String(c.phone || "").slice(-4))}</span>
      <small>${esc(c.last_visit_at ? t("last", { d: fmtD(c.last_visit_at) }) : t("never"))}</small></div>
      <div class="st">${ltr(c.stamps + "/" + s.stamps_needed)}${c.rewards_ready > 0 ? `<em>${esc(t("gifts"))} : ${c.rewards_ready}</em>` : ""}</div>
      ${actions ? `<div class="acts2"><button class="btn orange" data-stamp="1">${esc(t("plus1"))}</button><button class="btn" data-stamp="2">+2</button>
        ${c.rewards_ready > 0 ? `<button class="btn dark" data-redeem>${esc(t("redeem"))}</button>` : ""}</div>` : ""}</div>`;
  }
  function draw() {
    if (root.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const s = S.d.shop, st = S.d.stats || {};
    const tabs = [["stamp", t("tabStamp"), P.stamp], ["clients", t("tabClients"), P.users], ["card", t("tabCard"), P.card], ["share", t("tabShare"), P.qr]];
    let body = "";
    if (S.tab === "stamp") body = `
      <div class="box"><div class="h2">${esc(t("tabStamp"))}</div>
        <form class="row" id="find"><input class="in grow" name="q" placeholder="${esc(t("findPh"))}" autocomplete="off"><button class="btn orange" type="submit">${esc(t("find"))}</button></form>
        <button class="btn big dark" style="margin-top:12px" data-scan>${sv(P.cam, 20, "#fff")}${esc(t("scan"))}</button><video class="scan hidden" id="vid" playsinline muted></video>
        ${S.note ? `<div class="ok pop">${esc(S.note)}</div>` : ""}
        <div>${S.found ? (S.found.length ? S.found.map(c => memRow(c, true)).join("") : `<p class="muted">${esc(t("none"))}</p>`) : ""}</div></div>
      <div class="box"><div class="stats">
        <div class="stat"><b>${st.cards || 0}</b><small>${esc(t("sCards"))}</small></div><div class="stat"><b>${st.stamps_month || 0}</b><small>${esc(t("sStamps"))}</small></div>
        <div class="stat"><b>${st.rewards_month || 0}</b><small>${esc(t("sGifts"))}</small></div></div></div>`;
    if (S.tab === "clients") {
      const sl = (S.d.members || []).filter(m => m.sleeping);
      body = `
      <div class="box"><div class="stats">
        <div class="stat"><b>${st.new_month || 0}</b><small>${esc(t("sMonth"))}</small></div><div class="stat"><b>${st.wallet || 0}</b><small>${esc(t("sWallet"))}</small></div>
        <div class="stat"><b>${st.referrals || 0}</b><small>${esc(t("sRef"))}</small></div></div></div>
      <div class="box"><div class="h2">${esc(t("msgT"))}</div><p class="muted small">${esc(t("msgS"))}</p>
        <div class="small muted" style="margin-top:8px">${esc(t("tpl"))}</div><div class="chips">${ta("tpls").map(x => `<button type="button" data-tpl="${esc(x)}">${esc(x)}</button>`).join("")}</div>
        <textarea class="in" id="msg" maxlength="200" placeholder="${esc(t("msgPh"))}"></textarea><div style="height:10px"></div>
        <button class="btn orange" data-send>${sv(P.send, 18, "#fff")}${esc(t("send"))}</button></div>
      <div class="box"><div class="h2">${esc(t("sleepT"))}</div>${s.relance_days > 0 ? `<p class="muted small">${esc(t("sleepS", { n: s.relance_days }))}</p>` : ""}
        ${sl.length ? sl.slice(0, 40).map(c => `<div class="mem"><div class="grow"><b>${esc(c.name)}</b><small>${esc(c.last_visit_at ? t("last", { d: fmtD(c.last_visit_at) }) : t("never"))}</small></div>
          <a class="btn sm" target="_blank" rel="noopener" data-rel="${esc(c.token)}" href="${esc(wa(c.phone, (L === "he" ? s.relance_msg_he : s.relance_msg) || t("relTxt", { name: c.name, shop: shopName(s), left: s.stamps_needed - c.stamps })))}">${esc(t("wa"))}</a></div>`).join("")
          : `<p class="muted">${esc(t("sleepNone"))}</p>`}</div>
      <div class="box"><div class="row" style="margin-bottom:6px"><div class="h2 grow" style="margin:0">${esc(t("allT", { n: (S.d.members || []).length }))}</div>
        ${(S.d.members || []).length ? `<button class="btn sm" data-csv>${sv(P.dl, 16)}${esc(t("csv"))}</button>` : ""}</div>${(S.d.members || []).map(c => memRow(c, false)).join("")}</div>`;
    }
    if (S.tab === "card") body = cardForm();
    if (S.tab === "share") body = `
      <div class="box"><div class="h2">${esc(t("shareT"))}</div><p class="muted small">${esc(t("shareS"))}</p>
        <div class="poster" style="--c:${esc(s.color)}"><b><bdi>${esc(s.name)}</bdi></b>${s.name_he && s.name_he !== s.name ? `<b dir="rtl">${esc(s.name_he)}</b>` : ""}
          <span dir="ltr">${esc(T.fr.posterT)}</span><span dir="rtl">${esc(T.he.posterT)}</span>
          <div class="qrb" id="pq"></div>
          <span dir="ltr"><b style="display:inline;font-size:18px">${esc(s.stamps_needed + " tampons = " + (s.reward || s.reward_he || ""))}</b></span>
          ${s.reward_he ? `<span dir="rtl"><b style="display:inline;font-size:18px">${esc(s.stamps_needed + " חותמות = " + s.reward_he)}</b></span>` : ""}
          <span dir="ltr">${esc(T.fr.posterS)}</span><span dir="rtl">${esc(T.he.posterS)}</span></div>
        <div class="btns" style="margin-top:16px"><button class="btn orange" data-print>${esc(t("print"))}</button><button class="btn" data-copy>${esc(t("copy"))}</button>
          <a class="btn" target="_blank" rel="noopener" href="${esc(wa("", (L === "he" ? "כרטיס המועדון של " : "Votre carte de fidélité ") + shopName(s) + " : " + SITE + "carte.html?s=" + s.code))}">${esc(t("shareWa"))}</a></div>
        <p class="muted small" style="overflow-wrap:anywhere">${ltr(SITE + "carte.html?s=" + s.code)}</p></div>
      <div class="box small muted">${esc(t("walletState", { g: t(S.w.google ? "gOn" : "gOff"), a: t(S.w.apple ? "aOn" : "aOff") }))}<br>${esc(t("keepLink"))}<br>${ltr(location.href)}</div>`;
    root.innerHTML = top() + `<div class="tabs">${tabs.map(([id, n, ic]) => `<button data-tab="${id}" class="${S.tab === id ? "on" : ""}">${sv(ic, 17, S.tab === id ? "#fff" : "#111418")}${esc(n)}</button>`).join("")}</div>` + body;
    if (S.tab === "share") qr(document.getElementById("pq"), SITE + "carte.html?s=" + s.code, 190);
    if (S.tab === "card") preview();
  }
  function cardForm() {
    const s = S.draft || (S.draft = Object.assign({}, S.d.shop));
    const f = (k2, label, ph, dir, type) => `<label class="f"><span>${esc(t(label))}</span><input class="in" data-k="${k2}" value="${esc(s[k2] == null ? "" : s[k2])}"${ph ? ` placeholder="${esc(t(ph))}"` : ""}${dir ? ` dir="${dir}"` : ""}${type ? ` type="${type}"` : ""}></label>`;
    return `<div class="grid2"><div>
      <div class="box"><div class="h2">${esc(t("look"))}</div>
        <label class="f"><span>${esc(t("logo"))}</span><div class="row"><span class="fc-logo" style="border:var(--line)">${s._logo || logoSrc(s) ? `<img src="${esc(s._logo || logoSrc(s))}" alt="">` : ICO.svg(s.theme, 28, s.color, 2)}</span>
          <label class="btn sm">${esc(t("logoB"))}<input type="file" accept="image/*" id="logoIn" hidden></label></div></label>
        ${f("name", "shopName")}${f("name_he", "nameHe", "", "rtl")}
        <label class="f"><span>${esc(t("color"))}</span><div class="colors">${COLORS.map(c => `<button type="button" data-col="${c}" class="${c === s.color ? "on" : ""}" style="background:${c}"></button>`).join("")}</div></label>
        <label class="f"><span>${esc(t("theme"))}</span><div class="themes">${THEMES.map(x => `<button type="button" data-th2="${x}" class="${x === s.theme ? "on" : ""}">${ICO.svg(x, 24, "#111418", 1.8)}</button>`).join("")}</div></label></div>
      <div class="box"><div class="h2">${esc(t("rules"))}</div>
        <label class="f"><span>${esc(t("need"))} : <b id="needV">${s.stamps_needed}</b></span><input type="range" min="3" max="20" data-k="stamps_needed" value="${s.stamps_needed}" style="width:100%"></label>
        ${f("reward", "reward", "rewardPh", "ltr")}${f("reward_he", "rewardHe", "rewardPh", "rtl")}
        ${f("welcome_stamps", "welcomeSt", "", "ltr", "number")}${f("referral_stamps", "refSt", "", "ltr", "number")}</div>
      <div class="box"><div class="h2">${esc(t("auto"))}</div>
        ${f("birthday_gift", "bdayGift", "bdayPh", "ltr")}${f("birthday_gift_he", "bdayGiftHe", "bdayPh", "rtl")}
        ${f("relance_days", "relDays", "", "ltr", "number")}${f("relance_msg", "relMsg", "relPh", "ltr")}${f("relance_msg_he", "relMsgHe", "relPh", "rtl")}</div>
      <div class="box"><div class="h2">${esc(t("geo"))}</div><p class="muted small">${esc(t("geoS"))}</p>
        <button type="button" class="btn" data-geo style="white-space:normal">${sv(P.pin, 18)}${esc(t("geoB"))}</button>${s.lat != null ? `<div class="ok">${esc(t("geoOk"))} ${ltr(Number(s.lat).toFixed(4) + ", " + Number(s.lon).toFixed(4))}</div>` : ""}
        ${f("near_msg", "nearMsg", "nearPh", "ltr")}${f("near_msg_he", "nearMsgHe", "nearPh", "rtl")}</div>
      <div class="box"><div class="h2">${esc(t("links"))}</div>
        ${f("review_url", "review", "", "ltr", "url")}${f("phone", "tel", "", "ltr", "tel")}${f("whatsapp", "whatsapp", "", "ltr", "tel")}${f("instagram", "insta2", "", "ltr")}${f("website", "site", "", "ltr", "url")}${f("address", "addr")}</div>
      <div class="err hidden" id="err"></div>
      <button class="btn orange big" data-save>${esc(t("save"))}</button>
    </div><div style="position:sticky;top:12px"><div class="box soft"><div class="h2">${esc(t("preview"))}</div><div id="pv"></div></div></div></div>`;
  }
  function preview() { const pv = document.getElementById("pv"); if (pv) pv.innerHTML = cardHtml(Object.assign({}, S.draft, { logo: !!(S.draft._logo || S.draft.logo) }), null); if (pv && S.draft._logo) { const im = pv.querySelector(".fc-logo"); if (im) im.innerHTML = `<img src="${S.draft._logo}" alt="">`; } }
  async function find(qq) { S.note = ""; try { S.found = await rpc("fid_pro_find", { p_token: k, p_q: qq }); } catch (e) { S.found = []; } draw(); }
  let stream = null;
  const stop = () => { if (stream) stream.getTracks().forEach(x => x.stop()); stream = null; const v = document.getElementById("vid"); if (v) v.classList.add("hidden"); };
  async function scan() {
    const v = document.getElementById("vid");
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices) { S.note = t("camErr"); return draw(); }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      v.srcObject = stream; v.classList.remove("hidden"); await v.play();
      const det = new BarcodeDetector({ formats: ["qr_code"] }), until = Date.now() + 30000;
      while (stream && Date.now() < until) { const cs = await det.detect(v).catch(() => []); if (cs.length) { stop(); return find(cs[0].rawValue); } await new Promise(r => setTimeout(r, 250)); }
      stop();
    } catch (e) { stop(); S.note = t("camErr"); draw(); }
  }
  function shrinkLogo(file) {
    return new Promise((res, rej) => { const img = new Image(), fr = new FileReader();
      fr.onload = () => { img.onload = () => { const cv = document.createElement("canvas"), n = 256, sd = Math.min(img.width, img.height); cv.width = cv.height = n;
        const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, n, n); x.drawImage(img, (img.width - sd) / 2, (img.height - sd) / 2, sd, sd, 0, 0, n, n); res(cv.toDataURL("image/png")); };
        img.onerror = rej; img.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(file); });
  }
  function printPoster() {
    const s = S.d.shop, img = document.querySelector("#pq img"), cv = document.querySelector("#pq canvas"), src = (img && img.src) || (cv && cv.toDataURL()) || "";
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(s.name)}</title><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800&display=swap" rel="stylesheet"><style>
      body{margin:0;font-family:Heebo,Arial,sans-serif;display:flex;justify-content:center;padding:24px;background:#fff}
      .c{width:150mm;border-radius:24px;background:${esc(s.color)};color:#fff;text-align:center;padding:30px 24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .t{display:inline-block;background:#fff;color:#111418;border-radius:999px;padding:6px 20px;font-weight:800;font-size:22px;letter-spacing:.5px}
      h1{margin:18px 0 4px;font-size:40px;font-weight:800;letter-spacing:-.5px}p{margin:4px 0;font-size:19px;opacity:.92}img{background:#fff;padding:14px;border-radius:18px;width:66mm;height:66mm;margin:16px 0}b{display:block;font-size:24px;margin:4px 0}</style>
      <div class="c"><span class="t">SCANNEZ-MOI · סרקו אותי</span><h1>${esc(s.name)}</h1>${s.name_he && s.name_he !== s.name ? `<h1 dir="rtl" style="margin-top:0">${esc(s.name_he)}</h1>` : ""}
      <p>${esc(T.fr.posterT)}</p><p dir="rtl">${esc(T.he.posterT)}</p><img src="${src}">
      <b>${esc(s.stamps_needed + " tampons = " + (s.reward || s.reward_he || ""))}</b>${s.reward_he ? `<b dir="rtl">${esc(s.stamps_needed + " חותמות = " + s.reward_he)}</b>` : ""}
      <p>Sans appli · 20 secondes</p><p dir="rtl">בלי אפליקציה · 20 שניות</p></div><script>setTimeout(()=>print(),700)<\/script>`);
    w.document.close();
  }
  root.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset.k && S.draft) { S.draft[el.dataset.k] = el.type === "range" ? Number(el.value) : el.value; if (el.type === "range") document.getElementById("needV").textContent = el.value; preview(); }
  });
  root.addEventListener("change", async e => {
    if (e.target.id !== "logoIn" || !e.target.files[0]) return;
    try { S.draft._logo = await shrinkLogo(e.target.files[0]); if (S.draft._logo.length > 190000) { S.draft._logo = null; alert(t("logoBig")); } } catch (x) { alert(t("errGen")); }
    document.activeElement.blur(); draw();
  });
  root.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "find") return find(f.q.value.trim());
    if (f.id === "sign") {
      const err = document.getElementById("err"), bad = m => { err.textContent = m; err.classList.remove("hidden"); };
      if (!f.name.value.trim()) return bad(t("errName"));
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        const r = await rpc("fid_signup", { p_name: f.name.value.trim(), p_phone: f.phone.value, p_theme: S.theme });
        k = r.token; history.replaceState(null, "", "pro.html?k=" + k);
        await rpc("fid_pro_save", { p_token: k, p: { name: f.name.value.trim(), theme: S.theme, color: ICO.COLORS[S.theme], stamps_needed: 10, relance_days: 30, referral_stamps: 1 } });
        load();
      } catch (x) { bad(/bad_phone/.test(x.message) ? t("errPhone") : t("errGen")); btn.disabled = false; }
    }
  });
  root.addEventListener("click", async e => {
    const b = e.target.closest("button, a");
    if (!b) return;
    if (b.dataset.lang != null) { setLang(L === "he" ? "fr" : "he"); return S.d ? draw() : signup(); }
    if (b.dataset.th) { S.theme = b.dataset.th; root.querySelectorAll("[data-th]").forEach(x => x.classList.toggle("on", x === b)); return; }
    if (b.dataset.tab) { stop(); S.tab = b.dataset.tab; S.note = ""; return draw(); }
    if (b.dataset.th2 && S.draft) { S.draft.theme = b.dataset.th2; root.querySelectorAll("[data-th2]").forEach(x => x.classList.toggle("on", x === b)); return preview(); }
    if (b.dataset.col && S.draft) { S.draft.color = b.dataset.col; root.querySelectorAll("[data-col]").forEach(x => x.classList.toggle("on", x === b)); return preview(); }
    if (b.dataset.tpl) { const m = document.getElementById("msg"); if (m) { m.value = b.dataset.tpl; m.focus(); } return; }
    if (b.dataset.csv != null) {
      const rows = [["Prénom", "Téléphone", "Tampons", "Cadeaux", "Dernier passage", "Anniversaire"]].concat((S.d.members || []).map(c => [c.name, c.phone, c.stamps, c.rewards_ready, c.last_visit_at ? fmtD(c.last_visit_at) : "", c.birthday || ""]));
      const csv = "\ufeff" + rows.map(r => r.map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "clients-" + S.d.shop.code + ".csv"; a.click(); return;
    }
    if (b.dataset.scan != null) return scan();
    if (b.dataset.print != null) return printPoster();
    if (b.dataset.copy != null) { try { await navigator.clipboard.writeText(SITE + "carte.html?s=" + S.d.shop.code); b.textContent = t("copied"); } catch (x) { prompt("", SITE + "carte.html?s=" + S.d.shop.code); } return; }
    if (b.dataset.rel) { rpc("fid_pro_relanced", { p_token: k, p_card: b.dataset.rel }).catch(() => {}); return; }
    if (b.dataset.geo != null) {
      if (!navigator.geolocation) return alert(t("geoErr"));
      navigator.geolocation.getCurrentPosition(p => { S.draft.lat = p.coords.latitude; S.draft.lon = p.coords.longitude; draw(); }, () => alert(t("geoErr")), { enableHighAccuracy: true, timeout: 15000 });
      return;
    }
    if (b.dataset.send != null) {
      const m = (document.getElementById("msg").value || "").trim();
      if (m.length < 5) return alert(t("short"));
      b.disabled = true;
      try { const r = await wallet({ action: "message", k, text: m }); document.getElementById("msg").value = ""; alert(t("sent", { n: r.sent || 0 })); }
      catch (x) { alert(/broadcast_wait/.test(x.message) ? t("msgWait") : t("errGen")); }
      b.disabled = false; return;
    }
    if (b.dataset.save != null) {
      const d = S.draft, err = document.getElementById("err");
      if (!d.reward && !d.reward_he) { err.textContent = t("rewardPh"); err.classList.remove("hidden"); return; }
      const p = {}; ["name", "name_he", "theme", "color", "stamps_needed", "reward", "reward_he", "welcome_stamps", "referral_stamps", "birthday_gift", "birthday_gift_he", "relance_days",
        "relance_msg", "relance_msg_he", "review_url", "phone", "whatsapp", "instagram", "website", "address", "lat", "lon", "near_msg", "near_msg_he"].forEach(x => { p[x] = d[x] == null ? "" : d[x]; });
      if (d._logo) p.logo = d._logo;
      p.active = true;
      b.disabled = true;
      try { await rpc("fid_pro_save", { p_token: k, p }); S.draft = null; b.textContent = t("saved"); await load(); }
      catch (x) { err.textContent = /bad_link/.test(x.message) ? t("badLink") : /logo/.test(x.message) ? t("logoBig") : t("errGen"); err.classList.remove("hidden"); b.disabled = false; }
      return;
    }
    const row = b.closest("[data-card]");
    if (!row) return;
    const card = row.dataset.card; b.disabled = true;
    try {
      if (b.dataset.stamp) {
        const c = await rpc("fid_pro_stamp", { p_token: k, p_card: card, p_n: Number(b.dataset.stamp) });
        S.found = (S.found || []).map(x => x.token === card ? c : x);
        S.note = c.won ? t("won", { r: rewardOf(S.d.shop) }) : t("stamped");
        if (c.won) confetti();
        wallet({ action: "sync", token: card, won: !!c.won }).catch(() => {});
      } else if (b.dataset.redeem != null) {
        const c = await rpc("fid_pro_redeem", { p_token: k, p_card: card });
        S.found = (S.found || []).map(x => x.token === card ? c : x);
        S.note = t("redeemed");
        wallet({ action: "sync", token: card }).catch(() => {});
      }
      const d = await rpc("fid_pro_get", { p_token: k }).catch(() => null); if (d) S.d = d;
      draw();
    } catch (x) { S.note = /too_fast/.test(x.message) ? t("tooFast") : t("errGen"); draw(); }
  });
  load();
}

function pageHome() {
  initLang();
  const root = document.getElementById("app"), he = L === "he";
  const demoShop = { code: "X", name: he ? "פיצה נאפולי" : "Pizza Napoli", theme: "pizza", color: "#C8432F", stamps_needed: 10, reward: "Une pizza offerte", reward_he: "פיצה מתנה" };
  const F = he ? [
    ["bell", "התראות במסך הנעילה", "חותמת, מתנה מוכנה, מבצע: הלקוח רואה הכול, גם בלי לפתוח כלום."],
    ["pin", "כשהוא עובר ליד", "תזכורת אוטומטית כשהלקוח עובר ליד העסק."],
    ["cake", "ימי הולדת", "המתנה נשלחת לבד, ביום הנכון."],
    ["back", "תזכורת אוטומטית", "לקוח שלא חזר 30 יום? הכרטיס מזכיר לו."],
    ["users", "חבר מביא חבר", "הלקוח שולח את הכרטיס לחבר ומרוויח חותמת."],
    ["star", "ביקורות בגוגל", "כפתור על הכרטיס, והכוכבים מגיעים."],
    ["send", "הודעה לכל הלקוחות", "מבצע? הודעה אחת, וכולם יודעים."],
    ["chart", "סטטיסטיקות", "כמה לקוחות, כמה חותמות, מי לא חזר."],
    ["card", "בצבעים שלכם", "לוגו, צבע, אייקון ומתנה: הכרטיס נראה כמו העסק."],
    ["dl", "הלקוחות שלכם", "הרשימה שייכת לכם: מורידים אותה ב-Excel בכל רגע."]]
  : [["bell", "Notifications sur l'écran verrouillé", "Tampon, cadeau prêt, promo : le client voit tout, sans rien ouvrir."],
    ["pin", "Quand il passe devant", "Un rappel automatique quand le client passe près de chez vous."],
    ["cake", "Anniversaires", "Le cadeau part tout seul, le bon jour."],
    ["back", "Relance automatique", "Un client ne revient plus depuis 30 jours ? La carte le relance."],
    ["users", "Parrainage", "Le client envoie la carte à un ami et gagne un tampon."],
    ["star", "Avis Google", "Un bouton sur la carte, et les étoiles arrivent."],
    ["send", "Message à tous vos clients", "Une promo ? Un message, et tout le monde est prévenu."],
    ["chart", "Statistiques", "Combien de clients, de tampons, qui ne revient plus."],
    ["card", "À vos couleurs", "Logo, couleur, icône et cadeau : la carte vous ressemble."],
    ["dl", "Vos clients, à vous", "La liste vous appartient : téléchargez-la en Excel quand vous voulez."]];
  const STEPS = he ? [["יוצרים את הכרטיס", "שם, צבע, לוגו ומתנה. 2 דקות."], ["שמים את ה-QR בקופה", "מדפיסים את השלט, או מזמינים מעמד."], ["הלקוח סורק", "הכרטיס בארנק שלו תוך 20 שניות."], ["חותמת בכל ביקור", "סורקים את הכרטיס שלו, לחיצה אחת."]]
    : [["Vous créez la carte", "Nom, couleur, logo et cadeau. 2 minutes."], ["Le QR code à la caisse", "Vous imprimez l'affiche, ou on vous envoie un chevalet."], ["Le client scanne", "Sa carte est dans son Wallet en 20 secondes."], ["Un tampon à chaque passage", "Vous scannez sa carte, en un clic."]];
  const FAQ = he ? [
    ["הלקוח צריך להוריד אפליקציה?", "לא. הכרטיס נשמר ב-Google Wallet (אנדרואיד) או ב-Apple Wallet (אייפון), שכבר נמצאים בטלפון."],
    ["ומה אם אין לו ארנק בטלפון?", "הכרטיס קיים גם כדף אינטרנט: הוא שומר את הקישור ומציג את קוד ה-QR בקופה."],
    ["כמה זמן לוקח להתחיל?", "2 דקות ליצור את הכרטיס. אנחנו עוזרים לכם בהקמה, בחינם."],
    ["אפשר להפסיק מתי שרוצים?", "כן, בלי התחייבות. החודש הראשון חינם."],
    ["של מי הנתונים של הלקוחות?", "שלכם. אפשר להוריד את הרשימה בכל רגע (Excel)."],
    ["איך מוסיפים חותמת?", "סורקים את הכרטיס של הלקוח עם הטלפון, או מקלידים 4 ספרות אחרונות של הטלפון שלו."]]
  : [["Le client doit-il télécharger une appli ?", "Non. La carte va dans Google Wallet (Android) ou Apple Wallet (iPhone), déjà présents dans le téléphone."],
    ["Et s'il n'a pas de Wallet ?", "La carte existe aussi en page web : il garde le lien et montre son QR code au comptoir."],
    ["Combien de temps pour démarrer ?", "2 minutes pour créer la carte. On vous aide à la mettre en place, gratuitement."],
    ["Je peux arrêter quand je veux ?", "Oui, sans engagement. Le premier mois est offert."],
    ["À qui sont les données des clients ?", "À vous. Vous pouvez télécharger la liste à tout moment (Excel)."],
    ["Comment j'ajoute un tampon ?", "Vous scannez la carte du client avec votre téléphone, ou vous tapez les 4 derniers chiffres de son numéro."]];
  const TR = he ? ["בלי אפליקציה", "בלי התחייבות", "חודש ראשון חינם", "עברית וצרפתית"] : ["Sans appli", "Sans engagement", "1er mois offert", "Français et hébreu"];
  const cls = ["", " c2", " c3", " c4", " c5", " c6", "", " c2", " c3", " c4"];
  let n = 6;
  const notifTxt = k => k >= 10 ? [he ? "המתנה מחכה לך!" : "Ton cadeau t'attend !", he ? "פיצה מתנה בביקור הבא" : "Une pizza offerte à ton prochain passage"]
    : [he ? "חותמת חדשה!" : "Nouveau tampon !", he ? `עוד ${10 - k} ביקורים עד פיצה מתנה` : `Plus que ${10 - k} passage(s) avant ta pizza offerte`];
  const notif = k => { const [a, b] = notifTxt(k); return `<div class="nlogo" style="background:${demoShop.color}">${ICO.svg("pizza", 18, "#fff", 2)}</div><div class="grow"><b><bdi>${esc(demoShop.name)}</bdi> · ${esc(a)}</b><span>${esc(b)}</span></div><time>${he ? "עכשיו" : "maintenant"}</time>`; };
  const demoCard = (pop) => cardHtml(demoShop, { name: he ? "נועה כ." : "Julie M.", stamps: n, rewards_ready: n >= 10 ? 1 : 0 }, { popIndex: pop });
  root.innerHTML = `<div class="top"><span class="brandmini">${MARK}<span>${he ? "כרטיס מועדון" : "Carte fidélité"}</span></span>
      <span class="nav-l"><a class="lnk" href="#fonctions">${he ? "מה יש" : "Fonctions"}</a><a class="lnk" href="#prix">${he ? "מחירים" : "Prix"}</a><a class="lnk" href="#faq">${he ? "שאלות" : "Questions"}</a>
      <button class="chip" data-lang>${esc(t("lang"))}</button></span></div>
    <div class="grid2"><div class="hero-l rise">
        <span class="eyebrow">Google Wallet · Apple Wallet</span>
        <h1 class="h1">${he ? `כרטיס המועדון שלכם, <span class="soft">בטלפון של הלקוחות.</span>` : `Votre carte de fidélité, <span class="soft">dans le téléphone de vos clients.</span>`}</h1>
        <p class="sub">${he ? "בלי קרטון, בלי אפליקציה. הלקוח סורק את קוד ה-QR, והכרטיס נשמר בטלפון שלו תוך 20 שניות. הוא חוזר, ואתם יודעים מי הלקוחות הקבועים." : "Plus de carton, pas d'appli. Le client scanne le QR code, et sa carte est dans son téléphone en 20 secondes. Il revient, et vous connaissez enfin vos habitués."}</p>
        <div class="btns"><a class="btn orange" href="pro.html">${he ? "ליצור את הכרטיס שלי" : "Créer ma carte"}</a><a class="btn" href="carte.html?demo=1">${he ? "לראות כרטיס לדוגמה" : "Voir une carte exemple"}</a></div>
        <div class="trust">${TR.map(x => `<span>${sv(P.check, 16, "#0F1F3D", 2.4)}${esc(x)}</span>`).join("")}</div></div>
      <div style="padding-top:30px"><div class="demo-stage rise" style="animation-delay:.1s">
        <div class="notif" id="dNotif">${notif(n)}</div>
        <div id="dCard">${demoCard()}</div>
        <div class="demo-ctl"><button class="btn dark" data-dstamp>${sv(P.stamp, 18, "#fff")}${he ? "להוסיף חותמת" : "Ajouter un tampon"}</button><button class="btn" data-dreset>${he ? "מההתחלה" : "Recommencer"}</button></div>
        <p class="muted small" style="text-align:center;margin:10px 0 0">${he ? "נסו: ככה זה נראה אצל הלקוח" : "Essayez : voilà ce que voit votre client"}</p></div></div></div>
    <section class="sec" id="fonctions"><div class="sec-h"><h2 class="h3s">${he ? "כל מה שכרטיס קרטון לא יודע לעשות" : "Tout ce qu'une carte en carton ne sait pas faire"}</h2><p>${he ? "הכרטיס עובד בשבילכם, גם כשאתם עסוקים." : "La carte travaille pour vous, même quand vous êtes occupé."}</p></div>
      <div class="feat">${F.map(([i, ti, tx], k) => `<div class="box"><span class="ico${cls[k]}">${sv(P[i])}</span><b>${esc(ti)}</b><small>${esc(tx)}</small></div>`).join("")}</div></section>
    <section class="sec"><div class="sec-h"><h2 class="h3s">${he ? "ככה זה עובד" : "Comment ça marche"}</h2></div>
      <div class="steps">${STEPS.map(([a, b]) => `<div><span><b>${esc(a)}</b><small>${esc(b)}</small></span></div>`).join("")}</div></section>
    <div id="prix"></div>
    <section class="sec" id="faq"><div class="sec-h"><h2 class="h3s">${he ? "שאלות נפוצות" : "Questions fréquentes"}</h2></div>
      ${FAQ.map(([q, r]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join("")}</section>
    <div class="cta-end"><h2 class="h3s">${he ? "הלקוחות שלכם כבר מחזיקים טלפון." : "Vos clients ont déjà leur téléphone en main."}</h2><p>${he ? "הכרטיס שלכם מוכן תוך 2 דקות. החודש הראשון חינם." : "Votre carte est prête en 2 minutes. Le premier mois est offert."}</p>
      <a class="btn orange big" style="max-width:340px" href="pro.html">${he ? "ליצור את הכרטיס שלי" : "Créer ma carte"}</a></div>
    <p class="foot">${he ? "כרטיס מועדון בארנק" : "Carte fidélité dans le Wallet"} · ${new Date().getFullYear()}</p>`;
  const paint = pop => {
    const nb = document.getElementById("dNotif"); nb.classList.add("out");
    document.getElementById("dCard").innerHTML = demoCard(pop);
    setTimeout(() => { nb.innerHTML = notif(n); nb.classList.remove("out"); }, 180);
  };
  root.onclick = e => {
    if (e.target.closest("[data-lang]")) { setLang(L === "he" ? "fr" : "he"); return pageHome(); }
    if (e.target.closest("[data-dstamp]")) { if (n >= 10) n = 0; n++; paint(n - 1); if (n >= 10) confetti(); }
    if (e.target.closest("[data-dreset]")) { n = 0; paint(); }
  };
}

window.FC = { pageCard, pagePro, pageHome, heroSvg, cardHtml };
})();
