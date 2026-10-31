import React from 'react';
import { AbsoluteFill, Audio, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { C, DISPLAY, UI } from './theme';
import { Flashes, Grain, Vignette, Wordmark, inExpo, inOut, lerp, outExpo, shake, useSpring, NIGHT } from './Reel';

// « Itinéraire » : 15 s, 1080 × 1920, sur les coupes du showreel (60, 135, 225, 300, 360, 405) et la même grille musicale.
// Itinéraire optimisé, livraison rapide, suivi en direct, simplicité, atouts HOP!.
export const ROUTE_FRAMES = 450;
export type RouteLang = 'fr' | 'he';
const BLUE = '#1E9BE0', PURPLE = '#7A5AF8';
const STR = {
  fr: { rtl: false, kicker: 'ITINÉRAIRE', title: ['Le chemin', 'le plus court.'], km: 'km', min: 'min',
    steps: ['COMMANDÉ', 'ACCEPTÉ', 'RÉCUPÉRÉ', 'EN ROUTE', 'LIVRÉ'], live: 'SUIVI EN DIRECT',
    near: ['Le livreur le plus proche', 'part tout de suite.'], rider: '🛵 Ilan · à 600 m', here: '🏠 Vous',
    multi: ['Plusieurs commerces,', 'un seul trajet.'], messy: '✗ Dans le désordre', clean: '✓ Le bon ordre, calculé', waze: '🧭 Waze en 1 touche, à chaque arrêt',
    order: 'Commander ?', rows: ['Choisir', "L'adresse", 'Envoyer'], stamp: "C'EST TOUT.", noCard: 'Aucune carte bancaire à taper.',
    atouts: 'LES ATOUTS HOP!', tiles: [['📍', "Suivi en direct jusqu'à la porte"], ['🗺️', 'Le trajet le plus court'], ['⚡', "Express quand c'est urgent"], ['💬', 'Chat avec votre livreur']],
    tag: ['Vite.', 'Suivi.', 'Simple.'] },
  he: { rtl: true, kicker: 'מסלול', title: ['הדרך', 'הקצרה ביותר.'], km: 'ק"מ', min: "דק'",
    steps: ['הוזמן', 'אושר', 'נאסף', 'בדרך', 'נמסר'], live: 'מעקב חי',
    near: ['השליח הקרוב ביותר', 'יוצא מיד.'], rider: "🛵 אילן · 600 מ'", here: '🏠 אתם',
    multi: ['כמה חנויות,', 'מסלול אחד.'], messy: '✗ בלי סדר', clean: '✓ הסדר הנכון, מחושב', waze: '🧭 וייז בנגיעה, בכל עצירה',
    order: 'להזמין?', rows: ['בוחרים', 'כתובת', 'שולחים'], stamp: 'זהו!', noCard: 'בלי להקליד כרטיס אשראי.',
    atouts: 'היתרונות של HOP!', tiles: [['📍', 'מעקב חי עד הדלת'], ['🗺️', 'המסלול הקצר ביותר'], ['⚡', 'אקספרס כשדחוף'], ['💬', "צ'אט עם השליח"]],
    tag: ['מהיר.', 'במעקב.', 'פשוט.'] },
};
let T = STR.fr; // fixé par <Route lang> avant le rendu des scènes
const iso = { unicodeBidi: 'isolate' as const };

// ===== 1. Survol 3D : la caméra suit le trajet dans la ville, puis prend de la hauteur =============
const PLANE_W = 2400, PLANE_H = 3600;
const PATH = 'M 700 3150 L 700 2560 Q 700 2450 810 2450 L 1290 2450 Q 1400 2450 1400 2340 L 1400 1860 Q 1400 1750 1510 1750 L 1640 1750 Q 1750 1750 1750 1640 L 1750 1160 Q 1750 1050 1640 1050 L 1400 1050';
const GRID = [350, 700, 1050, 1400, 1750, 2100];
const BOXES = (() => {
  const out: { x: number; y: number; w: number; d: number; h: number }[] = [];
  for (let bx = 0; bx < 7; bx++) for (let by = 0; by < 10; by++) {
    if (random(`sk${bx}-${by}`) < 0.25) continue;
    const x0 = bx * 350 + 45, y0 = by * 350 + 45;
    const w = 120 + random(`w${bx}-${by}`) * 140, d = 120 + random(`d${bx}-${by}`) * 140;
    out.push({ x: x0 + random(`x${bx}-${by}`) * (260 - w), y: y0 + random(`y${bx}-${by}`) * (260 - d), w, d, h: 30 + random(`h${bx}-${by}`) * 170 });
  }
  return out;
})();
const Box: React.FC<{ b: (typeof BOXES)[number]; k: number; f: number }> = ({ b, k, f }) => {
  const grow = lerp(f, [k * 0.25, k * 0.25 + 14], [0.05, 1], outExpo), h = b.h * grow;
  const lit = random(`lit${k}`) > 0.7;
  return (
    <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.d, transformStyle: 'preserve-3d' }}>
      <div style={{ position: 'absolute', left: 0, top: b.d, width: b.w, height: h, background: '#18213A', transformOrigin: 'top', transform: 'rotateX(90deg)',
        backgroundImage: lit ? 'repeating-linear-gradient(90deg, rgba(255,196,120,.35) 0 10px, transparent 10px 26px)' : undefined }} />
      <div style={{ position: 'absolute', left: b.w, top: 0, width: h, height: b.d, background: '#111830', transformOrigin: 'left', transform: 'rotateY(-90deg)' }} />
      <div style={{ position: 'absolute', inset: 0, background: '#243052', transform: `translateZ(${h}px)`, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.05)' }} />
    </div>
  );
};
const Standing: React.FC<{ x: number; y: number; tilt: number; children: React.ReactNode; s?: number }> = ({ x, y, tilt, children, s = 1 }) => (
  <div style={{ position: 'absolute', left: x, top: y, transformStyle: 'preserve-3d' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '50% 100%', transform: `translate(-50%, -100%) translateZ(2px) rotateX(${-tilt}deg) scale(${s})` }}>{children}</div>
  </div>
);
const Pin: React.FC<{ e: string; c: string }> = ({ e, c }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ width: 150, height: 150, borderRadius: '50%', background: c, border: '10px solid #fff', display: 'grid', placeItems: 'center', fontSize: 76, boxShadow: `0 0 70px ${c}` }}>{e}</div>
    <div style={{ width: 14, height: 90, background: '#fff', borderRadius: 7 }} />
  </div>
);
const Fly: React.FC = () => {
  const f = useCurrentFrame();
  const len = getLength(PATH);
  const ride = lerp(f, [2, 42], [0, 1], inOut);
  const head = getPointAtLength(PATH, Math.max(0.5, ride * len)) ?? { x: 700, y: 3150 };
  const pull = lerp(f, [38, 54], [0, 1], inOut);
  const fx = head.x + (1300 - head.x) * pull, fy = head.y + (2050 - head.y) * pull;
  const tilt = 58 - 30 * pull, rz = lerp(f, [0, 42], [-28, -8], inOut) * (1 - pull), sc = 1.15 - 0.72 * pull;
  const dive = lerp(f, [54, 60], [0, 1], inExpo);
  const ev = evolvePath(ride, PATH);
  const pinA = useSpring(4, 12, 200), pinB = useSpring(30, 12, 200);
  const title = lerp(f, [40, 50], [0, 1], outExpo);
  const hud = useSpring(6, 14, 160);
  const km = (2.4 * ride).toFixed(1).replace('.', T.rtl ? '.' : ',');
  const mins = Math.max(1, Math.round(9 - 8 * ride));
  return (
    <AbsoluteFill style={{ background: '#070B16', overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: '50% 38%', transform: `scale(${1 + dive * 3})`, opacity: 1 - dive * 0.8 }}>
        <div style={{ position: 'absolute', left: 540 - fx, top: 1150 - fy, width: PLANE_W, height: PLANE_H, transformOrigin: `${fx}px ${fy}px`,
          transform: `rotateX(${tilt}deg) rotateZ(${rz}deg) scale(${sc})`, transformStyle: 'preserve-3d', background: '#0B1222' }}>
          <svg width={PLANE_W} height={PLANE_H} style={{ position: 'absolute', inset: 0 }}>
            <defs><filter id="rg"><feGaussianBlur stdDeviation="16" /></filter></defs>
            {GRID.map(g => <line key={`v${g}`} x1={g} y1={0} x2={g} y2={PLANE_H} stroke="#1C2540" strokeWidth={64} />)}
            {[...GRID, 2450, 2800, 3150, 3500].map(g => <line key={`h${g}`} x1={0} y1={g} x2={PLANE_W} y2={g} stroke="#1C2540" strokeWidth={64} />)}
            {GRID.map(g => <line key={`vd${g}`} x1={g} y1={0} x2={g} y2={PLANE_H} stroke="#33406A" strokeWidth={3} strokeDasharray="30 30" />)}
            <path d={PATH} stroke={C.orange} strokeWidth={70} fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#rg)" opacity={0.85} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
            <path d={PATH} stroke="#FFC29A" strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
            <circle cx={head.x} cy={head.y} r={90 + Math.sin(f / 2) * 10} fill={C.orange} opacity={0.25} />
          </svg>
          {BOXES.map((b, k) => <Box key={k} b={b} k={k} f={f} />)}
          <Standing x={700} y={3150} tilt={tilt} s={pinA}><Pin e="🏪" c={C.green} /></Standing>
          <Standing x={1400} y={1050} tilt={tilt} s={pinB}><Pin e="🏠" c={BLUE} /></Standing>
          <Standing x={head.x} y={head.y} tilt={tilt} s={1 - pull * 0.2}>
            <div style={{ width: 130, height: 130, borderRadius: '50%', background: C.orange, border: '9px solid #fff', display: 'grid', placeItems: 'center', fontSize: 66, boxShadow: `0 0 80px ${C.orange}` }}>🛵</div>
          </Standing>
        </div>
      </AbsoluteFill>
      {/* HUD : distance et temps */}
      <div style={{ position: 'absolute', top: 120, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - hud) * -300}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '22px 36px', borderRadius: 999, background: 'rgba(15,22,40,.86)', border: '2px solid #2A3350', boxShadow: '0 30px 60px rgba(0,0,0,.45)' }}>
          <span style={{ font: `800 34px/1 ${UI}`, letterSpacing: T.rtl ? '.05em' : '.3em', color: '#FFB27F' }}>{T.kicker}</span>
          <span style={{ width: 2, height: 46, background: '#2A3350' }} />
          <span style={{ font: `700 56px/1 ${DISPLAY}`, color: '#fff', ...iso }}>{km} {T.km}</span>
          <span style={{ font: `700 56px/1 ${DISPLAY}`, color: C.orange, ...iso }}>{mins} {T.min}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 170, left: 0, right: 0, textAlign: 'center', overflow: 'hidden', padding: '0 40px' }}>
        <div style={{ font: `700 132px/1.02 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - title) * 300}px)`, textShadow: '0 10px 40px rgba(0,0,0,.6)' }}>
          {T.title[0]}<br /><span style={{ color: C.orange }}>{T.title[1]}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 2. Le suivi, une étape par temps, sur un rail qui se remplit ==================================
