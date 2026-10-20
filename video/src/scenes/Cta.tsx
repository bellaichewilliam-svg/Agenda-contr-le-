import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AppIcon, Bg, Confetti, Pop, Rays, useHop } from '../components';
import { C, DISPLAY, UI } from '../theme';
import { Strings } from '../strings';

export const Cta: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const icon = useHop(4, 9, 0.6);
  const arc = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const drop = useHop(18, 8, 0.5);
  const pulse = 1 + Math.max(0, Math.sin((frame - 66) / 5)) * 0.035 * (frame > 66 ? 1 : 0);
  const float = Math.sin(frame / 14) * 8;

  return (
    <AbsoluteFill>
      <Bg from={C.orangeLight} to={C.orangeDeep} glow="rgba(255,255,255,.2)" />
      <Rays opacity={0.1} speed={0.2} cy={500} />
      <Confetti at={4} x={540} y={480} seed="cta" n={80} />

      <div style={{ position: 'absolute', top: 210 + float, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${icon}) rotate(${(1 - icon) * -40}deg)`, borderRadius: 90, boxShadow: '0 40px 90px rgba(120,30,0,.45)' }}>
          <AppIcon size={380} arc={arc} drop={drop} />
        </div>
      </div>

      <div style={{ position: 'absolute', top: 640, width: '100%', display: 'flex', justifyContent: 'center', direction: 'ltr' }}>
        {'HOP!'.split('').map((ch, i) => (
          <Pop key={i} delay={24 + i * 4} y={120} from={0.2} rotate={i % 2 ? 10 : -10}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 250, lineHeight: 1, color: '#fff', textShadow: `0 16px 0 ${C.orangeInk}`, display: 'inline-block' }}>{ch}</span>
          </Pop>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 905, width: '100%', textAlign: 'center' }}>
        <Pop delay={40}>
          <div dir={s.dir} style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 76, color: C.navy }}>{s.tagline}</div>
          <div dir={s.dir === 'rtl' ? 'ltr' : 'rtl'} style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 52, color: 'rgba(255,255,255,.9)', marginTop: 6 }}>{s.brandOther}</div>
        </Pop>
      </div>

      <div style={{ position: 'absolute', top: 1140, left: 90, right: 90 }}>
        <Pop delay={54} y={90}>
          <div dir={s.dir} style={{ transform: `scale(${pulse})`, background: '#fff', borderRadius: 48, padding: '36px 40px', textAlign: 'center', boxShadow: '0 30px 70px rgba(120,30,0,.35)' }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 64, color: C.navy, whiteSpace: 'nowrap' }}>{s.promo}</div>
            <div style={{ display: 'inline-block', marginTop: 16, padding: '12px 30px', borderRadius: 999, border: `4px dashed ${C.orange}`, fontFamily: UI, fontWeight: 800, fontSize: 40,
              color: C.orangeDeep, letterSpacing: 2 }}>{s.code}</div>
          </div>
        </Pop>
      </div>

      <div style={{ position: 'absolute', top: 1450, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Pop delay={64} y={60}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: C.navy, color: '#fff', padding: '28px 48px', borderRadius: 999, fontFamily: UI, fontWeight: 700,
            fontSize: 50, boxShadow: '0 20px 50px rgba(15,31,61,.4)' }}>
            <span style={{ fontSize: 46 }}>👉</span>{s.url}
          </div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};
