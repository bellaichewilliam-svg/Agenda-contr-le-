// Pub d'un commerce partenaire : « Le Marché Français vous livre ! », avec son vrai logo (celui de sa vitrine HOP!),
// en post carré et en story, français et hébreu. Le QR ouvre sa page dans l'appli (index.html?c=CODE).
// Usage : node generer.js <dossier des polices et de qrcodejs> [CODE,CODE…] (par défaut : tous les commerces de liste.json)
// Le logo est lu dans logos/<code>.webp|png|jpg s'il existe, sinon dans la vitrine en ligne (shops_showcase).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const fs = require('fs');
const L = process.argv[2] || __dirname + '/../libs', OUT = __dirname + '/../visuels', LOGOS = __dirname + '/logos';
const APP = 'https://hop-livraison.vercel.app/';
const CFG = fs.readFileSync(__dirname + '/../../config.js', 'utf8');
const SB = { url: CFG.match(/url:\s*"(https:\/\/[a-z0-9]+\.supabase\.co)"/)[1], key: CFG.match(/anonKey:\s*"([^"]+)"/)[1] };
const LIST = JSON.parse(fs.readFileSync(__dirname + '/liste.json', 'utf8'));
const CODES = process.argv[3] ? process.argv[3].split(',') : LIST.map(p => p.code);

