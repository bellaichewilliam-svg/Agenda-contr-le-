import React from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath, getLength, getPointAtLength, getTangentAtLength } from '@remotion/paths';
import { C, DISPLAY, UI } from './theme';
import { LETTERS } from './wordmark';

// Showreel HOP! : 15 s, 1080 × 1920, 120 BPM (1 temps = 15 images). Chaque coupe tombe sur un temps,
// la musique (scripts/reel_music.py) suit les mêmes images clés.
export const REEL_FRAMES = 450;
const CUTS = [60, 135, 225, 300, 360, 405];
const NIGHT = '#0B0F1A';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], ease?: (t: number) => number) => interpolate(f, a, b, { ...clamp, easing: ease });
const outExpo = Easing.out(Easing.exp);
const inExpo = Easing.in(Easing.exp);
const inOut = Easing.inOut(Easing.cubic);

const useSpring = (delay: number, damping = 12, stiffness = 180, mass = 0.7) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, stiffness, mass } });
};
// Secousse de caméra qui s'éteint
const shake = (f: number, at: number, amp: number, len = 10) => {
  const k = lerp(f, [at, at + len], [1, 0]);
  if (f < at || k <= 0) return { x: 0, y: 0 };
  return { x: (random(`sx${f}`) - 0.5) * 2 * amp * k, y: (random(`sy${f}`) - 0.5) * 2 * amp * k };
};

// --- Le logo HOP!, lettre par lettre ------------------------------------------------------------
const CX = [325, 995, 1640, 2060];
const Wordmark: React.FC<{ width: number; anim?: (i: number) => { x?: number; y?: number; s?: number; r?: number; o?: number; blur?: number }; bang?: string; fill?: string }>
  = ({ width, anim, bang = C.orange, fill = '#fff' }) => (
  <svg width={width} height={width * 760 / 2310} viewBox="-10 -20 2310 760" style={{ overflow: 'visible' }}>
    {LETTERS.map((l, i) => {
      const a = anim ? anim(i) : {};
      const s = a.s ?? 1, x = a.x ?? 0, y = a.y ?? 0, r = a.r ?? 0;
      return (
        <g key={i} opacity={a.o ?? 1} style={a.blur ? { filter: `blur(${a.blur}px)` } : undefined}
          transform={`translate(${x} ${y}) translate(${CX[i]} 350) rotate(${r}) scale(${s}) translate(${-CX[i]} -350)`}>
          <g transform="translate(0 700) scale(1 -1)"><path transform={l.t} d={l.d} fill={i === 3 ? bang : fill} /></g>
        </g>
      );
    })}
  </svg>
);

// --- Habillage : grain, vignette, flashs sur les coupes ----------------------------------------
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.22 }}>
      <svg width="100%" height="100%"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 12} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" /></svg>
    </AbsoluteFill>
  );
};
const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.38) 100%)' }} />
);
const Flashes: React.FC = () => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...CUTS.map(c => lerp(f, [c, c + 5], [0.55, 0])) .map((v, i) => (f >= CUTS[i] ? v : 0)));
  return <AbsoluteFill style={{ background: '#fff', opacity: o, pointerEvents: 'none' }} />;
};

