import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './theme';

// Survol 3D de la page d'accueil HOP! : 14,5 s, 1440 × 1152, 60 i/s, un seul mouvement de caméra.
// 0–8,2 s survol · 7,75–9,25 s montée à la verticale · 9,25–9,47 s pause sur la page entière ·
// 9,47–9,97 s plongée dans le hero · 9,97–14,5 s le hero devient la carte titre.
export const FLY_FPS = 60;
export const FLY_FRAMES = 870;
const VW = 1440, VH = 1152, CXs = VW / 2, CYs = VH / 2;
const P = 1600;                       // perspective
const PW = 1200, PH = 3960;           // la page
const HERO = { x: 40, y: 120, w: 1120, h: 660 };
const HERO_CY = HERO.y + HERO.h / 2;
const FONT = 'Rubik, "Noto Color Emoji", sans-serif';
const DISP = 'Fredoka, Rubik, "Noto Color Emoji", sans-serif';
const GEIST = 'Geist, Rubik, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Survol : vitesse en trapèze (on accélère au début, on ralentit à la fin, constante entre les deux)
const flyPos = (t: number) => {
  const T = 8.2, ta = 1.5, td = 1.5, v = 1 / (T - (ta + td) / 2);
  if (t <= 0) return 0;
  if (t < ta) return 0.5 * v * t * t / ta;
  if (t < T - td) return v * ta / 2 + v * (t - ta);
  if (t < T) return 1 - 0.5 * v * (T - t) * (T - t) / td;
  return 1;
};
const Y0 = 470, Y1 = 3420, PITCH = 40;
const S_OVER = 1060 / PH;
const camera = (t: number) => {
  const fy = lerp(Y0, Y1, flyPos(Math.min(t, 8.2)));
  // léger avancement au départ, sans jamais reculer
  const sFly = Math.exp(lerp(Math.log(0.9), 0, easeOut(t / 1.8)));
  const rise = smooth((t - 7.75) / 1.5);
  let pitch = PITCH * (1 - rise);
  let scale = Math.exp(lerp(Math.log(sFly), Math.log(S_OVER), rise));
  let camY = lerp(fy, PH / 2, rise);
  if (t >= 9.47) {
    const d = smooth((t - 9.47) / 0.5);
    scale = Math.exp(lerp(Math.log(S_OVER), 0, d));
    camY = lerp(PH / 2, HERO_CY, d);
    pitch = 0;
  }
  return { pitch, scale, camY };
};

// --- Éléments qui se soulèvent quand la caméra passe (20 à 40 px) -----------------------
type Rect = { x: number; y: number; w: number; h: number };
const liftOf = (r: Rect, camY: number) => {
  const d = (r.y + r.h / 2 - (camY + 120)) / 650;
  return 20 + 20 * Math.exp(-d * d);
};
const Lift: React.FC<{ r: Rect; camY: number; radius?: number; children: React.ReactNode; hidden?: boolean; fixed?: number }> = ({ r, camY, radius = 22, children, hidden, fixed }) => {
  const z = fixed ?? liftOf(r, camY);
  if (hidden) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: r.x + 6, top: r.y + z * 0.55, width: r.w - 12, height: r.h - 4, borderRadius: radius, background: 'rgba(15,31,61,.22)',
        filter: `blur(${10 + z * 0.45}px)`, transform: 'translateZ(0.5px)' }} />
      <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: radius, transform: `translateZ(${z}px)`, overflow: 'hidden' }}>{children}</div>
    </>
  );
};

