import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/heebo/900.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/caveat/700.css';
import { HoppyHop } from './HoppyHop';
import { Wordmark } from './Reel';

// « Spécial bureaux » (patron, 26/11) : « Envie de cigarette, envie de ci, envie de ça » + phrases choc.
// 39,5 s, 1080 × 1920, 120 BPM (1 temps = 15 images), FR + HE. Même boîte à outils que « Choc » (Choc.tsx).
// Plans video-shotcraft imposés : carousel-3d (les rubriques de l'appli en manège 3D), neon-triple-marquee (fin, trois
// bandes néon), logo-shrink-wordmark-lockup (apparition / disparition du logo). Aussi : vertical-word-roll-blur-cycle
// (les envies qui défilent), circle-match-iris (passages), radial-ripple (touchers), crash-zoom-punch (prix le moins cher).
// L'écran de l'appli est TOUJOURS animé : un seul téléphone qui reste à l'écran pendant les six envies, l'écran change
// comme dans l'appli (glissé latéral), défilement, touchers simulés, panneau qui monte, zoom sur le détail.
// Règles : cigarettes = paquet sans marque, prix approximatif ; aucun concurrent ; pas de durée chiffrée ; « dès 25 ₪ en ville ».
export const BUREAU_FRAMES = 1185;
type Lang = 'fr' | 'he';
const BLUE = '#1E9BF0', LEMON = '#FFE14A', CORAL = '#FF5D73', MINT = '#7ED9A6', INK = '#0B4A6F', NAVY = '#0F1F3D', OR = '#FF6A13', CREAM = '#FFF4E2', LILAC = '#C9B8FF';
const STR = {
  fr: {
    au: 'Au bureau…', envie: 'Envie', roll: ['d’une cigarette ?', 'd’un café ?', 'd’un vrai repas ?', 'de lait ?', 'd’un colis ?', 'du pressing ?'],
    bouger: ['Sans bouger', 'du bureau ?'],
    q: [['Envie d’une', 'cigarette ?'], ['Envie', 'd’un café ?'], ['Envie d’un', 'vrai repas ?'], ['Plus de lait', 'au bureau ?'], ['Un colis', 'à envoyer ?'], ['Un costume', 'au pressing ?']],
    cig: 'Cigarettes', cigP: '≈ 40 ₪ le paquet', cigS: 'prix indicatif',
    hoppy: 'Dites-le à Hoppy', say: 'Un café et un croissant !',
    chips: ['− Salade', '− Cornichons', '✓ Ajouté au panier'],
    cheap: '✓ Le moins cher · 7,20 ₪', colis: 'On vient le chercher', press: 'On dépose. On ramène.', pressOk: '✓ Ajouté',
    stay: ['Restez au bureau.', 'On y va pour vous.'],
    cards: ['Cigarettes', 'Restos', 'Makolet', 'Pharmacie', 'Courses', 'Boulange', 'Colis', 'Promos'], cigSub: 'Le kiosque le plus proche',
    livre: 'Livré au bureau', des: 'dès', inCity: 'en ville', pay: ['Payez le livreur', 'en espèces ou par Bit'],
    neon: ['HOP!', 'DÈS 25 ₪ EN VILLE', 'ON LIVRE TOUT'],
    open: 'Ouvrez', end1: 'Dites ce qu’il vous faut.', end2: 'On y va pour vous.',
  },
  he: {
    au: 'במשרד…', envie: 'בא לך', roll: ['סיגריה?', 'קפה?', 'ארוחה אמיתית?', 'חלב?', 'לשלוח חבילה?', 'ניקוי יבש?'],
    bouger: ['בלי לזוז', 'מהמשרד?'],
    q: [['בא לך', 'סיגריה?'], ['בא לך', 'קפה?'], ['בא לך', 'ארוחה אמיתית?'], ['נגמר החלב', 'במשרד?'], ['חבילה', 'לשלוח?'], ['חליפה', 'לניקוי יבש?']],
    cig: 'סיגריות', cigP: '≈ 40 ₪ לחפיסה', cigS: 'מחיר משוער',
    hoppy: 'תגידו להופי', say: 'קפה וקרואסון!',
    chips: ['− חסה', '− חמוצים', '✓ נוסף לסל'],
    cheap: '✓ הכי זול · 7.20 ₪', colis: 'אנחנו באים לאסוף', press: 'לוקחים. מחזירים.', pressOk: '✓ נוסף',
    stay: ['נשארים במשרד.', 'אנחנו הולכים בשבילכם.'],
    cards: ['סיגריות', 'מסעדות', 'מכולת', 'בית מרקחת', 'קניות', 'מאפייה', 'חבילות', 'מבצעים'], cigSub: 'הקיוסק הכי קרוב',
    livre: 'עד המשרד', des: 'החל מ־', inCity: 'בעיר', pay: ['משלמים לשליח', 'במזומן או בביט'],
    neon: ['HOP!', 'החל מ־25 ₪ בעיר', 'מביאים הכול'],
    open: 'פותחים את', end1: 'אומרים מה צריך.', end2: 'ואנחנו הולכים בשבילכם.',
  },
};
let S: (typeof STR)['fr'] = STR.fr, RTL = false, L: Lang = 'fr';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], e: (t: number) => number = Easing.inOut(Easing.quad)) => interpolate(f, a, b, { ...clamp, easing: e });
const outExpo = Easing.out(Easing.exp), inOut = Easing.inOut(Easing.cubic), inQuad = Easing.in(Easing.quad);
const sp = (f: number, d: number, damping = 12, stiffness = 220, mass = 0.7) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const TITLE = () => (RTL ? 'Heebo, sans-serif' : '"Bricolage Grotesque", Heebo, sans-serif');
const SCRIPT = () => (RTL ? 'Heebo, sans-serif' : 'Caveat, cursive');
const iso: React.CSSProperties = { unicodeBidi: 'isolate', direction: 'ltr' };
const bu = (p: string) => staticFile(`bureau/${p}-${L}.jpg`);
const ch = (p: string) => staticFile(`choc/${p}-${L}.jpg`);
const r5 = (p: string) => staticFile(`revo5/${p}-${L}.jpg`);
const fit = (t: string, size: number, room = 960) => Math.min(size, room / Math.max(1, t.length * (RTL ? 0.62 : 0.58)));
const BAR = () => (RTL ? 766 : 751);   // haut de la barre « Livraison / Continuer » (points CSS)