// ===== 1. L'allumage : un point, une onde, le logo claque, on plonge dans le « O » ================
const Ignite: React.FC = () => {
  const f = useCurrentFrame();
  const dot = useSpring(0, 8, 220, 0.5);
  const pulse = 1 + 0.12 * Math.sin(f * 0.9) * lerp(f, [0, 20], [1, 0]);
  const dotGone = lerp(f, [19, 23], [1, 0]);
  const ring = lerp(f, [21, 40], [0, 1], outExpo);
  const zoom = lerp(f, [44, 60], [1, 26], inExpo);
  const sh = shake(f, 22, 26, 12);
  const letter = (i: number) => {
    const d = 22 + i * 3;
    const s = spring({ frame: f - d, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 260, mass: 0.6 } });
    const from = [[-900, -400], [0, -900], [900, -400], [700, 600]][i];
    return { x: from[0] * (1 - s), y: from[1] * (1 - s), s: 2.4 - 1.4 * s, r: i === 3 ? (1 - s) * 70 : (1 - s) * (i - 1.5) * 20, o: f >= d ? 1 : 0, blur: (1 - s) * 18 };
  };
  const sub = lerp(f, [33, 42], [0, 1], outExpo);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, ${C.navy2} 0%, ${C.navy} 60%)` }} />
      {/* rayons de vitesse */}
      <svg width={1080} height={1920} style={{ position: 'absolute', opacity: lerp(f, [20, 24, 40], [0, 0.9, 0]) }}>
        {Array.from({ length: 28 }).map((_, i) => {
          const a = (i / 28) * Math.PI * 2 + random(`a${i}`) * 0.2, r0 = 200 + 500 * lerp(f, [20, 40], [0, 1], outExpo), r1 = r0 + 160 + random(`l${i}`) * 220;
          return <line key={i} x1={540 + Math.cos(a) * r0} y1={880 + Math.sin(a) * r0} x2={540 + Math.cos(a) * r1} y2={880 + Math.sin(a) * r1}
            stroke={i % 3 ? '#fff' : C.orange} strokeWidth={i % 2 ? 6 : 3} strokeLinecap="round" />;
        })}
      </svg>
      {/* onde de choc */}
      <div style={{ position: 'absolute', left: 540, top: 880, width: 40 + ring * 2600, height: 40 + ring * 2600, borderRadius: '50%', border: `${lerp(ring, [0, 1], [26, 3])}px solid ${C.orange}`,
        transform: 'translate(-50%,-50%)', opacity: lerp(ring, [0, 0.08, 1], [0, 1, 0]) }} />
      {/* le point orange */}
      <div style={{ position: 'absolute', left: 540, top: 880, width: 120, height: 120, borderRadius: '50%', background: C.orange, boxShadow: `0 0 120px ${C.orange}`,
        transform: `translate(-50%,-50%) scale(${dot * pulse * dotGone})` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y - 80}px)` }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: `${(995 / 2310) * 100}% 48%` }}>
          <Wordmark width={880} anim={letter} />
        </div>
        <div style={{ marginTop: 34, font: `700 46px/1 ${UI}`, letterSpacing: `${0.6 - 0.18 * sub}em`, color: '#fff', opacity: sub * lerp(f, [44, 50], [1, 0]),
          transform: `translateY(${(1 - sub) * 30}px)` }}>DELIVERY</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 2. Ce qu'on livre : un mot par temps =====================================================
