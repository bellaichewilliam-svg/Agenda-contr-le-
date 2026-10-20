import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, DISPLAY, UI } from './theme';

// Ressort « hop » : entre vite, dépasse un peu, se pose
export const useHop = (delay = 0, damping = 11, mass = 0.6) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass, stiffness: 170 } });
};

// Apparition : grossit en rebondissant et monte un peu
export const Pop: React.FC<{ delay?: number; from?: number; y?: number; rotate?: number; style?: React.CSSProperties; children: React.ReactNode }>
  = ({ delay = 0, from = 0.4, y = 60, rotate = 0, style, children }) => {
  const s = useHop(delay);
  const op = interpolate(s, [0, 0.35], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity: op, transform: `translateY(${(1 - s) * y}px) scale(${from + (1 - from) * s}) rotate(${(1 - s) * rotate}deg)`, ...style }}>
      {children}
    </div>
  );
};

// Le colis HOP! (blanc, ruban pêche, coche orange), comme dans le logo
export const Parcel: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size * 0.85} viewBox="-110 -94 220 188" style={{ overflow: 'visible', ...style }}>
    <rect x="-104" y="-88" width="208" height="176" rx="26" fill="#fff" />
    <rect x="-22" y="-88" width="44" height="84" fill={C.peach} />
    <path d="M-104 -10 H104" stroke="#FFE3CF" strokeWidth="10" />
    <path d="M-62 44 l26 26 l50 -56" fill="none" stroke={C.orangeDeep} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Icône de l'appli (carré orange, trajectoire en pointillés, colis qui saute)
export const AppIcon: React.FC<{ size: number; arc?: number; drop?: number }> = ({ size, arc = 1, drop = 1 }) => {
  const len = 420;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <defs>
        <linearGradient id="hopbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.orangeLight} />
          <stop offset="1" stopColor={C.orangeDeep} />
        </linearGradient>
        <mask id="arcmask">
          <path d="M84 404 C 120 190, 280 96, 380 166" fill="none" stroke="#fff" strokeWidth="60"
            strokeDasharray={`${len * arc} ${len}`} strokeLinecap="round" />
        </mask>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#hopbg)" />
      <path d="M84 404 C 120 190, 280 96, 380 166" fill="none" stroke="#fff" strokeWidth="24" strokeLinecap="round"
        strokeDasharray="0 44" opacity=".95" mask="url(#arcmask)" />
      <g transform={`translate(318 ${300 - (1 - drop) * 260}) rotate(${-14 - (1 - drop) * 40}) scale(${0.6 + 0.4 * drop})`} opacity={Math.min(1, drop * 3)}>
        <rect x="-104" y="-88" width="208" height="176" rx="26" fill="#fff" />
        <rect x="-22" y="-88" width="44" height="84" fill={C.peach} />
        <path d="M-104 -10 H104" stroke="#FFE3CF" strokeWidth="10" />
        <path d="M-62 44 l26 26 l50 -56" fill="none" stroke={C.orangeDeep} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

// Éclat de traits autour d'un point (quand le colis atterrit, quand un prix tombe)
export const Burst: React.FC<{ at: number; x: number; y: number; color?: string; r0?: number; r1?: number; n?: number; width?: number }>
  = ({ at, x, y, color = '#fff', r0 = 120, r1 = 260, n = 10, width = 14 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (t <= 0 || t >= 1) return null;
  const ease = 1 - Math.pow(1 - t, 3);
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width="1080" height="1920">
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const ra = r0 + (r1 - r0) * ease;
        const inner = r0 + (r1 - r0) * Math.max(0, ease * 1.25 - 0.3);
        return (
          <line key={i} x1={x + Math.cos(a) * inner} y1={y + Math.sin(a) * inner} x2={x + Math.cos(a) * ra} y2={y + Math.sin(a) * ra}
            stroke={color} strokeWidth={width * (1 - t * 0.6)} strokeLinecap="round" opacity={1 - t * 0.8} />
        );
      })}
    </svg>
  );
};