const STEP_UI = [
  { e: '🧾', bg: C.navy, fg: '#fff' }, { e: '👍', bg: BLUE, fg: '#fff' }, { e: '🛍️', bg: PURPLE, fg: '#fff' },
  { e: '🛵', bg: C.orange, fg: '#fff' }, { e: '✅', bg: C.green, fg: '#fff' },
];
const Step: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const s = STEP_UI[i], word = T.steps[i];
  const wipe = lerp(f, [0, 6], [1, 0], outExpo);
  const em = spring({ frame: f - 1, fps: 30, config: { damping: 11, stiffness: 240, mass: 0.6 } });
  const sh = shake(f, 0, 12, 6);
  const size = Math.min(230, (T.rtl ? 1400 : 1480) / word.length);
  const parts = T.rtl ? [word] : word.split('');
  return (
    <AbsoluteFill style={{ background: s.bg, overflow: 'hidden', clipPath: `circle(${(1 - wipe) * 150}% at 50% 86%)` }}>
      {/* le mot en très grand, en fond, qui défile verticalement */}
      <div style={{ position: 'absolute', left: -40, right: -40, top: lerp(f, [0, 15], [-120, -380]), font: `700 360px/0.92 ${DISPLAY}`, color: 'rgba(255,255,255,.07)', textAlign: 'center', whiteSpace: 'nowrap' }}>
        {[0, 1, 2, 3, 4, 5].map(k => <div key={k}>{word}</div>)}
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y - 120}px)` }}>
        <div style={{ fontSize: 230, transform: `scale(${em}) rotate(${(1 - em) * 30}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.25))', marginBottom: 10 }}>{s.e}</div>
        <div style={{ display: 'flex', overflow: 'hidden', paddingTop: 70, paddingBottom: 20 }}>
          {parts.map((ch, k) => {
            const ls = spring({ frame: f - k * 0.7, fps: 30, config: { damping: 14, stiffness: 340, mass: 0.45 } });
            return <span key={k} style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: s.fg, display: 'inline-block', whiteSpace: 'pre',
              transform: `translateY(${(1 - ls) * 300}px) scaleY(${0.6 + 0.4 * ls})`, transformOrigin: '50% 100%' }}>{ch}</span>;
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const Rail: React.FC = () => {
  const f = useCurrentFrame();
  const prog = lerp(f, [0, 66], [0, 1], (t: number) => t);
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, bottom: 250, height: 80 }}>
      <div style={{ position: 'absolute', top: -70, left: 0, right: 0, textAlign: 'center', font: `800 34px/1 ${UI}`, letterSpacing: T.rtl ? '.08em' : '.32em', color: '#fff', opacity: 0.9 }}>
        <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', background: '#FF4D4D', marginInlineEnd: 16, opacity: 0.5 + 0.5 * Math.sin(f / 3) }} />{T.live}
      </div>
      <div style={{ position: 'absolute', top: 36, left: 40, right: 40, height: 10, borderRadius: 5, background: 'rgba(255,255,255,.25)' }} />
      <div style={{ position: 'absolute', top: 36, [T.rtl ? 'right' : 'left']: 40, width: `calc((100% - 80px) * ${prog})`, height: 10, borderRadius: 5, background: '#fff' }} />
      {[0, 1, 2, 3, 4].map(k => {
        const on = f >= k * 15;
        const pop = spring({ frame: f - k * 15, fps: 30, config: { damping: 12, stiffness: 300, mass: 0.5 } });
        return <div key={k} style={{ position: 'absolute', top: 8, [T.rtl ? 'right' : 'left']: `calc(${k * 25}% - ${k * 20}px)`, width: 66, height: 66, borderRadius: '50%',
          background: on ? '#fff' : 'rgba(255,255,255,.25)', border: '6px solid rgba(255,255,255,.5)', transform: `scale(${on ? 0.8 + 0.2 * pop : 0.7})`,
          display: 'grid', placeItems: 'center', font: `800 30px/1 ${UI}`, color: STEP_UI[k].bg }}>{on ? '✓' : ''}</div>;
      })}
    </div>
  );
};
const Track: React.FC = () => (
  <AbsoluteFill>
    {T.steps.map((_, i) => <Sequence key={i} from={i * 15} durationInFrames={75 - i * 15}><Step i={i} /></Sequence>)}
    <Rail />
  </AbsoluteFill>
);

