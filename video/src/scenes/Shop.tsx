import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Bg, Burst, Dots, Pop, Words, useHop } from '../components';
import { C, DISPLAY, UI } from '../theme';
import { Strings } from '../strings';

const ZERO = 18;
const NOTIF = 60;
const TAP = 92;

export const Shop: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const zero = useHop(ZERO, 7, 0.6);
  const notif = useHop(NOTIF, 13, 0.7);
  const ok = frame >= TAP;
  const tap = frame >= TAP && frame < TAP + 6 ? 0.92 : 1;
  const glow = 0.45 + Math.sin(frame / 6) * 0.15;
  const rtl = s.dir === 'rtl';

  return (
    <AbsoluteFill>
      <Bg from={C.navy2} to={C.navy} />
      <Dots opacity={0.06} />
      <div style={{ position: 'absolute', top: 200, width: '100%' }}>
        <Words text={s.shopKicker} size={104} color={C.orange} dir={s.dir} delay={2} />
      </div>
      <div style={{ position: 'absolute', top: 330, width: '100%', display: 'flex', justifyContent: 'center', direction: 'ltr' }}>
        <div style={{ transform: `scale(${0.2 + 0.8 * zero}) rotate(${(1 - zero) * -25}deg)`, opacity: Math.min(1, zero * 2), fontFamily: DISPLAY, fontWeight: 700,
          fontSize: 470, lineHeight: 1, color: '#fff', textShadow: `0 0 80px rgba(255,106,19,${glow}), 0 20px 0 ${C.orangeDeep}` }}>
          0<span style={{ fontSize: 300 }}>%</span>
        </div>
      </div>
      <Burst at={ZERO + 2} x={540} y={560} color={C.orange} r0={300} r1={470} n={14} />
      <div style={{ position: 'absolute', top: 830, left: 70, right: 70 }}>
        <Words text={s.shopLine} size={96} dir={s.dir} delay={26} step={3} />
      </div>
      <div dir={s.dir} style={{ position: 'absolute', top: 1090, left: 90, right: 90, textAlign: 'center', fontFamily: UI, fontWeight: 500, fontSize: 44, lineHeight: 1.35, color: '#C9D3E6',
        opacity: interpolate(frame, [40, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        {s.shopSub}
      </div>

      <div style={{ position: 'absolute', left: 70, right: 70, top: 1290, transform: `translateX(${(1 - notif) * (rtl ? -1100 : 1100)}px) rotate(${(1 - notif) * 8}deg)` }}>
        <div dir={s.dir} style={{ background: '#fff', borderRadius: 44, padding: '30px 34px', display: 'flex', alignItems: 'center', gap: 26, boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
          <div style={{ width: 110, height: 110, borderRadius: 30, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🥙</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 40, color: C.ink }}>{s.notif}</div>
            <div style={{ fontFamily: UI, fontWeight: 500, fontSize: 32, color: C.muted, marginTop: 6 }}>{s.notifSub}</div>
          </div>
          <div style={{ transform: `scale(${tap})`, padding: '24px 30px', borderRadius: 26, background: ok ? C.greenSoft : C.green, color: ok ? '#067647' : '#fff',
            fontFamily: UI, fontWeight: 800, fontSize: 34, whiteSpace: 'nowrap' }}>
            {ok ? s.accepted : s.accept}
          </div>
        </div>
      </div>
      {ok && (
        <div style={{ position: 'absolute', top: 1500, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Pop delay={TAP + 2} from={0.5}>
            <div dir={s.dir} style={{ fontFamily: UI, fontWeight: 700, fontSize: 36, color: C.peach }}>🛵 → 🏠</div>
          </Pop>
        </div>
      )}
    </AbsoluteFill>
  );
};