// --- Le hero (le même composant sur la page et en carte titre) ---------------------------
const PhoneMock: React.FC = () => (
  <div style={{ width: 300, height: 590, borderRadius: 44, background: '#05070D', padding: 10, boxShadow: '0 40px 70px rgba(0,0,0,.45)' }}>
    <div style={{ width: '100%', height: '100%', borderRadius: 36, background: '#F6F7FB', overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ padding: '22px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <b style={{ font: `700 28px/1 ${DISP}`, color: C.orange }}>HOP!</b><span style={{ fontSize: 14, color: C.muted }}>📍 Netanya</span>
      </div>
      <div style={{ margin: '4px 16px 12px', padding: '12px 14px', borderRadius: 14, background: '#fff', border: `1px solid ${C.border}`, fontSize: 14, color: C.muted }}>🔎 Restos, courses, pharmacie…</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 16px' }}>
        {['🍔', '🛒', '💊', '📦'].map((e, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: 14, background: ['#FFE8D6', '#E3F4E8', '#E0F0FF', '#FDEBF3'][i], display: 'grid', placeItems: 'center', fontSize: 26 }}>{e}</div>)}
      </div>
      <div style={{ margin: '14px 16px 0', borderRadius: 16, overflow: 'hidden', background: '#fff', border: `1px solid ${C.border}` }}>
        <div style={{ height: 96, background: 'linear-gradient(135deg,#FFB27F,#E0420A)', display: 'grid', placeItems: 'center', fontSize: 44 }}>🥘</div>
        <div style={{ padding: '10px 12px' }}><b style={{ fontSize: 15, color: C.ink }}>Marylou Traiteur</b><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>🛵 Livraison 25 ₪ · 0 ₪ de frais</div></div>
      </div>
      <div style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: 16, background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', fontSize: 18 }}>🛵</span>
        <span style={{ fontSize: 13, lineHeight: 1.3 }}><b>Ilan arrive</b><br />dans ≈ 3 min</span>
      </div>
    </div>
  </div>
);
const Hero: React.FC<{ out?: number }> = ({ out = 0 }) => (
  <div style={{ position: 'relative', width: HERO.w, height: HERO.h, borderRadius: 24, overflow: 'hidden', background: `radial-gradient(circle at 78% 40%, ${C.navy2} 0%, ${C.navy} 62%)`, fontFamily: FONT }}>
    <div style={{ position: 'absolute', left: 72, top: 92, width: 560, opacity: 1 - out, transform: `translateY(${-out * 40}px)` }}>
      <span style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 99, background: 'rgba(255,255,255,.1)', color: '#C9D1E4', fontSize: 18, fontWeight: 600 }}>🛵 Netanya · HaSharon</span>
      <h1 style={{ margin: '26px 0 0', font: `700 84px/1.02 ${DISP}`, color: '#fff' }}>Tout livré.<br /><span style={{ color: C.orange }}>Simplement.</span></h1>
      <p style={{ margin: '22px 0 0', fontSize: 23, lineHeight: 1.45, color: '#C9D1E4' }}>Repas, courses, pharmacie, colis : une minute pour commander, on s'occupe du reste.</p>
      <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
        <span style={{ padding: '18px 30px', borderRadius: 16, background: C.orange, color: '#fff', fontSize: 21, fontWeight: 700 }}>Commander</span>
        <span style={{ padding: '18px 26px', borderRadius: 16, border: '2px solid rgba(255,255,255,.25)', color: '#fff', fontSize: 21, fontWeight: 600 }}>Comment ça marche</span>
      </div>
    </div>
    <div style={{ position: 'absolute', right: 96, top: 36, opacity: 1 - out, transform: `translateY(${out * 60}px) scale(${1 - out * 0.06})` }}><PhoneMock /></div>
  </div>
);

// Les quatre tuiles-logos autour du hero (sur la page et autour de la carte titre)
const TILE = 104;
const TILES: { x: number; y: number; el: React.ReactNode }[] = [
  { x: 6, y: 74, el: <Img src={staticFile('fly/marylou.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> },
  { x: 1100, y: 92, el: <Img src={staticFile('fly/icon-512.png')} style={{ width: '100%', height: '100%' }} /> },
  { x: 14, y: 720, el: <div style={{ width: '100%', height: '100%', background: '#fff', display: 'grid', placeItems: 'center' }}><Img src={staticFile('fly/marchefr.webp')} style={{ width: '88%', height: '88%', objectFit: 'contain' }} /></div> },
  { x: 1086, y: 706, el: <Img src={staticFile('fly/hop-orange-512.png')} style={{ width: '100%', height: '100%' }} /> },
];

// --- La page ----------------------------------------------------------------------------
const H2: React.FC<{ y: number; kicker: string; title: React.ReactNode; sub?: string; x?: number; w?: number }> = ({ y, kicker, title, sub, x = 60, w = 700 }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, fontFamily: FONT }}>
    <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '.16em', color: C.orangeDeep }}>{kicker}</div>
    <div style={{ marginTop: 12, font: `700 54px/1.06 ${DISP}`, color: C.ink }}>{title}</div>
    {sub && <p style={{ margin: '16px 0 0', fontSize: 21, lineHeight: 1.5, color: C.muted }}>{sub}</p>}
  </div>
);
const Card: React.FC<{ bg?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ bg = '#fff', children, style }) => (
  <div style={{ width: '100%', height: '100%', background: bg, border: `1px solid ${C.border}`, borderRadius: 22, fontFamily: FONT, boxSizing: 'border-box', ...style }}>{children}</div>
);
const Photo: React.FC<{ e: string; a: string; b: string; label?: string }> = ({ e, a, b, label }) => (
  <div style={{ position: 'relative', width: '100%', height: '100%', background: `radial-gradient(circle at 30% 25%, ${a}, ${b})`, display: 'grid', placeItems: 'center', fontSize: 88 }}>
    <span style={{ filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.25))' }}>{e}</span>
    {label && <span style={{ position: 'absolute', left: 12, bottom: 12, padding: '6px 12px', borderRadius: 99, background: 'rgba(255,255,255,.92)', fontSize: 15, fontWeight: 700, color: C.ink, fontFamily: FONT }}>{label}</span>}
  </div>
);