// ===== 3. Radar : on trouve le livreur le plus proche, il fonce =====================================
const RIDERS = [{ a: -40, d: 520 }, { a: 25, d: 410 }, { a: 100, d: 600 }, { a: 160, d: 330 }, { a: 220, d: 470 }, { a: 300, d: 230 }];
const HOME = { x: 540, y: 1120 };
const Radar: React.FC = () => {
  const f = useCurrentFrame();
  const sweep = f * 9 - 90;
  const near = 5;
  const pick = lerp(f, [44, 52], [0, 1], outExpo);
  const line = lerp(f, [48, 58], [0, 1], inOut);
  const go = lerp(f, [58, 76], [0, 1], (t: number) => t * t * (3 - 2 * t));
  const arrive = useSpring(76, 10, 240, 0.6);
  const head = lerp(f, [3, 14], [0, 1], outExpo);
  const exit = lerp(f, [82, 90], [0, 1], inExpo);
  const rp = (r: (typeof RIDERS)[number]) => ({ x: HOME.x + Math.cos(r.a * Math.PI / 180) * r.d, y: HOME.y + Math.sin(r.a * Math.PI / 180) * r.d });
  const nr = rp(RIDERS[near]);
  const pos = { x: nr.x + (HOME.x - nr.x) * go, y: nr.y + (HOME.y - nr.y) * go };
  const ang = Math.atan2(HOME.y - nr.y, HOME.x - nr.x) * 180 / Math.PI;
  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${1 + exit * 2.5})`, transformOrigin: `${HOME.x}px ${HOME.y}px`, opacity: 1 - exit }}>
        <AbsoluteFill style={{ backgroundImage: 'linear-gradient(rgba(70,90,140,.18) 2px, transparent 2px), linear-gradient(90deg, rgba(70,90,140,.18) 2px, transparent 2px)', backgroundSize: '90px 90px',
          backgroundPosition: `${-f * 1.5}px ${-f * 1.5}px` }} />
        {/* anneaux et balayage */}
        {[220, 440, 660].map((r, k) => <div key={k} style={{ position: 'absolute', left: HOME.x - r, top: HOME.y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: '2px solid rgba(255,138,61,.25)' }} />)}
        <div style={{ position: 'absolute', left: HOME.x - 700, top: HOME.y - 700, width: 1400, height: 1400, borderRadius: '50%', transform: `rotate(${sweep}deg)`, opacity: 1 - pick * 0.7,
          background: 'conic-gradient(from 0deg, rgba(255,106,19,.45), rgba(255,106,19,0) 60deg, transparent 360deg)' }} />
        {[0, 1, 2].map(k => {
          const t = ((f + k * 12) % 36) / 36;
          return <div key={k} style={{ position: 'absolute', left: HOME.x, top: HOME.y, width: 60 + t * 900, height: 60 + t * 900, borderRadius: '50%', border: `4px solid ${BLUE}`, transform: 'translate(-50%,-50%)', opacity: (1 - t) * 0.5 }} />;
        })}
        {/* la ligne vers le client */}
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <line x1={nr.x} y1={nr.y} x2={nr.x + (HOME.x - nr.x) * line} y2={nr.y + (HOME.y - nr.y) * line} stroke={C.orange} strokeWidth={10} strokeDasharray="4 22" strokeLinecap="round" />
        </svg>
        {/* traînée de vitesse */}
        {go > 0 && go < 1 && Array.from({ length: 7 }).map((_, k) => (
          <div key={k} style={{ position: 'absolute', left: pos.x, top: pos.y + (k - 3) * 22, width: 120 + k * 50, height: 6, borderRadius: 3, background: k % 2 ? '#fff' : C.orange,
            transformOrigin: '0 50%', transform: `rotate(${ang + 180}deg)`, opacity: 0.7 - Math.abs(k - 3) * 0.15 }} />
        ))}
        {RIDERS.map((r, k) => {
          const p = rp(r), on = spring({ frame: f - (6 + k * 6), fps: 30, config: { damping: 12, stiffness: 260, mass: 0.5 } });
          const sel = k === near;
          const q = sel ? pos : p;
          return <div key={k} style={{ position: 'absolute', left: q.x, top: q.y, transform: `translate(-50%,-50%) scale(${on * (sel ? 1 + 0.35 * pick : 1 - 0.4 * pick)})`, opacity: sel ? 1 : 1 - 0.6 * pick }}>
            <div style={{ width: 92, height: 92, borderRadius: '50%', background: sel && pick > 0 ? C.orange : '#2A3556', border: `6px solid ${sel && pick > 0 ? '#fff' : '#46557F'}`, display: 'grid', placeItems: 'center', fontSize: 44,
              boxShadow: sel && pick > 0 ? `0 0 ${50 * pick}px ${C.orange}` : 'none' }}>🛵</div>
          </div>;
        })}
        {/* le chip du livreur choisi */}
        <div style={{ position: 'absolute', left: nr.x, top: nr.y - 120, transform: `translate(-50%,-50%) scale(${pick * (1 - go)})`, padding: '18px 28px', borderRadius: 999, background: '#fff',
          font: `700 38px/1 ${UI}`, color: C.navy, whiteSpace: 'nowrap', boxShadow: '0 20px 40px rgba(0,0,0,.35)' }}>{T.rider}</div>
        {/* le client */}
        <div style={{ position: 'absolute', left: HOME.x, top: HOME.y, transform: `translate(-50%,-50%) scale(${1 + 0.25 * arrive})` }}>
          <div style={{ width: 110, height: 110, borderRadius: '50%', background: f >= 76 ? C.green : BLUE, border: '8px solid #fff', display: 'grid', placeItems: 'center', fontSize: 52, boxShadow: `0 0 60px ${f >= 76 ? C.green : BLUE}` }}>{f >= 76 ? '✓' : '🏠'}</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, left: 40, right: 40, textAlign: 'center', font: `700 92px/1.06 ${DISPLAY}`, color: '#fff', opacity: head * (1 - exit), transform: `translateY(${(1 - head) * 60}px)` }}>
        {T.near[0]}<br /><span style={{ color: C.orange }}>{T.near[1]}</span>
      </div>
    </AbsoluteFill>
  );
};

// ===== 4. Plusieurs commerces : le trajet en désordre se remet dans le bon ordre =====================
type P = { x: number; y: number };
const R0: P = { x: 170, y: 1600 }, SA: P = { x: 540, y: 1400 }, SB: P = { x: 880, y: 1130 }, SC: P = { x: 560, y: 870 }, HH: P = { x: 300, y: 620 };
const MESSY = [R0, SC, SA, SB, HH], CLEAN = [R0, SA, SB, SC, HH];
const smooth = (pts: P[]) => {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
};
const STOPS = [{ p: SA, e: '🥖' }, { p: SB, e: '💊' }, { p: SC, e: '💐' }];
const Optimize: React.FC = () => {
  const f = useCurrentFrame();
  const draw = lerp(f, [4, 18], [0, 1], inOut);
  const morph = lerp(f, [22, 43], [0, 1], inOut);
  const pts = MESSY.map((m, i) => ({ x: m.x + (CLEAN[i].x - m.x) * morph, y: m.y + (CLEAN[i].y - m.y) * morph }));
  const d = smooth(pts);
  const ok = f >= 43;
  const ev = evolvePath(draw, d);
  const len = getLength(d);
  const ride = lerp(f, [46, 72], [0, 1], inOut);
  const sc = getPointAtLength(d, Math.max(0.5, ride * len)) ?? R0;
  const head = lerp(f, [2, 12], [0, 1], outExpo);
  const okS = useSpring(43, 11, 260, 0.6);
  const chip = useSpring(52, 12, 220, 0.6);
  const sh = shake(f, 43, 14, 8);
  const exit = lerp(f, [70, 75], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: C.cream, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y + 60}px) scale(${1 - exit * 0.15})`, opacity: 1 - exit }}>
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {[400, 760, 1020, 1260, 1520, 1760].map((y, k) => <path key={`h${k}`} d={`M -20 ${y} L 1100 ${y + (k % 2 ? 40 : -30)}`} stroke="#FFDCC4" strokeWidth={30} />)}
          {[160, 420, 700, 960].map((x, k) => <path key={`v${k}`} d={`M ${x} 300 L ${x + (k % 2 ? 50 : -40)} 1900`} stroke="#FFDCC4" strokeWidth={30} />)}
          {ok && <path d={d} stroke={C.orange} strokeWidth={60} fill="none" strokeLinecap="round" opacity={0.25} />}
          <path d={d} stroke={ok ? C.orange : '#98A2B3'} strokeWidth={ok ? 18 : 12} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
        </svg>
        {STOPS.map((s, k) => {
          const pop = spring({ frame: f - 2 - k * 3, fps: 30, config: { damping: 11, stiffness: 240, mass: 0.6 } });
          const n = spring({ frame: f - 44 - k * 3, fps: 30, config: { damping: 10, stiffness: 300, mass: 0.5 } });
          return <div key={k} style={{ position: 'absolute', left: s.p.x, top: s.p.y, transform: `translate(-50%,-50%) scale(${pop})` }}>
            <div style={{ width: 130, height: 130, borderRadius: 40, background: '#fff', border: `6px solid ${ok ? C.orange : '#D0D5DD'}`, display: 'grid', placeItems: 'center', fontSize: 66, boxShadow: '0 20px 40px rgba(180,80,0,.18)' }}>{s.e}</div>
            <div style={{ position: 'absolute', top: -26, [T.rtl ? 'left' : 'right']: -26, width: 64, height: 64, borderRadius: '50%', background: C.navy, color: '#fff', display: 'grid', placeItems: 'center',
              font: `800 36px/1 ${UI}`, transform: `scale(${ok ? n : 0})`, border: '5px solid #fff' }}>{k + 1}</div>
          </div>;
        })}
        <div style={{ position: 'absolute', left: HH.x, top: HH.y, transform: 'translate(-50%,-50%)' }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: BLUE, border: '8px solid #fff', display: 'grid', placeItems: 'center', fontSize: 56, boxShadow: '0 20px 40px rgba(30,155,224,.35)' }}>🏠</div>
        </div>
        <div style={{ position: 'absolute', left: (ok ? sc : R0).x, top: (ok ? sc : R0).y, transform: 'translate(-50%,-50%)' }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: C.orange, border: '7px solid #fff', display: 'grid', placeItems: 'center', fontSize: 50, boxShadow: `0 0 40px ${C.orange}` }}>🛵</div>
        </div>
        {/* étiquette : désordre → bon ordre */}
        <div style={{ position: 'absolute', top: 1740, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ padding: '22px 38px', borderRadius: 999, font: `700 44px/1 ${UI}`, color: '#fff', background: ok ? C.green : '#F04438', transform: `scale(${ok ? okS : lerp(f, [10, 16], [0, 1], outExpo)})`, whiteSpace: 'nowrap' }}>{ok ? T.clean : T.messy}</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 130, left: 40, right: 40, textAlign: 'center', font: `700 96px/1.05 ${DISPLAY}`, color: C.navy, opacity: head * (1 - exit), transform: `translateY(${(1 - head) * 60}px)` }}>
        {T.multi[0]}<br /><span style={{ color: C.orangeDeep }}>{T.multi[1]}</span>
      </div>
      <div style={{ position: 'absolute', top: 400, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 1 - exit }}>
        <div style={{ padding: '18px 30px', borderRadius: 999, background: C.navy, color: '#fff', font: `700 38px/1 ${UI}`, transform: `scale(${chip})`, whiteSpace: 'nowrap' }}>{T.waze}</div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 5. Simplicité : 3 touches, puis le tampon =====================================================
