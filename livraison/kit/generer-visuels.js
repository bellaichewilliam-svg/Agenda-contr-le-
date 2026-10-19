// Génère les visuels de lancement (posts, stories, flyers) en PNG et PDF
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
// Usage : node generer-visuels.js <dossier des polices et de qrcodejs> (voir README)
const L = process.argv[2] || __dirname + '/libs', OUT = __dirname + '/visuels';
const APP = 'https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/';
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
.badge{background:#FF6A13;color:#fff;border-radius:22px;padding:12px 22px;font-family:Fredoka;font-weight:700}
.qrbox{background:#fff;border-radius:28px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px;color:#0F1F3D;font-weight:800}
.qrbox canvas,.qrbox img{display:block}
.foot{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.url{font-weight:700;opacity:.75;direction:ltr}
.scoot{position:absolute}
.road{position:absolute;left:0;right:0;border-bottom:6px dashed rgba(255,255,255,.18)}
ul.ok{list-style:none;display:grid;gap:16px}
ul.ok li{font-weight:700}
`;
const qr = (id, size) => `<div class="qrbox"><div id="${id}"></div><span style="font-size:${Math.round(size / 9)}px">{{scan}}</span></div>`;
// --- Contenus ------------------------------------------------------------------------
const T = {
  client: {
    fr: { h1: 'Et hop,<br><em>c\'est livré !</em>', sub: 'Colis · Poste · Super-Pharm · Restaurants · Courses', chips: ['🛵 Dans tout le Sharon', '📍 Suivi en direct', '💵 Espèces ou Bit', '🧾 Prix du magasin, 0 frais cachés'],
      price: '<span>Course dans Netanya</span><span><s>25 ₪</s> <b>15 ₪</b></span>', badge: '🎁 Première course', scan: 'Scannez et commandez', url: 'Commandez en 1 minute' },
    he: { h1: 'הופ,<br><em>וזה אצלך!</em>', sub: 'חבילות · דואר · סופר-פארם · מסעדות · קניות', chips: ['🛵 בכל השרון', '📍 מעקב בזמן אמת', '💵 מזומן או ביט', '🧾 מחיר החנות, 0 עמלות נסתרות'],
      price: '<span>משלוח בתוך נתניה</span><span><s>25 ₪</s> <b>15 ₪</b></span>', badge: '🎁 משלוח ראשון', scan: 'סורקים ומזמינים', url: 'מזמינים תוך דקה' },
    link: APP
  },
  shop: {
    fr: { h1: 'Votre commerce<br><em>livre avec HOP!</em>', sub: 'Restaurants · Boutiques · Pharmacies · Bureaux', chips: ['💸 0 % sur vos ventes', '🛵 Livreur en moins d\'une heure', '📱 Votre QR pour vos clients', '🧾 Reçu pour chaque course'],
      price: '<span>Course dans Netanya</span><span><b>25 ₪</b></span>', badge: '🎟️ Carnet 10 courses : 200 ₪', scan: 'Inscription gratuite', url: 'Votre espace pro en 1 minute' },
    he: { h1: 'העסק שלכם<br><em>שולח עם הופ!</em>', sub: 'מסעדות · חנויות · בתי מרקחת · משרדים', chips: ['💸 0% עמלה על המכירות', '🛵 שליח תוך פחות משעה', '📱 קוד QR ללקוחות שלכם', '🧾 קבלה על כל משלוח'],
      price: '<span>משלוח בתוך נתניה</span><span><b>25 ₪</b></span>', badge: '🎟️ כרטיסייה 10 משלוחים: 200 ₪', scan: 'הרשמה בחינם', url: 'אזור עסקי תוך דקה' },
    link: APP + 'commerce.html'
  },
  rider: {
    fr: { h1: 'Deviens livreur<br><em>partenaire HOP!</em>', sub: 'Scooter, voiture ou vélo · Netanya et le Sharon', chips: ['✅ Tu choisis tes courses', '🟢 En ligne quand tu veux', '🎯 Les courses proches de toi d\'abord', '🤝 +1 ₪ par commerce amené'],
      price: '<span>Commission HOP! par course</span><span><b>12 %</b> <small style="font-size:.45em;color:#5B6476">· min 3 ₪</small></span>', badge: '🛵 Pas d\'abonnement', scan: 'Inscris-toi', url: 'Permis, assurance, עוסק' },
    he: { h1: 'בואו להיות<br><em>שליחים בהופ!</em>', sub: 'קטנוע, רכב או אופניים · נתניה והשרון', chips: ['✅ בוחרים את המשלוחים', '🟢 מתחברים מתי שרוצים', '🎯 משלוחים קרובים אליכם קודם', '🤝 ‎+1 ₪ על כל עסק שמביאים'],
      price: '<span>העמלה של הופ! למשלוח</span><span><b>12%</b> <small style="font-size:.45em;color:#5B6476">· מינ׳ 3 ₪</small></span>', badge: '🛵 בלי מנוי', scan: 'להרשמה', url: 'רישיון, ביטוח, עוסק' },
    link: APP + 'coursier.html'
  }
};
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
    ${fmt !== 'post' ? `<div style="height:${Math.round(sw * 0.7) + 16}px;position:relative"><div class="road" style="bottom:6px"></div>${scoot(sw, `bottom:2px;${he ? 'right' : 'left'}:30px`)}</div>` : ''}
    <h1 style="font-size:${Math.round(110 * big)}px">${t.h1}</h1>
    <div class="sub" style="font-size:${Math.round(31 * big)}px">${t.sub}</div>
    <div class="chips" style="font-size:${Math.round(27 * big)}px">${t.chips.map(c => `<span class="chip">${c}</span>`).join('')}</div>
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
  return { html, W, H, qrSize, link: T[kind].link };
}
(async () => {
  const b = await chromium.launch();
  const qrJs = fs.readFileSync(L + '/q/package/qrcode.min.js', 'utf8');
  const made = [];
  for (const kind of ['client', 'shop', 'rider']) for (const lang of ['fr', 'he']) for (const fmt of ['post', 'story', 'flyer']) {
    const p = page(kind, lang, fmt);
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