const WORDS = [
  { w: 'REPAS', e: '🍔', bg: C.orange, fg: '#fff', out: 'rgba(255,255,255,.18)' },
  { w: 'PHARMACIE', e: '💊', bg: C.navy, fg: C.orange, out: 'rgba(255,106,19,.16)' },
  { w: 'COLIS', e: '📦', bg: C.cream, fg: C.navy, out: 'rgba(15,31,61,.09)' },
  { w: 'FLEURS', e: '💐', bg: '#fff', fg: C.orangeDeep, out: 'rgba(224,66,10,.1)' },
  { w: 'COURSES', e: '🛒', bg: C.navy, fg: '#fff', out: 'rgba(255,255,255,.1)' },
];
const Word: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const w = WORDS[i], dir = i % 2 ? -1 : 1;
  const wipe = lerp(f, [0, 5], [1, 0], outExpo);
  const s = useSpring(0, 13, 300, 0.5);
  const size = Math.min(290, 1600 / w.w.length);
  const em = useSpring(3, 9, 220, 0.6);
  const sh = shake(f, 0, 14, 6);
  return (
    <AbsoluteFill style={{ background: w.bg, overflow: 'hidden', clipPath: `inset(0 ${dir > 0 ? 0 : wipe * 100}% 0 ${dir > 0 ? wipe * 100 : 0}%)` }}>
      {/* le mot en contour qui défile derrière */}
      {[-1, 0, 1, 2].map(row => (
        <div key={row} style={{ position: 'absolute', left: 0, top: 960 + row * 330 - 520, whiteSpace: 'nowrap', font: `700 300px/1 ${DISPLAY}`, color: 'transparent',
          WebkitTextStroke: `4px ${w.out}`, transform: `translateX(${(row % 2 ? 1 : -1) * (f * 18) - 600}px)` }}>
          {`${w.w} · ${w.w} · ${w.w} · ${w.w}`}
        </div>
      ))}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ fontSize: 260, transform: `scale(${em}) rotate(${(1 - em) * -40 * dir}deg) translateY(-40px)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.25))' }}>{w.e}</div>
        <div style={{ display: 'flex', marginTop: 10 }}>
          {w.w.split('').map((ch, k) => {
            const ls = spring({ frame: f - k * 0.8, fps: 30, config: { damping: 12, stiffness: 320, mass: 0.45 } });
            return <span key={k} style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: w.fg, display: 'inline-block', letterSpacing: '-0.02em',
              transform: `translateX(${(1 - ls) * 260 * dir}px) skewX(${(1 - ls) * -22 * dir}deg) scale(${0.6 + 0.4 * s})`, opacity: ls }}>{ch}</span>;
          })}
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', font: `800 40px/1 ${UI}`, letterSpacing: '.35em', color: w.fg, opacity: 0.85 }}>
        ON LIVRE · {String(i + 1).padStart(2, '0')}/05
      </div>
    </AbsoluteFill>
  );
};
const Words: React.FC = () => (
  <AbsoluteFill>
    {WORDS.map((_, i) => <Sequence key={i} from={i * 15} durationInFrames={i === 4 ? 15 : 15}><Word i={i} /></Sequence>)}
  </AbsoluteFill>
);

// ===== 3. La carte : la ville se dessine, le scooter fonce, le temps baisse =====================
const ROUTE = 'M 250 1500 C 330 1290, 560 1330, 610 1140 S 520 860, 690 760 S 900 600, 830 430';
const STREETS = [
  'M 150 300 L 1000 380', 'M 120 620 L 1060 700', 'M 140 980 L 1040 1020', 'M 160 1320 L 1050 1300', 'M 130 1640 L 1000 1700',
  'M 300 120 L 360 1880', 'M 560 100 L 520 1900', 'M 820 120 L 880 1880', 'M 980 200 L 1040 1800',
  'M 200 820 L 900 260', 'M 260 1780 L 1020 1100',
];
const MapScene: React.FC = () => {
  const f = useCurrentFrame();
  const len = getLength(ROUTE);
  const draw = lerp(f, [8, 36], [0, 1], inOut);
  const ride = lerp(f, [26, 82], [0, 1], inOut);
  const p = getPointAtLength(ROUTE, ride * len) ?? { x: 250, y: 1500 }, tg = getTangentAtLength(ROUTE, Math.max(1, ride * len)) ?? { x: 1, y: 0 };
  const ang = Math.atan2(tg.y, tg.x) * 180 / Math.PI;
  const cam = lerp(f, [0, 90], [1.22, 1.02], outExpo);
  const rot = lerp(f, [0, 90], [-6, 0], outExpo);
  const mins = Math.max(1, Math.round(9 - 8 * ride));
  const shopPin = useSpring(4, 9), homePin = useSpring(12, 9);
  const hud = useSpring(10, 13);
  const title = lerp(f, [14, 30], [0, 1], outExpo);
  const exit = lerp(f, [82, 90], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${cam + exit * 0.6}) rotate(${rot}deg)`, opacity: 1 - exit * 0.4 }}>
        <svg width={1080} height={1920}>
          <defs>
            <linearGradient id="sea" x1="0" x2="1"><stop offset="0" stopColor="#0E3A66" /><stop offset="1" stopColor="#0B2442" /></linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="10" /></filter>
          </defs>
          <path d="M 0 0 L 170 0 C 120 400, 200 800, 130 1200 S 170 1700, 110 1920 L 0 1920 Z" fill="url(#sea)" />
          {[0, 1, 2, 3, 4, 5].map(k => <path key={k} d={`M ${30 + k * 14} ${(f * 6 + k * 300) % 1920} q 20 -10 40 0`} stroke="#3B6EA8" strokeWidth={4} fill="none" opacity={0.6} />)}
          {Array.from({ length: 34 }).map((_, k) => (
            <rect key={k} x={200 + (k % 6) * 140 + random(`bx${k}`) * 30} y={140 + Math.floor(k / 6) * 300 + random(`by${k}`) * 40} width={90 + random(`bw${k}`) * 40} height={120 + random(`bh${k}`) * 70} rx={14}
              fill="#151B2D" opacity={lerp(f, [k * 0.6, k * 0.6 + 10], [0, 1])} />
          ))}
          {STREETS.map((d, k) => {
            const ev = evolvePath(lerp(f, [k * 1.5, k * 1.5 + 18], [0, 1], outExpo), d);
            return <path key={k} d={d} stroke="#2C3552" strokeWidth={k < 5 ? 26 : 18} strokeLinecap="round" fill="none" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
          })}
          {/* le trajet, avec un halo */}
          <path d={ROUTE} stroke={C.orange} strokeWidth={34} fill="none" strokeLinecap="round" filter="url(#glow)" opacity={0.7}
            strokeDasharray={evolvePath(draw, ROUTE).strokeDasharray} strokeDashoffset={evolvePath(draw, ROUTE).strokeDashoffset} />
          <path d={ROUTE} stroke="#FFB27F" strokeWidth={12} fill="none" strokeLinecap="round"
            strokeDasharray={evolvePath(draw, ROUTE).strokeDasharray} strokeDashoffset={evolvePath(draw, ROUTE).strokeDashoffset} />
          {/* parcours déjà fait, plus clair */}
          <path d={ROUTE} stroke="#fff" strokeWidth={12} fill="none" strokeLinecap="round"
            strokeDasharray={evolvePath(ride, ROUTE).strokeDasharray} strokeDashoffset={evolvePath(ride, ROUTE).strokeDashoffset} opacity={0.9} />
          {/* épingles */}
          <g transform={`translate(250 1500) scale(${shopPin})`}><circle r={46} fill="#3FB950" stroke="#fff" strokeWidth={8} /><text y={18} textAnchor="middle" fontSize={48}>🍴</text></g>
          <g transform={`translate(830 430) scale(${homePin})`}><circle r={64} fill="#1E9BE0" opacity={0.25} /><circle r={42} fill="#1E9BE0" stroke="#fff" strokeWidth={8} /><circle r={14} fill="#fff" /></g>
        </svg>
        {/* le scooter */}
        <div style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%,-50%)`, opacity: lerp(f, [24, 28], [0, 1]) }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', border: '8px solid #fff',
            boxShadow: `0 0 60px ${C.orange}`, fontSize: 64, transform: `rotate(${Math.max(-25, Math.min(25, ang + 60))}deg)` }}>🛵</div>
        </div>
      </AbsoluteFill>
      {/* la pastille du temps (comme dans l'appli) */}
      <div style={{ position: 'absolute', top: 130, left: 80, right: 80, display: 'flex', alignItems: 'center', gap: 30, padding: '26px 34px', borderRadius: 999,
        background: 'rgba(20,27,45,.92)', border: '2px solid #2A3350', transform: `translateY(${(1 - hud) * -260}px)`, boxShadow: '0 30px 60px rgba(0,0,0,.4)' }}>
        <svg width={120} height={120} viewBox="0 0 120 120"><circle cx={60} cy={60} r={48} stroke="#2C3552" strokeWidth={14} fill="none" />
          <circle cx={60} cy={60} r={48} stroke={C.orange} strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${301 * (0.1 + 0.9 * ride)} 302`} transform="rotate(-90 60 60)" /></svg>
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: `700 92px/1 ${DISPLAY}`, color: '#fff' }}>{mins} min</span>
          <span style={{ font: `500 38px/1 ${UI}`, color: '#A9B3CA' }}>Ilan arrive chez vous</span>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 190, left: 0, right: 0, textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ font: `700 130px/1 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - title) * 160}px)`, letterSpacing: '-0.01em' }}>Suivi en direct</div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 4. Le téléphone : l'anneau se remplit, « Livré ! », confettis ===========================