// ---------- Fond de scène : ouverture en cercle + deux ronds qui dérivent ----------
const Stage: React.FC<{ bg: string; a: string; b: string; ox?: number; oy?: number; children?: React.ReactNode }> = ({ bg, a, b, ox = 540, oy = 960, children }) => {
  const f = useCurrentFrame();
  const r = lerp(f, [0, 13], [0, 2300], outExpo);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r}px at ${ox}px ${oy}px)`, background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 860, height: 860, borderRadius: '50%', background: a, opacity: 0.5, left: -300 + Math.sin(f / 24) * 40, top: -260 + Math.cos(f / 28) * 30 }} />
      <div style={{ position: 'absolute', width: 660, height: 660, borderRadius: '50%', background: b, opacity: 0.45, right: -240 + Math.cos(f / 21) * 40, bottom: -200 + Math.sin(f / 25) * 30 }} />
      {children}
    </AbsoluteFill>
  );
};
// ---------- Phrase choc : chaque ligne claque ----------
const Slam: React.FC<{ lines: string[]; at: number; y: number; size: number; color?: string; block?: string; blockInk?: string; step?: number; out?: number }> =
  ({ lines, at, y, size, color = INK, block, blockInk = '#fff', step = 9, out }) => {
  const f = useCurrentFrame();
  const ex = out != null ? lerp(f, [out, out + 9], [0, 1], inQuad) : 0;
  if (out != null && f > out + 10) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      transform: `translateY(${-ex * 160}px)`, opacity: 1 - ex }}>
      {lines.map((l, i) => {
        const d = at + i * step;
        const sz = fit(l, size);
        if (f < d) return <div key={i} style={{ height: sz * 1.12 }} />;
        const k = sp(f, d, 13, 300, 0.6);
        const last = i === lines.length - 1 && block;
        return (
          <div key={i} style={{ transform: `scale(${1.7 - 0.7 * k}) rotate(${(1 - k) * (i % 2 ? 5 : -5) + (last ? -1.5 : 0)}deg)`, opacity: Math.min(1, k * 2.5),
            filter: `blur(${(1 - Math.min(1, k)) * 10}px)`,
            fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: sz, lineHeight: 1.04, letterSpacing: RTL ? 0 : '-0.04em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr',
            color: last ? blockInk : color, background: last ? block : 'transparent', padding: last ? `${sz * 0.05}px ${sz * 0.22}px ${sz * 0.1}px` : 0, borderRadius: last ? sz * 0.26 : 0 }}>{l}</div>
        );
      })}
    </div>
  );
};
const Script: React.FC<{ text: string; at: number; y: number; size?: number; color?: string; rot?: number }> = ({ text, at, y, size = 96, color = LEMON, rot = -3 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const w = lerp(f, [at, at + 14], [0, 100], Easing.out(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', transform: `rotate(${rot}deg)` }}>
      <span style={{ display: 'inline-block', fontFamily: SCRIPT(), fontWeight: RTL ? 900 : 700, fontSize: RTL ? size * 0.8 : size, color, direction: RTL ? 'rtl' : 'ltr', whiteSpace: 'nowrap', padding: '0 0.25em',
        clipPath: RTL ? `inset(0 0 0 ${100 - w}%)` : `inset(0 ${100 - w}% 0 0)` }}>{text}</span>
    </div>
  );
};
const Pill: React.FC<{ text: React.ReactNode; at: number; x: number; y: number; bg?: string; ink?: string; size?: number; rot?: number; from?: number; f?: number }> =
  ({ text, at, x, y, bg = '#fff', ink = INK, size = 46, rot = -4, from = 0, f: ff }) => {
  const cf = useCurrentFrame();
  const f = ff ?? cf;
  if (f < at) return null;
  const k = sp(f, at, 10, 260, 0.6);
  const bob = Math.sin((f - at) / 10) * 5;
  return (
    <div style={{ position: 'absolute', left: x, top: y + bob, transform: `translate(-50%, -50%) translateX(${(1 - k) * from}px) scale(${0.3 + 0.7 * k}) rotate(${rot + Math.sin((f - at) / 15) * 1.5}deg)`,
      opacity: Math.min(1, k * 2), padding: `${size * 0.3}px ${size * 0.6}px`, borderRadius: size, background: bg, color: ink, fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: size,
      letterSpacing: RTL ? 0 : '-0.02em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 14px 30px rgba(8,18,38,.28), inset 0 -4px 0 rgba(0,0,0,.08)' }}>{text}</div>
  );
};
// ---------- Téléphone (écran 390 × 844 points CSS) avec caméra qui zoome sur un point ----------
type Cam = { s: number; px: number; py: number; tx: number; ty: number; e: number };
const Phone: React.FC<{ at?: number; x?: number; y: number; w: number; tilt?: number; cam?: Cam; children: (z: number) => React.ReactNode }> =
  ({ at = 0, x = 540, y, w, tilt = -3, cam, children }) => {
  const f = useCurrentFrame();
  const k = sp(f, at, 15, 130, 0.9);
  const sw = w - 36, z = sw / 390, sh = 844 * z;
  const breathe = Math.sin(f / 26) * 6;
  let camT = '', origin = '50% 50%';
  if (cam && cam.e > 0) {
    const Px = x - w / 2 + 18 + cam.px * z, Py = y + 18 + cam.py * z;
    origin = `${Px}px ${Py}px`;
    camT = `translate(${(cam.tx - Px) * cam.e}px, ${(cam.ty - Py) * cam.e}px) scale(${1 + (cam.s - 1) * cam.e})`;
  }
  return (
    <AbsoluteFill style={{ transform: camT, transformOrigin: origin }}>
      <div style={{ position: 'absolute', left: x - w / 2, top: y + breathe * (cam && cam.e > 0 ? 0 : 1), width: w, height: sh + 36, borderRadius: 34 * z, background: '#0B1220', padding: 18, boxSizing: 'border-box',
        transform: `translateY(${(1 - k) * 1100}px) rotate(${tilt * (1 - k * 0.7) * (cam ? 1 - cam.e : 1)}deg) perspective(1600px) rotateY(${(1 - k) * 20}deg)`,
        boxShadow: '0 50px 90px rgba(8,18,38,.45), inset 0 0 0 3px #2A3550' }}>
        <div style={{ position: 'relative', width: sw, height: sh, borderRadius: 28 * z, overflow: 'hidden', background: '#fff' }}>
          {children(z)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Shot: React.FC<{ src: string; z: number; top?: number; o?: number }> = ({ src, z, top = 0, o = 1 }) => (
  <Img src={src} style={{ position: 'absolute', left: 0, top: -top * z, width: 390 * z, opacity: o }} />
);
// La barre du bas (fixe dans l'appli) par-dessus une page qui défile
const Bar: React.FC<{ src: string; z: number; top: number }> = ({ src, z, top }) => (
  <Img src={src} style={{ position: 'absolute', left: 0, top: 0, width: 390 * z, clipPath: `inset(${top * z}px 0 0 0)` }} />
);
// Toucher simulé (rond qui se pose, appuie, onde) — f explicite
const Tap: React.FC<{ f: number; at: number; x: number; y: number; z: number }> = ({ f, at, x, y, z }) => {
  if (f < at - 8 || f > at + 18) return null;
  const pre = lerp(f, [at - 8, at], [0, 1], outExpo), t = lerp(f, [at, at + 18], [0, 1], Easing.out(Easing.quad));
  const R = 34 * z;
  return <>
    <div style={{ position: 'absolute', left: x * z - R, top: y * z - R, width: R * 2, height: R * 2, borderRadius: '50%', background: 'rgba(15,31,61,.28)', border: '4px solid rgba(255,255,255,.9)',
      transform: `scale(${f < at ? 1.3 - 0.3 * pre : 0.8 + 0.1 * Math.min(1, t * 4)})`, opacity: f < at ? pre : 1 - t }} />
    <div style={{ position: 'absolute', left: x * z - R * 1.6, top: y * z - R * 1.6, width: R * 3.2, height: R * 3.2, borderRadius: '50%', border: '5px solid #fff',
      transform: `scale(${0.4 + t * 1.1})`, opacity: f < at ? 0 : (1 - t) * 0.9 }} />
  </>;
};
const Finish: React.FC = () => {
  const f = useCurrentFrame();
  return <>
    <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(120% 85% at 50% 45%, rgba(0,0,0,0) 55%, rgba(8,18,38,.38) 100%)' }} />
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.16 }}>
      <svg width="100%" height="100%"><filter id="bg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 9} /></filter><rect width="100%" height="100%" filter="url(#bg)" /></svg>
    </AbsoluteFill>
  </>;
};
const Punch: React.FC<{ at: number[]; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = Math.max(0, ...at.map(c => (f >= c ? lerp(f, [c, c + 12], [0.06, 0], outExpo) : 0)));
  const sh = Math.max(0, ...at.map(c => (f >= c && f < c + 8 ? (8 - (f - c)) / 8 : 0)));
  return <AbsoluteFill style={{ transform: `scale(${1 + p}) translate(${Math.sin(f * 7.3) * 10 * sh}px, ${Math.cos(f * 5.1) * 8 * sh}px)` }}>{children}</AbsoluteFill>;
};

// ===== 1. Accroche (0–150) : « Au bureau… Envie [de ça, de ça, de ça…] » → « Sans bouger du bureau ? » =====
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const n = S.roll.length, per = 12, at = 26;
  const p = Math.max(0, Math.min(n - 1, (f - at) / per));
  const i = Math.floor(p), e = lerp(p - i, [0.55, 1], [0, 1], inOut);
  const k = sp(f, 18, 12, 240, 0.7);
  const out = lerp(f, [100, 110], [0, 1], inQuad);
  const H = 230;
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 50% 40%, rgba(30,155,240,.22), rgba(15,31,61,0) 70%)' }} />
      <AbsoluteFill style={{ transform: `translateY(${-out * 300}px) scale(${1 - out * 0.2})`, opacity: 1 - out }}>
        <Script text={S.au} at={2} y={430} size={130} color={LEMON} rot={-4} />
        <Slam lines={[S.envie]} at={12} y={640} size={230} color="#fff" />
        {f >= 18 ? <div style={{ position: 'absolute', left: 40, right: 40, top: 950, height: H, overflow: 'hidden', transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 2) }}>
          {[i, i + 1].filter(j => j < n).map((j, q) => {
            const off = (q - e) * H, t = S.roll[j];
            return <div key={j} style={{ position: 'absolute', left: 0, right: 0, top: off, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: fit(t, 124, 900), color: '#fff', background: [CORAL, OR, BLUE, '#16A34A', '#7C5CE0', CORAL][j], padding: '6px 34px 14px', borderRadius: 40,
                letterSpacing: RTL ? 0 : '-0.03em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr', filter: `blur(${Math.abs(q - e) * 10}px)`, opacity: 1 - Math.abs(q - e) * 0.6 }}>{t}</span>
            </div>;
          })}
        </div> : null}
      </AbsoluteFill>
      {f >= 104 ? <Punch at={[112]}><Slam lines={S.bouger} at={104} y={700} size={RTL ? 190 : 170} color="#fff" block={OR} step={8} /></Punch> : null}
    </AbsoluteFill>
  );
};

// ===== 2. Les six envies (150–600) : un seul téléphone, l'écran répond à chaque envie (75 images chacune) =====
const SEG = 75;
const BGS: [string, string, string][] = [[LEMON, '#FFEE80', CORAL], [CREAM, '#FFE1B8', OR], [CORAL, '#FF8496', LEMON], [MINT, '#A6EBC4', LEMON], [LILAC, '#DCD0FF', BLUE], ['#1F1C19', '#3A332B', '#E9D3A6']];
const QCOL: [string, string | undefined, string][] = [[INK, CORAL, '#fff'], [INK, OR, '#fff'], ['#fff', INK, '#fff'], [INK, INK, '#fff'], [INK, NAVY, '#fff'], ['#F5E9D0', '#E9D3A6', '#1F1C19']];
const VT: [number, string][] = [[0, 'vt1'], [22, 'vt2'], [40, 'vt3'], [56, 'vt5a'], [63, 'vt5']];
const VT_TAP: Record<Lang, [number, number, number][]> = { fr: [[18, 338, 368], [36, 52, 530], [60, 195, 530]], he: [[18, 52, 368], [36, 338, 530], [60, 195, 530]] };
const TYPED = () => (RTL ? 3 : 4);
const tAt = (k: number) => 6 + (k - 1) * 8;
const ROWY = () => (RTL ? 365 : 378);
const Screen: React.FC<{ seg: number; f: number; z: number }> = ({ seg, f, z }) => {
  if (seg === 0) {   // cigarettes : la rubrique défile (la liste des marques reste hors écran)
    const y = lerp(f, [8, 46], [0, 140], inOut);
    return <><Shot src={bu('tabacL')} z={z} top={y} /><Bar src={bu('tabacv')} z={z} top={BAR()} /></>;
  }
  if (seg === 1) {   // café : toucher le micro, le panneau de Hoppy monte, la voix, la bulle
    const sheet = sp(f, 16, 15, 170, 0.8), bub = sp(f, 44, 11, 240, 0.6);
    const mx = RTL ? 42 : 348;
    return <>
      <Shot src={ch('slide0')} z={z} />
      <Tap f={f} at={10} x={195} y={796} z={z} />
      {f >= 16 ? <>
        <Img src={ch('voice0')} style={{ position: 'absolute', left: 0, top: 0, width: 390 * z, clipPath: `inset(0 0 ${(844 - 120) * z}px 0)`, opacity: Math.min(1, sheet * 1.5) }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 844 * z, transform: `translateY(${(1 - sheet) * 760 * z}px)` }}>
          <Img src={ch('voice0')} style={{ position: 'absolute', left: 0, top: 0, width: 390 * z, clipPath: `inset(${120 * z}px 0 0 0)` }} />
          {f >= 26 && f < 52 ? <div style={{ position: 'absolute', left: mx * z - 70 * z, top: 800 * z - 22 * z, width: 140 * z, height: 44 * z, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 * z }}>
            {[...Array(9)].map((_, j) => <div key={j} style={{ width: 5 * z, borderRadius: 3 * z, background: OR,
              height: (8 + 30 * Math.abs(Math.sin(f / 3.2 + j * 1.3)) * Math.sin((j + 1) / 10 * Math.PI)) * z * lerp(f, [26, 32], [0, 1]) * lerp(f, [46, 52], [1, 0]) }} />)}
          </div> : null}
          {f >= 26 && f < 52 ? [0, 9, 18].map(d => { const t = ((f - 26 + d) % 27) / 27; return <div key={d} style={{ position: 'absolute', left: mx * z - 30 * z, top: 800 * z - 30 * z, width: 60 * z, height: 60 * z,
            borderRadius: '50%', border: `${2.5 * z}px solid ${OR}`, transform: `scale(${1 + t * 1.6})`, opacity: (1 - t) * 0.8 }} />; }) : null}
          {f >= 44 ? <div style={{ position: 'absolute', top: 330 * z, [RTL ? 'left' : 'right']: 16 * z, maxWidth: 300 * z, padding: `${12 * z}px ${16 * z}px`, borderRadius: 18 * z,
            [RTL ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: 4 * z, background: NAVY, color: '#fff', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 19 * z, direction: RTL ? 'rtl' : 'ltr',
            transform: `scale(${bub})`, transformOrigin: RTL ? 'left bottom' : 'right bottom' }}>{S.say}</div> : null}
          {f >= 58 ? <div style={{ position: 'absolute', top: 392 * z, [RTL ? 'right' : 'left']: 16 * z, padding: `${12 * z}px ${18 * z}px`, borderRadius: 18 * z, background: '#EEF2F7', display: 'flex', gap: 6 * z,
            transform: `scale(${sp(f, 58, 11, 240, 0.6)})`, transformOrigin: RTL ? 'right top' : 'left top' }}>
            {[0, 1, 2].map(j => <div key={j} style={{ width: 9 * z, height: 9 * z, borderRadius: '50%', background: INK, opacity: 0.35 + 0.65 * Math.abs(Math.sin((f - 58) / 5 - j * 0.7)) }} />)}
          </div> : null}
        </div>
      </> : null}
    </>;
  }
  if (seg === 2) {   // vrai repas : on compose le plat (vitrine Rendez-Vous), puis au panier
    return <>
      {VT.map(([at, n], i) => {
        const next = VT[i + 1];
        const o = (f >= at ? lerp(f, [at, at + 5], [i === 0 ? 1 : 0, 1]) : 0) * (next && f >= next[0] + 5 ? 0 : 1);
        return o > 0 ? <Shot key={n} src={r5(n)} z={z} o={o} /> : null;
      })}
      {VT_TAP[L].map(([at, x, y], i) => <Tap key={i} f={f} at={at} x={x} y={y} z={z} />)}
    </>;
  }
  if (seg === 3) {   // lait : recherche tapée, résultats, le moins cher entouré
    const typed = TYPED(), resAt = tAt(typed) + 6;
    let k = 0; for (let j = 1; j <= typed; j++) if (f >= tAt(j)) k = j;
    const base = ch(`find${Math.min(k, typed - 1)}`);
    const rk = lerp(f, [resAt, resAt + 12], [0, 1], outExpo);
    return <>
      <Shot src={base} z={z} />
      {k === typed ? <div style={{ position: 'absolute', left: 0, right: 0, top: 118 * z, bottom: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-(1 - rk) * 60 * z}px)`, opacity: rk }}>
          <Img src={ch(`find${typed}`)} style={{ position: 'absolute', left: 0, top: -118 * z, width: 390 * z }} />
        </div>
      </div> : null}
      {k === typed ? <div style={{ position: 'absolute', left: 0, right: 0, top: 30 * z, height: 70 * z, overflow: 'hidden' }}>
        <Img src={ch(`find${typed}`)} style={{ position: 'absolute', left: 0, top: -30 * z, width: 390 * z }} />
      </div> : null}
      {f >= 48 ? <div style={{ position: 'absolute', left: 18 * z, top: (ROWY() - 20) * z, width: 354 * z, height: 40 * z, borderRadius: 12 * z,
        border: `${3 * z}px solid ${OR}`, boxShadow: `0 0 ${18 * z}px ${OR}88`, opacity: lerp(f, [48, 54], [0, 1]),
        transform: `scale(${1 + 0.06 * (1 - lerp(f, [48, 58], [0, 1], outExpo))})` }} /> : null}
    </>;
  }
  if (seg === 4) {   // colis : « Envoyer un colis » touché
    const tx = RTL ? 277 : 112, ty = RTL ? 388 : 393;
    return <>
      <Shot src={bu(f < 28 ? 'poste0' : 'poste1')} z={z} />
      <Bar src={bu('poste1')} z={z} top={BAR()} />
      {f >= 24 && f < 32 ? <div style={{ position: 'absolute', left: (tx - 78) * z, top: (ty - 32) * z, width: 157 * z, height: 64 * z, borderRadius: 18 * z, background: 'rgba(15,31,61,.12)' }} /> : null}
      <Tap f={f} at={24} x={tx} y={ty} z={z} />
    </>;
  }
  // pressing : la page d'Edmar défile, on touche « + »
  const y = lerp(f, [6, 44], [0, 520], inOut);
  const px = RTL ? 75 : 315, py = (RTL ? 1163 : 1203) - 520;
  return <>
    <Shot src={bu('edmarL')} z={z} top={y} />
    <Bar src={bu('edmarv')} z={z} top={772} />
    <Tap f={f} at={54} x={px} y={py} z={z} />
    {f >= 54 ? <div style={{ position: 'absolute', left: (px - 22) * z, top: (py - 22) * z, width: 44 * z, height: 44 * z, borderRadius: '50%', background: OR, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Heebo, sans-serif', fontWeight: 900, fontSize: 22 * z, transform: `scale(${sp(f, 54, 7, 320, 0.5)})`, ...iso }}>1</div> : null}
  </>;
};
const Envies: React.FC = () => {
  const F = useCurrentFrame();
  const seg = Math.min(5, Math.floor(F / SEG)), f = F - seg * SEG;
  const dir = RTL ? -1 : 1;
  const sl = lerp(f, [0, 10], [0, 1], inOut);
  // zoom caméra : sur le prix le moins cher (lait), léger sur le plat (repas)
  let cam: Cam | undefined;
  if (seg === 3) cam = { s: 1.45, px: 195, py: ROWY(), tx: 540, ty: 1250, e: lerp(f, [42, 50], [0, 1], Easing.in(Easing.cubic)) * lerp(f, [67, 75], [1, 0]) };
  if (seg === 2) cam = { s: 1.2, px: 195, py: 450, tx: 540, ty: 1180, e: lerp(f, [10, 20], [0, 1], inOut) * lerp(f, [50, 58], [1, 0], inOut) };
  const tilt = [-3, 3, -2, 3, -3, 2][seg];
  return (
    <AbsoluteFill>
      {seg > 0 && f < 14 ? <AbsoluteFill style={{ background: BGS[seg - 1][0] }} /> : null}
      {BGS.map(([bg, a, b], i) => (
        <Sequence key={i} from={i * SEG} durationInFrames={SEG}>
          <Stage bg={bg} a={a} b={b} ox={i % 2 ? 900 : 180} oy={i % 2 ? 300 : 1700}>
            <Slam lines={S.q[i]} at={3} y={70} size={RTL ? 160 : 145} color={QCOL[i][0]} block={QCOL[i][1]} blockInk={QCOL[i][2]} step={8} />
          </Stage>
        </Sequence>
      ))}
      <Phone at={-6} y={460} w={560} tilt={tilt} cam={cam}>
        {(z) => <>
          {seg > 0 && f < 10 ? <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-dir * sl * 390 * z}px)` }}><Screen seg={seg - 1} f={SEG - 1} z={z} /></div> : null}
          <div style={{ position: 'absolute', inset: 0, transform: seg > 0 ? `translateX(${dir * (1 - sl) * 390 * z}px)` : undefined }}><Screen seg={seg} f={f} z={z} /></div>
        </>}
      </Phone>
      {/* ce que l'appli répond, en grand sous le téléphone */}
      {seg === 0 && f >= 30 ? <CigCard f={f} /> : null}
      {seg === 1 ? <Pill f={f} text={S.hoppy} at={30} x={540} y={1785} bg={NAVY} ink="#fff" size={64} rot={-3} /> : null}
      {seg === 2 ? S.chips.map((c, i) => {
        const at = VT_TAP[L][i][0] + 3;
        if (f < at || (i < 2 && f > at + 19)) return null;
        return <Pill key={i} f={f} text={c} at={at} x={540} y={1785} bg={i === 2 ? '#16A34A' : '#fff'} ink={i === 2 ? '#fff' : CORAL} size={62} rot={i % 2 ? 4 : -4} />;
      }) : null}
      {seg === 3 && f >= 50 ? <Pill f={f} text={<span style={{ unicodeBidi: 'plaintext' }}>{S.cheap}</span>} at={50} x={540} y={1790} bg={OR} ink="#fff" size={66} rot={-3} /> : null}
      {seg === 4 ? <Pill f={f} text={S.colis} at={34} x={540} y={1785} bg={NAVY} ink="#fff" size={64} rot={3} /> : null}
      {seg === 5 ? <Pill f={f} text={S.press} at={18} x={540} y={1785} bg="#E9D3A6" ink="#1F1C19" size={64} rot={-3} /> : null}
      {seg === 5 && f >= 57 ? <Pill f={f} text={S.pressOk} at={57} x={RTL ? 300 : 780} y={1640} bg={OR} ink="#fff" size={54} rot={5} /> : null}
    </AbsoluteFill>
  );
};
// Le paquet sans marque (icône officielle du kit) + prix approximatif
const CigCard: React.FC<{ f: number }> = ({ f }) => {
  const k = sp(f, 30, 11, 230, 0.7);
  const plus = sp(f, 52, 7, 320, 0.5);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1668, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - k) * 260}px) scale(${0.7 + 0.3 * k})`, opacity: Math.min(1, k * 2) }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 26, padding: '12px 36px 12px 22px', borderRadius: 42, background: '#fff', direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 20px 44px rgba(8,18,38,.28)' }}>
        <div style={{ width: 104, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Img src={staticFile('bureau/c-tabac.webp')} style={{ height: 130, transform: `rotate(${Math.sin(f / 9) * 4}deg)` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 50, color: INK, letterSpacing: RTL ? 0 : '-0.02em', lineHeight: 1.05 }}>{S.cig}</div>
          <div style={{ fontFamily: TITLE(), fontWeight: 900, fontSize: 60, color: OR, unicodeBidi: 'plaintext', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{S.cigP}</div>
          <div style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 28, color: '#6B7A8C', lineHeight: 1.1 }}>{S.cigS}</div>
        </div>
        <div style={{ position: 'relative', width: 96, height: 96, borderRadius: '50%', background: f >= 52 ? OR : INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Heebo, sans-serif', fontWeight: 900, fontSize: 60, transform: `scale(${f >= 52 && f < 58 ? 0.86 : 1})`, ...iso }}>
          {f >= 52 ? <span style={{ transform: `scale(${plus})` }}>1</span> : '+'}
          {f >= 52 && f < 70 ? <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: `5px solid ${OR}`, transform: `scale(${lerp(f, [52, 70], [0.6, 1.6])})`, opacity: lerp(f, [52, 70], [0.9, 0]) }} /> : null}
        </div>
      </div>
    </div>
  );
};

// ===== 3. « Restez au bureau. On y va pour vous. » (600–780) : carousel-3d des rubriques de l'appli =====
// Carte shotcraft carousel-3d : 8 cartes en anneau, chaque carte ne tourne qu'autour de Y (toujours droite), deux faces
// identiques (backface hidden), rotation = 50 % régulière + 50 % par pas (21 images : 8 de pose + 13 de passage),
// carte de face mise en avant (+44 px, contour orange), légende qui roule sous l'anneau, caméra fixe en léger plongé.
const N = 8, RAD = 600, CW = 380, CHh = 500, BEAT = 21, DWELL = 8, RING_Y = 930;
const smooth = (t: number) => t * t * (3 - 2 * t);
const c01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const stepPart = (f: number) => { const k = Math.floor(f / BEAT), lo = f - k * BEAT; return (k + smooth(c01((lo - DWELL) / (BEAT - DWELL)))) / N; };
const turnAt = (f: number) => 0.5 * (f / (N * BEAT)) + 0.5 * stepPart(f);
const POSTER = [-1, 2, 4, 3, 1, 5, 6, 0];   // -1 = carte cigarettes dessinée dans le style des affiches de l'accueil
const CigPoster: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 300, height: 395, transform: `scale(${380 / 300})`, transformOrigin: '0 0', background: '#FFC9D6', direction: RTL ? 'rtl' : 'ltr' }}>
    <Img src={staticFile('bureau/c-tabac.webp')} style={{ position: 'absolute', top: 26, left: '50%', height: 170, transform: 'translateX(-50%)' }} />
    <div style={{ position: 'absolute', top: 196, [RTL ? 'right' : 'left']: 22, fontFamily: 'monospace', fontSize: 15, color: '#8A5B66', ...iso }}>00</div>
    <div style={{ position: 'absolute', left: 14, right: 14, top: 214, textAlign: 'center', fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 58 : 52, color: INK, letterSpacing: RTL ? 0 : '-0.04em', whiteSpace: 'nowrap' }}>{S.cards[0]}</div>
    <div style={{ position: 'absolute', left: 22, right: 22, bottom: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 21, color: INK }}>{S.cigSub}</span>
      <span style={{ width: 46, height: 46, borderRadius: '50%', background: INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none' }}>{RTL ? '‹' : '›'}</span>
    </div>
  </div>
);
const Carousel: React.FC = () => {
  const F = useCurrentFrame();
  const f = Math.max(0, F - 6);
  const k0 = sp(F, 0, 14, 120, 0.9);
  const spin = (RTL ? -1 : 1) * turnAt(f) * 360;
  const az = (i: number) => ((((i * 360) / N - spin) % 360) + 540) % 360 - 180;
  const depth = (i: number) => (1 - Math.cos((az(i) * Math.PI) / 180)) / 2;
  const hl = (i: number) => smooth(c01(1 - Math.abs(az(i)) / 26));
  const k = Math.floor(f / BEAT), roll = smooth(c01((f - k * BEAT - DWELL) / (BEAT - DWELL)));
  const card = (i: number) => {
    const d = depth(i), h = hl(i);
    const face: React.CSSProperties = { position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
      boxShadow: h > 0.01 ? `0 0 0 ${5 * h}px ${OR}, 0 0 ${50 * h}px rgba(255,106,19,${0.6 * h})` : 'none' };
    const body = <>
      {POSTER[i] < 0 ? <CigPoster /> : <Img src={staticFile(`bureau/po${POSTER[i]}-${L}.jpg`)} style={{ position: 'absolute', left: -2, top: -2, width: CW + 4, height: CHh + 4, objectFit: 'cover' }} />}
      <div style={{ position: 'absolute', inset: 0, background: NAVY, opacity: 0.72 * d }} />
    </>;
    return (
      <div key={i} style={{ position: 'absolute', left: -CW / 2, top: -CHh / 2, width: CW, height: CHh, transformStyle: 'preserve-3d',
        transform: `rotateY(${(i * 360) / N}deg) translateZ(${RAD + 44 * h}px)` }}>
        <div style={face}>{body}</div>
        <div style={{ ...face, transform: 'rotateY(180deg)' }}>{body}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AbsoluteFill style={{ background: 'radial-gradient(80% 50% at 50% 62%, rgba(30,155,240,.28), rgba(15,31,61,0) 70%)' }} />
      <div style={{ position: 'absolute', left: 540 - 520, top: RING_Y + 120, width: 1040, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, rgba(255,106,19,.22) 0%, rgba(255,106,19,0) 65%)' }} />
      <Slam lines={S.stay} at={4} y={110} size={RTL ? 150 : 128} color="#fff" block={OR} step={12} />
      <div style={{ position: 'absolute', inset: 0, perspective: '2000px', perspectiveOrigin: `50% ${RING_Y - 80}px`, opacity: Math.min(1, k0 * 1.5), transform: `translateY(${(1 - k0) * 500}px)` }}>
        <div style={{ position: 'absolute', left: 540, top: RING_Y, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translateZ(${-RAD}px) rotateX(-8deg)` }}>
          <svg width={RAD * 2.6} height={RAD * 2.6} viewBox={`${-RAD * 1.3} ${-RAD * 1.3} ${RAD * 2.6} ${RAD * 2.6}`}
            style={{ position: 'absolute', left: -RAD * 1.3, top: CHh / 2 + 14 - RAD * 1.3, transform: `rotateX(90deg) rotateZ(${spin}deg)`, overflow: 'visible' }}>
            <circle r={RAD * 1.1} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={3} />
            {Array.from({ length: 96 }, (_, t) => { const a = (t / 96) * Math.PI * 2, r0 = RAD * (t % 12 === 0 ? 1.03 : 1.07);
              return <line key={t} x1={r0 * Math.cos(a)} y1={r0 * Math.sin(a)} x2={RAD * 1.1 * Math.cos(a)} y2={RAD * 1.1 * Math.sin(a)} stroke={t % 12 === 0 ? OR : 'rgba(255,255,255,.18)'} strokeWidth={t % 12 === 0 ? 4 : 2} />; })}
          </svg>
          <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `rotateY(${-spin}deg)` }}>
            {Array.from({ length: N }, (_, i) => card(i))}
          </div>
        </div>
      </div>
      {/* légende : la rubrique de face, qui roule */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1440, height: 130, overflow: 'hidden', opacity: lerp(F, [16, 26], [0, 1]) }}>
        {[0, 1].map(j => {
          const c = (k + j) % N;
          return <div key={j} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, direction: RTL ? 'rtl' : 'ltr',
            transform: `translateY(${(j - roll) * 130}px)`, opacity: 1 - Math.abs(j - roll) * 0.9 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 34, color: OR, letterSpacing: '0.12em', ...iso }}>{`0${c + 1} / 08`}</span>
            <span style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 92, color: '#fff', letterSpacing: RTL ? 0 : '-0.03em', whiteSpace: 'nowrap' }}>{S.cards[c]}</span>
          </div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ===== 4. Le prix (780–870) : « Livré au bureau · dès 25 ₪ en ville » + payez le livreur =====
const Price: React.FC = () => {
  const f = useCurrentFrame();
  const big = sp(f, 14, 9, 320, 0.7);
  return (
    <Stage bg={LEMON} a="#FFEE80" b={CORAL} ox={540} oy={960}>
      <Punch at={[14]}>
        <Slam lines={[S.livre]} at={4} y={250} size={RTL ? 150 : 130} color={INK} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 520, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 28, direction: RTL ? 'rtl' : 'ltr' }}>
          <span style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 110 : 130, color: INK, opacity: lerp(f, [8, 14], [0, 1]) }}>{S.des}</span>
          <span style={{ display: 'inline-block', transform: `scale(${2.2 - 1.2 * big})`, opacity: Math.min(1, big * 3), fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800, fontSize: 300,
            letterSpacing: '-0.05em', lineHeight: 1, color: INK, ...iso }}>25 ₪</span>
        </div>
        <Pill text={S.inCity} at={26} x={540} y={1000} bg={OR} ink="#fff" size={90} rot={-4} />
      </Punch>
      {S.pay.map((t, i) => {
        const at = 40 + i * 9, k = sp(f, at, 12, 220, 0.7);
        if (f < at) return null;
        return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 1240 + i * 150, display: 'flex', justifyContent: 'center', transform: `translateX(${(1 - k) * (RTL ? 500 : -500)}px)`, opacity: Math.min(1, k * 2) }}>
          <div style={{ padding: '20px 50px', borderRadius: 60, background: i ? '#fff' : INK, color: i ? INK : '#fff', fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 66, direction: RTL ? 'rtl' : 'ltr',
            whiteSpace: 'nowrap', boxShadow: '0 16px 36px rgba(8,18,38,.22)' }}>{t}</div>
        </div>;
      })}
    </Stage>
  );
};

// ===== 5. Néons (870–1005) : carte shotcraft neon-triple-marquee =====
// Trois lignes de lettres « tubes néon » (contour vide) sur un mur de briques filmé de biais (rotateY −17° → −9°) ;
// lignes 1 et 3 vers la droite, ligne 2 vers la gauche et un peu plus vite ; une seule ligne allumée à la fois
// (période 42 images, créneaux de 14 + 2 de relais, petit scintillement d'allumage) ; allumage ligne par ligne au début,
// extinction ligne par ligne à la fin (le mur reste avec les tubes éteints).
const NEON = ['#FF6A13', '#38D9FF', '#FFE14A'];
const flick = (t: number) => (t < 0 ? 0 : t < 2 ? 0.6 : t < 3 ? 0.25 : t < 6 ? 0.25 + 0.75 * ((t - 3) / 3) : 1);
const Neon: React.FC = () => {
  const f = useCurrentFrame();
  const rows = S.neon;
  const lit = (r: number) => {
    const on = flick(f - r * 5);                          // allumage
    const off = f >= 112 + r * 6 ? (f < 112 + r * 6 + 4 ? (f % 2 ? 0.2 : 0.9) : 0) : 1;   // extinction
    const ph = ((f - 18 - r * 14) % 42 + 42) % 42;         // tour de rôle
    let p = 0;
    if (f < 18) p = on;
    else if (ph < 16) p = ph < 2 ? (ph < 1 ? 0.6 : 0.3) : ph < 5 ? 0.3 + 0.7 * ((ph - 2) / 3) : ph < 11 ? 1 : 1 - Easing.in(Easing.quad)((ph - 11) / 5);
    return p * off;
  };
  const rot = lerp(f, [0, 135], [-17, -9], inOut), sc = lerp(f, [0, 135], [1, 1.05], inOut);
  const SZ = RTL ? 260 : 240;
  return (
    <AbsoluteFill style={{ background: '#0A0B14', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, perspective: '1700px' }}>
        <div style={{ position: 'absolute', left: -500, right: -500, top: 160, height: 1480, transform: `rotateY(${rot}deg) scale(${sc})`, transformOrigin: '50% 50%',
          backgroundColor: '#11131F',
          backgroundImage: 'linear-gradient(#0A0B14 6px, transparent 6px), linear-gradient(90deg, #0A0B14 6px, transparent 6px)',
          backgroundSize: '180px 80px, 180px 160px', backgroundPosition: '0 0, 90px 80px' }}>
          {rows.map((t, r) => {
            const p = lit(r), c = NEON[r];
            const dirSign = r === 1 ? -1 : 1, speed = r === 1 ? 11 : 9;
            const x = -2400 + dirSign * f * speed;
            const copies = Array.from({ length: t.length < 6 ? 14 : 7 });
            return (
              <div key={r} style={{ position: 'absolute', left: 0, right: 0, top: 120 + r * 450, height: 400 }}>
                {/* lumière du néon sur les briques */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: -120, bottom: -120, background: `radial-gradient(60% 50% at 50% 50%, ${c}55, transparent 70%)`, opacity: p * 0.9, mixBlendMode: 'screen' }} />
                <div style={{ position: 'absolute', left: x, top: 0, display: 'flex', alignItems: 'center', gap: 90, whiteSpace: 'nowrap', direction: 'ltr' }}>
                  {copies.map((_, j) => <React.Fragment key={j}>
                    <span style={{ fontFamily: TITLE(), fontWeight: 900, fontSize: SZ, lineHeight: 1.6, color: 'transparent', direction: RTL && r > 0 ? 'rtl' : 'ltr', unicodeBidi: 'isolate',
                      WebkitTextStroke: `${6 + 4 * p}px ${c}`, opacity: 0.3 + 0.7 * p,
                      filter: p > 0.05 ? `drop-shadow(0 0 ${9 * p}px ${c}) drop-shadow(0 0 ${36 * p}px ${c}) drop-shadow(0 0 ${90 * p}px ${c})` : 'none' }}>{t}</span>
                    <span style={{ width: 60, height: 60, flex: 'none', transform: 'rotate(45deg)', border: `${6 + 4 * p}px solid ${c}`, opacity: 0.3 + 0.7 * p }} />
                  </React.Fragment>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,11,20,.9) 0%, rgba(10,11,20,0) 14%, rgba(10,11,20,0) 86%, rgba(10,11,20,.95) 100%)' }} />
    </AbsoluteFill>
  );
};

// ===== 6. Fin (1005–1185) : logo-shrink-wordmark-lockup (comme « Choc ») =====
const WM = 760, WMX = 160, WMY = 480, WS = WM / 2310;
const BANG_X = WMX + (2060 + 10) * WS, BANG_Y = WMY + (350 + 20) * WS;
const BANG_OFF = (540 - BANG_X) / WS;
const arc = (r: number, a0: number, a1: number) => {
  const p = (a: number) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
};
const ringScale = (f: number) => lerp(f, [2, 30], [5.4, 1], inOut) * (1 + Math.sin(lerp(f, [28, 40], [0, 1], (t) => t) * Math.PI) * 0.06);
const End: React.FC = () => {
  const f = useCurrentFrame();
  const sc = ringScale(f), spin = -150 * lerp(f, [0, 32], [0, 1], Easing.out(Easing.cubic));
  const heal = lerp(f, [10, 30], [0, 1]);
  const bangIn = lerp(f, [26, 34], [0, 1]);
  const shift = lerp(f, [44, 58], [0, 1], inOut);
  const wave = lerp(f, [30, 50], [0, 1], Easing.out(Easing.cubic));
  const trail = Math.min(1, Math.abs(ringScale(f) - ringScale(f - 1)) / 0.35);
  const gone = (i: number) => lerp(f, [162 + (2 - i) * 3, 168 + (2 - i) * 3], [0, 1], inQuad);
  const bangOut = lerp(f, [170, 177], [0, 1], Easing.in(Easing.back(2)));
  const letter = (i: number) => {
    if (i === 3) return { x: BANG_OFF * (1 - shift), s: (f < 40 ? 1 + Math.sin(lerp(f, [28, 40], [0, 1], (t) => t) * Math.PI) * 0.06 : 1) * (1 - bangOut), o: bangIn };
    const k = lerp(f, [56 + i * 5, 66 + i * 5], [0, 1], Easing.out(Easing.cubic)), g = gone(i);
    return { x: (1 - k) * -90 - g * 60, o: k * (1 - g), blur: (1 - k) * 14 + g * 10 };
  };
  const ringX = BANG_X - (BANG_X - 540) * (1 - shift);
  const ring = (s: number, rot: number, o: number, ghost = false) => (
    <svg style={{ position: 'absolute', left: ringX - 150, top: BANG_Y - 150, overflow: 'visible', opacity: o, transform: `scale(${s})` }} width={300} height={300} viewBox="-150 -150 300 300">
      <g transform={`rotate(${rot})`}>
        {[0, 180].map(d => <path key={'g' + d} d={arc(112, -32 + d, 122 + d)} fill="none" stroke={OR} strokeOpacity={0.7 * (1 - heal)} strokeWidth={34} strokeLinecap="round" style={{ filter: 'blur(10px)' }} />)}
        {!ghost ? [0, 180].map(d => <path key={'c' + d} d={arc(112, -32 + d, 122 + d)} fill="none" stroke="#fff" strokeWidth={16} strokeLinecap="round" opacity={1 - heal * 0.8} />) : null}
        {!ghost ? <circle r={112} fill="none" stroke="#fff" strokeWidth={22} opacity={heal * (1 - bangIn)} /> : null}
      </g>
    </svg>
  );
  const txt = (at: number) => ({ o: lerp(f, [at, at + 10], [0, 1]) * lerp(f, [158, 166], [1, 0]), y: lerp(f, [at, at + 12], [30, 0], outExpo) });
  const t0 = txt(76), u = txt(108);
  const halo = lerp(f, [2, 34], [520, 130], inOut);
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #16294D 0%, #0F1F3D 55%, #0B1830 100%)' }} />
      <div style={{ position: 'absolute', left: ringX - halo, top: BANG_Y - halo, width: 2 * halo, height: 2 * halo,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,106,19,.35) 0%, rgba(255,106,19,.1) 40%, rgba(255,106,19,0) 70%)', opacity: (0.9 - 0.6 * lerp(f, [34, 60], [0, 1])) * (1 - bangOut) }} />
      <Punch at={[32]}>
        {wave > 0 && wave < 1 ? <div style={{ position: 'absolute', left: 540 - lerp(wave, [0, 1], [110, 420]), top: BANG_Y - lerp(wave, [0, 1], [110, 420]), width: 2 * lerp(wave, [0, 1], [110, 420]),
          height: 2 * lerp(wave, [0, 1], [110, 420]), borderRadius: '50%', boxSizing: 'border-box', border: `${lerp(wave, [0, 1], [6, 1.5])}px solid rgba(255,255,255,${0.7 * (1 - wave)})`,
          boxShadow: `0 0 30px rgba(255,106,19,${0.5 * (1 - wave)})` }} /> : null}
        {f < 36 ? <>
          {trail > 0.02 ? ring(ringScale(f - 2), -150 * lerp(f - 2, [0, 32], [0, 1], Easing.out(Easing.cubic)), 0.16 * trail, true) : null}
          {trail > 0.02 ? ring(ringScale(f - 1), -150 * lerp(f - 1, [0, 32], [0, 1], Easing.out(Easing.cubic)), 0.3 * trail, true) : null}
          {ring(sc, spin, 1 - lerp(f, [30, 36], [0, 1]))}
        </> : null}
        <div style={{ position: 'absolute', left: WMX, top: WMY }}><Wordmark width={WM} anim={letter} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 340, textAlign: 'center', fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 96, color: '#fff', direction: RTL ? 'rtl' : 'ltr',
          letterSpacing: RTL ? 0 : '-0.03em', opacity: t0.o, transform: `translateY(${t0.y}px)` }}>{S.open}</div>
        {f < 168 ? <AbsoluteFill style={{ opacity: lerp(f, [158, 166], [1, 0]) }}>
          <Slam lines={[S.end1]} at={86} y={820} size={RTL ? 96 : 84} color="#fff" />
          <Slam lines={[S.end2]} at={96} y={950} size={RTL ? 92 : 84} block={OR} />
        </AbsoluteFill> : null}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, display: 'flex', justifyContent: 'center', opacity: u.o, transform: `translateY(${u.y}px)` }}>
          <div style={{ padding: '18px 46px', borderRadius: 60, background: LEMON, color: INK, fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800, fontSize: 54, letterSpacing: '-0.02em', ...iso }}>hop-livraison.vercel.app</div>
        </div>
      </Punch>
      <Sequence from={66} layout="none"><HoppyHop x={540} bottom={1880} h={600} at={0.2} exitAt={3.1} from={RTL ? 'right' : 'left'} /></Sequence>
    </AbsoluteFill>
  );
};

// Montage : 120 BPM, coupes sur les temps (multiples de 15 images)
export const CUTS_BUREAU = [150, 225, 300, 375, 450, 525, 600, 780, 870, 1005];
export const Bureau: React.FC<{ lang?: Lang; music?: boolean }> = ({ lang = 'fr', music = true }) => {
  L = lang; S = STR[lang]; RTL = lang === 'he';
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence durationInFrames={150}><Hook /></Sequence>
      <Sequence from={150} durationInFrames={450}><Envies /></Sequence>
      <Sequence from={600} durationInFrames={180}><Carousel /></Sequence>
      <Sequence from={780} durationInFrames={90}><Price /></Sequence>
      <Sequence from={870} durationInFrames={135}><Neon /></Sequence>
      <Sequence from={1005} durationInFrames={180}><End /></Sequence>
      <Finish />
      {music ? <Audio src={staticFile(`bureau-music-${lang}.wav`)} /> : null}
    </AbsoluteFill>
  );
};
