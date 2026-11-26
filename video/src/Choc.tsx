import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/heebo/900.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/caveat/700.css';
import { HoppyHop } from './HoppyHop';
import { Wordmark } from './Reel';

// « Choc » (patron, 26/11) : 44 s, 1080 × 1920, 120 BPM (1 temps = 15 images), FR + HE.
// Des phrases choc, une par scène, et l'écran de l'appli TOUJOURS animé (vraies captures, public/choc/ et public/revo5/) :
// carrousel de l'accueil qui tourne affiche par affiche (jamais deux affiches coupées), page qui défile, touchers simulés,
// recherche tapée lettre par lettre, panneau de Hoppy qui monte en ressort, zoom caméra sur le prix et sur les ingrédients.
// Plans video-shotcraft adaptés : slam-entrance-moves (titres), marker-underline-title (le 40 ₪ barré), countdown (40 → 25),
// circle-match-iris (passages entre scènes), crash-zoom-punch (prix du comparateur), radial-ripple-phone-chips (touchers),
// vertical-word-roll-blur-cycle (ce qu'on livre), voice-waveform-live (micro), glow-flyline-moves (trajet du livreur),
// logo-shrink-wordmark-lockup (fin, logo tenu plus d'1 s).
// Règles : aucun concurrent nommé, pas de durée chiffrée, « dès 25 ₪ en ville », jamais « partenaire », Hoppy officiel.
export const CHOC_FRAMES = 1320;
type Lang = 'fr' | 'he';
const BLUE = '#1E9BF0', LEMON = '#FFE14A', CORAL = '#FF5D73', MINT = '#7ED9A6', INK = '#0B4A6F', NAVY = '#0F1F3D', OR = '#FF6A13', CREAM = '#FFF4E2';
const STR = {
  fr: {
    stop: ['Arrêtez', 'de payer plus de'], forty: '40 ₪', forS: 'pour vous faire livrer.', avec: 'Avec', des: 'dès', inCity: 'en ville',
    tout: ['Tout Netanya.', 'Livré.'], roll: ['Courses', 'Restos', 'Pharmacie', 'Pressing', 'Colis', 'Mezouzot', 'Mikvé'], rollPre: 'On y va :',
    shops: ['Rami Lévy', 'Carrefour', 'Osher Ad', 'Victory', 'Shufersal'],
    cmp: ['Le même lait.', 'Pas le même prix.'], cheap: 'Le moins cher', row: 'Osher Ad · 7,20 ₪', toutIci: 'Tout ici', toutIciS: 'toute la liste, en un clic',
    promo: ['Toutes les promos.', 'Réunies.'],
    vitA: ['Composez', 'votre plat.'], vitB: ['Sans cornichons ?', 'Un toucher.'], chips: ['− Salade', '− Cornichons', '+ Salade', '✓ Ajouté au panier'],
    voice: ['Pas envie de taper ?', 'Dites-le à Hoppy.'], say: 'Du lait, du pain et 6 œufs', langs: 'en français ou en hébreu',
    pay: ['Pas de carte.', 'Pas de surprise.'], rows: [['Payez le livreur', 'en espèces ou par Bit'], ['Livré au plus vite', 'votre plat arrive chaud'], ['Suivi en direct', 'vous voyez où en est votre course']],
    open: 'Ouvrez', end1: 'Dites ce qu’il vous faut.', end2: 'On s’occupe du reste.',
  },
  he: {
    stop: ['די לשלם', 'יותר מ־'], forty: '40 ₪', forS: 'על משלוח.', avec: 'עם', des: 'החל מ־', inCity: 'בעיר',
    tout: ['כל נתניה.', 'עד הבית.'], roll: ['קניות', 'מסעדות', 'בית מרקחת', 'ניקוי יבש', 'חבילות', 'מזוזות', 'מקווה'], rollPre: 'אנחנו הולכים:',
    shops: ['רמי לוי', 'קרפור', 'אושר עד', 'ויקטורי', 'שופרסל'],
    cmp: ['אותו חלב.', 'לא אותו מחיר.'], cheap: 'הכי זול', row: 'אושר עד · 7.20 ₪', toutIci: 'הכול כאן', toutIciS: 'כל הרשימה, בלחיצה אחת',
    promo: ['כל המבצעים.', 'במקום אחד.'],
    vitA: ['מרכיבים', 'את המנה.'], vitB: ['בלי חמוצים?', 'נגיעה אחת.'], chips: ['− חסה', '− חמוצים', '+ חסה', '✓ נוסף לסל'],
    voice: ['אין כוח להקליד?', 'תגידו להופי.'], say: 'חלב, לחם ו־6 ביצים', langs: 'בעברית או בצרפתית',
    pay: ['בלי כרטיס.', 'בלי הפתעות.'], rows: [['משלמים לשליח', 'במזומן או בביט'], ['משלוח הכי מהר', 'האוכל מגיע חם'], ['מעקב בזמן אמת', 'רואים איפה המשלוח']],
    open: 'פותחים את', end1: 'אומרים מה צריך.', end2: 'ואנחנו דואגים לשאר.',
  },
};
let S: (typeof STR)['fr'] = STR.fr, RTL = false, L: Lang = 'fr';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], e: (t: number) => number = Easing.inOut(Easing.quad)) => interpolate(f, a, b, { ...clamp, easing: e });
const outExpo = Easing.out(Easing.exp), inOut = Easing.inOut(Easing.cubic), outBack = Easing.out(Easing.back(1.6)), inQuad = Easing.in(Easing.quad);
const sp = (f: number, d: number, damping = 12, stiffness = 220, mass = 0.7) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const TITLE = () => (RTL ? 'Heebo, sans-serif' : '"Bricolage Grotesque", Heebo, sans-serif');
const SCRIPT = () => (RTL ? 'Heebo, sans-serif' : 'Caveat, cursive');
const iso: React.CSSProperties = { unicodeBidi: 'isolate', direction: 'ltr' };
const ch = (p: string) => staticFile(`choc/${p}-${L}.jpg`);
const r5 = (p: string) => staticFile(`revo5/${p}-${L}.jpg`);
const fit = (t: string, size: number, room = 960) => Math.min(size, room / Math.max(1, t.length * (RTL ? 0.62 : 0.58)));