const font = (fam, file, w, range) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(`${L}/${fam === 'Fredoka' ? 'fr' : 'ru'}/package/files/${file}`).toString('base64')}) format('woff2');unicode-range:${range}}`;
const LAT = 'U+0000-024F,U+20AA,U+2013-2019,U+00A0,U+00B7', HEB = 'U+0590-05FF';
const FONTS = [
  font('Fredoka', 'fredoka-latin-700-normal.woff2', 700, LAT), font('Fredoka', 'fredoka-hebrew-700-normal.woff2', 700, HEB),
  font('Rubik', 'rubik-latin-500-normal.woff2', 500, LAT), font('Rubik', 'rubik-hebrew-500-normal.woff2', 500, HEB),
  font('Rubik', 'rubik-latin-700-normal.woff2', 700, LAT), font('Rubik', 'rubik-hebrew-700-normal.woff2', 700, HEB),
  font('Rubik', 'rubik-latin-800-normal.woff2', 800, LAT), font('Rubik', 'rubik-hebrew-800-normal.woff2', 800, HEB)
].join('\n');
const LOGO = fs.readFileSync(__dirname + '/../../logo.svg', 'utf8');
const idx = fs.readFileSync(__dirname + '/../../index.html', 'utf8');
const SCOOTER = idx.slice(idx.indexOf('<svg class="scooter"'), idx.indexOf('</svg>', idx.indexOf('<svg class="scooter"')) + 6).replace('class="scooter"', 'class="scoot"');
const ART = k => 'data:image/webp;base64,' + fs.readFileSync(`${__dirname}/../../img/items/${k}.webp`).toString('base64');

const T = {
  fr: { kicker: 'Partenaire HOP!', h1: '<em>{name}</em><br>vous livre !', how: 'Sa carte est dans l\'appli : commandez en 1 minute, suivez le livreur en direct, payez en espèces ou par Bit.',
    price: 'Livraison dans Netanya', badge: '🛵 Livré en 30 min environ', scan: 'Commander chez {short}', url: 'hop-livraison.vercel.app', kosher: 'Casher' },
  he: { kicker: 'שותף של הופ!', h1: '<em>{name}</em><br>מגיע אליכם!', how: 'התפריט באפליקציה: מזמינים תוך דקה, עוקבים אחרי השליח בזמן אמת, משלמים במזומן או בביט.',
    price: 'משלוח בתוך נתניה', badge: '🛵 מגיע תוך כ-30 דקות', scan: 'להזמין מ{short}', url: 'hop-livraison.vercel.app', kosher: 'כשר' }
};
const CSS = `${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Rubik,Arial,sans-serif;color:#fff}
.page{position:relative;overflow:hidden;background:radial-gradient(110% 70% at 85% 0%,#2B4C8C 0%,#0F1F3D 55%,#0A1630 100%);display:flex;flex-direction:column}
.page:before{content:"";position:absolute;inset:auto -20% -30% -20%;height:55%;background:radial-gradient(50% 50% at 50% 50%,rgba(255,106,19,.22),transparent 70%)}
.page>*{position:relative}
.he{direction:rtl}
.top{display:flex;align-items:center;justify-content:space-between;gap:20px}
.top .lg{width:92px;height:92px}.top .lg svg{width:100%;height:100%}
.wm{font-family:Fredoka;font-weight:700;font-size:80px;line-height:1}
.wm i{font-style:normal;color:#FF6A13;display:inline-block;transform:rotate(10deg)}
.kick{display:inline-flex;align-items:center;gap:12px;background:#FF6A13;color:#fff;font-family:Fredoka;font-weight:700;border-radius:99px;padding:10px 26px;box-shadow:0 10px 30px rgba(255,106,19,.35)}
.hero{display:flex;align-items:center;gap:34px}
.lgo{flex:none;background:#fff;border-radius:40px;box-shadow:0 24px 60px rgba(0,0,0,.45);display:grid;place-items:center;overflow:hidden}
.lgo img{width:84%;height:84%;object-fit:contain}
h1{font-family:Fredoka;font-weight:700;line-height:1.04}
h1 em{font-style:normal;color:#FFB27F}
.tag{font-weight:700;opacity:.92;line-height:1.25}
.how{font-weight:500;opacity:.88;line-height:1.3}
.items{display:flex;flex-wrap:wrap;gap:14px}
.item{flex:1 1 0;min-width:0;background:#fff;color:#0F1F3D;border-radius:26px;display:flex;align-items:center;gap:12px;padding:12px 16px;font-weight:800;line-height:1.15;box-shadow:0 14px 30px rgba(0,0,0,.3)}
.story .item{flex:1 1 44%}
.item span{flex:none;display:grid;place-items:center;border-radius:18px;background:radial-gradient(circle at 30% 25%,hsl(var(--h) 100% 97%),hsl(var(--h) 85% 84%) 70%)}
.item img{width:72%;height:72%;object-fit:contain}
.foot{display:flex;align-items:center;justify-content:space-between;gap:24px}
.price{background:#fff;color:#0F1F3D;border-radius:30px;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px;font-weight:700}
.price b{font-family:Fredoka;color:#FF6A13;line-height:1;white-space:nowrap}
.badge{background:#FF6A13;color:#fff;border-radius:22px;padding:10px 20px;font-family:Fredoka;font-weight:700;line-height:1.15}
.price>b{white-space:nowrap}
.foot>div{min-width:0}
.foot .qrbox{flex:none}
.seal{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:99px;background:linear-gradient(135deg,#1E3A8A,#1D4ED8 55%,#3B82F6);color:#fff;font-weight:800;border:3px solid #fff}
.qrbox{background:#fff;border-radius:26px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#0F1F3D;font-weight:800;text-align:center}
.qrbox img,.qrbox canvas{display:block}
.url{direction:ltr;font-weight:700;opacity:.8}
.scoot{position:absolute;direction:ltr}
.road{position:absolute;left:0;right:0;border-bottom:6px dashed rgba(255,255,255,.18)}
`;
function page(p, lang, fmt) {
  const t = T[lang], he = lang === 'he', story = fmt === 'story';
  const W = 1080, H = story ? 1920 : 1080, pad = story ? 80 : 60, k = story ? 1.25 : 1;
  const name = p.name[lang], short = p.short ? p.short[lang] : name;
  const lg = story ? 420 : 360;
  const scoot = (w, style) => SCOOTER.replace('width="118" height="83"', `width="${w}" height="${Math.round(w * 0.7)}"`).replace('class="scoot"', `class="scoot" style="${style}"`);
  const items = (p.items || []).slice(0, story ? 4 : 3);
  const html = `<div class="page ${he ? 'he' : ''}${story ? ' story' : ''}" style="width:${W}px;height:${H}px;padding:${pad}px;gap:${story ? 30 : 20}px">
    <div class="top"><div style="display:flex;align-items:center;gap:20px"><div class="lg">${LOGO}</div><div class="wm">${he ? 'הופ' : 'HOP'}<i>!</i></div></div>
      <span class="kick" style="font-size:${Math.round(28 * k)}px">✨ ${t.kicker}</span></div>
    <div class="hero" style="${story ? 'flex-direction:column;align-items:flex-start;gap:26px' : ''}">
      <div class="lgo" style="width:${lg}px;height:${lg}px;${story ? 'align-self:center' : ''}">${p.logo ? `<img src="${p.logo}" alt="" />` : `<b style="font-family:Fredoka;font-size:${Math.round(lg / 6)}px;color:#0F1F3D;text-align:center;padding:20px">${name}</b>`}</div>
      <div style="display:grid;gap:${story ? 16 : 10}px;min-width:0">
        <h1 style="font-size:${story ? 92 : 66}px">${t.h1.replace('{name}', name)}</h1>
        ${p.kosher ? `<span class="seal" style="font-size:${Math.round(22 * k)}px;align-self:flex-start;justify-self:start">✡️ ${t.kosher}</span>` : ''}
        <div class="tag" style="font-size:${Math.round(28 * k)}px">${p.tagline[lang]}</div>
      </div>
    </div>
    <div class="how" style="font-size:${Math.round(26 * k)}px">${t.how}</div>
    ${items.length ? `<div class="items" style="font-size:${Math.round(21 * k)}px">${items.map(([img, h, fr, hb]) => `<div class="item"><span style="--h:${h};width:${story ? 84 : 76}px;height:${story ? 84 : 76}px"><img src="${ART(img)}" alt="" /></span>${he ? hb : fr}</div>`).join('')}</div>` : ''}
    <div style="flex:1"></div>
    ${story ? `<div style="height:170px;position:relative;flex-shrink:0"><div class="road" style="bottom:6px"></div>${scoot(240, `bottom:2px;${he ? 'right' : 'left'}:40px`)}</div>` : ''}
    <div class="foot">
      <div style="display:grid;gap:14px;flex:1;min-width:0">
        <div class="price" style="font-size:${Math.round(26 * k)}px"><span>${t.price}</span><b style="font-size:${Math.round(58 * k)}px">25 ₪</b></div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="badge" style="font-size:${Math.round(24 * k)}px">${t.badge}</span><span class="url" style="font-size:${Math.round(22 * k)}px">${t.url}</span></div>
      </div>
      <div class="qrbox"><div id="q"></div><span style="font-size:${Math.round(18 * k)}px;max-width:${story ? 230 : 170}px">${t.scan.replace('{short}', short)}</span></div>
    </div>
  </div>`;
  return { html, W, H, qrSize: story ? 210 : 150, link: `${APP}?c=${encodeURIComponent(p.code)}${he ? '&lang=he' : ''}` };
}
const splitName = s => { const [a, b] = String(s).split(' · '); return { fr: a, he: b || a }; };
async function showcase() {
  const r = await fetch(`${SB.url}/rest/v1/rpc/shops_showcase`, { method: 'POST', headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}`, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error('vitrine ' + r.status);
  return r.json();
}
(async () => {
  let show = null;
  const b = await chromium.launch();
  const qrJs = fs.readFileSync(L + '/q/package/qrcode.min.js', 'utf8');
  const made = [];
  for (const code of CODES) {
    const p = Object.assign({}, LIST.find(x => x.code === code));
    if (!p.code) { console.warn('pas dans liste.json :', code); continue; }
    // Logo : fichier local, sinon vitrine en ligne
    const local = ['webp', 'png', 'jpg'].map(ext => `${LOGOS}/${code.toLowerCase()}.${ext}`).find(f => fs.existsSync(f));
    if (local) p.logo = `data:image/${local.endsWith('jpg') ? 'jpeg' : local.split('.').pop()};base64,${fs.readFileSync(local).toString('base64')}`;
    if (!local || !p.name || !p.tagline) {
      show = show || await showcase();
      const s = show.find(x => x.code === code);
      if (s) {
        if (!local && s.logo) p.logo = s.logo;
        p.name = p.name || splitName(s.name);
        p.tagline = p.tagline || { fr: s.tagline || '', he: s.tagline_he || s.tagline || '' };
        if (p.kosher == null) p.kosher = !!s.kosher;
      }
    }
    for (const lang of ['fr', 'he']) for (const fmt of ['post', 'story']) {
      const pg0 = page(p, lang, fmt);
      const ctx = await b.newContext({ viewport: { width: pg0.W, height: pg0.H }, deviceScaleFactor: 1 });
      const pg = await ctx.newPage();
      await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${pg0.html}<script>${qrJs}</script>
        <script>new QRCode(document.getElementById('q'), { text: ${JSON.stringify(pg0.link)}, width: ${pg0.qrSize}, height: ${pg0.qrSize}, correctLevel: QRCode.CorrectLevel.M });</script></body></html>`);
      await pg.evaluate(() => document.fonts.ready);
      await pg.evaluate(H => { const p = document.querySelector('.page'), h1 = p.querySelector('h1'), sub = p.querySelector('.how');
        for (let i = 0; i < 12 && p.scrollHeight > H; i++) { h1.style.fontSize = (parseFloat(getComputedStyle(h1).fontSize) * 0.93) + 'px'; if (sub) sub.style.fontSize = (parseFloat(getComputedStyle(sub).fontSize) * 0.96) + 'px'; } }, pg0.H);
      await pg.waitForTimeout(300);
      const name = `partenaire-${code.toLowerCase()}-${fmt}-${lang}`;
      await pg.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: pg0.W, height: pg0.H } });
      made.push(name);
      await ctx.close();
    }
  }
  console.log(made.join(' '));
  await b.close();
})();
