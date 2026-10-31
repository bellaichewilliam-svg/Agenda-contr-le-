import React from 'react';
import { HoppyHop } from './HoppyHop';
import { AbsoluteFill, Audio, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { C, DISPLAY, UI } from './theme';
import { Grain, Vignette, Wordmark, inExpo as inExpoRaw, inOut, lerp, outExpo, shake, useSpring } from './Reel';

// « Le cycle HOP! » : 20 s en boucle, 1080 × 1920, format Insta / TikTok. « J'ai faim ! » → commande en 3 touches →
// attente (il vit sa vie, le livreur roule, le suivi avance, gardé au chaud) → ding-dong, livré au plus vite →
// il savoure, c'est chaud, 5 étoiles → logo HOP! sur fond bleu nuit, et la dernière image est la première (boucle).
export const CYCLE_FRAMES = 600;
export type CycleLang = 'fr' | 'he';
const BLUE = '#1E9BE0', SKIN = '#F2C29B', HAIR = '#2B2135', WALL = '#FFF0E6', WOOD = '#E8C9A4';
const STR = {
  fr: { rtl: false, hook: "J'ai faim ! 😩", grr: 'Grrr…', c2: '3 touches. Commandé !', items: [['🍕', 'Pizza'], ['🍔', 'Burger'], ['🥗', 'Salade']], order: 'Commander',
    done: 'Commandé !', eta: 'Arrive au plus vite ⚡', steps: ['En préparation', 'Récupérée', 'En route', 'Il arrive !'], acts: ['On met la table…', 'On danse un peu…', 'Déjà là ?! 😮'],
    hot: '🔥 Gardé au chaud', ding: 'Ding-dong !', livre: '⚡ Livré au plus vite', hotChip: '🔥 Encore chaud', hotBig: 'Votre plat arrive chaud 🔥', c5: 'Content. Comme toujours. 😋',
    thanks: '💝 Merci Ilan !', tag: ['Commandé.', 'Livré.', 'Encore chaud.'], pizzeria: 'PIZZERIA' },
  he: { rtl: true, hook: 'אני רעב! 😩', grr: 'גררר…', c2: '3 נגיעות. הוזמן!', items: [['🍕', 'פיצה'], ['🍔', 'המבורגר'], ['🥗', 'סלט']], order: 'להזמין',
    done: 'הוזמן!', eta: 'מגיע הכי מהר ⚡', steps: ['בהכנה', 'נאסף', 'בדרך', 'מגיע!'], acts: ['עורכים את השולחן…', 'רוקדים קצת…', 'כבר כאן?! 😮'],
    hot: '🔥 נשמר חם', ding: 'דינג-דונג!', livre: '⚡ נמסר הכי מהר', hotChip: '🔥 עדיין חם', hotBig: 'האוכל מגיע חם 🔥', c5: 'מרוצה. כמו תמיד. 😋',
    thanks: '💝 תודה אילן!', tag: ['הוזמן.', 'נמסר.', 'עדיין חם.'], pizzeria: 'פיצרייה' },
};
let T = STR.fr; // fixé par <Cycle lang> avant le rendu des scènes
const iso = { unicodeBidi: 'isolate' as const, direction: 'ltr' as const };
const rad = (d: number) => (d * Math.PI) / 180;
// L'exponentielle ne vaut pas tout à fait 0 au départ : on force 0 (sinon le zoom de la 1re image ≠ dernière image)
const inExpo = (t: number) => (t <= 0 ? 0 : inExpoRaw(t));

// ===== Le personnage (vue de face, articulé) ===========================================================
type Pose = {
  sit?: number;            // 0 debout → 1 assis
  aL?: number; fL?: number; // bras gauche (à l'écran) : épaule et coude, degrés (0 = le long du corps, + = vers l'extérieur / le haut)
  aR?: number; fR?: number;
  head?: number; bob?: number; lean?: number;
  eyes?: 'open' | 'happy' | 'closed' | 'look';
  mouth?: 'smile' | 'grin' | 'o' | 'chew' | 'flat';
  brows?: number;           // levés (surprise) 0..1
  hold?: React.ReactNode;   // objet dans la main droite (à l'écran)
  holdL?: React.ReactNode;
  sweater?: string; pants?: string; helmet?: boolean;
};
const limb = (x: number, y: number, a: number, f: number, side: 1 | -1, l1 = 62, l2 = 60) => {
  const a1 = rad(a), a2 = rad(a + f);
  const ex = x + side * Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const hx = ex + side * Math.sin(a2) * l2, hy = ey + Math.cos(a2) * l2;
  return { ex, ey, hx, hy };
};
const Person: React.FC<Pose> = p => {
  const sit = p.sit ?? 0, sw = p.sweater ?? BLUE, pa = p.pants ?? '#22314F';
  const kneeY = lerp(sit, [0, 1], [86, 28]), kneeX = lerp(sit, [0, 1], [26, 46]), footY = lerp(sit, [0, 1], [172, 118]), footX = lerp(sit, [0, 1], [30, 52]);
  const L = limb(-52, -128, p.aL ?? 8, p.fL ?? 0, -1), R = limb(52, -128, p.aR ?? 8, p.fR ?? 0, 1);
  const eyes = p.eyes ?? 'open', mouth = p.mouth ?? 'smile', br = p.brows ?? 0;
  return (
    <g transform={`translate(0 ${p.bob ?? 0}) rotate(${p.lean ?? 0} 0 0)`}>
      {/* jambes */}
      {[-1, 1].map(s => (
        <g key={s}>
          <path d={`M ${s * 26} -4 L ${s * kneeX} ${kneeY} L ${s * footX} ${footY}`} stroke={pa} strokeWidth={36} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx={s * (footX + 8)} cy={footY + 14} rx={28} ry={14} fill="#1D2433" />
        </g>
      ))}
      {/* buste */}
      <rect x={-58} y={-152} width={116} height={160} rx={36} fill={sw} />
      <path d="M -26 -150 Q 0 -128 26 -150" stroke="rgba(255,255,255,.55)" strokeWidth={6} fill="none" strokeLinecap="round" />
      {p.helmet && <rect x={-58} y={-100} width={116} height={14} fill={C.orange} />}
      {/* bras */}
      {[{ s: -1, j: L, hold: p.holdL }, { s: 1, j: R, hold: p.hold }].map(({ s, j, hold }) => (
        <g key={s}>
          <path d={`M ${s * 52} -128 L ${j.ex} ${j.ey} L ${j.hx} ${j.hy}`} stroke={sw} strokeWidth={30} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={j.hx} cy={j.hy} r={15} fill={SKIN} />
          {hold && <g transform={`translate(${j.hx} ${j.hy})`}>{hold}</g>}
        </g>
      ))}
      {/* tête */}
      <g transform={`rotate(${p.head ?? 0} 0 -160)`}>
        <rect x={-14} y={-176} width={28} height={30} fill={SKIN} />
        <circle cx={-54} cy={-214} r={11} fill={SKIN} /><circle cx={54} cy={-214} r={11} fill={SKIN} />
        <circle cx={0} cy={-216} r={56} fill={SKIN} />
        {p.helmet
          ? <g><path d="M -64 -206 A 64 70 0 0 1 64 -206 Z" fill={C.orange} /><rect x={-66} y={-212} width={132} height={14} rx={7} fill={C.orangeDeep} />
              <rect x={-40} y={-262} width={80} height={12} rx={6} fill="rgba(255,255,255,.4)" /></g>
          : <path d="M -58 -214 C -60 -280, 60 -290, 58 -214 C 46 -246, 10 -250, -6 -236 C -24 -250, -50 -240, -58 -214 Z" fill={HAIR} />}
        {/* sourcils */}
        <path d={`M -32 ${-240 - br * 10} Q -20 ${-246 - br * 12} -8 ${-240 - br * 10}`} stroke={HAIR} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d={`M 8 ${-240 - br * 10} Q 20 ${-246 - br * 12} 32 ${-240 - br * 10}`} stroke={HAIR} strokeWidth={6} fill="none" strokeLinecap="round" />
        {/* yeux */}
        {[-20, 20].map(x => eyes === 'happy'
          ? <path key={x} d={`M ${x - 10} -216 Q ${x} -230 ${x + 10} -216`} stroke="#1D2433" strokeWidth={6} fill="none" strokeLinecap="round" />
          : eyes === 'closed'
            ? <path key={x} d={`M ${x - 10} -220 Q ${x} -212 ${x + 10} -220`} stroke="#1D2433" strokeWidth={6} fill="none" strokeLinecap="round" />
            : <g key={x}><ellipse cx={x} cy={-220} rx={8} ry={10} fill="#1D2433" /><circle cx={x + (eyes === 'look' ? 4 : 2)} cy={-224} r={3} fill="#fff" /></g>)}
        <circle cx={-34} cy={-198} r={9} fill="#F59A8B" opacity={0.55} /><circle cx={34} cy={-198} r={9} fill="#F59A8B" opacity={0.55} />
        {/* bouche */}
        {mouth === 'smile' && <path d="M -16 -192 Q 0 -178 16 -192" stroke="#7A2E2E" strokeWidth={6} fill="none" strokeLinecap="round" />}
        {mouth === 'grin' && <path d="M -22 -194 Q 0 -166 22 -194 Z" fill="#7A2E2E" />}
        {mouth === 'o' && <ellipse cx={0} cy={-186} rx={9} ry={11} fill="#7A2E2E" />}
        {mouth === 'chew' && <ellipse cx={0} cy={-188} rx={14} ry={6} fill="#7A2E2E" />}
        {mouth === 'flat' && <path d="M -12 -188 L 12 -188" stroke="#7A2E2E" strokeWidth={6} strokeLinecap="round" />}
      </g>
    </g>
  );
};

// Objets
const Phone: React.FC<{ s?: number; r?: number }> = ({ s = 1, r = 0 }) => (
  <g transform={`rotate(${r}) scale(${s})`}><rect x={-20} y={-58} width={40} height={74} rx={8} fill="#111" /><rect x={-16} y={-52} width={32} height={60} rx={5} fill={C.orange} /></g>
);
const Slice: React.FC<{ r?: number }> = ({ r = -30 }) => (
  <g transform={`rotate(${r})`}><path d="M -8 -10 L 46 -70 Q 62 -50 70 -30 Z" fill="#FFC857" stroke="#E0A030" strokeWidth={4} /><circle cx={40} cy={-48} r={6} fill="#E04F2F" /><circle cx={54} cy={-34} r={5} fill="#E04F2F" /></g>
);
// Le sac isotherme HOP! : bleu nuit comme le logo, couvercle, bande orange, poignée
const Bag: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <g transform={`scale(${s})`}>
    <path d="M -28 -56 Q 0 -92 28 -56" stroke="#0B1730" strokeWidth={9} fill="none" strokeLinecap="round" />
    <rect x={-62} y={-56} width={124} height={114} rx={18} fill={C.navy} />
    <rect x={-62} y={-56} width={124} height={26} rx={18} fill="#1B2F57" />
    <rect x={-62} y={-36} width={124} height={6} fill="#0B1730" opacity={0.5} />
    <text direction="ltr" x={0} y={14} textAnchor="middle" fontFamily="Fredoka, Rubik" fontWeight={700} fontSize={40} fill="#fff">HOP<tspan fill={C.orange}>!</tspan></text>
    <rect x={-62} y={32} width={124} height={12} fill={C.orange} />
    <rect x={-62} y={-56} width={124} height={114} rx={18} fill="none" stroke="#2A3F6E" strokeWidth={3} />
  </g>
);
const Clock: React.FC<{ m: number; r?: number }> = ({ m, r = 80 }) => {
  const hr = ((19 + m / 60) % 12) * 30, mn = (m % 60) * 6;
  return (
    <g>
      <circle r={r} fill="#fff" stroke={C.navy} strokeWidth={10} />
      {Array.from({ length: 12 }).map((_, k) => <line key={k} x1={0} y1={-r + 14} x2={0} y2={-r + (k % 3 ? 22 : 30)} stroke={C.navy} strokeWidth={k % 3 ? 4 : 7} transform={`rotate(${k * 30})`} />)}
      <line x1={0} y1={0} x2={0} y2={-r * 0.48} stroke={C.navy} strokeWidth={9} strokeLinecap="round" transform={`rotate(${hr})`} />
      <line x1={0} y1={0} x2={0} y2={-r * 0.72} stroke={C.orange} strokeWidth={6} strokeLinecap="round" transform={`rotate(${mn})`} />
      <circle r={8} fill={C.navy} />
    </g>
  );
};
// Contour épais « autocollant » (ombres tout autour) + ombre portée, comme les sous-titres TikTok
const outline = (w: number, drop: number) => Array.from({ length: 24 }, (_, k) => {
  const a = (k / 24) * Math.PI * 2;
  return `${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${C.navy}`;
}).concat([`0 ${drop}px 0 ${C.navy}`, `0 ${drop + 6}px 24px rgba(0,0,0,.35)`]).join(', ');
const Punch: React.FC<{ t: string; at: number; until?: number; y?: number; size?: number; color?: string; rot?: number }> = ({ t, at, until = 9999, y = 300, size = 96, color = '#fff', rot = -3 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const s = spring({ frame: f - at, fps: 30, config: { damping: 9, stiffness: 320, mass: 0.5 } });
  const out = lerp(f, [until, until + 5], [0, 1], inExpo);
  if (out >= 1) return null;
  return (
    <div style={{ position: 'absolute', top: y, left: 30, right: 30, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ font: `700 ${size}px/1.08 ${DISPLAY}`, color, textAlign: 'center', textShadow: outline(Math.max(5, Math.round(size / 13)), Math.round(size / 11)),
        transform: `scale(${s * (1 - out)}) rotate(${rot * s}deg)` }}>{t}</div>
    </div>
  );
};
const Steam: React.FC<{ x: number; y: number; s?: number; n?: number }> = ({ x, y, s = 1, n = 3 }) => {
  const f = useCurrentFrame();
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{Array.from({ length: n }).map((_, k) => {
    const t = ((f + k * 11) % 34) / 34, dx = (k - (n - 1) / 2) * 34;
    return <path key={k} d={`M ${dx} 0 q -14 -24 0 -48 q 14 -24 0 -48`} stroke="#fff" strokeWidth={9} fill="none" strokeLinecap="round"
      opacity={Math.sin(Math.PI * t) * 0.85} transform={`translate(${Math.sin(t * 6 + k) * 6} ${-t * 70})`} />;
  })}</g>;
};

// ===== Le salon (début, fin de boucle, et le repas) =====================================================
const Room: React.FC<{ minutes: number; children?: React.ReactNode; table?: React.ReactNode; lampOn?: number }> = ({ minutes, children, table, lampOn = 1 }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE3CF" /><stop offset="1" stopColor={WALL} /></linearGradient>
      <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B1430" /><stop offset="1" stopColor="#24386B" /></linearGradient>
      <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFD9A0" stopOpacity={0.75 * lampOn} /><stop offset="1" stopColor="#FFD9A0" stopOpacity={0} /></radialGradient>
    </defs>
    <rect width={1080} height={1400} fill="url(#wall)" />
    <rect y={1400} width={1080} height={520} fill={WOOD} />
    {Array.from({ length: 7 }).map((_, k) => <line key={k} x1={0} y1={1460 + k * 70} x2={1080} y2={1460 + k * 70} stroke="#D9B48A" strokeWidth={3} />)}
    <rect y={1388} width={1080} height={18} fill="#F7D9BE" />
    {/* fenêtre de nuit */}
    <rect x={90} y={250} width={420} height={500} rx={24} fill="url(#night)" stroke="#fff" strokeWidth={16} />
    <circle cx={420} cy={340} r={36} fill="#FFF3C4" />
    {Array.from({ length: 9 }).map((_, k) => <rect key={k} x={110 + k * 44} y={560 - (k % 3) * 60 - random(`wb${k}`) * 80} width={40} height={400} fill="#14204A" />)}
    {Array.from({ length: 22 }).map((_, k) => <rect key={k} x={118 + (k % 9) * 44} y={590 + Math.floor(k / 9) * 46 - (k % 3) * 20} width={12} height={14} fill="#FFC857" opacity={random(`lw${k}`) > 0.4 ? 0.9 : 0.15} />)}
    <line x1={300} y1={258} x2={300} y2={742} stroke="#fff" strokeWidth={10} /><line x1={98} y1={500} x2={502} y2={500} stroke="#fff" strokeWidth={10} />
    {/* horloge */}
    <g transform="translate(800 420)"><Clock m={40 + minutes} r={92} /></g>
    {/* lampe */}
    <circle cx={930} cy={980} r={260} fill="url(#lamp)" />
    <path d="M 880 900 L 980 900 L 960 980 L 900 980 Z" fill={C.orange} /><rect x={926} y={980} width={8} height={420} fill={C.navy} /><ellipse cx={930} cy={1400} rx={50} ry={12} fill={C.navy} />
    {/* plante */}
    <rect x={70} y={1250} width={90} height={150} rx={14} fill={C.navy2} />
    {[-40, -10, 20, 50].map((a, k) => <ellipse key={k} cx={115 + a * 0.8} cy={1190 - Math.abs(a) * 0.4} rx={22} ry={70} fill={k % 2 ? '#2E9E6B' : C.green} transform={`rotate(${a} ${115} 1260)`} />)}
    {/* canapé */}
    <rect x={170} y={960} width={740} height={260} rx={60} fill={C.navy2} />
    <rect x={140} y={1110} width={800} height={230} rx={50} fill={C.navy} />
    <rect x={120} y={1060} width={110} height={300} rx={50} fill={C.navy2} /><rect x={850} y={1060} width={110} height={300} rx={50} fill={C.navy2} />
    <rect x={250} y={1000} width={200} height={150} rx={40} fill={C.orange} opacity={0.9} />
    <rect x={180} y={1340} width={24} height={60} fill={C.navy} /><rect x={876} y={1340} width={24} height={60} fill={C.navy} />
    {children}
    {/* table basse */}
    <rect x={260} y={1530} width={560} height={40} rx={14} fill="#B37A4C" />
    <rect x={300} y={1570} width={22} height={130} fill="#8C5A35" /><rect x={758} y={1570} width={22} height={130} fill="#8C5A35" />
    {table}
  </svg>
);

// ===== 1. « J'ai faim ! » (accroche dès la 1re seconde) ==================================================
const Hungry: React.FC = () => {
  const f = useCurrentFrame();          // 0..45
  const rumble = (k: number) => Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (f - k) / 18))));
  const r1 = rumble(6), r2 = rumble(22);
  const punch = f >= 6 ? 1 + 0.06 * Math.max(0, 1 - (f - 6) / 8) : 1;
  const lift = lerp(f, [26, 34], [0, 1], outExpo);
  const zoom = lerp(f, [34, 45], [1, 4.2], inExpo);
  return (
    <AbsoluteFill style={{ background: WALL, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom * punch})`, transformOrigin: '640px 940px' }}>
        <Room minutes={0}>
          <g transform="translate(540 1180) scale(1.55)">
            <Person sit={1} bob={(r1 + r2) * Math.sin(f * 2.4) * 3} aL={lerp(r1 + r2, [0, 1], [10, 40])} fL={lerp(r1 + r2, [0, 1], [0, 90])}
              aR={lerp(lift, [0, 1], [10, 30])} fR={lerp(lift, [0, 1], [0, 130])} hold={lift > 0.2 ? <Phone s={0.9} r={-10} /> : undefined}
              eyes={f > 6 && f < 26 ? 'closed' : 'open'} mouth={f > 6 && f < 34 ? 'o' : 'smile'} brows={r1 + r2 * 0.5} head={lift * 8 + (r1 + r2) * Math.sin(f) * 4} />
            {(r1 > 0 || r2 > 0) && [0, 1, 2].map(k => <path key={k} d={`M ${-70 - k * 16} ${-70 + k * 22} q -12 -10 0 -20 q 12 -10 0 -20`} stroke={C.orange} strokeWidth={5} fill="none" opacity={Math.max(r1, r2)} />)}
          </g>
        </Room>
        <div style={{ position: 'absolute', left: 150, top: 1000, transform: `scale(${Math.max(r1, r2 * 0.8)}) rotate(-8deg)`, transformOrigin: '100% 100%', padding: '14px 26px', borderRadius: 30,
          background: '#fff', font: `700 46px/1 ${DISPLAY}`, color: C.orangeDeep, boxShadow: '0 12px 30px rgba(0,0,0,.15)' }}>{T.grr}</div>
      </AbsoluteFill>
      <Punch t={T.hook} at={4} until={32} y={260} size={124} />
    </AbsoluteFill>
  );
};

// ===== 2. Le téléphone : 3 touches ======================================================================
const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame();
  const k = lerp(f, [at - 6, at], [0, 1], outExpo), r = lerp(f, [at, at + 12], [0, 1], outExpo);
  if (f < at - 8 || f > at + 14) return null;
  return <>
    <div style={{ position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,.85)', transform: `scale(${0.6 + 0.4 * k - 0.2 * r})`, opacity: k * (1 - r * 0.8), boxShadow: '0 6px 18px rgba(0,0,0,.3)' }} />
    <div style={{ position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: '50%', border: '6px solid #fff', transform: `scale(${1 + r * 1.8})`, opacity: 1 - r }} />
  </>;
};
const Order: React.FC = () => {
  const f = useCurrentFrame();          // 0..75
  const enter = lerp(f, [0, 10], [0, 1], outExpo);
  const picked = f >= 15, sent = f >= 36;
  const sentS = useSpring(36, 10, 260, 0.6);
  const exit = lerp(f, [66, 75], [0, 1], inExpo);
  const card = (k: number) => {
    const on = picked && k === 0;
    return <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 24px', borderRadius: 28, background: on ? '#FFF0E6' : '#fff', border: `4px solid ${on ? C.orange : '#EEF0F4'}`,
      transform: `scale(${on ? 1 + 0.05 * Math.max(0, 1 - (f - 15) / 8) : 1})` }}>
      <span style={{ fontSize: 64 }}>{T.items[k][0]}</span><span style={{ font: `700 44px/1 ${DISPLAY}`, color: C.navy }}>{T.items[k][1]}</span>
      {on && <span style={{ marginInlineStart: 'auto', width: 50, height: 50, borderRadius: '50%', background: C.orange, color: '#fff', display: 'grid', placeItems: 'center', font: `800 30px/1 ${UI}` }}>1</span>}
    </div>;
  };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.navy2} 0%, ${C.navy} 70%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', marginTop: 200, width: 640, height: 1240, borderRadius: 90, background: '#05070D', padding: 20, boxShadow: '0 80px 120px rgba(0,0,0,.5)',
          transform: `translateY(${(1 - enter) * 300 + exit * -200}px) scale(${0.92 + 0.08 * enter - exit * 0.3}) rotate(${(1 - enter) * -6}deg)`, opacity: 1 - exit }}>
          <div style={{ position: 'absolute', inset: 20, borderRadius: 72, background: '#F6F7FB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: C.navy, padding: '70px 40px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: `700 54px/1 ${DISPLAY}`, color: '#fff', ...iso }}>HOP<span style={{ color: C.orange }}>!</span></span>
              <span style={{ font: `600 30px/1 ${UI}`, color: '#A9B3CA' }}>📍 Netanya</span>
            </div>
            {!sent ? <div style={{ padding: 30, display: 'grid', gap: 22 }}>
              {[0, 1, 2].map(card)}
              <div style={{ marginTop: 30, padding: '34px 0', borderRadius: 999, textAlign: 'center', background: picked ? C.orange : '#D0D5DD', color: '#fff', font: `700 50px/1 ${DISPLAY}`,
                transform: `scale(${lerp(f, [30, 33, 38], [1, 0.94, 1])})` }}>{T.order}</div>
            </div> : <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, transform: `scale(${sentS})` }}>
              <div style={{ width: 220, height: 220, borderRadius: '50%', background: C.green, display: 'grid', placeItems: 'center', font: `700 140px/1 ${DISPLAY}`, color: '#fff', boxShadow: '0 20px 50px rgba(18,183,106,.4)' }}>✓</div>
              <div style={{ font: `700 72px/1 ${DISPLAY}`, color: C.navy }}>{T.done}</div>
              <div style={{ font: `700 42px/1.2 ${UI}`, color: C.orangeDeep }}>{T.eta}</div>
            </div>}
          </div>
          <Tap x={230} y={262} at={15} />
          <Tap x={320} y={685} at={33} />
        </div>
      </AbsoluteFill>
      <Punch t={T.c2} at={38} until={64} y={110} size={92} />
    </AbsoluteFill>
  );
};

// ===== 3. L'attente : chez lui en haut, le livreur en bas, le suivi au milieu ===========================
const WAIT = 210;
const Scooter: React.FC<{ f: number; speed: number }> = ({ f, speed }) => {
  const spin = f * speed * 14;
  const bob = Math.sin(f / 3) * 3 * Math.min(1, speed);
  const wheel = (x: number) => <g transform={`translate(${x} 0) rotate(${spin})`}><circle r={46} fill="#1D2433" /><circle r={22} fill="#C9CED8" />
    {[0, 60, 120].map(a => <line key={a} x1={-20} y1={0} x2={20} y2={0} stroke="#1D2433" strokeWidth={5} transform={`rotate(${a})`} />)}</g>;
  return (
    <g transform={`translate(0 ${bob})`}>
      {wheel(-130)}{wheel(130)}
      <path d="M -170 -40 Q -170 -110 -60 -110 L 40 -110 L 80 -40 Z" fill={C.orange} />
      <path d="M 60 -40 L 110 -190 L 135 -190" stroke="#1D2433" strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d="M 100 -40 Q 160 -60 170 -10" stroke={C.orangeDeep} strokeWidth={30} fill="none" strokeLinecap="round" />
      {/* top case */}
      <rect x={-230} y={-230} width={130} height={120} rx={16} fill={C.navy} stroke="#fff" strokeWidth={6} />
      <text direction="ltr" x={-165} y={-158} textAnchor="middle" fontFamily="Fredoka, Rubik" fontWeight={700} fontSize={40} fill="#fff">HOP<tspan fill={C.orange}>!</tspan></text>
      {/* livreur de profil */}
      <path d="M -40 -110 L 10 -110 L 40 -40" stroke="#22314F" strokeWidth={34} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M -40 -110 L -10 -250" stroke={C.navy} strokeWidth={60} strokeLinecap="round" />
      <path d="M -10 -230 L 60 -200 L 115 -190" stroke={C.navy} strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={0} cy={-300} r={46} fill={SKIN} />
      <path d="M -50 -300 A 52 52 0 0 1 52 -310 L 52 -296 L -50 -290 Z" fill={C.orange} />
      <rect x={20} y={-318} width={36} height={20} rx={8} fill="rgba(20,30,60,.7)" />
      {speed > 0.3 && [0, 1, 2].map(k => <line key={k} x1={-260 - k * 30} y1={-200 + k * 60} x2={-400 - k * 50 - speed * 60} y2={-200 + k * 60} stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={0.5} />)}
    </g>
  );
};
const City: React.FC = () => {
  const f = useCurrentFrame();
  const speed = lerp(f, [55, 80], [0, 1], inOut);
  const dist = (() => { let d = 0; for (let k = 0; k < f; k++) d += lerp(k, [55, 80], [0, 1], inOut); return d; })();
  const bagT = lerp(f, [30, 48], [0, 1], inOut);
  const shopX = 300 - dist * 22;
  return (
    <svg width={1080} height={860} style={{ position: 'absolute', left: 0, bottom: 0 }}>
      <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B2F57" /><stop offset="1" stopColor="#E0703A" /></linearGradient></defs>
      <rect width={1080} height={860} fill="url(#dusk)" />
      {Array.from({ length: 14 }).map((_, k) => {
        const x = ((k * 140 - dist * 6) % 1960 + 1960) % 1960 - 200;
        return <rect key={k} x={x} y={260 + random(`fb${k}`) * 160} width={120} height={600} fill="#2A2350" opacity={0.7} />;
      })}
      {Array.from({ length: 10 }).map((_, k) => {
        const x = ((k * 230 - dist * 14) % 2300 + 2300) % 2300 - 300;
        const h = 300 + random(`nb${k}`) * 200;
        return <g key={k}><rect x={x} y={620 - h} width={200} height={h} fill={k % 2 ? '#14204A' : '#1B2A5C'} />
          {Array.from({ length: 8 }).map((__, j) => <rect key={j} x={x + 26 + (j % 3) * 56} y={640 - h + Math.floor(j / 3) * 70} width={30} height={34} fill="#FFC857" opacity={random(`nw${k}-${j}`) > 0.45 ? 0.85 : 0.15} />)}</g>;
      })}
      {/* pizzeria (au départ) */}
      <g transform={`translate(${shopX} 0)`}>
        <rect x={-180} y={300} width={360} height={320} fill="#C0392B" /><rect x={-200} y={280} width={400} height={70} rx={10} fill="#fff" />
        <text direction="ltr" x={0} y={330} textAnchor="middle" fontFamily="Fredoka, Rubik" fontWeight={700} fontSize={46} fill="#C0392B">{T.pizzeria}</text>
        <rect x={-60} y={420} width={120} height={200} fill="#FFE3A3" />
        {Array.from({ length: 6 }).map((_, k) => <path key={k} d={`M ${-180 + k * 60} 350 l 30 40 l 30 -40`} fill={k % 2 ? '#fff' : '#E74C3C'} />)}
      </g>
      <rect y={620} width={1080} height={240} fill="#2B2F3A" />
      {Array.from({ length: 9 }).map((_, k) => <rect key={k} x={((k * 160 - dist * 22) % 1440 + 1440) % 1440 - 180} y={736} width={90} height={12} rx={6} fill="#F2F4F7" opacity={0.8} />)}
      <g transform="translate(560 690) scale(0.95)"><Scooter f={f} speed={speed} /></g>
      {/* le sac passe du commerce au top case */}
      {bagT > 0 && bagT < 1 && <g transform={`translate(${shopX + (420 - shopX) * bagT} ${470 - Math.sin(Math.PI * bagT) * 200 + bagT * 30})`}><Bag s={0.8} /></g>}
    </svg>
  );
};
const Home: React.FC = () => {
  const f = useCurrentFrame();
  const m = lerp(f, [0, WAIT], [0, 14], (t: number) => t);
  const act = f < 70 ? 0 : f < 140 ? 1 : 2;
  const a = f - act * 70;
  const reach = act === 0 ? Math.max(0, Math.sin(Math.PI * ((a % 35) / 35))) : 0;
  const plates = act > 0 ? 2 : a > 26 ? (a > 60 ? 2 : 1) : 0;
  const beat = Math.sin((a / 15) * Math.PI);
  const pose: Pose = act === 0
    ? { aR: 20 + reach * 40, fR: reach * 40, aL: 10, lean: reach * 6, eyes: 'open', mouth: 'smile', hold: reach > 0.2 ? <ellipse cx={18} cy={12} rx={36} ry={10} fill="#fff" stroke="#D0D5DD" strokeWidth={4} /> : undefined }
    : act === 1
      ? { aL: 140 + beat * 30, fL: 30, aR: 140 - beat * 30, fR: 30, bob: -Math.abs(beat) * 18, head: beat * 10, lean: beat * 5, eyes: 'happy', mouth: 'grin' }
      : { aR: 30, fR: 140, hold: <Phone s={0.9} r={-10} />, aL: 10, head: a > 30 ? 14 : 0, eyes: a > 30 ? 'look' : 'open', mouth: a > 30 ? 'o' : 'smile', brows: a > 30 ? 1 : 0 };
  return (
    <svg width={1080} height={860} style={{ position: 'absolute', left: 0, top: 0 }}>
      <rect width={1080} height={860} fill={WALL} />
      <rect y={700} width={1080} height={160} fill={WOOD} />
      <rect x={70} y={170} width={300} height={360} rx={20} fill="#1B2F57" stroke="#fff" strokeWidth={12} />
      <circle cx={300} cy={240} r={26} fill="#FFF3C4" />
      <g transform="translate(860 300)"><Clock m={40 + m} r={80} /></g>
      <rect x={560} y={590} width={420} height={26} rx={10} fill="#B37A4C" /><rect x={590} y={616} width={18} height={150} fill="#8C5A35" /><rect x={932} y={616} width={18} height={150} fill="#8C5A35" />
      {plates >= 1 && <ellipse cx={680} cy={582} rx={56} ry={14} fill="#fff" stroke="#D0D5DD" strokeWidth={4} />}
      {plates >= 2 && <ellipse cx={860} cy={582} rx={56} ry={14} fill="#fff" stroke="#D0D5DD" strokeWidth={4} />}
      {act >= 1 && <rect x={760} y={530} width={34} height={56} rx={8} fill="rgba(150,200,255,.6)" stroke="#9CB3D0" strokeWidth={3} />}
      <g transform="translate(420 520) scale(1.12)"><Person {...pose} /></g>
      {act === 1 && [0, 1, 2].map(k => <text direction="ltr" key={k} x={240 + k * 160} y={330 - ((a * 4 + k * 40) % 160)} fontSize={54} opacity={0.8}>🎵</text>)}
    </svg>
  );
};
const Wait: React.FC = () => {
  const f = useCurrentFrame();
  const prog = lerp(f, [0, WAIT], [0, 1], (t: number) => t);
  const step = f < 45 ? 0 : f < 85 ? 1 : f < 185 ? 2 : 3;
  const enter = lerp(f, [0, 10], [0, 1], outExpo);
  const stepPop = spring({ frame: f - [0, 45, 85, 185][step], fps: 30, config: { damping: 10, stiffness: 300, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - enter) * -400}px)` }}><Home /></div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - enter) * 400}px)` }}><City /></div>
      {/* le suivi, au milieu */}
      <div style={{ position: 'absolute', left: 50, right: 50, top: 860 - 100, height: 200, borderRadius: 50, background: '#fff', boxShadow: '0 30px 70px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', gap: 30, padding: '0 40px',
        transform: `scaleX(${enter})` }}>
        <svg width={140} height={140} viewBox="0 0 140 140" style={{ flex: 'none' }}>
          <circle cx={70} cy={70} r={56} stroke="#EEF0F4" strokeWidth={16} fill="none" />
          <circle cx={70} cy={70} r={56} stroke={C.orange} strokeWidth={16} fill="none" strokeLinecap="round" strokeDasharray={`${352 * (0.05 + 0.95 * prog)} 352`} transform="rotate(-90 70 70)" />
          <text direction="ltr" x={70} y={88} textAnchor="middle" fontSize={54}>🛵</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `700 50px/1.1 ${DISPLAY}`, color: C.navy, whiteSpace: 'nowrap', transform: `scale(${0.9 + 0.1 * stepPop})`, transformOrigin: T.rtl ? '100% 50%' : '0% 50%' }}>{['🍳', '🛍️', '🛵', '🔔'][step]} {T.steps[step]}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ flex: 1, height: 12, borderRadius: 6, background: k <= step ? C.orange : '#EEF0F4' }} />)}</div>
            <span style={{ font: `700 30px/1 ${UI}`, color: '#B54708', background: '#FEF0C7', padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap' }}>{T.hot}</span>
          </div>
        </div>
      </div>
      <Punch t={T.acts[0]} at={6} until={64} y={40} size={76} />
      <Punch t={T.acts[1]} at={74} until={134} y={40} size={76} rot={3} />
      <Punch t={T.acts[2]} at={144} until={204} y={40} size={76} />
    </AbsoluteFill>
  );
};

// ===== 4. Ding-dong : la porte s'ouvre, le livreur entier dans l'encadrement ==============================
// Position du sac à l'écran au moment où il vient vers nous (livreur : translate(540 1182) scale(1.72))
const BAG_K = 1.72 * 1.22, BAG_X = 540, BAG_Y = 1182 + (-34 + 1 * 1.22) * 1.72;
const Door: React.FC = () => {
  const f = useCurrentFrame();          // 0..60
  const open = lerp(f, [12, 26], [0, 1], inOut);
  const ring = (k: number) => lerp(f, [k, k + 14], [0, 1], outExpo);
  const badge = useSpring(16, 11, 260, 0.6);
  const sh = shake(f, 16, 18, 8);
  const give = lerp(f, [26, 38], [0, 1], inOut);
  const zoomBag = lerp(f, [44, 60], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: WALL, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <rect width={1080} height={1920} fill="#FFE3CF" />
          <rect y={1516} width={1080} height={404} fill={WOOD} />
          <rect x={250} y={420} width={580} height={1096} fill="#2B3655" />
          <rect x={250} y={1330} width={580} height={186} fill="#3A4566" />
          {/* le livreur, entier : casque, sac chaud, pieds sur le palier */}
          <g transform="translate(540 1182) scale(1.72)">
            <Person helmet sweater={C.navy} pants="#1D2433" aL={14 + give * 16} fL={-60 - give * 12} aR={14 + give * 16} fR={-60 - give * 12} eyes="happy" mouth="grin" />
            {/* le sac, tenu à deux mains devant lui, qu'il tend vers nous ; la vapeur sort sur les côtés */}
            {f < 44 && <g transform={`translate(0 ${-20 - give * 14}) scale(${1 + give * 0.22})`}>
              <Bag s={1} /><Steam x={-80} y={-40} s={0.55} n={1} /><Steam x={80} y={-40} s={0.55} n={1} />
              <circle cx={-62} cy={8} r={15} fill={SKIN} /><circle cx={62} cy={8} r={15} fill={SKIN} />
            </g>}
          </g>
          <rect x={232} y={404} width={616} height={1124} rx={10} fill="none" stroke="#fff" strokeWidth={24} />
          <rect x={210} y={1516} width={660} height={24} rx={6} fill="#C9A27A" />
        </svg>
        <div style={{ position: 'absolute', left: 250, top: 420, width: 580, height: 1096, perspective: 1600 }}>
          <div style={{ position: 'absolute', inset: 0, background: C.navy2, transformOrigin: '0% 50%', transform: `rotateY(${-open * 100}deg)`, borderRadius: 6, boxShadow: 'inset 0 0 0 18px #22386A' }}>
            <div style={{ position: 'absolute', right: 50, top: 540, width: 40, height: 40, borderRadius: '50%', background: '#FFC857' }} />
            <div style={{ position: 'absolute', left: 190, top: 120, width: 200, height: 70, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center', font: `700 40px/1 ${UI}`, color: C.navy }}>12</div>
          </div>
        </div>
        {[0, 6].map(k => f >= k && f < k + 16 && <div key={k} style={{ position: 'absolute', left: 900, top: 900, width: 60 + ring(k) * 380, height: 60 + ring(k) * 380, borderRadius: '50%', border: `6px solid ${C.orange}`, transform: 'translate(-50%,-50%)', opacity: 1 - ring(k) }} />)}
        <div style={{ position: 'absolute', left: 880, top: 880, width: 40, height: 40, borderRadius: '50%', background: C.orange, border: '6px solid #fff' }} />
        <Punch t={`🔔 ${T.ding}`} at={0} until={13} y={200} size={116} color={C.orange} />
        {/* « livré au plus vite » + « encore chaud » */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: Math.min(1, badge) * (1 - zoomBag) }}>
          <div style={{ padding: '26px 44px', borderRadius: 999, background: C.green, color: '#fff', font: `700 70px/1 ${DISPLAY}`, transform: `scale(${1 + Math.max(0, 1 - badge) * 2}) rotate(-3deg)`,
            boxShadow: '0 30px 60px rgba(18,183,106,.4)', whiteSpace: 'nowrap' }}>{T.livre}</div>
          <div style={{ padding: '16px 30px', borderRadius: 999, background: '#FEF0C7', color: '#B54708', font: `700 50px/1 ${DISPLAY}`, transform: `scale(${spring({ frame: f - 24, fps: 30, config: { damping: 9, stiffness: 300, mass: 0.5 } })}) rotate(2deg)` }}>{T.hotChip}</div>
        </div>
      </AbsoluteFill>
      {/* le sac vient vers nous : écran bleu nuit HOP!, comme le logo */}
      {f >= 44 && <AbsoluteFill>
        <div style={{ position: 'absolute', left: BAG_X - 62 * BAG_K, top: BAG_Y - 57 * BAG_K, width: 124 * BAG_K, height: 114 * BAG_K, borderRadius: 18 * BAG_K, background: C.navy, overflow: 'hidden',
          transform: `scale(${1 + zoomBag * 11})`, transformOrigin: '50% 45%', boxShadow: `inset 0 ${26 * BAG_K}px 0 #1B2F57` }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 30 * BAG_K, display: 'flex', justifyContent: 'center' }}><Wordmark width={92 * BAG_K} /></div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 88 * BAG_K, height: 12 * BAG_K, background: C.orange }} />
        </div>
      </AbsoluteFill>}
    </AbsoluteFill>
  );
};