// ---------- Fond de scène : ouverture en cercle (circle-match-iris) + deux ronds qui dérivent + vignette ----------
const Stage: React.FC<{ bg: string; a: string; b: string; ox?: number; oy?: number; children: React.ReactNode }> = ({ bg, a, b, ox = 540, oy = 960, children }) => {
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
// ---------- Phrase choc : chaque ligne claque (slam : grande, floue, puis posée avec un léger tilt) ; sortie rapide ----------
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
// Accroche manuscrite qui s'écrit (Caveat ; en hébreu Heebo gras)
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
// Pastille (comme les bulles de l'appli) : pop + balancement
const Pill: React.FC<{ text: React.ReactNode; at: number; x: number; y: number; bg?: string; ink?: string; size?: number; rot?: number; from?: number }> =
  ({ text, at, x, y, bg = '#fff', ink = INK, size = 46, rot = -4, from = 0 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 10, 260, 0.6);
  const bob = Math.sin((f - at) / 10) * 5;
  return (
    <div style={{ position: 'absolute', left: x, top: y + bob, transform: `translate(-50%, -50%) translateX(${(1 - k) * from}px) scale(${0.3 + 0.7 * k}) rotate(${rot + Math.sin((f - at) / 15) * 1.5}deg)`,
      opacity: Math.min(1, k * 2), padding: `${size * 0.3}px ${size * 0.6}px`, borderRadius: size, background: bg, color: ink, fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: size,
      letterSpacing: RTL ? 0 : '-0.02em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 14px 30px rgba(8,18,38,.28), inset 0 -4px 0 rgba(0,0,0,.08)' }}>{text}</div>
  );
};

// ---------- Téléphone : arrive en ressort, caméra qui zoome sur un point de l'écran (coordonnées CSS 390 × 844) ----------
type Cam = { s: number; px: number; py: number; tx: number; ty: number; e: number };
const Phone: React.FC<{ at?: number; x?: number; y: number; w: number; tilt?: number; cam?: Cam; children: (z: number, sw: number) => React.ReactNode }> =
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
          {children(z, sw)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
// Une capture dans l'écran (décalage vertical en points CSS)
const Shot: React.FC<{ src: string; z: number; top?: number; o?: number; x?: number; clipTop?: number; clipBot?: number }> = ({ src, z, top = 0, o = 1, x = 0, clipTop, clipBot }) => (
  <Img src={src} style={{ position: 'absolute', left: x * z, top: -top * z, width: 390 * z, opacity: o,
    clipPath: clipTop != null || clipBot != null ? `inset(${(clipTop ?? 0) * z + top * z}px 0 0 0)` : undefined }} />
);
// Toucher simulé : le doigt arrive (rond qui se pose), appuie (rond qui rétrécit) et lâche (onde) — radial-ripple
const Tap: React.FC<{ at: number; x: number; y: number; z: number }> = ({ at, x, y, z }) => {
  const f = useCurrentFrame();
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
// Grain + vignette par-dessus tout
const Finish: React.FC = () => {
  const f = useCurrentFrame();
  return <>
    <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(120% 85% at 50% 45%, rgba(0,0,0,0) 55%, rgba(8,18,38,.38) 100%)' }} />
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.16 }}>
      <svg width="100%" height="100%"><filter id="cg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 9} /></filter><rect width="100%" height="100%" filter="url(#cg)" /></svg>
    </AbsoluteFill>
  </>;
};
// Le zoom de caméra sur les 3 grands coups du film (40 ₪, prix du comparateur, logo) — pas plus (R4)
const Punch: React.FC<{ at: number[]; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = Math.max(0, ...at.map(c => (f >= c ? lerp(f, [c, c + 12], [0.06, 0], outExpo) : 0)));
  const sh = Math.max(0, ...at.map(c => (f >= c && f < c + 8 ? (8 - (f - c)) / 8 : 0)));
  return <AbsoluteFill style={{ transform: `scale(${1 + p}) translate(${Math.sin(f * 7.3) * 10 * sh}px, ${Math.cos(f * 5.1) * 8 * sh}px)` }}>{children}</AbsoluteFill>;
};

// ===== 1. Accroche (0–180) : « Arrêtez de payer plus de 40 ₪ » → barré → « Avec HOP! dès 25 ₪ en ville » =====
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const big = sp(f, 30, 9, 320, 0.7);
  const strike = lerp(f, [74, 86], [0, 1], Easing.out(Easing.cubic));
  const out = lerp(f, [100, 110], [0, 1], inQuad);
  // compteur 40 → 25 (countdown) puis pop
  const cnt = Math.round(lerp(f, [116, 138], [40, 25], Easing.out(Easing.cubic)));
  const pop = sp(f, 138, 8, 320, 0.5);
  const a2 = sp(f, 110, 13, 240, 0.7);
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 50% 40%, rgba(30,155,240,.22), rgba(15,31,61,0) 70%)' }} />
      <Punch at={[30]}>
        <AbsoluteFill style={{ transform: `translateY(${-out * 300}px) scale(${1 - out * 0.2})`, opacity: 1 - out }}>
          <Slam lines={S.stop} at={0} y={450} size={RTL ? 190 : 170} color="#fff" step={12} />
          {f >= 30 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 840, display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', transform: `scale(${2.4 - 1.4 * big})`, opacity: Math.min(1, big * 3), fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800,
              fontSize: 380, lineHeight: 1, letterSpacing: '-0.05em', color: '#fff', ...iso }}>
              {S.forty}
              <svg style={{ position: 'absolute', left: -40, top: 60, overflow: 'visible' }} width={900} height={300} viewBox="0 0 900 300">
                <path d="M10 250 C 260 190, 560 110, 880 40" fill="none" stroke={OR} strokeWidth={46} strokeLinecap="round" strokeDasharray={1000} strokeDashoffset={1000 * (1 - strike)} />
              </svg>
            </div>
          </div> : null}
          <Script text={S.forS} at={52} y={1270} size={120} color={LEMON} rot={-3} />
        </AbsoluteFill>
      </Punch>
      {f >= 108 ? <AbsoluteFill style={{ opacity: Math.min(1, a2 * 2) }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 34, direction: RTL ? 'rtl' : 'ltr',
          transform: `translateY(${(1 - a2) * 80}px)` }}>
          <span style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 130, color: '#fff', letterSpacing: RTL ? 0 : '-0.04em' }}>{S.avec}</span>
          <span style={{ display: 'inline-block', marginTop: 20 }}><Wordmark width={420} /></span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 850, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 26, direction: RTL ? 'rtl' : 'ltr' }}>
          <span style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 96 : 120, color: '#fff', opacity: lerp(f, [116, 124], [0, 1]) }}>{S.des}</span>
          <span style={{ display: 'inline-block', transform: `scale(${f < 138 ? 1 : 0.8 + 0.2 * pop})`, fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800, fontSize: RTL ? 250 : 300,
            letterSpacing: '-0.05em', lineHeight: 1, color: f < 138 ? '#fff' : LEMON, fontVariantNumeric: 'tabular-nums', ...iso }}>{cnt} ₪</span>
        </div>
        {f >= 142 ? <Pill text={S.inCity} at={142} x={540} y={1300} bg={OR} ink="#fff" size={84} rot={-4} /> : null}
      </AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

