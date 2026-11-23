// HOP! — « On fait vos courses pour vous » (Tabletop App Flythrough, vertical 1080×1920, 40 s).
// Un sac de courses en pixels traverse l'appli HOP! posée sur un bureau : la liste s'écrit sur le téléphone, le comparateur
// trouve le magasin le moins cher, « Tout ici » met tout dans le sac, les promos montent, Hoppy écoute, on livre tout,
// le livreur roule sur la carte de suivi, « Livré ». L'horloge de la voix est dans vo.js ; chaque geste est calé dessus.
import * as THREE from 'three';
import { card, pill, rbox } from './world.js';
import { makeMonster } from './voxel.js';
import * as K from './cards.js';
import { clamp, lerp, seg, ss, eo, ei, eio, back, V, arc, pop, beatBounce, squash, hops } from './anim.js';
import { VO, DUR as VDUR, CREDIT_T } from './vo.js';

export const DUR = VDUR;
export const END = { credit: VDUR + 5 };   // pas de signature à la fin
export { VO };
export const GLYPHS = '';
// palette HOP! : papier gris froid, cartes presque blanches, encre bleu nuit, un seul accent orange (ce qui compte maintenant)
Object.assign(K.COL, { paper: '#e5e9ed', dot: '#c8cfd7', card: '#fdfdfc', ink: '#0F1F3D', mute: '#7f8790', line: '#e0e4e8', faint: '#f1f3f5',
  accent: '#FF6A13', red: '#d23a3a', green: '#2f9e64', teal: '#2f8fb0', plum: '#8a5a9e', cream: '#f4e3b5' });
const C = K.COL, TOP = .005, PH = .009, YAX = V(0, 1, 0);

// image officielle de Hoppy (jamais redessinée) : imprimée sur les cartes
const HOPPY = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = './hoppy.png'; });

// ── horloge (secondes du film) ──
export const T = {
  type: [0.5, 2.9], bagPop: 4.0, hopCmp: [7.9, 8.45], counter: [9.0, 11.6], best: 11.9,
  hopBtn: [13.45, 13.95], press: 14.0, items: 14.35, intoBag: [[14.75, 15.2], [15.0, 15.45], [15.25, 15.7]], cheer: 16.0,
  hopPromo: [16.9, 17.45], promoUp: [18.4, 18.9, 19.4],
  hopVoice: [21.3, 21.9], listen: [22.9, 25.6], said: 25.0,
  hopServ: [26.0, 26.55], tiles: [27.4, 27.9, 28.4, 28.9],
  hopTrack: [30.2, 30.75], ride: [31.6, 35.5], delivered: 36.0, title: CREDIT_T + .4, curtain: 39.2,
};

// ── le bureau (vertical : les cartes descendent vers le fond) ──
export const MAT = [1.32, 4.8];
export const CARDS = {
  phone: { c: V(-.11, 0, .80), w: .30, h: .56, yaw: .04 },
  cmp: { c: V(.15, 0, .20), w: .46, h: .40, yaw: -.035 },
  promo: { c: V(-.14, 0, -.36), w: .42, h: .34, yaw: .045 },
  voice: { c: V(.15, 0, -.88), w: .38, h: .34, yaw: -.04 },
  serv: { c: V(-.13, 0, -1.36), w: .42, h: .27, yaw: .03 },
  track: { c: V(.13, 0, -1.90), w: .38, h: .48, yaw: -.035 },
};
export const at = (n, u, v, y = TOP) => { const d = CARDS[n]; return V(u / 1000 - d.w / 2, y, v / 1000 - d.h / 2).applyAxisAngle(YAX, d.yaw).add(d.c); };

