import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource/anton/400.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/900.css';
import '@fontsource/bricolage-grotesque/800.css';
import { HoppyHop } from './HoppyHop';
import { Wordmark } from './Reel';

// « Vice City » (patron, 26/11) : SA vidéo (public/gta/source.mp4, 10 s) au milieu, une ouverture « nouvelle mission »
// avant, « mission accomplie » + appel HOP! après. 1080 × 1920, 30 i/s, 700 images (23,3 s), FR + HE.
// Ambiance jeu vidéo années 80 seulement (néons, coucher de soleil, grille, HUD de mission) : aucun logo ni nom de jeu.
// Le clip reste intact et en grand (720×1280 → ×1,5 exact), son d'origine devant ; seulement 2 éléments de HUD dessus
// (« livraison en cours » + barre, 5 étoiles calées sur les grands moments) et un titre en bas.
// Plans video-shotcraft repris : slam-entrance-moves (titres), neon-flicker (LA FAIM), path-draw (trajet sur la carte),
// logo-shrink-wordmark-lockup (fin, comme dans Choc.tsx). Musique et bruitages : scripts/gta_music.py (synthétisés).
// Règles : pas de mot laitier (resto casher viande), pas de durée chiffrée, « dès 25 ₪ en ville », jamais « partenaire ».
export const GTA_FRAMES = 700;
export const GTA_CLIP = 130;          // le clip du patron : 130 → 430
const CLIP_END = GTA_CLIP + 300;
const STAR_AT = [196, 220, 259, 280, 358];   // éclaboussure, burger qui monte, frites qui sautent, pluie de frites, voiture
type Lang = 'fr' | 'he';
const T = {
  pink: '#FF3EA5', cyan: '#3EE6FF', violet: '#7B2CBF', night: '#12061F', sun1: '#FFD166', sun2: '#FF3EA5',
  navy: '#0F1F3D', or: '#FF6A13', lemon: '#FFE14A', ink: '#0B4A6F', white: '#FFFFFF',
};
const STR = {
  fr: {
    newM: 'NOUVELLE MISSION', big: 'LA FAIM', at: 'À NETANYA', city: 'NETANYA', goalK: 'OBJECTIF', goal: 'un menu, livré chaud',
    hud: 'LIVRAISON EN COURS', lowA: 'LIVRÉ CHAUD', lowB: 'à Netanya, au plus vite',
    m1: 'MISSION', m2: 'ACCOMPLIE', mSub: '+1 menu livré chaud', mPrice: 'dès 25 ₪ en ville',
    open: 'Commandez sur', end1: 'Livré à Netanya,', end2: 'dès 25 ₪ en ville',
  },
  he: {
    newM: 'משימה חדשה', big: 'רעבים', at: 'בנתניה', city: 'נתניה', goalK: 'המטרה', goal: 'ארוחה חמה עד הבית',
    hud: 'המשלוח בדרך', lowA: 'חם עד הבית', lowB: 'בנתניה, הכי מהר',
    m1: 'המשימה', m2: 'הושלמה', mSub: 'ארוחה חמה עד הבית', mPrice: 'החל מ־25 ₪ בעיר',
    open: 'מזמינים ב־', end1: 'משלוח בנתניה,', end2: 'החל מ־25 ₪ בעיר',
  },
};
let S: (typeof STR)['fr'] = STR.fr, RTL = false;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], e: (t: number) => number = Easing.inOut(Easing.quad)) => interpolate(f, a, b, { ...clamp, easing: e });
const outExpo = Easing.out(Easing.exp), inOut = Easing.inOut(Easing.cubic), inQuad = Easing.in(Easing.quad);
const sp = (f: number, d: number, damping = 13, stiffness = 260, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const COND = () => (RTL ? 'Heebo, sans-serif' : 'Anton, Heebo, sans-serif');
const W8 = () => (RTL ? 900 : 400);
const TITLE = () => (RTL ? 'Heebo, sans-serif' : '"Bricolage Grotesque", Heebo, sans-serif');
const iso: React.CSSProperties = { unicodeBidi: 'isolate', direction: 'ltr' };
const neon = (c: string, k = 1) => `0 0 ${6 * k}px rgba(255,255,255,.85), 0 0 ${18 * k}px ${c}, 0 0 ${42 * k}px ${c}, 0 0 ${80 * k}px ${c}`;
const fit = (t: string, size: number, room = 960, w = RTL ? 0.6 : 0.46) => Math.min(size, room / Math.max(1, t.length * w));

// ---------- textures : grain, lignes d'écran, vignette ----------
const Finish: React.FC<{ scan?: number }> = ({ scan = 0.06 }) => {
  const f = useCurrentFrame();
  return <>
    <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(120% 80% at 50% 48%, rgba(0,0,0,0) 55%, rgba(10,2,24,.5) 100%)' }} />
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: scan, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.9) 0px, rgba(0,0,0,.9) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)', transform: `translateY(${(f * 0.6) % 5}px)` }} />
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.14 }}>
      <svg width="100%" height="100%"><filter id="gg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 9} /></filter><rect width="100%" height="100%" filter="url(#gg)" /></svg>
    </AbsoluteFill>
  </>;
};