// ===== 2. Tout Netanya, livré (180–390) : le carrousel de l'accueil tourne (une affiche à la fois), puis la page défile =====
const SLIDE_AT = [30, 58, 86];   // passages 0→1, 1→2, 2→3 (12 images chacun)
const Home: React.FC<{ z: number; f: number; scrollFrom: number; scrollTo: number; scrollAt: [number, number] }> = ({ z, f, scrollFrom, scrollTo, scrollAt }) => {
  if (f >= scrollAt[0]) {
    const y = lerp(f, scrollAt, [scrollFrom, scrollTo], inOut);
    return <Shot src={ch('long')} z={z} top={y} />;
  }
  let cur = 0, t = 0;
  SLIDE_AT.forEach((a, i) => { if (f >= a) { cur = i; t = lerp(f, [a, a + 12], [0, 1], inOut); } });
  const from = f < SLIDE_AT[0] ? 0 : cur, to = f < SLIDE_AT[0] ? 0 : cur + 1;
  const dir = RTL ? 1 : -1;   // en hébreu, l'affiche suivante arrive par la gauche
  const T0 = 180, T1 = 622;   // la bande du carrousel en points CSS
  return <>
    <Shot src={ch(`slide${to}`)} z={z} />
    {from !== to ? <div style={{ position: 'absolute', left: 0, top: T0 * z, width: 390 * z, height: (T1 - T0) * z, overflow: 'hidden' }}>
      <Img src={ch(`slide${from}`)} style={{ position: 'absolute', left: dir * t * 390 * z, top: -T0 * z, width: 390 * z }} />
      <Img src={ch(`slide${to}`)} style={{ position: 'absolute', left: (dir * t - dir) * 390 * z, top: -T0 * z, width: 390 * z }} />
    </div> : null}
  </>;
};
const WordRoll: React.FC<{ at: number; y: number }> = ({ at, y }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 12, 220, 0.7);
  const per = 11, n = S.roll.length;
  const p = Math.min(n - 1, (f - at) / per);
  const i = Math.floor(p), fr = p - i;
  const e = lerp(fr, [0.55, 1], [0, 1], inOut);
  const H = 96;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 2) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '16px 40px', borderRadius: 80, background: INK, direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 18px 40px rgba(8,18,38,.3)' }}>
        <span style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 60, color: '#fff', whiteSpace: 'nowrap' }}>{S.rollPre}</span>
        <div style={{ position: 'relative', height: H, width: RTL ? 360 : 380, overflow: 'hidden' }}>
          {[i, i + 1].filter(j => j < n).map((j, q) => {
            const off = (q - e) * H;
            return <div key={j} style={{ position: 'absolute', left: 0, right: 0, top: off, height: H, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', direction: RTL ? 'rtl' : 'ltr',
              fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 70, color: LEMON, whiteSpace: 'nowrap', filter: `blur(${Math.abs(q - e) * 8}px)`, opacity: 1 - Math.abs(q - e) * 0.6 }}>{S.roll[j]}</div>;
          })}
        </div>
      </div>
    </div>
  );
};
const Tout: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Stage bg={LEMON} a="#FFEE80" b={CORAL} ox={540} oy={1700}>
      <Slam lines={S.tout} at={4} y={90} size={RTL ? 160 : 150} block={CORAL} step={10} />
      <Phone at={8} y={430} w={560} tilt={-3}>
        {(z) => <>
          <Home z={z} f={f} scrollFrom={0} scrollTo={1010} scrollAt={[118, 190]} />
        </>}
      </Phone>
      {S.shops.map((s, i) => (
        <Pill key={s} text={s} at={44 + i * 9} x={i % 2 ? 900 : 180} y={600 + i * 170} bg={['#fff', INK, '#fff', CORAL, '#fff'][i]} ink={[INK, '#fff', INK, '#fff', INK][i]}
          size={48} rot={i % 2 ? 5 : -5} from={i % 2 ? 300 : -300} />
      ))}
      <WordRoll at={112} y={1690} />
    </Stage>
  );
};

