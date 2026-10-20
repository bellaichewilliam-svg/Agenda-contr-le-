import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Bg, Burst, Chip, Confetti, Pop, Rays, useHop } from '../components';
import { C, DISPLAY } from '../theme';
import { Strings } from '../strings';

const SLAM = 36;

export const Price: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [8, SLAM], [0, 25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) }));
  const slam = useHop(SLAM, 8, 0.5);
  const scale = frame < SLAM ? interpolate(frame, [8, SLAM], [0.7, 1.05], { extrapolateLeft: 'clamp' }) : 1.25 - 0.25 * slam;
  const shake = frame >= SLAM && frame < SLAM + 8 ? Math.sin(frame * 2.7) * (SLAM + 8 - frame) * 2.2 : 0;

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <Bg from={C.orangeLight} to={C.orangeDeep} glow="rgba(255,255,255,.18)" />
      <Rays opacity={0.12} speed={0.35} cy={820} />
      <div dir={s.dir} style={{ position: 'absolute', top: 330, width: '100%', textAlign: 'center' }}>
        <Pop delay={2}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 86, color: '#fff' }}>{s.priceTop}</span>
        </Pop>
      </div>
      <div style={{ position: 'absolute', top: 470, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', direction: 'ltr',
        transform: `scale(${scale})`, opacity: interpolate(frame, [6, 12], [0, 1], { extrapolateRight: 'clamp' }) }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 560, lineHeight: 0.95, color: '#fff', textShadow: `0 22px 0 ${C.orangeInk}`, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 250, lineHeight: 1.4, color: C.navy, marginInlineStart: 16 }}>₪</span>
      </div>
      <Burst at={SLAM} x={540} y={760} r0={380} r1={560} n={16} width={18} />
      <Confetti at={SLAM} x={540} y={760} seed="price" />
      <div dir={s.dir} style={{ position: 'absolute', top: 1110, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        {s.priceChips.map((t, i) => (
          <Pop key={t} delay={46 + i * 8} y={70} rotate={i % 2 ? 4 : -4}>
            <Chip size={50}>{t}</Chip>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  );
};