const TAPS = [5, 13, 20];
const Simple: React.FC = () => {
  const f = useCurrentFrame();
  const stamp = useSpring(30, 13, 320, 0.6);
  const sh = shake(f, 30, 26, 10);
  const head = lerp(f, [0, 8], [0, 1], outExpo);
  const sub = lerp(f, [36, 44], [0, 1], outExpo);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, ${C.orangeLight} 0%, ${C.orangeDeep} 100%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,.25), rgba(255,255,255,0) 55%)' }} />
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ position: 'absolute', top: 190, left: 0, right: 0, textAlign: 'center', font: `700 120px/1 ${DISPLAY}`, color: '#fff', opacity: head, transform: `translateY(${(1 - head) * 50}px)` }}>{T.order}</div>
        <div style={{ position: 'absolute', top: 470, left: 110, right: 110, display: 'grid', gap: 34, opacity: 1 - 0.55 * Math.min(1, stamp) }}>
          {T.rows.map((r, k) => {
            const inS = spring({ frame: f - k * 2, fps: 30, config: { damping: 14, stiffness: 220, mass: 0.6 } });
            const tapped = f >= TAPS[k];
            const tp = lerp(f, [TAPS[k] - 3, TAPS[k], TAPS[k] + 6], [1, 0.94, 1]);
            const rip = lerp(f, [TAPS[k], TAPS[k] + 10], [0, 1], outExpo);
            return <div key={k} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 34, padding: '34px 40px', borderRadius: 40, background: '#fff', overflow: 'hidden',
              transform: `translateX(${(1 - inS) * (k % 2 ? 900 : -900)}px) scale(${tp})`, boxShadow: '0 24px 50px rgba(120,30,0,.25)' }}>
              {tapped && <div style={{ position: 'absolute', left: 90, top: '50%', width: 40 + rip * 1600, height: 40 + rip * 1600, borderRadius: '50%', background: C.greenSoft, transform: 'translate(-50%,-50%)', opacity: 1 - rip * 0.4 }} />}
              <span style={{ position: 'relative', width: 104, height: 104, borderRadius: '50%', background: tapped ? C.green : C.navy, color: '#fff', display: 'grid', placeItems: 'center', font: `700 56px/1 ${DISPLAY}` }}>{tapped ? '✓' : k + 1}</span>
              <span style={{ position: 'relative', font: `700 74px/1 ${DISPLAY}`, color: C.navy }}>{r}</span>
            </div>;
          })}
        </div>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ marginTop: 260, padding: '30px 64px', borderRadius: 36, background: C.navy, color: '#fff', font: `700 150px/1 ${DISPLAY}`, whiteSpace: 'nowrap',
            transform: `scale(${1 + Math.max(0, 1 - stamp) * 2.6}) rotate(-6deg)`, opacity: Math.min(1, stamp), boxShadow: '0 40px 80px rgba(60,10,0,.4)' }}>{T.stamp}</div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', bottom: 230, left: 0, right: 0, textAlign: 'center', font: `700 54px/1.2 ${UI}`, color: '#fff', opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>🔒 {T.noCard}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 6. Les atouts : panneau à palettes, puis tout file vers le point orange =======================