// ===== 3. Le même lait, pas le même prix (390–630) : recherche tapée, résultats qui glissent, zoom sur le moins cher, puis les promos =====
const Compare: React.FC = () => {
  const f = useCurrentFrame();
  const typed = RTL ? 3 : 4;                    // lettres de « Lait » / « חלב »
  const tAt = (k: number) => 38 + (k - 1) * 8;  // une lettre toutes les 8 images
  const resAt = tAt(typed) + 6;
  const zoomE = f < 150 ? lerp(f, [100, 108], [0, 1], Easing.in(Easing.cubic)) : lerp(f, [150, 162], [1, 0], inOut);
  const rowY = RTL ? 365 : 378;
  const promo = f >= 186;
  return (
    <Stage bg={MINT} a="#A6EBC4" b={LEMON} ox={900} oy={300}>
      <Slam lines={S.cmp} at={4} y={90} size={RTL ? 160 : 140} block={INK} step={10} out={152} />
      {promo ? <Slam lines={S.promo} at={186} y={90} size={RTL ? 160 : 140} block={CORAL} step={9} /> : null}
      <Phone at={8} y={450} w={600} tilt={RTL ? 3 : -3} cam={{ s: 1.75, px: 195, py: rowY, tx: 540, ty: 960, e: zoomE }}>
        {(z) => {
          if (promo) {
            const k = lerp(f, [186, 196], [0, 1], outExpo);
            return <>
              <Shot src={ch(`find${typed}`)} z={z} />
              <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - k) * 844 * z}px)` }}>
                <Shot src={ch('long')} z={z} top={lerp(f, [192, 236], [2150, 2330], inOut)} />
              </div>
            </>;
          }
          if (f < 30) return <><Shot src={ch('slide0')} z={z} /><Tap at={24} x={195} y={147} z={z} /></>;
          let k = 0; for (let j = 1; j <= typed; j++) if (f >= tAt(j)) k = j;
          const base = ch(`find${Math.min(k, typed - 1)}`);
          const rk = lerp(f, [resAt, resAt + 12], [0, 1], outExpo);
          return <>
            <Shot src={base} z={z} />
            {k === typed ? <div style={{ position: 'absolute', left: 0, right: 0, top: 118 * z, bottom: 0, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: `translateY(${-(1 - rk) * 60 * z}px)`, opacity: rk }}>
                <Img src={ch(`find${typed}`)} style={{ position: 'absolute', left: 0, top: -118 * z, width: 390 * z }} />
              </div>
            </div> : null}
            {k === typed ? <div style={{ position: 'absolute', left: 0, right: 0, top: 30 * z, height: 70 * z, overflow: 'hidden' }}>
              <Img src={ch(`find${typed}`)} style={{ position: 'absolute', left: 0, top: -30 * z, width: 390 * z }} />
            </div> : null}
            {/* le moins cher, entouré au moment du zoom */}
            {f >= 108 && f < 160 ? <div style={{ position: 'absolute', left: 18 * z, top: (rowY - 20) * z, width: 354 * z, height: 40 * z, borderRadius: 12 * z,
              border: `${3 * z}px solid ${OR}`, boxShadow: `0 0 ${18 * z}px ${OR}88`, opacity: lerp(f, [108, 114], [0, 1]) * lerp(f, [150, 158], [1, 0]),
              transform: `scale(${1 + 0.06 * (1 - lerp(f, [108, 118], [0, 1], outExpo))})` }} /> : null}
          </>;
        }}
      </Phone>
      {f >= 110 && f < 160 ? <Pill text={`✓ ${S.cheap}`} at={112} x={540} y={250} bg={OR} ink="#fff" size={64} rot={-3} /> : null}
      {f >= 160 && !promo ? <ToutIci at={160} /> : null}
    </Stage>
  );
};
// Bouton « Tout ici » de l'appli, touché (le bouton s'enfonce) — pour toute la liste au même magasin
const ToutIci: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const k = sp(f, at, 11, 240, 0.6);
  const press = f >= at + 10 && f < at + 16 ? 0.9 : 1;
  const ex = lerp(f, [176, 184], [0, 1], inQuad);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, transform: `scale(${(0.5 + 0.5 * k) * press}) translateY(${-ex * 160}px)`, opacity: Math.min(1, k * 2) * (1 - ex) }}>
      <div style={{ position: 'relative', padding: '26px 72px', borderRadius: 80, background: INK, color: '#fff', fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 82, direction: RTL ? 'rtl' : 'ltr',
        boxShadow: press < 1 ? '0 4px 10px rgba(8,18,38,.3)' : '0 20px 40px rgba(8,18,38,.35)' }}>{S.toutIci}
        {f >= at + 10 ? <div style={{ position: 'absolute', left: '50%', top: '50%', width: 220, height: 220, marginLeft: -110, marginTop: -110, borderRadius: '50%', border: '6px solid #fff',
          transform: `scale(${lerp(f, [at + 10, at + 26], [0.3, 1.6])})`, opacity: lerp(f, [at + 10, at + 26], [0.9, 0]) }} /> : null}
      </div>
      <div style={{ fontFamily: SCRIPT(), fontWeight: RTL ? 900 : 700, fontSize: RTL ? 58 : 76, color: INK, direction: RTL ? 'rtl' : 'ltr' }}>{S.toutIciS}</div>
    </div>
  );
};

// ===== 4. Composez votre plat (630–870) : vitrine Rendez-Vous, vrais touchers, zoom sur les ingrédients, ajout au panier =====
const VT_SHOTS: [number, string][] = [[0, 'rdv'], [42, 'vt1'], [80, 'vt2'], [118, 'vt3'], [156, 'vt4'], [186, 'vt5a'], [204, 'vt5']];
const VT_TAPS: Record<Lang, [number, number, number][]> = {
  fr: [[74, 338, 368], [112, 52, 530], [150, 338, 368], [198, 195, 530]],
  he: [[74, 52, 368], [112, 338, 530], [150, 52, 368], [198, 195, 530]],
};
const Vitrine: React.FC = () => {
  const f = useCurrentFrame();
  const zoomE = f < 120 ? lerp(f, [56, 70], [0, 1], inOut) : lerp(f, [166, 182], [1, 0], inOut);
  const cart = sp(f, 206, 7, 300, 0.5);
  return (
    <Stage bg={CORAL} a="#FF8496" b={LEMON} ox={180} oy={1500}>
      <Slam lines={S.vitA} at={4} y={70} size={RTL ? 150 : 140} color="#fff" block={INK} step={9} out={100} />
      {f >= 112 ? <Slam lines={S.vitB} at={112} y={70} size={RTL ? 150 : 128} color="#fff" block={LEMON} blockInk={INK} step={9} /> : null}
      <Phone at={6} y={470} w={600} tilt={3} cam={{ s: 1.22, px: 195, py: 450, tx: 540, ty: 1290, e: zoomE }}>
        {(z) => <>
          {VT_SHOTS.map(([at, n], i) => {
            const next = VT_SHOTS[i + 1];
            const o = (f >= at ? lerp(f, [at, at + 5], [i === 0 ? 1 : 0, 1]) : 0) * (next && f >= next[0] + 5 ? 0 : 1);
            return o > 0 ? <Shot key={n} src={r5(n)} z={z} o={o} /> : null;
          })}
          {VT_TAPS[L].map(([at, x, y], i) => <Tap key={i} at={at} x={x} y={y} z={z} />)}
        </>}
      </Phone>
      {S.chips.slice(0, 3).map((c, i) => {
        const at = VT_TAPS[L][i][0] + 3;
        if (f < at || f > at + 34) return null;
        return <Pill key={i} text={c} at={at} x={540} y={1770} bg={i === 2 ? '#16A34A' : '#fff'} ink={i === 2 ? '#fff' : CORAL} size={60} rot={i % 2 ? 4 : -4} />;
      })}
      {f >= 206 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 1700, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', transform: `scale(${0.4 + 0.6 * cart})`, padding: '22px 50px', borderRadius: 70, background: '#fff', color: INK, fontFamily: TITLE(), fontWeight: RTL ? 900 : 800,
          fontSize: 60, direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 18px 40px rgba(8,18,38,.3)', whiteSpace: 'nowrap' }}>
          {S.chips[3]}
          <span style={{ position: 'absolute', top: -26, [RTL ? 'left' : 'right']: -26, width: 64, height: 64, borderRadius: '50%', background: OR, color: '#fff', fontSize: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${sp(f, 212, 6, 320, 0.4)}) translateY(${-Math.abs(Math.sin((f - 212) / 5)) * 14 * lerp(f, [212, 236], [1, 0])}px)`, ...iso }}>1</span>
        </div>
      </div> : null}
    </Stage>
  );
};

