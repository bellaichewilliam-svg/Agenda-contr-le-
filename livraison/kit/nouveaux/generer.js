// Visuels « Nouveaux partenaires » : les enseignes ajoutées sur HOP!, avec leur vrai logo (repris de la base),
// en post carré et en story, français et hébreu. Prépare aussi les données de la vidéo Remotion (video/).
// Usage : node generer.js <dossier des polices et de qrcodejs> [fichier JSON de la vitrine, sinon lu en ligne]
// Lancé tout seul par GitHub Actions (.github/workflows/kit-nouveaux.yml) quand la liste partenaires.json change.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const fs = require('fs');
const L = process.argv[2] || __dirname + '/../libs', OUT = __dirname + '/../visuels', LOGOS = __dirname + '/video/public/logos';
const APP = 'https://hop-livraison.vercel.app/';
const CFG = fs.readFileSync(__dirname + '/../../config.js', 'utf8');
const SB = { url: CFG.match(/url:\s*"(https:\/\/[a-z0-9]+\.supabase\.co)"/)[1], key: CFG.match(/anonKey:\s*"([^"]+)"/)[1] };
const LIST = JSON.parse(fs.readFileSync(__dirname + '/partenaires.json', 'utf8'));

const font = (fam, file, w, range) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(`${L}/${fam === 'Fredoka' ? 'fr' : 'ru'}/package/files/${file}`).toString('base64')}) format('woff2');unicode-range:${range}}`;
const LAT = 'U+0000-024F,U+20AA,U+2013-2019,U+00A0,U+00B7', HEB = 'U+0590-05FF';
const FONTS = [
  font('Fredoka', 'fredoka-latin-700-normal.woff2', 700, LAT), font('Fredoka', 'fredoka-hebrew-700-normal.woff2', 700, HEB),
  font('Rubik', 'rubik-latin-500-normal.woff2', 500, LAT), font('Rubik', 'rubik-hebrew-500-normal.woff2', 500, HEB),
  font('Rubik', 'rubik-latin-700-normal.woff2', 700, LAT), font('Rubik', 'rubik-hebrew-700-normal.woff2', 700, HEB),
  font('Rubik', 'rubik-latin-800-normal.woff2', 800, LAT), font('Rubik', 'rubik-hebrew-800-normal.woff2', 800, HEB)
].join('\n');
const LOGO = fs.readFileSync(__dirname + '/../../logo.svg', 'utf8');
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 3.2l7.6 13.2H4.4zM12 20.8L4.4 7.6h15.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const idx = fs.readFileSync(__dirname + '/../../index.html', 'utf8');
const SCOOTER = idx.slice(idx.indexOf('<svg class="scooter"'), idx.indexOf('</svg>', idx.indexOf('<svg class="scooter"')) + 6).replace('class="scooter"', 'class="scoot"');

const T = {
  fr: { kicker: 'Nouveau sur HOP!', h1: 'On vous livre<br><em>vos adresses préférées</em>', more: 'et des centaines d\'autres enseignes à Netanya',
    price: 'Livraison dans Netanya', kosher: 'Casher', scan: 'Commandez ici', url: 'hop-livraison.vercel.app' },
  he: { kicker: 'חדש בהופ!', h1: 'עכשיו מביאים לכם<br><em>את המקומות שאתם אוהבים</em>', more: 'ועוד מאות עסקים בנתניה',
    price: 'משלוח בתוך נתניה', kosher: 'כשר', scan: 'מזמינים כאן', url: 'hop-livraison.vercel.app' }
};
const CSS = `${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Rubik,Arial,sans-serif;color:#fff}
.page{position:relative;overflow:hidden;background:radial-gradient(110% 70% at 85% 0%,#2B4C8C 0%,#0F1F3D 55%,#0A1630 100%);display:flex;flex-direction:column}
.page:before{content:"";position:absolute;inset:auto -20% -30% -20%;height:55%;background:radial-gradient(50% 50% at 50% 50%,rgba(255,106,19,.22),transparent 70%)}
.he{direction:rtl}
.top{display:flex;align-items:center;gap:20px;position:relative}
.top .lg{width:96px;height:96px}.top .lg svg{width:100%;height:100%}
.wm{font-family:Fredoka;font-weight:700;font-size:84px;line-height:1}
.wm i{font-style:normal;color:#FF6A13;display:inline-block;transform:rotate(10deg)}
.kick{display:inline-flex;align-self:flex-start;align-items:center;gap:12px;background:#FF6A13;color:#fff;font-family:Fredoka;font-weight:700;border-radius:99px;padding:10px 28px;box-shadow:0 10px 30px rgba(255,106,19,.35);position:relative}
h1{font-family:Fredoka;font-weight:700;line-height:1.04;position:relative}
h1 em{font-style:normal;color:#FFB27F}
.grid{display:flex;flex-wrap:wrap;justify-content:center;position:relative}
.card{background:#fff;color:#0F1F3D;border-radius:34px;display:flex;flex-direction:column;align-items:center;text-align:center;box-shadow:0 18px 40px rgba(0,0,0,.35);position:relative}
.card .lgo{display:grid;place-items:center;width:100%;border-radius:24px;background:#fff}
.card .lgo{background-position:center;background-repeat:no-repeat;background-size:contain}
.card b{font-family:Fredoka;font-weight:700;line-height:1.05}
.card small{color:#475467;font-weight:500;line-height:1.2}
.seal{position:absolute;top:-14px;inset-inline-end:-10px;display:inline-flex;align-items:center;gap:6px;padding:5px 14px 5px 5px;border-radius:99px;background:linear-gradient(135deg,#1E3A8A,#1D4ED8 55%,#3B82F6);color:#fff;font-weight:800;border:3px solid #fff;box-shadow:0 6px 16px rgba(29,78,216,.45)}
.he .seal{padding:5px 5px 5px 14px}
.seal svg{background:#fff;color:#1D4ED8;border-radius:50%;padding:4px;display:block}
.more{font-weight:700;opacity:.85;position:relative}
.foot{display:flex;align-items:center;justify-content:space-between;gap:24px;position:relative}
.price{background:#fff;color:#0F1F3D;border-radius:30px;padding:20px 30px;display:flex;flex-direction:column;gap:2px;font-weight:700}
.price b{font-family:Fredoka;color:#FF6A13;line-height:1}
.qrbox{background:#fff;border-radius:26px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#0F1F3D;font-weight:800}
.qrbox img,.qrbox canvas{display:block}
.url{direction:ltr;font-weight:700;opacity:.8}
.scoot{position:absolute;direction:ltr}
.road{position:absolute;left:0;right:0;border-bottom:6px dashed rgba(255,255,255,.18)}
`;
function page(list, lang, fmt) {
  const t = T[lang], he = lang === 'he', story = fmt === 'story';
  const W = 1080, H = story ? 1920 : 1080, pad = story ? 80 : 60;
  const n = list.length;
  const cw = story ? (n > 4 ? 292 : 420) : n > 4 ? 298 : 360, lh = story ? (n > 4 ? 200 : 240) : n > 4 ? 100 : 150;
  const qrSize = story ? 210 : 130;
  const scoot = (w, style) => SCOOTER.replace('width="118" height="83"', `width="${w}" height="${Math.round(w * 0.7)}"`).replace('class="scoot"', `class="scoot" style="${style}"`);
  const card = p => `<div class="card" style="width:${cw}px;padding:${story ? 24 : 16}px 16px ${story ? 24 : 16}px;gap:${story ? 10 : 6}px">
      ${p.kosher ? `<span class="seal" style="font-size:${story ? 24 : 19}px">${STAR.replace('<svg', `<svg width="${story ? 30 : 24}" height="${story ? 30 : 24}"`)}${t.kosher}</span>` : ''}
      <span class="lgo" style="height:${lh}px${p.logo ? `;background-image:url(${p.logo})` : ''}"></span>
      <b style="font-size:${story ? 34 : 27}px">${p.name[lang]}</b><small style="font-size:${story ? 23 : 18}px">${p.label[lang]}</small></div>`;
  const html = `<div class="page ${he ? 'he' : ''}" style="width:${W}px;height:${H}px;padding:${pad}px;gap:${story ? 30 : 18}px">
    <div class="top" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:20px"><div class="lg">${LOGO}</div><div class="wm">${he ? 'הופ' : 'HOP'}<i>!</i></div></div>
      <span class="kick" style="font-size:${story ? 36 : 30}px;align-self:center">✨ ${t.kicker}</span></div>
    <h1 style="font-size:${story ? 76 : 52}px">${t.h1}</h1>
    <div class="grid" style="gap:${story ? 30 : 18}px ${story ? 22 : 18}px;margin-top:${story ? 14 : 6}px">${list.map(card).join('')}</div>
    <div class="more" style="font-size:${story ? 30 : 22}px;text-align:center">+ ${t.more}</div>
    <div style="flex:1"></div>
    ${story ? `<div style="height:200px;position:relative;flex-shrink:0"><div class="road" style="bottom:6px"></div>${scoot(260, `bottom:2px;${he ? 'right' : 'left'}:40px`)}</div>` : ''}
    <div class="foot">
      <div style="display:grid;gap:14px">
        <div class="price" style="font-size:${story ? 30 : 22}px;padding:${story ? '20px 30px' : '14px 24px'}"><span>${t.price}</span><b style="font-size:${story ? 76 : 50}px">25 ₪</b></div>
        <span class="url" style="font-size:${story ? 28 : 22}px">${t.url}</span>
      </div>
      <div class="qrbox"><div id="q"></div><span style="font-size:${story ? 26 : 18}px">${t.scan}</span></div>
    </div>
  </div>`;
  return { html, W, H, qrSize };
}
const splitName = s => { const [a, b] = String(s).split(' · '); return { fr: a, he: b || a }; };
(async () => {
  let show;
  if (process.argv[3]) show = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  else {
    const r = await fetch(`${SB.url}/rest/v1/rpc/shops_showcase`, { method: 'POST', headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error('vitrine ' + r.status);
    show = await r.json();
  }
  fs.mkdirSync(LOGOS, { recursive: true });
  // Ce dont la vidéo a besoin : polices, logo HOP!, scooter (video/public)
  const PUB = __dirname + '/video/public';
  fs.mkdirSync(PUB + '/fonts', { recursive: true });
  for (const [fam, dir] of [['fredoka', 'fr'], ['rubik', 'ru']]) for (const sub of ['latin', 'hebrew'])
    fs.copyFileSync(`${L}/${dir}/package/files/${fam}-${sub}-700-normal.woff2`, `${PUB}/fonts/${fam}-${sub}-700.woff2`);
  fs.copyFileSync(__dirname + '/../../logo.svg', PUB + '/logo.svg');
  fs.writeFileSync(PUB + '/scooter.svg', SCOOTER.includes('xmlns=') ? SCOOTER : SCOOTER.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  const list = LIST.codes.map(code => {
    const s = show.find(x => x.code === code);
    if (!s) { console.warn('absent de la vitrine :', code); return null; }
    let logo = null;
    const m = String(s.logo || '').match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
    if (m) { logo = `${code.toLowerCase()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(`${LOGOS}/${logo}`, Buffer.from(m[2], 'base64')); }
    const lab = (LIST.labels || {})[code] || { fr: s.tagline || '', he: s.tagline_he || s.tagline || '' };
    return { code, name: Object.assign(splitName(s.name), (LIST.names || {})[code] || {}), label: lab, kosher: !!s.kosher, logoFile: logo, logo: s.logo || null };
  }).filter(Boolean);
  // Données de la vidéo (Remotion) : sans les images (elles sont dans video/public/logos)
  fs.writeFileSync(__dirname + '/video/props.json', JSON.stringify({ partners: list.map(({ logo, ...p }) => p) }, null, 2));
  const qrJs = fs.readFileSync(L + '/q/package/qrcode.min.js', 'utf8');
  const b = await chromium.launch();
  const made = [];
  for (const lang of ['fr', 'he']) for (const fmt of ['post', 'story']) {
    const p = page(list, lang, fmt);
    const ctx = await b.newContext({ viewport: { width: p.W, height: p.H } });
    const pg = await ctx.newPage();
    await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${p.html}<script>${qrJs}</script>
      <script>new QRCode(document.getElementById('q'), { text: ${JSON.stringify(APP)}, width: ${p.qrSize}, height: ${p.qrSize}, correctLevel: QRCode.CorrectLevel.M });</script></body></html>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    const name = `nouveaux-${fmt}-${lang}`;
    await pg.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: p.W, height: p.H } });
    made.push(name);
    await ctx.close();
  }
  console.log(made.join(' '), '·', list.map(p => p.code).join(', '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