const PhoneScene: React.FC = () => {
  const f = useCurrentFrame();
  const enter = useSpring(0, 14, 120, 0.9);
  const ringP = lerp(f, [6, 42], [0.08, 1], inOut);
  const done = f >= 43;
  const doneS = useSpring(43, 9, 220, 0.6);
  const floatY = Math.sin(f / 9) * 12;
  const head = lerp(f, [4, 16], [0, 1], outExpo), head2 = lerp(f, [43, 52], [0, 1], outExpo);
  const chip = (d: number) => spring({ frame: f - d, fps: 30, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const confetti = Array.from({ length: 46 }).map((_, k) => {
    const t = Math.max(0, f - 43) / 30, a = random(`ca${k}`) * Math.PI * 2, v = 900 + random(`cv${k}`) * 1300;
    return { x: Math.cos(a) * v * t, y: Math.sin(a) * v * t + 1600 * t * t, r: random(`cr${k}`) * 720 * t, c: [C.orange, '#fff', '#FFB020', '#12B76A', '#1E9BE0'][k % 5], w: 14 + random(`cw${k}`) * 16 };
  });
  const sh = shake(f, 43, 22, 10);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.orangeLight} 0%, ${C.orangeDeep} 100%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 55%, rgba(255,255,255,.28), rgba(255,255,255,0) 55%)' }} />
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', height: 150 }}>
        <div style={{ position: 'absolute', inset: 0, font: `700 112px/1.05 ${DISPLAY}`, color: '#fff', opacity: head * (1 - head2), transform: `translateY(${(1 - head) * 60 - head2 * 60}px)` }}>Commandé en 1 min.</div>
        <div style={{ position: 'absolute', inset: 0, font: `700 112px/1.05 ${DISPLAY}`, color: '#fff', opacity: head2, transform: `translateY(${(1 - head2) * 60}px) scale(${0.9 + 0.1 * head2})` }}>Et hop, c'est livré !</div>
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1800, transform: `translate(${sh.x}px, ${sh.y + 120}px)` }}>
        <div style={{ position: 'relative', width: 560, height: 1120, borderRadius: 86, background: '#05070D', padding: 18, boxShadow: '0 80px 120px rgba(80,20,0,.45)',
          transform: `translateY(${(1 - enter) * 1400 + floatY}px) rotateY(${-50 * (1 - enter) - 10 + Math.sin(f / 20) * 4}deg) rotateX(${8 * (1 - enter) + 6}deg) rotateZ(${(1 - enter) * 18}deg)` }}>
          <div style={{ position: 'absolute', inset: 18, borderRadius: 70, background: NIGHT, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ height: 380, width: '100%', background: '#1A1F2B', position: 'relative', borderRadius: '0 0 40px 40px', overflow: 'hidden' }}>
              {[0, 1, 2, 3, 4].map(k => <div key={k} style={{ position: 'absolute', left: -20, right: -20, top: 40 + k * 80, height: 14, background: '#2C3552', transform: `rotate(${k % 2 ? -8 : 6}deg)` }} />)}
              <div style={{ position: 'absolute', left: 120 + ringP * 220, top: 250 - ringP * 150, width: 64, height: 64, borderRadius: '50%', background: C.orange, border: '6px solid #fff', display: 'grid', placeItems: 'center', fontSize: 30 }}>🛵</div>
            </div>
            <div style={{ position: 'relative', marginTop: -120, width: 330, height: 330, borderRadius: '50%', background: '#151B2D', boxShadow: `0 0 0 14px ${NIGHT}`, display: 'grid', placeItems: 'center' }}>
              <svg width={330} height={330} viewBox="0 0 330 330" style={{ position: 'absolute', inset: 0 }}>
                <circle cx={165} cy={165} r={135} stroke="#2C3552" strokeWidth={20} fill="none" />
                <circle cx={165} cy={165} r={135} stroke={done ? C.green : C.orange} strokeWidth={20} fill="none" strokeLinecap="round"
                  strokeDasharray={`${848 * ringP} 849`} transform="rotate(-90 165 165)" />
              </svg>
              {done
                ? <div style={{ transform: `scale(${doneS})`, font: `700 140px/1 ${DISPLAY}`, color: C.green }}>✓</div>
                : <div style={{ textAlign: 'center' }}><div style={{ font: `700 104px/1 ${DISPLAY}`, color: '#F4F6FB' }}>{Math.max(1, Math.round(6 - 5 * ringP))}</div><div style={{ font: `500 34px/1 ${UI}`, color: '#A9B3CA' }}>min</div></div>}
            </div>
            <div style={{ marginTop: 34, font: `700 44px/1.15 ${DISPLAY}`, color: '#F4F6FB', textAlign: 'center', padding: '0 30px' }}>{done ? 'Livré ! 🎉' : 'Ilan arrive chez vous'}</div>
            <div style={{ marginTop: 28, display: 'flex', gap: 14 }}>
              {[0, 1, 2, 3].map(k => <div key={k} style={{ width: 80, height: 10, borderRadius: 9, background: ringP * 4 > k || done ? C.orange : '#2C3552' }} />)}
            </div>
          </div>
        </div>
        {/* bulles autour du téléphone */}
        {[{ d: 14, x: -330, y: -260, t: '🛵 Ilan · ⭐ 4,9' }, { d: 20, x: 330, y: -40, t: '💬 J\'arrive !' }, { d: 26, x: -320, y: 260, t: '🧾 Reçu envoyé' }].map((b, k) => {
          const s = chip(b.d);
          return <div key={k} style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) translate(${b.x}px, ${b.y + Math.sin((f + k * 20) / 10) * 14}px) scale(${s})`,
            padding: '22px 30px', borderRadius: 999, background: '#fff', font: `700 38px/1 ${UI}`, color: C.navy, boxShadow: '0 20px 40px rgba(0,0,0,.18)', whiteSpace: 'nowrap' }}>{b.t}</div>;
        })}
        {done && confetti.map((c, k) => <div key={k} style={{ position: 'absolute', left: '50%', top: '42%', width: c.w, height: c.w * 0.5, background: c.c, borderRadius: 4,
          transform: `translate(${c.x}px, ${c.y}px) rotate(${c.r}deg)` }} />)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 5. Le prix : les chiffres roulent, le tampon tombe =======================================
const Digit: React.FC<{ to: number; land: number }> = ({ to, land }) => {
  const f = useCurrentFrame();
  const t = lerp(f, [0, land], [0, 1], Easing.out(Easing.cubic));
  const pos = (to + 20) * t; // deux tours puis le bon chiffre
  const h = 420;
  return (
    <div style={{ height: h, overflow: 'hidden', width: 260 }}>
      <div style={{ transform: `translateY(${-(pos % 10) * h}px)`, filter: `blur(${(1 - t) * 10}px)` }}>
        {Array.from({ length: 11 }).map((_, k) => <div key={k} style={{ height: h, font: `700 440px/${h}px ${DISPLAY}`, color: C.navy, textAlign: 'center' }}>{k % 10}</div>)}
      </div>
    </div>
  );
};
const PriceScene: React.FC = () => {
  const f = useCurrentFrame();
  const stamp = useSpring(30, 8, 300, 0.6);
  const sh = shake(f, 30, 30, 10);
  const ring = lerp(f, [30, 50], [0, 1], outExpo);
  const lab = lerp(f, [2, 14], [0, 1], outExpo);
  const chip = (d: number) => spring({ frame: f - d, fps: 30, config: { damping: 10, stiffness: 220, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: C.cream, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `repeating-linear-gradient(-45deg, rgba(255,106,19,.06) 0 40px, transparent 40px 80px)`, transform: `translateX(${f * 3}px)` }} />
      <div style={{ position: 'absolute', left: 540, top: 900, width: 20, height: 20, borderRadius: '50%', border: `10px solid ${C.orange}`, transform: `translate(-50%,-50%) scale(${ring * 80})`, opacity: 1 - ring }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ font: `800 50px/1 ${UI}`, letterSpacing: `${0.5 - 0.2 * lab}em`, color: C.orangeInk, opacity: lab, marginBottom: 20 }}>LA COURSE DANS NETANYA</div>
        <div style={{ font: `800 60px/1 ${UI}`, color: C.navy, opacity: lab, marginBottom: 24 }}>dès</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Digit to={2} land={24} /><Digit to={5} land={30} />
          <div style={{ font: `700 260px/1 ${DISPLAY}`, color: C.orange, transform: `scale(${stamp}) rotate(${(1 - stamp) * -60}deg)`, marginLeft: 10 }}>₪</div>
        </div>
        <div style={{ marginTop: 40, padding: '28px 56px', border: `10px solid ${C.orangeDeep}`, borderRadius: 28, font: `800 84px/1 ${UI}`, color: C.orangeDeep, letterSpacing: '.08em',
          transform: `scale(${1 + Math.max(0, 1 - stamp) * 2.2}) rotate(-6deg)`, opacity: Math.min(1, stamp) }}>PRIX FIXE</div>
        <div style={{ display: 'flex', gap: 22, marginTop: 70 }}>
          {['Bit', 'Espèces', 'Express ⚡'].map((t, k) => <div key={k} style={{ transform: `scale(${chip(40 + k * 6)})`, padding: '22px 36px', borderRadius: 999, background: C.navy, color: '#fff', font: `700 44px/1 ${UI}` }}>{t}</div>)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 6. Quatre tuiles, puis elles se replient en un point =======================================
const TILES = [
  { big: '0 %', t: 'de commission pour les commerces', bg: C.orange, fg: '#fff' },
  { big: '🛵', t: 'Livreurs : vous choisissez vos horaires', bg: '#fff', fg: C.navy },
  { big: 'FR · עב', t: 'En français et en hébreu', bg: C.navy2, fg: '#fff' },
  { big: '📍', t: 'Suivi en direct jusqu\'à la porte', bg: C.green, fg: '#fff' },
];
const TilesScene: React.FC = () => {
  const f = useCurrentFrame();
  const fold = lerp(f, [32, 45], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 60, top: 300, width: 960, height: 1320, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30,
        transform: `scale(${1 - fold * 0.98}) rotate(${fold * 90}deg)`, opacity: 1 - lerp(fold, [0.85, 1], [0, 1]) }}>
        {TILES.map((x, k) => {
          const s = spring({ frame: f - k * 6, fps: 30, config: { damping: 12, stiffness: 200, mass: 0.6 } });
          const from = [[-700, -900], [700, -900], [-700, 900], [700, 900]][k];
          return (
            <div key={k} style={{ background: x.bg, color: x.fg, borderRadius: 44, padding: 46, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              transform: `translate(${from[0] * (1 - s)}px, ${from[1] * (1 - s)}px) rotate(${(1 - s) * (k % 2 ? 25 : -25)}deg) scale(${0.5 + 0.5 * s})`,
              boxShadow: '0 30px 60px rgba(0,0,0,.3)' }}>
              <div style={{ font: `700 ${x.big.length > 4 ? 120 : 170}px/1 ${DISPLAY}` }}>{x.big}</div>
              <div style={{ font: `700 50px/1.15 ${UI}` }}>{x.t}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${fold})`, boxShadow: `0 0 80px ${C.orange}` }} />
    </AbsoluteFill>
  );
};