// ===== 5. Dites-le à Hoppy (870–1020) : toucher le micro, le panneau monte en ressort, l'onde de la voix, la bulle =====
const Voice: React.FC = () => {
  const f = useCurrentFrame();
  const sheet = sp(f, 30, 15, 170, 0.8);
  const bub = sp(f, 82, 11, 240, 0.6);
  return (
    <Stage bg={BLUE} a="#3FB0FF" b={LEMON} ox={540} oy={1700}>
      <Slam lines={S.voice} at={4} y={90} size={RTL ? 150 : 130} color="#fff" block={LEMON} blockInk={INK} step={11} />
      <Phone at={6} y={450} w={600} tilt={-3}>
        {(z) => <>
          <Shot src={ch('slide0')} z={z} />
          <Tap at={24} x={195} y={796} z={z} />
          {f >= 30 ? <>
            <Img src={ch('voice0')} style={{ position: 'absolute', left: 0, top: 0, width: 390 * z, clipPath: `inset(0 0 ${(844 - 120) * z}px 0)`, opacity: Math.min(1, sheet * 1.5) }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 844 * z, transform: `translateY(${(1 - sheet) * 760 * z}px)` }}>
              <Img src={ch('voice0')} style={{ position: 'absolute', left: 0, top: 0, width: 390 * z, clipPath: `inset(${120 * z}px 0 0 0)` }} />
              {/* onde de la voix sur le bouton micro */}
              {f >= 50 && f < 96 ? <div style={{ position: 'absolute', left: (RTL ? 42 : 348) * z - 70 * z, top: 800 * z - 22 * z, width: 140 * z, height: 44 * z, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 * z }}>
                {[...Array(9)].map((_, j) => <div key={j} style={{ width: 5 * z, borderRadius: 3 * z, background: OR,
                  height: (8 + 30 * Math.abs(Math.sin(f / 3.2 + j * 1.3)) * Math.sin((j + 1) / 10 * Math.PI)) * z * lerp(f, [50, 56], [0, 1]) * lerp(f, [88, 96], [1, 0]) }} />)}
              </div> : null}
              {f >= 50 && f < 96 ? [0, 9, 18].map(d => { const t = ((f - 50 + d) % 27) / 27; return <div key={d} style={{ position: 'absolute', left: (RTL ? 42 : 348) * z - 30 * z, top: 800 * z - 30 * z, width: 60 * z, height: 60 * z,
                borderRadius: '50%', border: `${2.5 * z}px solid ${OR}`, transform: `scale(${1 + t * 1.6})`, opacity: (1 - t) * 0.8 }} />; }) : null}
              {/* la phrase dite, en bulle du client */}
              {f >= 82 ? <div style={{ position: 'absolute', top: 330 * z, [RTL ? 'left' : 'right']: 16 * z, maxWidth: 300 * z, padding: `${12 * z}px ${16 * z}px`, borderRadius: 18 * z,
                [RTL ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: 4 * z, background: NAVY, color: '#fff', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 17 * z, direction: RTL ? 'rtl' : 'ltr',
                transform: `scale(${bub})`, transformOrigin: RTL ? 'left bottom' : 'right bottom' }}>{S.say}</div> : null}
              {f >= 100 ? <div style={{ position: 'absolute', top: 392 * z, [RTL ? 'right' : 'left']: 16 * z, padding: `${12 * z}px ${18 * z}px`, borderRadius: 18 * z, background: '#EEF2F7', display: 'flex', gap: 6 * z,
                transform: `scale(${sp(f, 100, 11, 240, 0.6)})`, transformOrigin: RTL ? 'right top' : 'left top' }}>
                {[0, 1, 2].map(j => <div key={j} style={{ width: 9 * z, height: 9 * z, borderRadius: '50%', background: INK, opacity: 0.35 + 0.65 * Math.abs(Math.sin((f - 100) / 5 - j * 0.7)) }} />)}
              </div> : null}
            </div>
          </> : null}
        </>}
      </Phone>
      <Pill text={S.langs} at={112} x={540} y={1730} bg="#fff" ink={INK} size={56} rot={-3} />
    </Stage>
  );
};