// Confettis aux couleurs HOP!
export const Confetti: React.FC<{ at: number; x?: number; y?: number; n?: number; seed?: string; colors?: string[] }>
  = ({ at, x = 540, y = 900, n = 70, seed = 'c', colors = ['#fff', C.navy, C.peach, '#FFD84D', C.orangeLight] }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 75) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const v = 18 + random(`${seed}v${i}`) * 34;
        const px = x + Math.cos(a) * v * t * 0.9;
        const py = y + Math.sin(a) * v * t * 0.9 + 0.55 * t * t;
        const rot = random(`${seed}r${i}`) * 360 + t * (8 + random(`${seed}s${i}`) * 14);
        const w = 16 + random(`${seed}w${i}`) * 18;
        const op = interpolate(t, [0, 50, 75], [1, 1, 0]);
        return (
          <div key={i} style={{ position: 'absolute', left: px, top: py, width: w, height: w * 0.55, borderRadius: 4,
            background: colors[i % colors.length], opacity: op, transform: `rotate(${rot}deg) scaleX(${Math.cos(t * 0.3 + i)})` }} />
        );
      })}
    </AbsoluteFill>
  );
};

// Rayons qui tournent lentement (fond « soleil »)
export const Rays: React.FC<{ color?: string; opacity?: number; speed?: number; cx?: number; cy?: number }>
  = ({ color = '#fff', opacity = 0.12, speed = 0.25, cx = 540, cy = 900 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: cx - 1600, top: cy - 1600, width: 3200, height: 3200, transform: `rotate(${frame * speed}deg)`,
        background: `repeating-conic-gradient(${color} 0deg 9deg, transparent 9deg 22.5deg)` }} />
    </AbsoluteFill>
  );
};

// Pointillés qui flottent (rappel de la trajectoire du logo)
export const Dots: React.FC<{ color?: string; opacity?: number }> = ({ color = '#fff', opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, backgroundImage: `radial-gradient(${color} 5px, transparent 6px)`, backgroundSize: '64px 64px',
      backgroundPosition: `${frame * 0.8}px ${frame * -0.6}px` }} />
  );
};

export const Chip: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number; style?: React.CSSProperties }>
  = ({ children, bg = '#fff', color = C.navy, size = 46, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: `${size * 0.42}px ${size * 0.8}px`, borderRadius: 999,
    background: bg, color, fontFamily: UI, fontWeight: 700, fontSize: size, boxShadow: '0 14px 34px rgba(15,31,61,.18)', whiteSpace: 'nowrap', ...style }}>
    {children}
  </div>
);

// Titre géant, mot par mot
export const Words: React.FC<{ text: string; delay?: number; step?: number; size: number; color?: string; weight?: number; dir?: 'ltr' | 'rtl'; style?: React.CSSProperties }>
  = ({ text, delay = 0, step = 4, size, color = '#fff', weight = 700, dir = 'ltr', style }) => (
  <div dir={dir} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${size * 0.26}px`, fontFamily: DISPLAY,
    fontWeight: weight, fontSize: size, lineHeight: 1.04, color, textAlign: 'center', ...style }}>
    {text.split(' ').map((w, i) => (
      <Pop key={i} delay={delay + i * step} y={size * 0.5} from={0.3} rotate={i % 2 ? 6 : -6}>{w}</Pop>
    ))}
  </div>
);

// Fond plein (couleur ou dégradé) avec un léger halo
export const Bg: React.FC<{ from: string; to: string; glow?: string }> = ({ from, to, glow = 'rgba(255,255,255,.10)' }) => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 38%, ${from} 0%, ${to} 100%)` }}>
    <AbsoluteFill style={{ background: `radial-gradient(40% 25% at 50% 40%, ${glow}, transparent)` }} />
  </AbsoluteFill>
);