// ===== 7. Fin : le point s'ouvre, le logo se pose =================================================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 10], [0, 1], outExpo);
  const letter = (i: number) => {
    const s = spring({ frame: f - 4 - i * 3, fps: 30, config: { damping: i === 3 ? 6 : 10, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * -500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * -80 : 0, o: f >= 4 + i * 3 ? 1 : 0 };
  };
  const sub = lerp(f, [14, 24], [0, 1], outExpo);
  const url = spring({ frame: f - 20, fps: 30, config: { damping: 11, stiffness: 200, mass: 0.6 } });
  const tag = lerp(f, [26, 36], [0, 1], outExpo);
  const breathe = 1 + Math.sin(f / 6) * 0.01;
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${1 + open * 40})`, opacity: 1 - open }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 60%)`, opacity: open }} />
      {Array.from({ length: 24 }).map((_, k) => (
        <div key={k} style={{ position: 'absolute', left: random(`px${k}`) * 1080, top: (random(`py${k}`) * 1920 - f * (2 + random(`pv${k}`) * 4)) % 1920 + 0, width: 8, height: 8, borderRadius: '50%',
          background: k % 3 ? 'rgba(255,255,255,.4)' : C.orange, opacity: open * 0.8 }} />
      ))}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${breathe})` }}>
        <Wordmark width={840} anim={letter} />
        <div style={{ marginTop: 36, font: `700 52px/1 ${UI}`, color: '#fff', letterSpacing: `${0.7 - 0.25 * sub}em`, opacity: sub }}>DELIVERY</div>
        <div style={{ marginTop: 90, padding: '30px 52px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 52px/1 ${UI}`, transform: `scale(${url})`, boxShadow: `0 20px 50px rgba(255,106,19,.45)` }}>
          hop-livraison.vercel.app
        </div>
        <div style={{ marginTop: 44, font: `500 42px/1 ${UI}`, color: '#A9B3CA', opacity: tag, letterSpacing: '.06em' }}>Netanya · HaSharon · FR · עב</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ music?: boolean }> = ({ music = true }) => (
  <AbsoluteFill style={{ background: C.navy }}>
    <Sequence durationInFrames={60}><Ignite /></Sequence>
    <Sequence from={60} durationInFrames={75}><Words /></Sequence>
    <Sequence from={135} durationInFrames={90}><MapScene /></Sequence>
    <Sequence from={225} durationInFrames={75}><PhoneScene /></Sequence>
    <Sequence from={300} durationInFrames={60}><PriceScene /></Sequence>
    <Sequence from={360} durationInFrames={45}><TilesScene /></Sequence>
    <Sequence from={405} durationInFrames={45}><Outro /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('reel-music.wav')} />}
  </AbsoluteFill>
);