// ===== 6. Pas de carte, pas de surprise (1020–1140) : trois lignes en cascade + le trajet du livreur (flyline) =====
const Icon: React.FC<{ k: number }> = ({ k }) => {
  const s = { fill: 'none', stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (k === 0) return <svg viewBox="0 0 24 24" width="64" height="64"><rect x="2.5" y="6" width="19" height="12" rx="2.5" {...s} /><circle cx="12" cy="12" r="2.8" {...s} /><path d="M6 9.5v5M18 9.5v5" {...s} /></svg>;
  if (k === 1) return <svg viewBox="0 0 24 24" width="64" height="64"><circle cx="6" cy="17" r="2.6" {...s} /><circle cx="18" cy="17" r="2.6" {...s} /><path d="M8.6 17h6.8M14 7h3l2.4 7.4M5 12h6l2 5M11 7h3" {...s} /></svg>;
  return <svg viewBox="0 0 24 24" width="64" height="64"><path d="M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0118.5 10c0 4.8-6.5 11-6.5 11z" {...s} /><circle cx="12" cy="10" r="2.4" {...s} /></svg>;
};
const Pay: React.FC = () => {
  const f = useCurrentFrame();
  const path = 'M140 300 C 320 80, 520 420, 700 200 S 900 120, 960 90';
  const d = lerp(f, [40, 100], [0, 1], inOut);
  return (
    <Stage bg={CREAM} a="#FFE9C2" b={MINT} ox={540} oy={300}>
      <Slam lines={S.pay} at={4} y={110} size={RTL ? 170 : 160} block={INK} step={10} />
      {S.rows.map((r, i) => {
        const at = 28 + i * 12, k = sp(f, at, 12, 220, 0.7);
        if (f < at) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: 70, right: 70, top: 560 + i * 215, height: 186, display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px', borderRadius: 40,
            background: '#fff', boxShadow: '0 16px 40px rgba(11,74,111,.14)', direction: RTL ? 'rtl' : 'ltr', transform: `translateX(${(1 - k) * (RTL ? 400 : -400)}px)`, opacity: Math.min(1, k * 2) }}>
            <div style={{ position: 'relative', width: 104, height: 104, borderRadius: 30, background: [OR, INK, '#16A34A'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon k={i} />
              {i === 2 ? <div style={{ position: 'absolute', top: -8, [RTL ? 'left' : 'right']: -8, width: 30, height: 30, borderRadius: '50%', background: CORAL, boxShadow: `0 0 0 ${6 + 6 * Math.abs(Math.sin(f / 6))}px rgba(255,93,115,.3)` }} /> : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 66 : 64, color: INK, letterSpacing: RTL ? 0 : '-0.02em', whiteSpace: 'nowrap', lineHeight: 1.05 }}>{r[0]}</div>
              <div style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 42, color: '#4A6A80', whiteSpace: 'nowrap' }}>{r[1]}</div>
            </div>
          </div>
        );
      })}
      <svg style={{ position: 'absolute', left: 0, top: 1290, transform: RTL ? 'scaleX(-1)' : undefined }} width={1080} height={420} viewBox="0 0 1080 420">
        <path d={path} fill="none" stroke={INK} strokeOpacity={0.14} strokeWidth={16} strokeLinecap="round" strokeDasharray="2 30" />
        <path d={path} fill="none" stroke={OR} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} />
        <circle cx={140} cy={300} r={22} fill={INK} />
        <g transform="translate(960 90)"><circle r={30 + 8 * Math.abs(Math.sin(f / 7))} fill={OR} opacity={0.25} /><circle r={24} fill={OR} /></g>
      </svg>
    </Stage>
  );
};