// ---------- 1. Ouverture (0–130) : coucher de soleil rétro, « NOUVELLE MISSION / LA FAIM À NETANYA », carte avec le trajet ----------
const HZ = 1150;   // ligne d'horizon
const Sunset: React.FC = () => {
  const f = useCurrentFrame();
  const rise = lerp(f, [0, 130], [40, 0], Easing.out(Easing.cubic));
  const rows = 14;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${T.night} 0%, #2A0B4A 38%, #6A1B6E 60%, #FF4F8B 79%, #FF9A5A 86%, #2A0B4A 86.2%)` }} />
      {/* étoiles */}
      {Array.from({ length: 40 }).map((_, i) => {
        const x = (i * 263) % 1080, y = (i * 137) % 640, tw = 0.35 + 0.35 * Math.sin(f / 9 + i);
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 3, height: 3, borderRadius: 2, background: '#fff', opacity: tw }} />;
      })}
      {/* soleil à bandes */}
      <div style={{ position: 'absolute', left: 540 - 330, top: HZ - 470 + rise, width: 660, height: 660, borderRadius: '50%',
        background: `linear-gradient(180deg, ${T.sun1} 0%, #FF8E5A 45%, ${T.sun2} 100%)`, boxShadow: '0 0 160px rgba(255,62,165,.55)',
        WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 52%, transparent 52%, transparent 55%, #000 55%, #000 63%, transparent 63%, transparent 67%, #000 67%, #000 74%, transparent 74%, transparent 79%, #000 79%, #000 85%, transparent 85%, transparent 91%, #000 91%)' }} />
      {/* sol : grille en perspective qui avance */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: HZ, bottom: 0, background: 'linear-gradient(180deg, #1B0733 0%, #0B0216 100%)', overflow: 'hidden' }}>
        <svg width={1080} height={1920 - HZ} style={{ position: 'absolute', left: 0, top: 0 }}>
          {Array.from({ length: 23 }).map((_, i) => {
            const x = -1100 + i * 150;
            return <line key={'v' + i} x1={540} y1={0} x2={540 + (x - 540) * 3.2} y2={1920 - HZ} stroke={T.pink} strokeOpacity={0.55} strokeWidth={2} />;
          })}
          {Array.from({ length: rows }).map((_, i) => {
            const p = ((i + (f / 22) % 1) / rows);
            const y = Math.pow(p, 2.2) * (1920 - HZ);
            return <line key={'h' + i} x1={0} y1={y} x2={1080} y2={y} stroke={T.cyan} strokeOpacity={0.15 + 0.55 * p} strokeWidth={1 + 2 * p} />;
          })}
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 90, background: 'linear-gradient(180deg, rgba(255,62,165,.45), rgba(255,62,165,0))' }} />
      </div>
    </AbsoluteFill>
  );
};
const Letters: React.FC<{ text: string; at: number; size: number; color: string; spacing?: string }> = ({ text, at, size, color, spacing = '0.28em' }) => {
  const f = useCurrentFrame();
  const chars = RTL ? [text] : text.split('');
  return (
    <div style={{ display: 'flex', justifyContent: 'center', direction: RTL ? 'rtl' : 'ltr', fontFamily: COND(), fontWeight: W8(), fontSize: size, color, letterSpacing: RTL ? '0.04em' : spacing, whiteSpace: 'pre' }}>
      {chars.map((c, i) => {
        const k = lerp(f, [at + i * 1.2, at + i * 1.2 + 8], [0, 1], Easing.out(Easing.cubic));
        return <span key={i} style={{ opacity: k, transform: `translateY(${(1 - k) * 18}px)`, filter: `blur(${(1 - k) * 6}px)`, textShadow: `0 0 18px ${T.cyan}` }}>{c}</span>;
      })}
    </div>
  );
};
const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const kBig = sp(f, 18), kAt = sp(f, 26);
  // néon qui grésille à l'allumage
  const flick = f < 18 ? 0 : f < 34 ? ([1, 0.25, 1, 1, 0.4, 1, 1, 1, 0.6, 1, 1, 1, 1, 1, 1, 1][f - 18] ?? 1) : 0.92 + 0.08 * Math.sin(f / 3);
  const map = lerp(f, [56, 70], [0, 1], outExpo);
  const route = lerp(f, [66, 104], [0, 1], inOut);
  const exit = lerp(f, [118, 135], [0, 1], inQuad);
  const bigSz = fit(S.big, RTL ? 250 : 270, 980, RTL ? 0.62 : 0.44), atSz = fit(S.at, RTL ? 130 : 128, 980, RTL ? 0.62 : 0.44);
  // trajet sur la carte (coordonnées de la carte 820 × 380)
  const path = 'M150,290 C 250,250 260,170 380,170 S 560,120 640,90';
  const len = 620;
  const dot = (t: number) => { const a = [150, 290], b = [380, 170], c = [640, 90]; return t < 0.5 ? [a[0] + (b[0] - a[0]) * t * 2, a[1] + (b[1] - a[1]) * t * 2] : [b[0] + (c[0] - b[0]) * (t - 0.5) * 2, b[1] + (c[1] - b[1]) * (t - 0.5) * 2]; };
  const [dx, dy] = dot(route);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + 0.14 * exit})`, filter: `blur(${exit * 14}px)`, opacity: 1 - exit }}>
      <AbsoluteFill style={{ transform: `scale(${lerp(f, [0, 130], [1.06, 1], Easing.out(Easing.quad))})` }}><Sunset /></AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300 }}><Letters text={S.newM} at={6} size={RTL ? 60 : 54} color={T.cyan} /></div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 390, textAlign: 'center', direction: RTL ? 'rtl' : 'ltr', fontFamily: COND(), fontWeight: W8(), fontSize: bigSz, lineHeight: 1,
        color: '#FFE3F3', textShadow: neon(T.pink, 1.2), opacity: f < 18 ? 0 : flick * Math.min(1, kBig * 2), transform: `scale(${1.5 - 0.5 * kBig}) rotate(${-4 * (1 - kBig) - 3}deg)`,
        filter: `blur(${(1 - Math.min(1, kBig)) * 10}px)`, letterSpacing: RTL ? 0 : '0.02em' }}>{S.big}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 390 + bigSz * 1.02, textAlign: 'center', direction: RTL ? 'rtl' : 'ltr', fontFamily: COND(), fontWeight: W8(), fontSize: atSz, lineHeight: 1,
        color: '#fff', textShadow: `0 6px 0 ${T.violet}, 0 0 30px rgba(62,230,255,.6)`, opacity: f < 26 ? 0 : Math.min(1, kAt * 2), transform: `translateY(${(1 - kAt) * 40}px) rotate(-3deg)`,
        letterSpacing: RTL ? 0 : '0.06em' }}>{S.at}</div>
      {/* carte de mission */}
      <div style={{ position: 'absolute', left: 130, top: 1240, width: 820, opacity: map, transform: `translateY(${(1 - map) * 60}px) scale(${0.94 + 0.06 * map})` }}>
        <div style={{ position: 'relative', height: 380, borderRadius: 28, overflow: 'hidden', background: 'rgba(10,4,26,.82)', border: `3px solid ${T.cyan}`, boxShadow: `0 0 30px rgba(62,230,255,.45), inset 0 0 40px rgba(62,230,255,.15)` }}>
          <svg width={820} height={380} style={{ position: 'absolute', inset: 0 }}>
            {/* mer à l'ouest */}
            <path d="M0,0 L150,0 C 120,90 135,180 95,260 C 70,310 80,350 60,380 L0,380 Z" fill="#14285C" />
            <path d="M150,0 C 120,90 135,180 95,260 C 70,310 80,350 60,380" fill="none" stroke={T.cyan} strokeOpacity={0.7} strokeWidth={3} />
            {/* rues */}
            {[60, 120, 180, 240, 300, 350].map(y => <line key={'r' + y} x1={110} y1={y} x2={820} y2={y - 30} stroke="#fff" strokeOpacity={0.1} strokeWidth={2} />)}
            {[230, 330, 450, 560, 680, 770].map(x => <line key={'c' + x} x1={x} y1={0} x2={x + 40} y2={380} stroke="#fff" strokeOpacity={0.1} strokeWidth={2} />)}
            <path d={path} fill="none" stroke={T.pink} strokeOpacity={0.25} strokeWidth={10} strokeLinecap="round" />
            <path d={path} fill="none" stroke={T.pink} strokeWidth={7} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - route)} style={{ filter: `drop-shadow(0 0 8px ${T.pink})` }} />
            {/* départ : le resto ; arrivée : chez vous */}
            <circle cx={150} cy={290} r={16} fill={T.pink} />
            <circle cx={640} cy={90} r={14 + 6 * Math.sin(f / 4) * (route >= 1 ? 1 : 0)} fill="none" stroke={T.cyan} strokeWidth={5} />
            <circle cx={640} cy={90} r={8} fill={T.cyan} />
            {route > 0 && route < 1 ? <circle cx={dx} cy={dy} r={11} fill="#fff" style={{ filter: `drop-shadow(0 0 10px ${T.pink})` }} /> : null}
          </svg>
          <div style={{ position: 'absolute', [RTL ? 'right' : 'left']: RTL ? 26 : 175, top: 20, fontFamily: COND(), fontWeight: W8(), fontSize: 34, color: T.cyan, letterSpacing: RTL ? 0 : '0.2em' }}>{S.city}</div>
        </div>
        <div style={{ marginTop: 22, textAlign: 'center', direction: RTL ? 'rtl' : 'ltr', fontFamily: RTL ? 'Heebo, sans-serif' : TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 50 : 46, color: '#fff' }}>
          <span style={{ color: T.cyan, fontFamily: COND(), fontWeight: W8(), letterSpacing: RTL ? 0 : '0.12em' }}>{S.goalK}{RTL ? ': ' : ' : '}</span>{S.goal}
        </div>
      </div>
      <Finish scan={0.07} />
    </AbsoluteFill>
  );
};

// ---------- 2. Le clip du patron (130–430) + HUD sobre ----------
const Star: React.FC<{ on: number; i: number }> = ({ on, i }) => {
  const f = useCurrentFrame();
  const k = f >= on ? sp(f, on, 9, 320, 0.5) : 0;
  const lit = f >= on;
  return (
    <svg width={56} height={56} viewBox="-12 -12 24 24" style={{ transform: `scale(${lit ? 0.8 + 0.2 * Math.min(1.25, k) + (k > 1 ? 0 : (1 - k) * 0.5) : 0.8})`, filter: lit ? `drop-shadow(0 0 8px ${T.pink})` : 'none' }}>
      <path d="M0,-10 L2.9,-3.1 L10,-3.1 L4.4,1.4 L6.4,9 L0,4.6 L-6.4,9 L-4.4,1.4 L-10,-3.1 L-2.9,-3.1 Z" fill={lit ? '#FFE3F3' : 'rgba(10,4,26,.35)'} stroke={lit ? T.pink : 'rgba(255,255,255,.75)'} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
};
const Clip: React.FC = () => {
  const f = useCurrentFrame();   // 0 = début du clip
  const inK = lerp(f, [0, 10], [0, 1], Easing.out(Easing.cubic));
  const hud = sp(f, 16, 15, 220, 0.7), hudOut = lerp(f, [282, 296], [0, 1], inQuad);
  const prog = lerp(f, [16, 296], [0, 1], (t) => t);
  const blink = Math.floor(f / 12) % 2 === 0 ? 1 : 0.25;
  const low = sp(f, 168, 14, 240, 0.6), lowOut = lerp(f, [262, 274], [0, 1], inQuad);
  const side = RTL ? 'right' : 'left', other = RTL ? 'left' : 'right';
  return (
    <AbsoluteFill style={{ opacity: inK }}>
      <AbsoluteFill style={{ transform: `scale(${1.05 - 0.05 * inK + 0.025 * lerp(f, [14, 300], [0, 1], (t) => t)})` }}>
        <OffthreadVideo src={staticFile('gta/source.mp4')} style={{ width: 1080, height: 1920 }} volume={(fr) => lerp(fr, [0, 6], [0, 1])} />
      </AbsoluteFill>
      {/* étalonnage néon léger */}
      <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'soft-light', background: 'linear-gradient(180deg, rgba(123,44,191,.28) 0%, rgba(255,62,165,.12) 50%, rgba(62,230,255,.10) 100%)' }} />
      {/* HUD : livraison en cours + barre */}
      <div style={{ position: 'absolute', [side]: 50, top: 92, opacity: Math.min(1, hud * 2) * (1 - hudOut), transform: `translateX(${(RTL ? 1 : -1) * (1 - hud) * 80}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexDirection: RTL ? 'row-reverse' : 'row', padding: '14px 26px', borderRadius: 18, background: 'rgba(10,4,26,.62)', border: '2px solid rgba(62,230,255,.8)', boxShadow: '0 0 22px rgba(62,230,255,.35)' }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: T.pink, opacity: blink, boxShadow: `0 0 12px ${T.pink}` }} />
          <div style={{ fontFamily: COND(), fontWeight: W8(), fontSize: RTL ? 40 : 38, color: '#fff', letterSpacing: RTL ? 0 : '0.14em', direction: RTL ? 'rtl' : 'ltr' }}>{S.hud}</div>
        </div>
        <div style={{ marginTop: 12, width: 380, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.2)', overflow: 'hidden', [side]: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', [side]: 0, top: 0, bottom: 0, width: `${prog * 100}%`, background: `linear-gradient(90deg, ${T.pink}, ${T.cyan})`, boxShadow: `0 0 10px ${T.pink}` }} />
        </div>
      </div>
      {/* 5 étoiles qui s'allument sur les grands moments */}
      <div style={{ position: 'absolute', [other]: 40, top: 96, display: 'flex', gap: 2, flexDirection: RTL ? 'row-reverse' : 'row', opacity: Math.min(1, hud * 2) * (1 - hudOut) }}>
        {STAR_AT.map((a, i) => <Star key={i} i={i} on={a - GTA_CLIP} />)}
      </div>
      {/* titre du bas */}
      {f >= 168 && f < 276 ? (
        <div style={{ position: 'absolute', left: 60, right: 60, top: 1560, textAlign: RTL ? 'right' : 'left', direction: RTL ? 'rtl' : 'ltr', opacity: Math.min(1, low * 2) * (1 - lowOut), transform: `translateY(${(1 - low) * 50 - lowOut * 30}px)` }}>
          <div style={{ fontFamily: COND(), fontWeight: W8(), fontSize: RTL ? 120 : 132, lineHeight: 1, color: '#fff', textShadow: `0 0 26px rgba(0,0,0,.6), 0 5px 0 ${T.violet}`, letterSpacing: RTL ? 0 : '0.02em' }}>{S.lowA}</div>
          <div style={{ marginTop: 10, fontFamily: RTL ? 'Heebo, sans-serif' : TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 58 : 54, color: '#FFE3F3', textShadow: neon(T.pink, 0.55) }}>{S.lowB}</div>
        </div>
      ) : null}
      <Finish scan={0.045} />
    </AbsoluteFill>
  );
};