type L = { r: Rect; radius?: number; el: React.ReactNode };
const STEPS: L[] = [
  ['✍️', '1. Dites ce qu\'il vous faut', 'Un repas, une liste de courses, un colis : en une minute.'],
  ['🛵', '2. On s\'en occupe', 'Un Hoper du quartier part tout de suite chercher pour vous.'],
  ['📍', '3. Suivez, recevez', 'Le scooter sur la carte, jusqu\'à votre porte.'],
].map(([e, t, d], i) => ({ r: { x: 60 + i * 370, y: 990, w: 340, h: 280 },
  el: <Card><div style={{ padding: 30 }}><div style={{ width: 66, height: 66, borderRadius: 18, background: C.cream, display: 'grid', placeItems: 'center', fontSize: 34 }}>{e}</div>
    <div style={{ marginTop: 22, fontSize: 25, fontWeight: 700, color: C.ink }}>{t}</div><div style={{ marginTop: 10, fontSize: 18, lineHeight: 1.45, color: C.muted }}>{d}</div></div></Card> }));

const LIST = ['Lait ×2', 'Pain de campagne', 'Pommes (1 kg)', 'Pack d\'eau', 'Œufs ×12', 'Couches taille 4'];
const COURSES: L[] = [
  { r: { x: 650, y: 1390, w: 330, h: 410 }, el: <Card><div style={{ padding: 26 }}><b style={{ fontSize: 22, color: C.ink }}>🧾 Ma liste</b>
    {LIST.map((x, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, fontSize: 19, color: C.ink }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, background: i < 4 ? C.green : '#fff', border: `2px solid ${i < 4 ? C.green : C.border}`, color: '#fff', fontSize: 15, display: 'grid', placeItems: 'center' }}>{i < 4 ? '✓' : ''}</span>{x}</div>)}</div></Card> },
  { r: { x: 920, y: 1700, w: 250, h: 190 }, el: <Card bg={C.navy} style={{ border: 0 }}><div style={{ padding: 22, color: '#fff' }}><div style={{ fontSize: 15, color: '#A9B3CA' }}>Ticket de caisse</div>
    <div style={{ marginTop: 6, fontSize: 40, fontWeight: 800 }}>86,40 ₪</div><div style={{ marginTop: 8, fontSize: 15, color: '#FFB27F', fontWeight: 700 }}>au prix du magasin ✓</div></div></Card> },
  { r: { x: 60, y: 1660, w: 170, h: 170 }, radius: 20, el: <Photo e="🥖" a="#FFE3B3" b="#F2B36B" /> },
  { r: { x: 250, y: 1660, w: 170, h: 170 }, radius: 20, el: <Photo e="🍎" a="#FFD1CC" b="#E8574A" /> },
  { r: { x: 440, y: 1660, w: 170, h: 170 }, radius: 20, el: <Photo e="🥛" a="#E9F3FF" b="#9CC3F0" /> },
];