// ===== 7. Fin (1140–1320) : carte shotcraft logo-shrink-wordmark-lockup adaptée au logo HOP! =====
// Un grand anneau fendu (blanc + halo orange) se resserre en tournant (×5,4 → ×1), se referme et laisse place au « ! » orange
// avec un petit freinage (+6 %) et une onde de choc ; le « ! » glisse à sa place, puis H, O, P arrivent un par un (glissé + mise au point).
// Ensuite « Ouvrez / Dites ce qu'il vous faut. / On s'occupe du reste. », le lien, Hoppy. Logo tenu plus d'1 s, puis il repart
// à l'envers (lettres qui s'effacent, le « ! » qui se rétracte en point).
const WM = 760, WMX = 160, WMY = 480, WS = WM / 2310;                 // logo : largeur, coin haut-gauche, échelle des unités du dessin
const BANG_X = WMX + (2060 + 10) * WS, BANG_Y = WMY + (350 + 20) * WS; // centre du « ! » une fois en place
const BANG_OFF = (540 - BANG_X) / WS;                                 // décalage (unités du dessin) pour centrer le « ! » au départ
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
  // disparition (162–176) : H, O, P s'effacent de droite à gauche, le « ! » se rétracte
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
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #16294D 0%, #0F1F3D 55%, #0B1830 100%)' }} />
      {/* halo orange qui se resserre avec l'anneau, puis lueur discrète derrière le « ! » */}
      <div style={{ position: 'absolute', left: ringX - lerp(f, [2, 34], [520, 130], inOut), top: BANG_Y - lerp(f, [2, 34], [520, 130], inOut), width: 2 * lerp(f, [2, 34], [520, 130], inOut), height: 2 * lerp(f, [2, 34], [520, 130], inOut),
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
          <Slam lines={[S.end2]} at={96} y={950} size={RTL ? 96 : 84} block={OR} />
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
export const CUTS_CHOC = [180, 390, 630, 870, 1020, 1140];
export const Choc: React.FC<{ lang?: Lang; music?: boolean }> = ({ lang = 'fr', music = true }) => {
  L = lang; S = STR[lang]; RTL = lang === 'he';
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence durationInFrames={180}><Hook /></Sequence>
      <Sequence from={180} durationInFrames={210}><Tout /></Sequence>
      <Sequence from={390} durationInFrames={240}><Compare /></Sequence>
      <Sequence from={630} durationInFrames={240}><Vitrine /></Sequence>
      <Sequence from={870} durationInFrames={150}><Voice /></Sequence>
      <Sequence from={1020} durationInFrames={120}><Pay /></Sequence>
      <Sequence from={1140} durationInFrames={180}><End /></Sequence>
      <Finish />
      {music ? <Audio src={staticFile(`choc-music-${lang}.wav`)} /> : null}
    </AbsoluteFill>
  );
};