// ---------- 3. « Mission accomplie » (430–520) ----------
const Mission: React.FC = () => {
  const f = useCurrentFrame();
  const bars = lerp(f, [0, 10], [0, 1], outExpo);
  const k1 = sp(f, 3), k2 = sp(f, 10);
  const sub = lerp(f, [28, 40], [0, 1], outExpo), price = lerp(f, [40, 52], [0, 1], outExpo);
  const exit = lerp(f, [80, 90], [0, 1], inQuad);
  const flash = lerp(f, [0, 2, 10], [0.0, 0.55, 0], Easing.out(Easing.quad));
  const m1 = fit(S.m1, RTL ? 190 : 200, 960, RTL ? 0.62 : 0.44), m2 = fit(S.m2, RTL ? 190 : 200, 960, RTL ? 0.62 : 0.44);
  const line = (txt: string, k: number, size: number, style: React.CSSProperties) => (
    <div style={{ textAlign: 'center', direction: RTL ? 'rtl' : 'ltr', fontFamily: COND(), fontWeight: W8(), fontSize: size, lineHeight: 1.02, letterSpacing: RTL ? 0 : '0.04em',
      opacity: Math.min(1, k * 2.5), transform: `scale(${1.6 - 0.6 * k})`, filter: `blur(${(1 - Math.min(1, k)) * 10}px)`, ...style }}>{txt}</div>
  );
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, transform: `scale(${1 + exit * 0.06})` }}>
      <AbsoluteFill style={{ transform: `scale(${1.075 + 0.04 * lerp(f, [0, 90], [0, 1], (t) => t)})`, filter: `blur(${lerp(f, [0, 16], [0, 9], Easing.out(Easing.quad))}px) brightness(${lerp(f, [0, 16], [1, 0.45])})` }}>
        <Img src={staticFile('gta/last.jpg')} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(70% 40% at 50% 46%, rgba(255,62,165,.28), rgba(18,6,31,0) 70%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 210 * bars, background: '#05010C' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 210 * bars, background: '#05010C' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 660 }}>
        {f >= 3 ? line(S.m1, k1, m1, { color: '#fff', textShadow: '0 6px 0 rgba(0,0,0,.35)' }) : <div style={{ height: m1 * 1.02 }} />}
        {f >= 10 ? line(S.m2, k2, m2, { color: '#FFE3F3', textShadow: neon(T.pink, 1.1) }) : null}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, textAlign: 'center', direction: RTL ? 'rtl' : 'ltr', opacity: sub, transform: `translateY(${(1 - sub) * 26}px)`,
        fontFamily: RTL ? 'Heebo, sans-serif' : TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 58 : 54, color: '#fff' }}>{S.mSub}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1215, display: 'flex', justifyContent: 'center', opacity: price, transform: `translateY(${(1 - price) * 26}px) scale(${0.9 + 0.1 * price})` }}>
        <div style={{ padding: '14px 40px', borderRadius: 50, border: `3px solid ${T.cyan}`, background: 'rgba(10,4,26,.6)', boxShadow: `0 0 26px rgba(62,230,255,.5)`, direction: RTL ? 'rtl' : 'ltr',
          fontFamily: COND(), fontWeight: W8(), fontSize: RTL ? 60 : 58, color: T.cyan, letterSpacing: RTL ? 0 : '0.06em' }}>{S.mPrice}</div>
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
      <Finish scan={0.06} />
    </AbsoluteFill>
  );
};

