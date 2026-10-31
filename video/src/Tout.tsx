import React from 'react';
import { HoppyHop } from './HoppyHop';
import { AbsoluteFill, Audio, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { C, DISPLAY, UI } from './theme';
import { Flashes, Grain, Vignette, Wordmark, inExpo as inExpoRaw, inOut, lerp, outExpo, shake } from './Reel';

// « On livre TOUT, partout à Netanya » : 15 s, 1080 × 1920, sur les coupes du showreel (60, 135, 225, 300, 360, 405).
export const TOUT_FRAMES = 450;
export type ToutLang = 'fr' | 'he';
const STR = {
  fr: { rtl: false, onLivre: 'On livre…', tout: 'TOUT.',
    cats: [['🍕', 'RESTAURANTS', 'Vos plats préférés'], ['🛒', 'COURSES', 'Supermarché, épicerie…'], ['👔', 'PRESSING', 'Aller et retour'], ['📦', 'COLIS', 'Envois, retraits, poste'], ['💊', 'PHARMACIE', 'Super-Pharm et les autres']],
    partout: ['Partout à', 'Netanya'], quartiers: ['Ir Yamim', 'Ramat Poleg', 'Agamim', 'Kiryat HaSharon', 'Kiryat Nordau', 'Centre-ville', 'Zone industrielle'], sea: 'MER',
    more: ['Et bien plus', 'encore…'], orbit: ['💐 Fleurs', '🥖 Boulangerie', '✉️ Poste', '📄 Documents', '🎁 Cadeaux', '🍷 Caviste 18+', '🧸 Jouets', '🐾 Animalerie'],
    one: ['Une seule appli.', 'Tout Netanya.'],
    tiles: [['🛵', 'Livreurs de Netanya'], ['⚡', 'Au plus vite'], ['📍', 'Suivi en direct'], ['💳', 'Bit, PayBox, espèces']],
    out: ['On livre tout.', 'Partout à Netanya.'] },
  he: { rtl: true, onLivre: 'אנחנו מביאים…', tout: 'הכול.',
    cats: [['🍕', 'מסעדות', 'האוכל שאתם אוהבים'], ['🛒', 'קניות', 'סופר, מכולת…'], ['👔', 'ניקוי יבש', 'הלוך וחזור'], ['📦', 'חבילות', 'שליחה, איסוף, דואר'], ['💊', 'בית מרקחת', 'סופר-פארם ועוד']],
    partout: ['בכל', 'נתניה'], quartiers: ['עיר ימים', 'רמת פולג', 'אגמים', 'קריית השרון', 'קריית נורדאו', 'מרכז העיר', 'אזור התעשייה'], sea: 'ים',
    more: ['ועוד', 'הרבה יותר…'], orbit: ['💐 פרחים', '🥖 מאפייה', '✉️ דואר', '📄 מסמכים', '🎁 מתנות', '🍷 יין 18+', '🧸 צעצועים', '🐾 חיות מחמד'],
    one: ['אפליקציה אחת.', 'כל נתניה.'],
    tiles: [['🛵', 'שליחים מנתניה'], ['⚡', 'הכי מהר'], ['📍', 'מעקב חי'], ['💳', 'ביט, פייבוקס, מזומן']],
    out: ['מביאים הכול.', 'בכל נתניה.'] },
};
let T = STR.fr; // fixé par <Tout lang> avant le rendu des scènes
const iso = { unicodeBidi: 'isolate' as const, direction: 'ltr' as const };
const inExpo = (t: number) => (t <= 0 ? 0 : inExpoRaw(t));
const sp = (f: number, d: number, damping = 11, stiffness = 260, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const CAT_BG = ['#E04F2F', '#12B76A', '#7A5AF8', C.orange, '#1E9BE0'];
const ALL = ['🍕', '🛒', '👔', '📦', '💊', '💐', '🥖', '✉️', '📄', '🎁', '🍔', '🍣'];

// ===== 1. Machine à sous : 3 rouleaux qui s'arrêtent, « On livre… TOUT. » ===========================
const Reel3: React.FC<{ stop: number; land: string; seed: number }> = ({ stop, land, seed }) => {
  const f = useCurrentFrame();
  const t = lerp(f, [4, stop], [0, 1], (x: number) => 1 - Math.pow(1 - x, 3));
  const h = 220, n = 14;
  const strip = Array.from({ length: n }, (_, k) => (k === n - 1 ? land : ALL[(k * 5 + seed) % ALL.length]));
  const pos = t * (n - 1);
  return (
    <div style={{ width: 230, height: h, overflow: 'hidden', borderRadius: 30, background: '#fff', boxShadow: 'inset 0 18px 30px rgba(0,0,0,.18), inset 0 -18px 30px rgba(0,0,0,.18)' }}>
      <div style={{ transform: `translateY(${-pos * h}px)`, filter: `blur(${(1 - t) * 6}px)` }}>
        {strip.map((e, k) => <div key={k} style={{ height: h, display: 'grid', placeItems: 'center', fontSize: 140 }}>{e}</div>)}
      </div>
    </div>
  );
};
const Slots: React.FC = () => {
  const f = useCurrentFrame();
  const head = sp(f, 0, 12, 240, 0.6);
  const tout = sp(f, 40, 8, 320, 0.5);
  const sh = shake(f, 40, 24, 10);
  const lights = Math.floor(f / 3) % 2;
  const zoom = lerp(f, [52, 60], [1, 6], inExpo);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 70%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px) scale(${zoom})` }}>
        <div style={{ font: `700 120px/1 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - head) * -300}px)`, marginBottom: 60 }}>{T.onLivre}</div>
        <div style={{ position: 'relative', padding: 34, borderRadius: 60, background: C.orange, boxShadow: '0 40px 80px rgba(0,0,0,.4)', display: 'flex', gap: 22, ...iso }}>
          {Array.from({ length: 14 }).map((_, k) => {
            const a = (k / 14) * Math.PI * 2;
            return <div key={k} style={{ position: 'absolute', left: `${50 + Math.cos(a) * 54}%`, top: `${50 + Math.sin(a) * 66}%`, width: 22, height: 22, borderRadius: '50%',
              background: (k + lights) % 2 ? '#FFE7A3' : '#fff', boxShadow: '0 0 16px #FFD25A', transform: 'translate(-50%,-50%)' }} />;
          })}
          <Reel3 stop={22} land="🍕" seed={1} /><Reel3 stop={30} land="🛒" seed={4} /><Reel3 stop={38} land="📦" seed={7} />
        </div>
        <div style={{ marginTop: 70, font: `700 230px/1 ${DISPLAY}`, color: C.orange, transform: `scale(${f >= 40 ? 2.6 - 1.6 * tout : 0}) rotate(${-4 * tout}deg)`, opacity: f >= 40 ? 1 : 0,
          textShadow: '0 14px 0 #0B1730' }}>{T.tout}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 2. Les grands titres, un par temps (volets) ===================================================
const Cat: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const [e, title, sub] = T.cats[i];
  const slats = 8;
  const s = sp(f, 1, 10, 320, 0.5);
  const sh = shake(f, 0, 12, 6);
  const size = Math.min(190, (T.rtl ? 1400 : 1220) / title.length);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: i ? CAT_BG[i - 1] : C.navy }}>
      {Array.from({ length: slats }).map((_, k) => {
        const o = lerp(f, [k * 0.6, k * 0.6 + 5], [0, 1], outExpo);
        return <div key={k} style={{ position: 'absolute', left: 0, right: 0, top: (k * 1920) / slats, height: 1920 / slats + 1, background: CAT_BG[i], transformOrigin: k % 2 ? '100% 50%' : '0% 50%', transform: `scaleX(${o})` }} />;
      })}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y - 60}px)` }}>
        <div style={{ fontSize: 300, transform: `scale(${s}) rotate(${(1 - s) * 40}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.25))' }}>{e}</div>
        <div style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: '#fff', marginTop: 20, transform: `translateX(${(1 - s) * (i % 2 ? 600 : -600)}px)`, letterSpacing: T.rtl ? 0 : '-.01em' }}>{title}</div>
        <div style={{ font: `700 52px/1.2 ${UI}`, color: 'rgba(255,255,255,.92)', marginTop: 20, opacity: lerp(f, [4, 8], [0, 1]) }}>{sub}</div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', font: `800 40px/1 ${UI}`, letterSpacing: T.rtl ? '.05em' : '.32em', color: '#fff', opacity: 0.85 }}>
        HOP! · <span style={iso}>{String(i + 1).padStart(2, '0')}/05</span>
      </div>
    </AbsoluteFill>
  );
};
const Cats: React.FC = () => <AbsoluteFill>{T.cats.map((_, i) => <Sequence key={i} from={i * 15} durationInFrames={15}><Cat i={i} /></Sequence>)}</AbsoluteFill>;

// ===== 3. La carte : la mer à gauche, les quartiers s'allument, le scooter passe de l'un à l'autre ====
const COAST = 'M 330 -20 C 300 260, 360 480, 300 760 S 250 1180, 300 1460 S 330 1780, 290 1960';
const PINS = [[540, 470], [470, 1520], [820, 720], [760, 1180], [560, 900], [520, 1250], [880, 1540]];
const TOUR = 'M 540 470 C 700 520, 820 600, 820 720 S 600 860, 560 900 S 760 1060, 760 1180 S 560 1220, 520 1250 S 420 1460, 470 1520 S 760 1600, 880 1540';
const MapScene: React.FC = () => {
  const f = useCurrentFrame();          // 0..90
  const cam = lerp(f, [0, 90], [1.12, 1], outExpo);
  const head = sp(f, 4, 12, 220, 0.6);
  const ride = lerp(f, [14, 86], [0, 1], inOut);
  const len = getLength(TOUR);
  const p = getPointAtLength(TOUR, Math.max(0.5, ride * len)) ?? { x: 540, y: 470 };
  const ev = evolvePath(ride, TOUR);
  const order = [0, 2, 4, 3, 5, 1, 6];
  const exit = lerp(f, [84, 90], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: '#0B1222', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${cam + exit * 0.5})`, opacity: 1 - exit * 0.5 }}>
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs><linearGradient id="seaT" x1="0" x2="1"><stop offset="0" stopColor="#0E3A66" /><stop offset="1" stopColor="#13497F" /></linearGradient>
            <filter id="glT"><feGaussianBlur stdDeviation="12" /></filter></defs>
          <rect width={1080} height={1920} fill="#141C30" />
          {Array.from({ length: 16 }).map((_, k) => <line key={`h${k}`} x1={300} y1={60 + k * 120} x2={1080} y2={60 + k * 120 + (k % 3) * 18} stroke="#1E2842" strokeWidth={k % 4 ? 10 : 22} />)}
          {Array.from({ length: 7 }).map((_, k) => <line key={`v${k}`} x1={380 + k * 110} y1={0} x2={400 + k * 110} y2={1920} stroke="#1E2842" strokeWidth={k % 3 ? 10 : 22} />)}
          <path d={`${COAST} L -20 1960 L -20 -20 Z`} fill="url(#seaT)" />
          <path d={COAST} stroke="#F5D6A0" strokeWidth={26} fill="none" opacity={0.85} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(k => <path key={k} d={`M ${60 + (k % 3) * 60} ${(f * 4 + k * 240) % 1920} q 22 -12 44 0 q 22 12 44 0`} stroke="#5B8FD0" strokeWidth={5} fill="none" opacity={0.6} />)}
          <text direction="ltr" x={120} y={980} fill="#7FB0E8" fontFamily="Rubik" fontWeight={800} fontSize={44} letterSpacing={12} transform="rotate(-90 120 980)" textAnchor="middle">{T.sea}</text>
          <path d={TOUR} stroke={C.orange} strokeWidth={34} fill="none" strokeLinecap="round" filter="url(#glT)" opacity={0.6} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
          <path d={TOUR} stroke="#FFC29A" strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
        </svg>
        {PINS.map(([x, y], k) => {
          const at = 8 + order.indexOf(k) * 10;
          const s = sp(f, at, 10, 300, 0.5);
          const pulse = ((f - at) % 24) / 24;
          return <div key={k} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
            {f >= at && <div style={{ position: 'absolute', left: -60, top: -60, width: 120, height: 120, borderRadius: '50%', border: `4px solid ${C.orange}`, transform: `scale(${0.4 + pulse * 1.4})`, opacity: 1 - pulse }} />}
            <div style={{ position: 'relative', transform: `scale(${s})`, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px 14px 14px', borderRadius: 999, background: '#fff', boxShadow: '0 16px 30px rgba(0,0,0,.35)', whiteSpace: 'nowrap' }}>
              <span style={{ width: 40, height: 40, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', fontSize: 22 }}>{ALL[k]}</span>
              <span style={{ font: `700 34px/1 ${DISPLAY}`, color: C.navy }}>{T.quartiers[k]}</span>
            </div>
          </div>;
        })}
        <div style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', width: 96, height: 96, borderRadius: '50%', background: C.orange, border: '7px solid #fff', display: 'grid', placeItems: 'center', fontSize: 48, boxShadow: `0 0 50px ${C.orange}` }}>🛵</div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 110, left: 0, right: 0, textAlign: 'center', font: `700 104px/1.02 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - head) * -240}px)`, textShadow: '0 10px 30px rgba(0,0,0,.6)' }}>
        {T.partout[0]} <span style={{ color: C.orange }}>{T.partout[1]}</span>
      </div>
    </AbsoluteFill>
  );
};

// ===== 4. « Et bien plus encore » : la ronde en 3D autour du sac HOP! ===============================
const Orbit: React.FC = () => {
  const f = useCurrentFrame();          // 0..75
  const rot = f * 2.4 - 60;
  const head = sp(f, 2, 12, 240, 0.6);
  const burst = lerp(f, [43, 60], [0, 1], outExpo);
  const exit = lerp(f, [68, 75], [0, 1], inExpo);
  const items = T.orbit;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 52%, #FFE7A3 0%, ${C.orangeLight} 45%, ${C.orangeDeep} 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center', font: `700 112px/1.02 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - head) * -260}px)`, textShadow: '0 8px 0 rgba(120,30,0,.35)', opacity: 1 - exit }}>
        {T.more[0]}<br />{T.more[1]}
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1600, transform: `translateY(120px) scale(${1 - exit * 0.4})`, opacity: 1 - exit }}>
        <div style={{ position: 'relative', width: 10, height: 10 }}>
          {items.map((t, k) => {
            const a = ((rot + (k * 360) / items.length) * Math.PI) / 180;
            const pop = sp(f, k * 2, 12, 260, 0.6);
            const depth = (Math.sin(a) + 1) / 2;          // 0 derrière, 1 devant
            const rx = 300 + burst * 30, ry = 470 + burst * 40;
            return <div key={k} style={{ position: 'absolute', left: Math.cos(a) * rx, top: Math.sin(a) * ry * 0.9, zIndex: depth > 0.5 ? 3 : 1,
              transform: `translate(-50%,-50%) scale(${pop * (0.7 + 0.35 * depth)})`, opacity: 0.55 + 0.45 * depth,
              padding: '18px 26px', borderRadius: 999, background: '#fff', color: C.navy, font: `700 42px/1 ${DISPLAY}`, whiteSpace: 'nowrap', boxShadow: '0 20px 40px rgba(120,30,0,.3)' }}>{t}</div>;
          })}
          {/* le sac HOP! au centre */}
          <div style={{ position: 'absolute', zIndex: 2, left: -150, top: -160, width: 300, height: 290, borderRadius: 44, background: C.navy, transform: `scale(${sp(f, 0, 10, 240, 0.6) * (1 + 0.06 * Math.sin(f / 4))})`,
            boxShadow: `inset 0 64px 0 #1B2F57, 0 40px 80px rgba(80,20,0,.45)`, display: 'grid', placeItems: 'center' }}>
            <div style={{ marginTop: 30 }}><Wordmark width={220} /></div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, height: 26, background: C.orange }} />
            <div style={{ position: 'absolute', left: 110, top: -60, width: 80, height: 70, border: '14px solid #0B1730', borderBottom: 'none', borderRadius: '50px 50px 0 0' }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 5. « Une seule appli » : toutes les icônes s'aspirent dans l'icône HOP! =========================
const OneApp: React.FC = () => {
  const f = useCurrentFrame();          // 0..60
  const suck = lerp(f, [10, 30], [0, 1], (x: number) => x * x * x);
  const icon = sp(f, 30, 9, 320, 0.5);
  const sh = shake(f, 30, 24, 10);
  const txt = sp(f, 34, 12, 260, 0.6);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {ALL.map((e, k) => {
          const col = k % 4, row = Math.floor(k / 4);
          const x0 = 180 + col * 240, y0 = 500 + row * 300;
          const x = x0 + (540 - x0) * suck, y = y0 + (900 - y0) * suck;
          const pop = sp(f, k, 12, 260, 0.6);
          return <div key={k} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${pop * (1 - suck * 0.8)}) rotate(${suck * 360}deg)`, opacity: 1 - lerp(suck, [0.85, 1], [0, 1]),
            width: 190, height: 190, borderRadius: 50, background: '#1B2F57', display: 'grid', placeItems: 'center', fontSize: 110 }}>{e}</div>;
        })}
        {/* l'icône de l'appli */}
        <div style={{ position: 'absolute', left: 540, top: 900, transform: `translate(-50%,-50%) scale(${f >= 30 ? icon : 0})`, width: 380, height: 380, borderRadius: 96, background: C.navy,
          border: '6px solid #2A3F6E', boxShadow: `0 0 120px rgba(255,106,19,${0.5 * icon})`, display: 'grid', placeItems: 'center' }}>
          <Wordmark width={300} />
        </div>
        {f >= 30 && Array.from({ length: 14 }).map((_, k) => {
          const t = lerp(f, [30, 48], [0, 1], outExpo), a = (k / 14) * Math.PI * 2;
          return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(a) * 480 * t, top: 900 + Math.sin(a) * 480 * t, width: 20, height: 20, borderRadius: '50%', background: k % 2 ? C.orange : '#fff', opacity: 1 - t, transform: 'translate(-50%,-50%)' }} />;
        })}
        <div style={{ position: 'absolute', top: 1220, left: 0, right: 0, textAlign: 'center', font: `700 104px/1.08 ${DISPLAY}`, color: '#fff', transform: `scale(${txt})`, opacity: Math.min(1, txt * 1.5) }}>
          {T.one[0]}<br /><span style={{ color: C.orange }}>{T.one[1]}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 6. Les atouts =================================================================================
const TILE_BG = ['#fff', C.orange, '#1E9BE0', C.green], TILE_FG = [C.navy, '#fff', '#fff', '#fff'];
const Tiles: React.FC = () => {
  const f = useCurrentFrame();          // 0..45
  const fold = lerp(f, [32, 45], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 60, top: 330, width: 960, height: 1260, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, transform: `scale(${1 - fold * 0.98}) rotate(${fold * -90}deg)`, opacity: 1 - lerp(fold, [0.85, 1], [0, 1]) }}>
        {T.tiles.map(([e, t], k) => {
          const s = sp(f, k * 6, 12, 220, 0.6);
          return <div key={k} style={{ background: TILE_BG[k], color: TILE_FG[k], borderRadius: 48, padding: 44, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 30px 60px rgba(0,0,0,.35)',
            transform: `perspective(1400px) rotateY(${(1 - s) * (k % 2 ? 90 : -90)}deg) scale(${0.6 + 0.4 * s})` }}>
            <div style={{ fontSize: 160, lineHeight: 1 }}>{e}</div>
            <div style={{ font: `700 56px/1.12 ${DISPLAY}` }}>{t}</div>
          </div>;
        })}
      </div>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${fold})`, boxShadow: `0 0 80px ${C.orange}` }} />
    </AbsoluteFill>
  );
};