const TILE_BG = [BLUE, C.navy2, C.orange, C.green];
const Atouts: React.FC = () => {
  const f = useCurrentFrame();
  const lab = lerp(f, [0, 8], [0, 1], outExpo);
  const dot = lerp(f, [36, 45], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 260, left: 0, right: 0, textAlign: 'center', font: `800 44px/1 ${UI}`, letterSpacing: T.rtl ? '.05em' : '.3em', color: '#FFB27F', opacity: lab * (1 - dot), ...iso }}>{T.atouts}</div>
      <div style={{ position: 'absolute', top: 380, left: 70, right: 70, display: 'grid', gap: 30, perspective: 1600 }}>
        {T.tiles.map(([e, t], k) => {
          const flip = spring({ frame: f - k * 6, fps: 30, config: { damping: 15, stiffness: 230, mass: 0.6 } });
          const out = lerp(f, [30 + k * 1.5, 38 + k * 1.5], [0, 1], inExpo);
          return <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 34, padding: '40px 44px', borderRadius: 40, background: TILE_BG[k], color: '#fff',
            transformOrigin: '50% 0%', transform: `rotateX(${(1 - flip) * -100}deg) translateY(${out * -1600}px) scale(${1 - out * 0.4})`, boxShadow: '0 30px 60px rgba(0,0,0,.35)', backfaceVisibility: 'hidden' }}>
            <span style={{ width: 150, height: 150, borderRadius: 40, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', fontSize: 90, flex: 'none' }}>{e}</span>
            <span style={{ font: `700 60px/1.12 ${DISPLAY}` }}>{t}</span>
          </div>;
        })}
      </div>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${dot})`, boxShadow: `0 0 80px ${C.orange}` }} />
    </AbsoluteFill>
  );
};

// ===== 7. Fin : le point s'ouvre, le logo, « Vite. Suivi. Simple. » ==================================
const TAG_C = [C.orange, BLUE, C.green];
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 10], [0, 1], outExpo);
  const letter = (i: number) => {
    const s = spring({ frame: f - 3 - i * 3, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * 500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * 80 : 0, o: f >= 3 + i * 3 ? 1 : 0 };
  };
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${1 + open * 40})`, opacity: 1 - open }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 60%)`, opacity: open }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark width={760} anim={letter} />
        <div style={{ display: 'flex', gap: 30, marginTop: 60 }}>
          {T.tag.map((w, k) => {
            const s = spring({ frame: f - 15 - k * 4, fps: 30, config: { damping: 12, stiffness: 260, mass: 0.5 } });
            return <span key={k} style={{ font: `700 96px/1 ${DISPLAY}`, color: TAG_C[k], transform: `translateY(${(1 - s) * 80}px) scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 1.5), display: 'inline-block' }}>{w}</span>;
          })}
        </div>
        <div style={{ marginTop: 64, font: `700 46px/1 ${UI}`, color: '#A9B3CA', opacity: lerp(f, [30, 38], [0, 1]) }}>hop-livraison.vercel.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Route: React.FC<{ music?: boolean; lang?: RouteLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: C.navy, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={60}><Fly /></Sequence>
    <Sequence from={60} durationInFrames={75}><Track /></Sequence>
    <Sequence from={135} durationInFrames={90}><Radar /></Sequence>
    <Sequence from={225} durationInFrames={75}><Optimize /></Sequence>
    <Sequence from={300} durationInFrames={60}><Simple /></Sequence>
    <Sequence from={360} durationInFrames={45}><Atouts /></Sequence>
    <Sequence from={405} durationInFrames={45}><Outro /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('route-music.wav')} />}
  </AbsoluteFill>
); };