// ---------- 4. Fin (520–700) : logo-shrink-wordmark-lockup (repris de Choc.tsx) + appel ----------
const WM = 760, WMX = 160, WMY = 480, WS = WM / 2310;
const BANG_X = WMX + (2060 + 10) * WS, BANG_Y = WMY + (350 + 20) * WS;
const BANG_OFF = (540 - BANG_X) / WS;
const arc = (r: number, a0: number, a1: number) => {
  const p = (a: number) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
};
const ringScale = (f: number) => lerp(f, [2, 30], [5.4, 1], inOut) * (1 + Math.sin(lerp(f, [28, 40], [0, 1], (t) => t) * Math.PI) * 0.06);
const Slam: React.FC<{ text: string; at: number; y: number; size: number; color?: string; block?: string; out: number }> = ({ text, at, y, size, color = '#fff', block, out }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 13, 300, 0.6), ex = lerp(f, [out, out + 8], [0, 1], inQuad);
  const sz = Math.min(size, 960 / Math.max(1, text.length * (RTL ? 0.62 : 0.56)));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', opacity: Math.min(1, k * 2.5) * (1 - ex), transform: `translateY(${-ex * 80}px)` }}>
      <div style={{ transform: `scale(${1.7 - 0.7 * k}) rotate(${(1 - k) * -5 + (block ? -1.5 : 0)}deg)`, filter: `blur(${(1 - Math.min(1, k)) * 10}px)`, fontFamily: TITLE(), fontWeight: RTL ? 900 : 800,
        fontSize: sz, lineHeight: 1.04, letterSpacing: RTL ? 0 : '-0.04em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr', color: block ? '#fff' : color, background: block || 'transparent',
        padding: block ? `${sz * 0.05}px ${sz * 0.22}px ${sz * 0.1}px` : 0, borderRadius: block ? sz * 0.26 : 0 }}>{text}</div>
    </div>
  );
};
const End: React.FC = () => {
  const f = useCurrentFrame();
  const sc = ringScale(f), spin = -150 * lerp(f, [0, 32], [0, 1], Easing.out(Easing.cubic));
  const heal = lerp(f, [10, 30], [0, 1]), bangIn = lerp(f, [26, 34], [0, 1]), shift = lerp(f, [44, 58], [0, 1], inOut);
  const wave = lerp(f, [30, 50], [0, 1], Easing.out(Easing.cubic));
  const trail = Math.min(1, Math.abs(ringScale(f) - ringScale(f - 1)) / 0.35);
  const gone = (i: number) => lerp(f, [164 + (2 - i) * 3, 170 + (2 - i) * 3], [0, 1], inQuad);
  const bangOut = lerp(f, [172, 179], [0, 1], Easing.in(Easing.back(2)));
  const letter = (i: number) => {
    if (i === 3) return { x: BANG_OFF * (1 - shift), s: (f < 40 ? 1 + Math.sin(lerp(f, [28, 40], [0, 1], (t) => t) * Math.PI) * 0.06 : 1) * (1 - bangOut), o: bangIn };
    const k = lerp(f, [56 + i * 5, 66 + i * 5], [0, 1], Easing.out(Easing.cubic)), g = gone(i);
    return { x: (1 - k) * -90 - g * 60, o: k * (1 - g), blur: (1 - k) * 14 + g * 10 };
  };
  const ringX = BANG_X - (BANG_X - 540) * (1 - shift);
  const ring = (s: number, rot: number, o: number, ghost = false) => (
    <svg style={{ position: 'absolute', left: ringX - 150, top: BANG_Y - 150, overflow: 'visible', opacity: o, transform: `scale(${s})` }} width={300} height={300} viewBox="-150 -150 300 300">
      <g transform={`rotate(${rot})`}>
        {[0, 180].map(d => <path key={'g' + d} d={arc(112, -32 + d, 122 + d)} fill="none" stroke={T.or} strokeOpacity={0.7 * (1 - heal)} strokeWidth={34} strokeLinecap="round" style={{ filter: 'blur(10px)' }} />)}
        {!ghost ? [0, 180].map(d => <path key={'c' + d} d={arc(112, -32 + d, 122 + d)} fill="none" stroke="#fff" strokeWidth={16} strokeLinecap="round" opacity={1 - heal * 0.8} />) : null}
        {!ghost ? <circle r={112} fill="none" stroke="#fff" strokeWidth={22} opacity={heal * (1 - bangIn)} /> : null}
      </g>
    </svg>
  );
  const txt = (at: number) => ({ o: lerp(f, [at, at + 10], [0, 1]) * lerp(f, [160, 168], [1, 0]), y: lerp(f, [at, at + 12], [30, 0], outExpo) });
  const t0 = txt(70), u = txt(104);
  const pulse = lerp(f, [30, 34, 46], [0, 1, 0]);
  return (
    <AbsoluteFill style={{ background: T.navy }}>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #16294D 0%, #0F1F3D 58%, #1A1240 100%)' }} />
      {/* rappel discret du coucher de soleil : lueur rose à l'horizon */}
      <div style={{ position: 'absolute', left: -200, right: -200, bottom: -380, height: 760, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,62,165,.32), rgba(255,62,165,0))' }} />
      <div style={{ position: 'absolute', left: ringX - lerp(f, [2, 34], [520, 130], inOut), top: BANG_Y - lerp(f, [2, 34], [520, 130], inOut), width: 2 * lerp(f, [2, 34], [520, 130], inOut), height: 2 * lerp(f, [2, 34], [520, 130], inOut),
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,106,19,.35) 0%, rgba(255,106,19,.1) 40%, rgba(255,106,19,0) 70%)', opacity: (0.9 - 0.6 * lerp(f, [34, 60], [0, 1])) * (1 - bangOut) }} />
      <AbsoluteFill style={{ transform: `scale(${1 + 0.05 * pulse})` }}>
        {wave > 0 && wave < 1 ? <div style={{ position: 'absolute', left: 540 - lerp(wave, [0, 1], [110, 420]), top: BANG_Y - lerp(wave, [0, 1], [110, 420]), width: 2 * lerp(wave, [0, 1], [110, 420]),
          height: 2 * lerp(wave, [0, 1], [110, 420]), borderRadius: '50%', boxSizing: 'border-box', border: `${lerp(wave, [0, 1], [6, 1.5])}px solid rgba(255,255,255,${0.7 * (1 - wave)})`,
          boxShadow: `0 0 30px rgba(255,106,19,${0.5 * (1 - wave)})` }} /> : null}
        {f < 36 ? <>
          {trail > 0.02 ? ring(ringScale(f - 2), -150 * lerp(f - 2, [0, 32], [0, 1], Easing.out(Easing.cubic)), 0.16 * trail, true) : null}
          {trail > 0.02 ? ring(ringScale(f - 1), -150 * lerp(f - 1, [0, 32], [0, 1], Easing.out(Easing.cubic)), 0.3 * trail, true) : null}
          {ring(sc, spin, 1 - lerp(f, [30, 36], [0, 1]))}
        </> : null}
        <div style={{ position: 'absolute', left: WMX, top: WMY }}><Wordmark width={WM} anim={letter} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 340, textAlign: 'center', fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: 92, color: '#fff', direction: RTL ? 'rtl' : 'ltr',
          letterSpacing: RTL ? 0 : '-0.03em', opacity: t0.o, transform: `translateY(${t0.y}px)` }}>{S.open}</div>
        <Slam text={S.end1} at={80} y={830} size={RTL ? 96 : 86} out={160} />
        <Slam text={S.end2} at={90} y={960} size={RTL ? 96 : 86} block={T.or} out={160} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1130, display: 'flex', justifyContent: 'center', opacity: u.o, transform: `translateY(${u.y}px)` }}>
          <div style={{ padding: '18px 46px', borderRadius: 60, background: T.lemon, color: T.ink, fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800, fontSize: 54, letterSpacing: '-0.02em', ...iso }}>hop-livraison.vercel.app</div>
        </div>
      </AbsoluteFill>
      <Sequence from={64} layout="none"><HoppyHop x={540} bottom={1880} h={590} at={0.2} exitAt={2.9} from={RTL ? 'right' : 'left'} /></Sequence>
      <Finish scan={0.035} />
    </AbsoluteFill>
  );
};

export const Gta: React.FC<{ lang?: Lang; music?: boolean }> = ({ lang = 'fr', music = true }) => {
  S = STR[lang]; RTL = lang === 'he';
  return (
    <AbsoluteFill style={{ background: T.night }}>
      <Sequence from={GTA_CLIP} durationInFrames={300}><Clip /></Sequence>
      <Sequence durationInFrames={GTA_CLIP + 6}><Intro /></Sequence>
      <Sequence from={CLIP_END} durationInFrames={90}><Mission /></Sequence>
      <Sequence from={CLIP_END + 90} durationInFrames={GTA_FRAMES - CLIP_END - 90}><End /></Sequence>
      {music ? <Audio src={staticFile('gta/gta-music.wav')} /> : null}
    </AbsoluteFill>
  );
};