// ===== 7. Fin =========================================================================================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 10], [0, 1], outExpo);
  const letter = (i: number) => {
    const s = spring({ frame: f - 3 - i * 3, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * 500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * 80 : 0, o: f >= 3 + i * 3 ? 1 : 0 };
  };
  const a = sp(f, 14, 12, 260, 0.6), b = sp(f, 20, 10, 280, 0.5);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${1 + open * 40})`, opacity: 1 - open }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 60%)`, opacity: open }} />
      {/* les catégories défilent en fond */}
      {[0, 1, 2].map(r => <div key={r} style={{ position: 'absolute', left: 0, top: 260 + r * 560, whiteSpace: 'nowrap', fontSize: 110, opacity: 0.1 * open, transform: `translateX(${(r % 2 ? 1 : -1) * f * 6 - 300}px)` }}>{ALL.concat(ALL).join(' ')}</div>)}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark width={760} anim={letter} />
        <div style={{ marginTop: 56, font: `700 84px/1.1 ${DISPLAY}`, color: '#fff', textAlign: 'center', transform: `translateY(${(1 - a) * 40}px)`, opacity: Math.min(1, a * 1.5) }}>{T.out[0]}</div>
        <div style={{ marginTop: 20, padding: '22px 46px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 70px/1 ${DISPLAY}`, transform: `scale(${b}) rotate(-3deg)` }}>📍 {T.out[1]}</div>
        <div style={{ marginTop: 50, font: `700 44px/1 ${UI}`, color: '#A9B3CA', opacity: lerp(f, [30, 38], [0, 1]) }}>hop-livraison.vercel.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Tout: React.FC<{ music?: boolean; lang?: ToutLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: C.navy, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={60}><Slots /></Sequence>
    <Sequence from={60} durationInFrames={75}><Cats /></Sequence>
    <Sequence from={135} durationInFrames={90}><MapScene /></Sequence>
    <Sequence from={225} durationInFrames={75}><Orbit /></Sequence>
    <Sequence from={300} durationInFrames={60}><OneApp /></Sequence>
    <Sequence from={360} durationInFrames={45}><Tiles /></Sequence>
    <Sequence from={405} durationInFrames={45}><Outro /><HoppyHop x={210} bottom={1890} h={560} at={0.35} /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('tout-music.wav')} />}
  </AbsoluteFill>
); };