// ===== 5. Il savoure : c'est chaud, bouchées, cœurs, 5 étoiles ==========================================
const Joy: React.FC = () => {
  const f = useCurrentFrame();          // 0..120
  const open = lerp(f, [0, 12], [1, 0], outExpo);
  const logoIn = spring({ frame: f, fps: 30, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  const bite = (f % 24) / 24, toMouth = Math.max(0, Math.sin(Math.PI * Math.min(1, bite * 1.6)));
  const chew = f % 24 > 14 && Math.floor(f / 3) % 2 === 0;
  const phone = useSpring(56, 13, 220, 0.6);
  const thanks = useSpring(84, 11, 240, 0.6);
  return (
    <AbsoluteFill style={{ background: WALL, overflow: 'hidden' }}>
      <Room minutes={14} table={<g>
        <rect x={420} y={1478} width={240} height={56} rx={6} fill="#F2E3C6" stroke="#D9C29A" strokeWidth={4} />
        <path d="M 420 1478 L 440 1380 L 640 1380 L 660 1478 Z" fill="#F7EBD3" stroke="#D9C29A" strokeWidth={4} />
        <circle cx={540} cy={1500} r={8} fill="#E04F2F" /><circle cx={600} cy={1500} r={8} fill="#E04F2F" /><circle cx={480} cy={1505} r={8} fill="#E04F2F" />
        <Steam x={540} y={1470} s={1.2} n={4} />
        <g transform="translate(800 1478)"><Bag s={0.9} /><Steam x={0} y={-56} s={0.6} /></g>
      </g>}>
        <g transform="translate(540 1180) scale(1.55)">
          <Person sit={1} aR={20 + toMouth * 30} fR={20 + toMouth * 120} hold={<g><Slice r={-40 - toMouth * 40} /><Steam x={36} y={-80} s={0.45} n={2} /></g>} aL={14} fL={10}
            eyes="happy" mouth={chew ? 'chew' : toMouth > 0.6 ? 'o' : 'grin'} head={Math.sin(f / 10) * 4} bob={Math.sin(f / 6) * 2} />
        </g>
      </Room>
      {Array.from({ length: 10 }).map((_, k) => {
        const t = ((f + k * 9) % 60) / 60;
        return <div key={k} style={{ position: 'absolute', left: 300 + random(`hx${k}`) * 480 + Math.sin(t * 6 + k) * 30, top: 900 - t * 600, fontSize: 50 + random(`hs${k}`) * 30, opacity: Math.sin(Math.PI * t) }}>{k % 3 ? '❤️' : '⭐'}</div>;
      })}
      <div style={{ position: 'absolute', right: 50, top: 520, width: 420, padding: '34px 30px', borderRadius: 50, background: '#fff', boxShadow: '0 40px 80px rgba(15,31,61,.25)',
        transform: `translateX(${(1 - phone) * 600}px) rotate(${(1 - phone) * 10 + 3}deg)`, textAlign: 'center' }}>
        <div style={{ font: `700 40px/1 ${DISPLAY}`, color: C.navy, marginBottom: 20 }}>🛵 Ilan</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, ...iso }}>
          {[0, 1, 2, 3, 4].map(k => { const s = spring({ frame: f - 58 - k * 4, fps: 30, config: { damping: 9, stiffness: 300, mass: 0.5 } });
            return <span key={k} style={{ fontSize: 58, transform: `scale(${0.6 + 0.4 * s})`, filter: s > 0.5 ? 'none' : 'grayscale(1) opacity(.35)', display: 'inline-block' }}>⭐</span>; })}
        </div>
        <div style={{ marginTop: 22, display: 'inline-block', padding: '16px 26px', borderRadius: 999, background: C.cream, color: C.orangeDeep, font: `700 36px/1 ${UI}`, transform: `scale(${thanks})` }}>{T.thanks}</div>
      </div>
      <Punch t={T.hotBig} at={12} until={58} y={130} size={96} />
      <Punch t={T.c5} at={64} y={130} size={84} rot={2} />
      {/* ouverture depuis l'écran bleu nuit, avec le logo un instant */}
      {open > 0.01 && <AbsoluteFill style={{ background: C.navy, opacity: open, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * logoIn})` }}><Wordmark width={640} /></div>
      </AbsoluteFill>}
    </AbsoluteFill>
  );
};

// ===== 6. Logo HOP! sur bleu nuit, puis retour exact à la première image (boucle) ========================
const Loop: React.FC = () => {
  const f = useCurrentFrame();          // 0..90
  const out = lerp(f, [70, 86], [0, 1], inOut);
  const sh = shake(f, 4, 16, 8);
  const letter = (i: number) => {
    const s = spring({ frame: f - i * 3, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 260, mass: 0.6 } });
    return { y: (1 - s) * -500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * -90 : 0, o: f >= i * 3 ? 1 : 0 };
  };
  return (
    <AbsoluteFill style={{ background: WALL, overflow: 'hidden' }}>
      <Room minutes={0}><g transform="translate(540 1180) scale(1.55)"><Person sit={1} bob={0} aL={10} fL={0} aR={10} fR={0} eyes="open" mouth="smile" brows={0} head={0} /></g></Room>
      {out < 1 && <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 70%)`, opacity: 1 - out, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${1 - out * 0.3})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Wordmark width={760} anim={letter} />
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 26px', marginTop: 56, maxWidth: 1000 }}>
            {T.tag.map((w, k) => { const s = spring({ frame: f - 14 - k * 6, fps: 30, config: { damping: 11, stiffness: 280, mass: 0.5 } });
              return <span key={k} style={{ font: `700 88px/1.05 ${DISPLAY}`, color: ['#fff', '#fff', C.orange][k], transform: `translateY(${(1 - s) * 60}px) scale(${0.7 + 0.3 * s})`, opacity: Math.min(1, s * 1.5), display: 'inline-block' }}>{w}</span>; })}
          </div>
          <div style={{ marginTop: 56, padding: '20px 40px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 46px/1 ${UI}`, transform: `scale(${spring({ frame: f - 36, fps: 30, config: { damping: 10, stiffness: 260, mass: 0.5 } })})` }}>hop-livraison.vercel.app</div>
        </div>
      </AbsoluteFill>}
    </AbsoluteFill>
  );
};

export const Cycle: React.FC<{ music?: boolean; lang?: CycleLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: WALL, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={45}><Hungry /></Sequence>
    <Sequence from={45} durationInFrames={75}><Order /></Sequence>
    <Sequence from={120} durationInFrames={WAIT}><Wait /></Sequence>
    <Sequence from={330} durationInFrames={60}><Door /></Sequence>
    <Sequence from={390} durationInFrames={120}><Joy /></Sequence>
    <Sequence from={510} durationInFrames={90}><Loop /><HoppyHop x={210} bottom={1890} h={560} at={0.3} exitAt={1.85} /></Sequence>
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('cycle-music.wav')} />}
  </AbsoluteFill>
); };
export { Person, Bag, Steam, Punch, Phone };