// ── pixel art ──
const toArt = (rows, pal) => { const cells = []; rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') cells.push([i, j, pal[ch]]); })); return { w: rows[0].length, h: rows.length, cells }; };
const BAG = [
  '...NN....NN...', '..N..N..N..N..', '..N..N..N..N..', '.OOOOOOOOOOOO.', '.OOOOOOOOOOOO.', '.OOOKOOOOKOOO.', '.OOOKOOOOKOOO.',
  '.OOOOOOOOOOOO.', '.OOOOMMMMOOOO.', '.OOOOOMMOOOOO.', '.NNNNNNNNNNNN.', '.NNNNNNNNNNNN.', '.OOOOOOOOOOOO.', '..OOOOOOOOOO..'];
const BAGPAL = { O: '#FF6A13', N: '#0F1F3D', K: '#000000', M: '#ffe1cc' };
const MILK = ['..BB..', '.WWWW.', 'WWWWWW', 'WBBBBW', 'WBBBBW', 'WWWWWW', 'WWWWWW', 'WWWWWW'];
const BREAD = ['..TTTTT..', '.TDTDTDT.', 'TTTTTTTTT', 'TTTTTTTTT', '.TTTTTTT.'];
const APPLE = ['...G..', '..GG..', '.RRRR.', 'RRRRRR', 'RRRRRR', 'RRRRRR', '.RRRR.'];
const ITPAL = { W: '#f7f7f4', B: '#2f8fb0', T: '#e0a35a', D: '#b5772f', G: '#3c9c6e', R: '#d94a3a' };
const SCOOT = [   // vue de côté, il roule vers la droite ; le sac HOP! se pose à la place du coffre
  '...............', '...............', '............NN.', '............N..', '.NNNNNNN....NOO', '.NNNNNNNNNNNNN.', 'NNNNNNNNNNNNNN.', '.GG.........GG.', 'GGGG.......GGGG', '.GG.........GG.'];
const SCPAL = { N: '#0F1F3D', O: '#FF6A13', G: '#2a2f3a' };

// ── écrans et cartes (Canvas 2D ; le haut de la carte pointe vers le fond) ──
function hopLogo(c, x, y, s, light = true) {
  K.txt(c, 'HOP', x, y, { size: s, wt: 800, font: K.SANS, col: light ? '#fff' : C.ink });
  c.font = `800 ${s}px ${K.SANS}`; const w = c.measureText('HOP').width;
  K.txt(c, '!', x + w + 1, y, { size: s, wt: 800, font: K.SANS, col: C.accent });
}
const LIST = [['Lait 1 L', 'חלב'], ['Pain', 'לחם'], ['Couches', 'חיתולים'], ['Bananes', 'בננות']];
function drawPhone(c, st) {
  const w = 300, h = 560;
  c.clearRect(0, 0, w, h);
  c.fillStyle = C.ink; K.rr(c, 0, 0, w, h, 36); c.fill();
  c.fillStyle = '#f7f8fa'; K.rr(c, 11, 11, w - 22, h - 22, 27); c.fill();
  // en-tête HOP! bleu nuit avec Hoppy officiel
  c.save(); K.rr(c, 11, 11, w - 22, h - 22, 27); c.clip();
  c.fillStyle = C.ink; c.fillRect(11, 11, w - 22, 112);
  c.fillStyle = '#fff'; K.txt(c, '08:30', 30, 32, { size: 15, wt: 600, col: '#cfd6e4' });
  hopLogo(c, 30, 80, 40);
  c.drawImage(HOPPY, w - 104, 22, 74, 111);
  c.restore();
  K.txt(c, 'MA LISTE', 30, 150, { size: 15, wt: 600, col: C.accent, ls: 3 });
  K.txt(c, 'הרשימה שלי', 270, 150, { size: 19, wt: 700, font: K.SANS, col: C.mute, align: 'right' });
  c.fillStyle = C.line; c.fillRect(24, 168, w - 48, 2);
  LIST.forEach(([fr], i) => {
    const y = 200 + i * 52, n = st.typed - i; if (n <= 0) return;
    const s = fr.slice(0, Math.max(0, Math.floor(n * fr.length)));
    c.strokeStyle = C.ink; c.lineWidth = 2.5; K.rr(c, 30, y - 12, 24, 24, 6); c.stroke();
    K.txt(c, s, 68, y, { size: 24, wt: 700, font: K.SANS });
  });
  // recherche avec micro, bouton « Comparer »
  c.fillStyle = '#eceef2'; K.rr(c, 24, h - 140, w - 48, 46, 23); c.fill();
  K.txt(c, 'Un article…', 46, h - 117, { size: 18, wt: 600, font: K.SANS, col: '#9aa1ad' });
  c.fillStyle = C.ink; c.beginPath(); c.arc(w - 50, h - 117, 15, 0, 7); c.fill();
  c.fillStyle = st.go ? '#d9520a' : C.accent; K.rr(c, 24, h - 82, w - 48, 52, 26); c.fill();
  K.txt(c, 'Comparer les prix', w / 2, h - 56, { size: 22, wt: 800, font: K.SANS, col: '#fff', align: 'center' });
}
const STORES = [['Rami Lévy', 128.4], ['Shufersal', 142.9], ['Yohananof', 119.8]];
const fmt = v => v.toFixed(2).replace('.', ',') + ' ₪';
function drawCmp(c, st) {
  const w = 460, h = 400;
  K.cardBase(c, w, h, 'comparer', 'השוואת מחירים', { headH: 92 });
  K.txt(c, '4 articles', w - 28, 40, { size: 18, wt: 600, col: C.mute, align: 'right' });
  STORES.forEach(([n, v], i) => {
    const y = 132 + i * 66, best = st.best && i === 2;
    if (best) { c.fillStyle = '#fff3ea'; K.rr(c, 18, y - 28, w - 36, 56, 14); c.fill(); c.strokeStyle = C.accent; c.lineWidth = 4; K.rr(c, 18, y - 28, w - 36, 56, 14); c.stroke(); }
    K.txt(c, n, 36, y, { size: 26, wt: 700, font: K.SANS });
    const shown = v * st.k;
    K.txt(c, fmt(shown), w - 36, y, { size: 26, wt: 600, col: best ? C.accent : C.ink, align: 'right' });
  });
  if (st.best) K.txt(c, 'LE MOINS CHER · הכי זול', 36, 316, { size: 16, wt: 600, col: C.accent, ls: 2 });
  c.fillStyle = st.press ? '#d9520a' : C.accent; K.rr(c, 24, 336, w - 48, 48, 24); c.fill();
  K.txt(c, 'Tout ici', w / 2 - 54, 361, { size: 24, wt: 800, font: K.SANS, col: '#fff', align: 'center' });
  K.txt(c, 'הכול כאן', w / 2 + 60, 361, { size: 22, wt: 700, font: K.SANS, col: '#ffe0cc', align: 'center' });
}
const PROMOS = [['Café 200 g', 32.9, 19.9, '#8a5a9e'], ['Lessive 3 L', 49.9, 29.9, '#2f8fb0'], ['Biscuits', 14.9, 7.5, '#e0a35a']];
function drawPromo(c) {
  const w = 420, h = 340;
  K.cardBase(c, w, h, 'promos', 'כל המבצעים במקום אחד', { headH: 92 });
  PROMOS.forEach(([n, o, p, col], i) => {
    const y = 136 + i * 70;
    c.fillStyle = col; K.rr(c, 28, y - 24, 48, 48, 10); c.fill();
    K.txt(c, n, 92, y - 10, { size: 22, wt: 700, font: K.SANS });
    K.txt(c, fmt(o), 92, y + 16, { size: 17, wt: 500, col: C.mute });
    c.fillStyle = C.mute; c.fillRect(92, y + 16, 82, 2);
    K.txt(c, fmt(p), w - 30, y, { size: 26, wt: 600, col: C.accent, align: 'right' });
  });
}
function drawVoice(c, st) {
  const w = 380, h = 340;
  K.cardBase(c, w, h, 'à la voix', 'מזמינים בקול', { headH: 92 });
  c.drawImage(HOPPY, 18, 104, 140, 210);
  // micro et ondes
  const mx = 262, my = 180;
  c.fillStyle = C.ink; c.beginPath(); c.arc(mx, my, 44, 0, 7); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; K.rr(c, mx - 9, my - 26, 18, 34, 9); c.stroke();
  c.beginPath(); c.arc(mx, my, 20, .15, Math.PI - .15); c.stroke(); c.beginPath(); c.moveTo(mx, my + 20); c.lineTo(mx, my + 30); c.stroke();
  c.fillStyle = C.accent; c.beginPath(); c.arc(mx + 32, my - 32, 8, 0, 7); c.fill();
  for (let i = 0; i < 9; i++) { const a = st.lv ? (.25 + .75 * Math.abs(Math.sin(i * 1.7 + st.lv * 2.3))) : .12; const bh = 6 + a * 34; c.fillStyle = st.lv ? C.accent : '#c9ced6'; K.rr(c, 196 + i * 15, 262 - bh / 2, 9, bh, 4); c.fill(); }
  if (st.said) { c.fillStyle = '#eef1f5'; K.rr(c, 176, 296, 184, 34, 17); c.fill(); K.txt(c, '« Lait et pain »', 268, 313, { size: 18, wt: 700, font: K.SANS, align: 'center' }); }
}
const TILES = [['Courses', 'קניות', '#e3f3e6'], ['Pharmacie', 'בית מרקחת', '#e3edff'], ['Restos', 'מסעדות', '#ffeedc'], ['Colis', 'חבילות', '#eee7ff']];
function drawServ(c) {
  K.cardBase(c, 420, 270, 'on livre tout', 'מביאים הכול', { headH: 92 });
  K.txt(c, 'dès 25 ₪ en ville · מ-25 ₪ בעיר', 210, 252, { size: 18, wt: 700, font: K.SANS, col: C.accent, align: 'center' });
}
function drawTile(c, i) {
  const [fr, he, bg] = TILES[i];
  c.clearRect(0, 0, 88, 120); c.fillStyle = bg; K.rr(c, 0, 0, 88, 120, 14); c.fill();
  K.txt(c, fr, 44, 50, { size: fr.length > 7 ? 15 : 18, wt: 800, font: K.SANS, align: 'center' });
  K.txt(c, he, 44, 80, { size: 15, wt: 700, font: K.SANS, col: C.mute, align: 'center' });
}
const ROUTE_UV = [[70, 400], [70, 300], [190, 300], [190, 190], [300, 190], [300, 120]];
function drawTrack(c, st) {
  const w = 380, h = 480;
  K.cardBase(c, w, h, 'suivi', 'מעקב בזמן אמת', { headH: 92 });
  // petite carte de quartier (rues claires, pâtés de maisons)
  c.fillStyle = '#eef0f2'; K.rr(c, 20, 100, w - 40, 330, 14); c.fill();
  c.fillStyle = '#e2e6ea'; for (const [x, y, ww, hh] of [[34, 112, 120, 74], [210, 112, 140, 60], [34, 210, 120, 74], [210, 216, 140, 74], [34, 320, 120, 96], [210, 320, 140, 96]]) { K.rr(c, x, y, ww, hh, 8); c.fill(); }
  c.fillStyle = '#d3e9da'; K.rr(c, 214, 224, 60, 60, 8); c.fill();
  // le trajet : magasin (point noir) → maison (point orange)
  c.strokeStyle = C.accent; c.lineWidth = 7; c.lineJoin = 'round'; c.lineCap = 'round'; c.setLineDash([2, 12]);
  c.beginPath(); ROUTE_UV.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.setLineDash([]);
  c.fillStyle = C.ink; c.beginPath(); c.arc(70, 400, 12, 0, 7); c.fill();
  c.fillStyle = C.accent; c.beginPath(); c.arc(300, 120, 14, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(300, 120, 5, 0, 7); c.fill();
  // statut
  const done = st.done;
  c.fillStyle = done ? C.green : C.ink; K.rr(c, 20, 440, w - 40, 30, 15); c.fill();
  K.txt(c, done ? 'Livré ✓  ·  נמסר' : 'En route  ·  בדרך אליכם', w / 2, 455, { size: 17, wt: 800, font: K.SANS, col: '#fff', align: 'center' });
}

export function build(ctx) {
  const { world, ev } = ctx, scene = world.scene;
  ctx.fx = { flash: 0 };
  const mat = (col, r = .5, extra = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: r, ...extra });

  // cartes (canvas à 3,3× pour que le texte reste net en plan serré)
  const cv = {}, cd = {}, state = {};
  const mk = (n, draw, init, thick) => { const d = CARDS[n], [c, x] = K.canvas(d.w * 1000, d.h * 1000, 3.3); cv[n] = x; draw(x, init); state[n] = JSON.stringify(init); const g = card(world, c, d.w, d.h, thick); g.position.copy(d.c); g.rotation.y = d.yaw; scene.add(g); cd[n] = g; };
  const re = (n, draw, st) => { const k = JSON.stringify(st); if (k === state[n]) return; state[n] = k; draw(cv[n], st); cd[n].userData.redraw(); };
  mk('phone', drawPhone, { typed: 0, go: 0 }, PH); mk('cmp', drawCmp, { k: 0, best: 0, press: 0 }); mk('promo', drawPromo, {}); mk('voice', drawVoice, { lv: 0, said: 0 });
  mk('serv', drawServ, {}); mk('track', drawTrack, { done: 0 });

  // les 4 tuiles « on livre tout » : petites cartes posées sur la carte, qui sautent une à une
  const tiles = TILES.map((_, i) => { const [c, x] = K.canvas(88, 120, 3.3); drawTile(x, i); const g = card(world, c, .088, .12, .006); scene.add(g); return g; });
  const tileAt = i => at('serv', 30 + i * 96 + 44, 112 + 60, TOP);

  // accessoires du bureau (avant-plan / arrière-plan) : un stylo, des post-it, une tasse, un ticket de caisse
  {
    const pen = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(.0065, .0065, .15, 20), mat(C.ink, .35)); body.rotation.z = Math.PI / 2; pen.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.0065, .02, 20), mat('#c9ccd4', .3, { metalness: .6 })); tip.rotation.z = -Math.PI / 2; tip.position.x = .085; pen.add(tip);
    pen.position.set(.36, .0065, .9); pen.rotation.y = .9; pen.traverse(o => o.castShadow = true); scene.add(pen);
    for (let i = 0; i < 4; i++) { const n = new THREE.Mesh(rbox(.1, .0016, .1, .002), mat(i === 3 ? '#ffd2b5' : '#ffbe92', .85)); n.position.set(-.45, .0008 + i * .0016, -.05); n.rotation.y = .3 + i * .03; n.castShadow = n.receiveShadow = true; scene.add(n); }
    const mug = new THREE.Group(); const cup = new THREE.Mesh(new THREE.CylinderGeometry(.05, .046, .1, 40, 1, true), mat('#f3efe7', .45, { side: THREE.DoubleSide })); cup.position.y = .05; mug.add(cup);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(.047, 40), mat('#6b4a32', .25)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .085; mug.add(coffee);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(.046, 40), mat('#f3efe7', .45)); bot.rotation.x = -Math.PI / 2; bot.position.y = .002; mug.add(bot);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.025, .007, 12, 24, Math.PI), mat('#f3efe7', .45)); handle.rotation.z = -Math.PI / 2; handle.position.set(.05, .05, 0); mug.add(handle);
    mug.position.set(.47, 0, -1.25); mug.rotation.y = 2.2; mug.traverse(o => o.castShadow = o.receiveShadow = true); scene.add(mug);
    const [rc, rx] = K.canvas(90, 220, 2); rx.fillStyle = '#fbfaf6'; rx.fillRect(0, 0, 90, 220); K.grain(rx, 90, 220, 4, 600);
    for (let i = 0; i < 9; i++) { rx.fillStyle = '#c9ccd2'; rx.fillRect(10, 26 + i * 18, 40 + (i * 13 % 25), 4); rx.fillRect(66, 26 + i * 18, 14, 4); }
    const rec = new THREE.Mesh(new THREE.PlaneGeometry(.09, .22), new THREE.MeshStandardMaterial({ map: world.tex(rc), roughness: .9 })); rec.rotation.set(-Math.PI / 2, 0, -.35); rec.position.set(-.46, .0005, .55); rec.receiveShadow = true; scene.add(rec);
  }
  // lumière douce de fenêtre (chaude, additive, sous les cartes)
  { const [c, x] = K.canvas(512, 512, 1); x.filter = 'blur(26px)'; x.fillStyle = 'rgba(255,236,205,1)';
    for (const [a, b] of [[60, 60], [270, 60], [60, 270], [270, 270]]) x.fillRect(a, b, 180, 180); x.filter = 'none';
    const lm = new THREE.MeshBasicMaterial({ map: world.tex(c), transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const [px, pz, s, r] of [[-.1, .45, 1.0, .5], [.2, -1.1, .9, .4]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * .8), lm); m.rotation.set(-Math.PI / 2, 0, r); m.position.set(px, .0003, pz); m.renderOrder = 1; scene.add(m); } }

  // le chemin du sac : points orange entre les cartes (s'allument au final)
  const PATH = [at('phone', 150, 40, 0), at('cmp', 230, 390, 0), at('cmp', 230, 10, 0), at('promo', 210, 330, 0), at('promo', 210, 10, 0), at('voice', 190, 330, 0), at('voice', 190, 10, 0), at('serv', 210, 260, 0), at('serv', 210, 10, 0), at('track', 190, 470, 0)];
  const segs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
  const dotsP = []; segs.forEach(([a, b]) => { const p = PATH[a], q = PATH[b]; const n = Math.max(2, Math.round(p.distanceTo(q) / .03)); for (let k = 1; k < n; k++) dotsP.push(p.clone().lerp(q, k / n)); });
  const pathMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0062, .0062, .0024, 16), new THREE.MeshStandardMaterial({ color: C.accent, roughness: .45, emissive: C.accent, emissiveIntensity: 0 }), dotsP.length);
  { const m4 = new THREE.Matrix4(); dotsP.forEach((p, k) => { m4.makeTranslation(p.x, .0013, p.z); pathMesh.setMatrixAt(k, m4); }); } pathMesh.castShadow = true; scene.add(pathMesh);

  // anneaux d'impact (orange) sur le papier
  const RINGS = [{ t: T.bagPop, p: at('phone', 370, 330, 0) }, { t: T.press, p: at('cmp', 230, 360, 0) }, { t: T.delivered, p: at('track', 300, 120, 0) }, { t: T.title + .25, p: V(.24, 0, .86) }];
  const rings = RINGS.map(r => { const m = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(r.p.x, .0006, r.p.z); m.renderOrder = 2; scene.add(m); return { m, r }; });

  // pastilles des promos (face caméra, sans ombre)
  const promoPills = ['−40 %', '−40 %', '−50 %'].map((s, i) => { const m = pill(world, s, { h: .034, size: 42, font: K.SANS, wt: 800 }); m.castShadow = false; m.renderOrder = 3; return m; });
  const livre = pill(world, 'Livré ✓', { h: .04, size: 44, bg: C.green, font: K.SANS, wt: 800 }); livre.castShadow = false;

  // la carte-titre finale (tombe dans l'espace libre à droite du téléphone)
  const TW = .36, TH = .22;
  const title = new THREE.Group(); scene.add(title);
  { const [c, x] = K.canvas(TW * 1000, TH * 1000, 3.3); x.fillStyle = C.ink; K.rr(x, 0, 0, 360, 220, 18); x.fill();
    hopLogo(x, 26, 70, 72); x.drawImage(HOPPY, 238, 18, 108, 162);
    K.txt(x, 'On fait vos courses', 26, 136, { size: 25, wt: 800, font: K.SANS, col: '#fff' }); K.txt(x, 'pour vous', 26, 166, { size: 25, wt: 800, font: K.SANS, col: '#fff' });
    K.txt(x, 'עושים לכם את הקניות', 26, 200, { size: 19, wt: 700, font: K.SANS, col: '#ffbe92' });
    const g = card(world, c, TW, TH, .008); g.children[0].material.color.set(C.ink); title.add(g); }
  const TITLE_AT = V(.25, 0, .9);

  // personnages : le sac (héros), trois articles, le scooter du livreur
  const bag = makeMonster(toArt(BAG, BAGPAL), .0048, 'bag', .9);
  const items = [MILK, BREAD, APPLE].map((a, i) => makeMonster(toArt(a, ITPAL), .0046, 'it' + i, .9));
  const scoot = makeMonster(toArt(SCOOT, SCPAL), .0062, 'scoot', .8);
  for (const m of [bag, ...items, scoot]) scene.add(m.root);

  // lieux
  const PL = {
    bagPhone: at('phone', 370, 330, 0), bagCmp: at('cmp', 268, 50, TOP), btn: at('cmp', 230, 360, TOP),
    bagPromo: at('promo', 360, 50, TOP), bagVoice: at('voice', 325, 52, TOP), bagServ: at('serv', 365, 50, TOP),
    trackStart: at('track', 70, 400, TOP),
  };
  const routeW = ROUTE_UV.map(([u, v]) => at('track', u, v, TOP));
  const rideAt = p => { const L = []; let tot = 0; for (let i = 1; i < routeW.length; i++) { const d = routeW[i].distanceTo(routeW[i - 1]); L.push(d); tot += d; }
    let s = clamp(p, 0, 1) * tot; for (let i = 0; i < L.length; i++) { if (s <= L[i]) { const a = routeW[i], b = routeW[i + 1]; return { pos: a.clone().lerp(b, s / L[i]), dir: b.clone().sub(a) }; } s -= L[i]; }
    return { pos: routeW[routeW.length - 1].clone(), dir: routeW[routeW.length - 1].clone().sub(routeW[routeW.length - 2]) }; };
  const bagHops = [
    { t0: T.hopCmp[0], t1: T.hopCmp[1], from: PL.bagPhone, to: PL.bagCmp, h: .14 },
    { t0: T.hopBtn[0], t1: T.hopBtn[1], from: PL.bagCmp, to: PL.btn, h: .08 },
    { t0: T.hopPromo[0], t1: T.hopPromo[1], from: PL.btn, to: PL.bagPromo, h: .16 },
    { t0: T.hopVoice[0], t1: T.hopVoice[1], from: PL.bagPromo, to: PL.bagVoice, h: .16 },
    { t0: T.hopServ[0], t1: T.hopServ[1], from: PL.bagVoice, to: PL.bagServ, h: .16 },
    { t0: T.hopTrack[0], t1: T.hopTrack[1], from: PL.bagServ, to: PL.trackStart.clone().add(V(0, .03, 0)), h: .17 },
  ];

  // sujets que la caméra suit
  const cardC = n => CARDS[n].c.clone().setY(.02);
  let bagPos = PL.bagPhone.clone(), scootPos = PL.trackStart.clone();
  ctx.subj = {
    phone: () => at('phone', 150, 300, .02), phoneBag: () => at('phone', 215, 300, .02), bag: () => bagPos.clone(), cmp: () => cardC('cmp'), btn: () => at('cmp', 230, 300, .03),
    promo: () => cardC('promo'), voice: () => cardC('voice'), serv: () => cardC('serv'), track: () => cardC('track'), scoot: () => scootPos.clone().setY(.03),
    final: () => V(.02, 0, -.5), titleC: () => V(.1, .02, .86),
  };

  // textes à lire dans le monde (pour la vérification du temps de lecture)
  const uv = (n, u0, v0, u1, v1, y = TOP) => () => [at(n, u0, v0, y), at(n, u1, v0, y), at(n, u0, v1, y), at(n, u1, v1, y)];
  const pillBox = m => () => { m.updateMatrixWorld(); const hw = m.w / 2, hh = m.geometry.parameters.height / 2; return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map(([x, y]) => V(x, y, 0).applyMatrix4(m.matrixWorld)); };
  ctx.read = [
    ['list', 'MA LISTE Lait 1 L Pain Couches Bananes', 2.9, 7.6, uv('phone', 24, 130, 280, 380, PH)],
    ['best', 'Yohananof 119,80 ₪ LE MOINS CHER', T.best + .2, 13.3, uv('cmp', 18, 230, 442, 330)],
    ['promo', 'PROMOS Café Lessive Biscuits', 18.6, 21.1, uv('promo', 20, 100, 400, 330)],
    ['said', '« Lait et pain »', T.said + .1, 26.0, uv('voice', 176, 296, 360, 330)],
    ['livre', 'Livré ✓', T.delivered + .1, 37.6, pillBox(livre)],
  ];

  // ── événements sonores ──
  for (let i = 0; i < 24; i++) ev.push({ t: T.type[0] + i * (T.type[1] - T.type[0]) / 24, type: 'key' });
  ev.push({ t: T.bagPop, type: 'pop', k: 0, big: 1 });
  bagHops.forEach((h, i) => ev.push({ t: h.t0, type: 'hop', k: i }, { t: h.t1, type: 'land', v: .8 }));
  for (let i = 0; i < 10; i++) ev.push({ t: T.counter[0] + i * (T.counter[1] - T.counter[0]) / 10, type: 'tickdown', k: i });
  ev.push({ t: T.best, type: 'badge', k: 2 }, { t: T.press, type: 'press' });
  items.forEach((_, i) => ev.push({ t: T.items + i * .125, type: 'pop', k: i + 2 }, { t: T.intoBag[i][1], type: 'land', v: .5 }));
  ev.push({ t: T.cheer, type: 'badge', k: 1 });
  T.promoUp.forEach((t, i) => ev.push({ t, type: 'badge', k: i }));
  ev.push({ t: T.listen[0], type: 'tap' }, { t: T.said, type: 'banner' });
  T.tiles.forEach((t, i) => ev.push({ t, type: 'hop', k: i }, { t: t + .35, type: 'land', v: .4 }));
  ev.push({ t: T.ride[0], type: 'fetch' }, { t: T.delivered, type: 'ring' }, { t: T.title, type: 'drop' }, { t: T.title + .25, type: 'titleLand' });
  ev.push({ t: T.curtain, type: 'hop', k: 0 }, { t: T.curtain + .4, type: 'land', v: .5 });

  return t => {
    // téléphone : la liste s'écrit, le bouton s'allume
    re('phone', drawPhone, { typed: Math.round(clamp((t - T.type[0]) / (T.type[1] - T.type[0]) * 4, 0, 4) * 8) / 8, go: t > 7.0 && t < 7.8 ? 1 : 0 });
    // comparateur : les totaux montent, le moins cher s'allume, « Tout ici » enfoncé
    re('cmp', drawCmp, { k: Math.round(ss(seg(t, T.counter[0], T.counter[1])) * 12) / 12, best: t >= T.best ? 1 : 0, press: t >= T.press && t < T.press + .45 ? 1 : 0 });
    re('voice', drawVoice, { lv: t >= T.listen[0] && t < T.listen[1] ? Math.floor(t * 8) % 6 + 1 : 0, said: t >= T.said ? 1 : 0 });
    re('track', drawTrack, { done: t >= T.delivered ? 1 : 0 });

    // le sac : pop sur le téléphone, puis les sauts de carte en carte, puis le scooter
    const pb = pop(t, T.bagPop, .45, .06);
    const h = hops(t, bagHops, PL.bagPhone);
    let p = h.pos, sq = squash(t, h.lands, h.takeoffs, h.air) * (t < T.hopCmp[0] ? pb.sq : 1), yaw = h.dir ? Math.atan2(h.dir.x, h.dir.z) * .3 : .15;
    if (t < T.hopCmp[0]) p = p.clone().add(V(0, pb.y, 0));
    const waitB = [[T.bagPop + .6, T.hopCmp[0] - .1], [T.items, T.hopPromo[0] - .1], [T.hopPromo[1] + .3, T.hopVoice[0] - .1], [T.hopVoice[1] + .3, T.hopServ[0] - .1], [T.hopServ[1] + .3, T.hopTrack[0] - .1]];
    for (const [a, b] of waitB) { const bb = beatBounce(t, a, b, .012); p = p.clone().add(V(0, bb.y, 0)); sq *= bb.sq; }
    if (t >= T.press && t < T.press + .25) sq *= 1 - .35 * Math.sin(Math.PI * (t - T.press) / .25);   // il écrase le bouton
    // trajet en scooter : le sac monte sur le scooter et part avec lui
    const r = rideAt(eio(seg(t, T.ride[0], T.ride[1])));
    scootPos = r.pos;
    if (t >= T.ride[0]) { p = r.pos.clone().add(V(-.026, .036, 0)); yaw = 0; }
    if (t >= T.curtain - .05) { const bb = pop(t, T.curtain, .45, .05); p = p.clone().add(V(0, bb.y, 0)); sq *= bb.sq; }
    bagPos = p;
    bag.set({ pos: p, vis: t >= T.bagPop - .05, e: t < T.hopCmp[0] ? pb.e : 1, hinge: t < T.hopCmp[0] ? pb.hinge : 1, sq, yaw });
    bag.blink((t + .3) % 2.1 < .12);

    // les trois articles : ils sortent des lignes du comparateur et sautent dans le sac (l'un derrière l'autre)
    items.forEach((m, i) => {
      const from = at('cmp', 300 + i * 40, 150 + i * 60, TOP), [a, b] = T.intoBag[i], pi = pop(t, T.items + i * .125, .35, .04);
      const hh = hops(t, [{ t0: a, t1: b, from, to: PL.btn.clone().add(V(0, .03, 0)), h: .1 }], from);
      const inBag = t >= b, sh = 1 - ss(seg(t, b, b + .15));
      m.set({ pos: hh.pos.clone().add(V(0, t < a ? pi.y : 0, 0)), vis: t >= T.items + i * .125 - .02 && !(inBag && sh <= .01), e: pi.e, hinge: pi.hinge, sq: squash(t, [], [a], hh.air) * pi.sq, scale: inBag ? Math.max(.01, sh) : 1, yaw: -.3 });
    });

    // le scooter : posé au départ du trajet, puis il roule
    const ps = pop(t, T.hopTrack[1] - .2, .4, .03);
    scoot.set({ pos: scootPos, vis: t >= T.hopTrack[1] - .25, e: ps.e, hinge: ps.hinge, sq: ps.sq * (t > T.ride[0] && t < T.ride[1] ? 1 + .03 * Math.sin(t * 40) : 1), yaw: 0 });

    // pastilles des promos : elles montent de leur ligne, une par temps
    promoPills.forEach((m, i) => { const t0 = T.promoUp[i], q = seg(t, t0, t0 + .35); m.visible = t >= t0 && t < 21.6; const base = at('promo', 52, 136 + i * 70, .012); m.position.copy(base).add(V(0, .028 * back(q, 2), 0)); m.scale.setScalar(Math.max(.01, back(q, 1.8))); m.face(ctx.camera); });
    // tuiles : elles sautent une à une sur le temps
    tiles.forEach((g, i) => { const t0 = T.tiles[i], q = seg(t, t0, t0 + .35); g.position.copy(tileAt(i)).add(V(0, .05 * arc(q), 0)); g.rotation.y = CARDS.serv.yaw + (q > 0 && q < 1 ? Math.sin(q * Math.PI) * .25 : 0); const sqT = squash(t, [t0 + .35], [t0], q > 0 && q < 1 ? q : null); g.scale.set(1, sqT, 1); });
    // « Livré » : pastille verte au-dessus de la maison
    { const q = seg(t, T.delivered, T.delivered + .35); livre.visible = t >= T.delivered; livre.position.copy(at('track', 190, 255, .1)).add(V(0, .02 * back(q, 2), 0)); livre.scale.setScalar(Math.max(.01, back(q, 1.8))); livre.face(ctx.camera); }
    // la carte-titre tombe d'en haut, s'écrase un peu et se pose
    { const td = T.title, land = td + .25, q = seg(t, td, land), d = t - land; title.visible = t >= td;
      title.position.copy(TITLE_AT).setY((1 - ei(q)) * .7 + (d > 0 && d < .35 ? .012 * Math.sin(Math.PI * d / .35) * (1 - d / .35) : 0)); title.rotation.y = -.06;
      const s2 = d > 0 && d < .2 ? 1 - .25 * Math.sin(Math.PI * d / .2) : 1; title.scale.set(1 / Math.sqrt(s2), s2, 1 / Math.sqrt(s2)); }
    // le chemin s'allume au final
    pathMesh.material.emissiveIntensity = .5 * ss(seg(t, T.title - .4, T.title + .6));
    rings.forEach(({ m, r }) => { const d = t - r.t, on = d > 0 && d < 1.1; m.visible = on; if (on) { m.scale.setScalar(.12 + d * .5); m.material.opacity = .55 * (1 - d / 1.1); } });
  };
}