const RESTOS: L[] = [
  { r: { x: 60, y: 2140, w: 340, h: 300 }, el: <Card style={{ overflow: 'hidden' }}><div style={{ height: 170 }}><Img src={staticFile('fly/marylou.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
    <div style={{ padding: '16px 20px' }}><b style={{ fontSize: 22, color: C.ink }}>Marylou Traiteur</b><div style={{ marginTop: 6, fontSize: 16, color: C.muted }}>Tunisien casher · ⭐ 4,9</div></div></Card> },
  { r: { x: 430, y: 2140, w: 340, h: 300 }, el: <Card style={{ overflow: 'hidden' }}><div style={{ height: 170 }}><Photo e="🍔" a="#FFD9A8" b="#C2410C" label="Burgers" /></div>
    <div style={{ padding: '16px 20px' }}><b style={{ fontSize: 22, color: C.ink }}>Votre burger préféré</b><div style={{ marginTop: 6, fontSize: 16, color: C.muted }}>Au prix affiché sur place</div></div></Card> },
  { r: { x: 800, y: 2140, w: 340, h: 300 }, el: <Card style={{ overflow: 'hidden' }}><div style={{ height: 170 }}><Photo e="🍣" a="#FFE1E1" b="#B91C1C" label="Sushis" /></div>
    <div style={{ padding: '16px 20px' }}><b style={{ fontSize: 22, color: C.ink }}>Vos sushis du soir</b><div style={{ marginTop: 6, fontSize: 16, color: C.muted }}>On commande pour vous</div></div></Card> },
  ...[['🧾', 'Prix du menu = prix sur place'], ['0 ₪', 'de frais de service'], ['🛵', 'Livraison dès 25 ₪']].map(([a, b], i) => ({ r: { x: 60 + i * 370, y: 2480, w: 340, h: 74 }, radius: 99,
    el: <div style={{ width: '100%', height: '100%', borderRadius: 99, background: i === 1 ? C.orange : '#fff', border: `1px solid ${i === 1 ? C.orange : C.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', fontFamily: FONT, boxSizing: 'border-box' }}>
      <b style={{ fontSize: 22, color: i === 1 ? '#fff' : C.orangeDeep }}>{a}</b><span style={{ fontSize: 18, fontWeight: 700, color: i === 1 ? '#fff' : C.ink }}>{b}</span></div> })),
];

const ASKS: L[] = [
  ['« Un pack d\'eau et du lait, s\'il vous plaît »', '🛒 Courses', '#E3F4E8'],
  ['« Mes médicaments à la pharmacie »', '💊 Pharmacie', '#E0F0FF'],
  ['« Le couscous de Marylou pour 20 h »', '🍽️ Restaurant', '#FFE8D6'],
].map(([q, tag, bg], i) => ({ r: { x: 60 + i * 370, y: 2820, w: 340, h: 230 },
  el: <Card><div style={{ padding: 26 }}><span style={{ padding: '7px 13px', borderRadius: 99, background: bg, fontSize: 15, fontWeight: 700, color: C.ink }}>{tag}</span>
    <div style={{ marginTop: 18, padding: '16px 18px', borderRadius: '18px 18px 18px 4px', background: C.bg, fontSize: 19, lineHeight: 1.4, color: C.ink }}>{q}</div>
    <div style={{ marginTop: 12, fontSize: 15, color: C.green, fontWeight: 700 }}>✓ Pris en charge en 1 min</div></div></Card> }));

const CTA: L[] = [
  { r: { x: 760, y: 3500, w: 300, h: 330 }, radius: 28, el: <div style={{ width: '100%', height: '100%', transform: 'scale(.56)', transformOrigin: '0 0' }}><PhoneMock /></div> },
];

const Page: React.FC<{ camY: number; hideHero: boolean }> = ({ camY, hideHero }) => {
  const all: L[] = [...STEPS, ...COURSES, ...RESTOS, ...ASKS, ...CTA];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 24, transformStyle: 'preserve-3d', fontFamily: FONT,
      boxShadow: '0 50px 120px rgba(15,31,61,.16), 0 12px 30px rgba(15,31,61,.08)' }}>
      {/* barre du haut */}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 30, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <b style={{ font: `700 38px/1 ${DISP}`, color: C.orange }}>HOP!</b>
        <div style={{ display: 'flex', gap: 34, fontSize: 18, fontWeight: 600, color: C.ink }}><span>Restos</span><span>Courses</span><span>Pharmacie</span><span>Commerces</span><span style={{ color: C.orangeDeep }}>FR · עב</span></div>
        <span style={{ padding: '13px 22px', borderRadius: 14, background: C.navy, color: '#fff', fontSize: 17, fontWeight: 700 }}>Commander</span>
      </div>
      {/* hero */}
      {!hideHero && <div style={{ position: 'absolute', left: HERO.x, top: HERO.y }}><Hero /></div>}
      {/* 1, 2, 3 */}
      <H2 y={850} kicker="SIMPLE COMME 1, 2, 3" title="Une minute pour commander." />
      {/* courses */}
      <H2 y={1340} w={560} kicker="ON FAIT VOS COURSES" title={<>On fait les courses<br />à votre place.</>} sub="Envoyez votre liste : votre Hoper achète au prix du magasin et vous livre. Vous ne bougez pas." />
      {/* restos */}
      <H2 y={1960} w={1000} kicker="VOS RESTOS PRÉFÉRÉS" title="Tous vos restos, au prix du restaurant." sub="Même ceux qui ne sont pas sur HOP! : on commande pour vous. Pas de prix gonflés, 0 ₪ de frais de service." />
      {/* demandes */}
      <H2 y={2640} kicker="CE QU'ON VOUS LIVRE" title="Demandez, c'est parti." />
      {/* bande chiffres */}
      <div style={{ position: 'absolute', left: 40, right: 40, top: 3130, height: 200, borderRadius: 24, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        {[['dès 25 ₪', 'la course dans Netanya'], ['0 ₪', 'de frais de service'], ['1 min', 'pour commander']].map(([a, b], i) => (
          <div key={i} style={{ textAlign: 'center' }}><div style={{ font: `700 58px/1 ${DISP}`, color: C.orangeDeep }}>{a}</div><div style={{ marginTop: 10, fontSize: 19, color: C.ink, fontWeight: 600 }}>{b}</div></div>))}
      </div>
      {/* appel à commander */}
      <div style={{ position: 'absolute', left: 40, right: 40, top: 3410, height: 420, borderRadius: 28, background: `linear-gradient(135deg, ${C.orangeLight}, ${C.orangeDeep})` }}>
        <div style={{ position: 'absolute', left: 64, top: 80, width: 600, color: '#fff' }}>
          <div style={{ font: `700 60px/1.05 ${DISP}` }}>Prêt ? Commandez<br />en une minute.</div>
          <div style={{ marginTop: 34, display: 'inline-block', padding: '18px 30px', borderRadius: 16, background: '#fff', color: C.orangeDeep, fontSize: 22, fontWeight: 800 }}>hop-livraison.vercel.app</div>
        </div>
      </div>
      {/* pied de page */}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 3880, display: 'flex', justifyContent: 'space-between', fontSize: 16, color: C.muted }}>
        <span><b style={{ font: `700 24px/1 ${DISP}`, color: C.orange }}>HOP!</b> · Netanya · HaSharon</span><span>Restos · Courses · Pharmacie · Colis</span>
      </div>
      {all.map((x, i) => <Lift key={i} r={x.r} camY={camY} radius={x.radius}>{x.el}</Lift>)}
      {TILES.map((x, i) => <Lift key={'t' + i} r={{ x: x.x, y: x.y, w: TILE, h: TILE }} camY={camY} radius={26} fixed={30} hidden={hideHero}>{x.el}</Lift>)}
    </div>
  );
};

// --- Carte titre --------------------------------------------------------------------------
const Word: React.FC<{ w: string; d: number; u: number; style: React.CSSProperties }> = ({ w, d, u, style }) => {
  const k = easeOut((u - d) / 0.55);
  return <span style={{ display: 'inline-block', opacity: k, transform: `translateY(${(1 - k) * 34}px)`, filter: `blur(${(1 - k) * 8}px)`, marginRight: '0.24em', ...style }}>{w}</span>;
};
const TitleCard: React.FC<{ u: number }> = ({ u }) => {
  const lift = easeOut(u / 1.0);
  const settle = smooth(u / 2.2);
  const out = smooth((u - 0.1) / 0.45);
  const scale = 1 - 0.06 * lift;
  const tilt = 7 * lift * (1 - 0.6 * settle);
  const float = Math.sin(u * 1.6) * 4 * lift;
  const badge = easeOut((u - 0.45) / 0.5);
  const head = [['Vos', 'courses', 'et', 'vos', 'restos,'], ['livrés', 'en', 'une', 'minute.']];
  const tail = 'au prix du magasin.'.split(' ');
  const orbit = (i: number) => {
    // les tuiles partent des coins du hero et se posent en orbite douce autour de la carte
    const k = 1600 / (1600 - 30);
    const sx = CXs + (TILES[i].x + TILE / 2 - PW / 2) * k, sy = CYs + (TILES[i].y + TILE / 2 - HERO_CY) * k;
    const tx = [CXs - 600, CXs + 600, CXs - 590, CXs + 592][i], ty = [CYs - 300, CYs - 250, CYs + 270, CYs + 300][i];
    const m = smooth((u - 0.2) / 1.4);
    return { x: lerp(sx, tx, m) + Math.sin(u * 1.3 + i * 1.7) * 6 * m, y: lerp(sy, ty, m) + Math.cos(u * 1.1 + i) * 8 * m, s: k * (1 + 0.08 * m), r: lerp(0, [-8, 7, 6, -7][i], m) };
  };
  return (
    <AbsoluteFill style={{ perspective: 1800 }}>
      <div style={{ position: 'absolute', left: CXs - HERO.w / 2, top: CYs - HERO.h / 2, width: HERO.w, height: HERO.h, borderRadius: 24,
        transform: `translateY(${-14 * lift + float}px) scale(${scale}) rotateX(${tilt}deg)`,
        boxShadow: `0 ${50 * lift}px ${20 + 120 * lift}px rgba(15,31,61,${0.32 * lift}), 0 ${10 * lift}px ${24 * lift}px rgba(15,31,61,${0.12 * lift})` }}>
        <Hero out={out} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 90px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px 10px 10px', borderRadius: 99, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
            opacity: badge, transform: `translateY(${(1 - badge) * 20}px) scale(${0.92 + 0.08 * badge})` }}>
            <Img src={staticFile('fly/icon-512.png')} style={{ width: 46, height: 46, borderRadius: 12 }} />
            <span style={{ font: `700 26px/1 ${DISP}`, color: '#fff' }}>HOP!</span>
            <span style={{ font: `500 20px/1 ${GEIST}`, color: '#A9B3CA', letterSpacing: '.08em' }}>DELIVERY</span>
          </div>
          <div style={{ marginTop: 40, font: `500 70px/1.1 ${GEIST}`, color: '#fff', letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>
            {head.map((line, l) => <div key={l}>{line.map((w, i) => <Word key={i} w={w} d={0.7 + (l * 5 + i) * 0.08} u={u} style={{}} />)}</div>)}
          </div>
          <div style={{ marginTop: 14, font: `italic 400 76px/1.1 ${SERIF}`, color: '#FFB27F', whiteSpace: 'nowrap' }}>
            {tail.map((w, i) => <Word key={i} w={w} d={1.3 + i * 0.08} u={u} style={{}} />)}
          </div>
        </div>
      </div>
      {TILES.map((x, i) => {
        const o = orbit(i);
        return <div key={i} style={{ position: 'absolute', left: o.x - TILE / 2, top: o.y - TILE / 2, width: TILE, height: TILE, borderRadius: 26, overflow: 'hidden',
          transform: `scale(${o.s}) rotate(${o.r}deg)`, boxShadow: '0 24px 40px rgba(15,31,61,.22)' }}>{x.el}</div>;
      })}
    </AbsoluteFill>
  );
};

// --- Profondeur de champ (le haut, au loin, et le bord le plus proche sont flous) ---------------
const DepthOfField: React.FC<{ k: number }> = ({ k }) => k <= 0.01 ? null : (
  <>
    <AbsoluteFill style={{ backdropFilter: `blur(${7 * k}px)`, WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.6) 18%, transparent 42%)', maskImage: 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.6) 18%, transparent 42%)', pointerEvents: 'none' }} />
    <AbsoluteFill style={{ backdropFilter: `blur(${4 * k}px)`, WebkitMaskImage: 'linear-gradient(to top, #000 0%, transparent 16%)', maskImage: 'linear-gradient(to top, #000 0%, transparent 16%)', pointerEvents: 'none' }} />
  </>
);

export const Fly: React.FC<{ music?: boolean }> = ({ music = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const title = t >= 9.97;
  const cam = camera(Math.min(t, 9.97));
  const u = t - 9.97;
  const dz = P * (1 - 1 / cam.scale);
  const sink = title ? smooth(u / 0.9) : 0;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, #f9fbfb 0%, #f6f7f9 55%, #f2f3f6 100%)', overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: P, perspectiveOrigin: `${CXs}px ${CYs}px`, filter: sink ? `blur(${sink * 9}px)` : undefined, opacity: 1 - sink * 0.25, transform: `scale(${1 - sink * 0.04})` }}>
        <div style={{ position: 'absolute', left: CXs, top: CYs, width: PW, height: PH, transformStyle: 'preserve-3d', transformOrigin: '0 0',
          transform: `translateZ(${dz}px) rotateX(${cam.pitch}deg) translate(${-PW / 2}px, ${-cam.camY}px)` }}>
          <Page camY={cam.camY} hideHero={title} />
        </div>
      </AbsoluteFill>
      {!title && <DepthOfField k={cam.pitch / PITCH} />}
      {title && <TitleCard u={u} />}
      {music && <Audio src={staticFile('fly-music.wav')} />}
    </AbsoluteFill>
  );
};
