import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, Dots, Pop, Rays } from '../components';
import { C, DISPLAY, UI } from '../theme';
import { Strings } from '../strings';

const STEP = 18;
const BGS = [C.orange, C.navy, C.orangeDeep, C.navy2, C.orange];
const END = 92;

export const Items: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const idx = Math.min(s.items.length - 1, Math.max(0, Math.floor((frame - 2) / STEP)));
  const ended = frame >= END;
  const stamp = spring({ frame: frame - END, fps, config: { damping: 9, mass: 0.5, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ background: ended ? C.navy : BGS[idx] }}>
      <Rays opacity={ended ? 0.05 : 0.1} speed={0.6} />
      <Dots opacity={0.08} />
      {!ended && (
        <>
          <div dir={s.dir} style={{ position: 'absolute', top: 330, width: '100%', textAlign: 'center', fontFamily: DISPLAY, fontWeight: 600, fontSize: 84, color: 'rgba(255,255,255,.92)' }}>
            {s.itemsTop}
          </div>
          {s.items.map(([emoji, label], i) => {
            const start = 2 + i * STEP;
            const local = frame - start;
            if (local < 0 || local >= STEP + 6) return null;
            const inn = spring({ frame: local, fps, config: { damping: 10, mass: 0.5, stiffness: 220 } });
            const out = interpolate(local, [STEP - 2, STEP + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const dirX = i % 2 ? -1 : 1;
            return (
              <AbsoluteFill key={i} style={{ opacity: 1 - out }}>
                <div style={{ position: 'absolute', left: 540, top: 900, transform: `translate(-50%, -50%) translate(${out * dirX * -500}px, ${out * -120}px) scale(${0.2 + 0.8 * inn}) rotate(${(1 - inn) * 30 * dirX + out * -25 * dirX}deg)` }}>
                  <div style={{ width: 560, height: 560, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 40px 90px rgba(0,0,0,.28), inset 0 -18px 0 rgba(15,31,61,.06)' }}>
                    <span style={{ fontSize: 300, lineHeight: 1, fontFamily: UI }}>{emoji}</span>
                  </div>
                </div>
                <div dir={s.dir} style={{ position: 'absolute', top: 1260, width: '100%', textAlign: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 132, color: '#fff',
                  transform: `translateY(${(1 - inn) * 80 - out * 60}px)`, opacity: inn * Math.max(0, 1 - out * 3), textShadow: '0 10px 0 rgba(0,0,0,.12)' }}>
                  {label}
                </div>
              </AbsoluteFill>
            );
          })}
          <div style={{ position: 'absolute', top: 1500, width: '100%', display: 'flex', justifyContent: 'center', gap: 22 }}>
            {s.items.map((_, i) => (
              <div key={i} style={{ width: i === idx ? 64 : 22, height: 22, borderRadius: 11, background: i <= idx ? '#fff' : 'rgba(255,255,255,.35)' }} />
            ))}
          </div>
        </>
      )}
      {ended && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Burst at={END + 2} x={540} y={930} color={C.orange} r0={330} r1={520} n={14} width={18} />
          <div style={{ transform: `scale(${2.4 - 1.4 * stamp}) rotate(${-6 + (1 - stamp) * 10}deg)`, opacity: Math.min(1, stamp * 3) }}>
            <div dir={s.dir} style={{ padding: '30px 70px 44px', border: `14px solid ${C.orange}`, borderRadius: 50, fontFamily: DISPLAY, fontWeight: 700,
              fontSize: 132, color: '#fff', whiteSpace: 'nowrap', background: 'rgba(255,106,19,.12)' }}>
              {s.itemsEnd}
            </div>
          </div>
          <div style={{ position: 'absolute', top: 1180 }}>
            <Pop delay={END + 8} from={0}>
              <div style={{ width: 150, height: 150, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 96, fontFamily: UI, fontWeight: 800, boxShadow: '0 20px 50px rgba(18,183,106,.45)' }}>✓</div>
            </Pop>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
