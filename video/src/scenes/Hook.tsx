import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { Bg, Burst, Dots, Parcel, Pop, Words, useHop } from '../components';
import { C, DISPLAY, UI } from '../theme';
import { Strings } from '../strings';

const ARC = 'M 120 1060 C 230 470, 690 250, 900 560';
const LAND = 34;

export const Hook: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const len = getLength(ARC);
  const p = interpolate(frame, [3, LAND], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const pt = getPointAtLength(ARC, len * p) ?? { x: 0, y: 0 };
  const reveal = evolvePath(p, ARC);
  const land = useHop(LAND, 7, 0.5);
  const squash = frame >= LAND ? 1 - Math.sin(Math.min(1, land) * Math.PI) * 0.18 : 1;
  const bob = frame > LAND + 12 ? Math.sin((frame - LAND) / 7) * 10 : 0;
  const rot = interpolate(p, [0, 1], [-260, -14]);
  const pill = useHop(46, 14, 0.7);
  const cam = 1 + frame * 0.0009;
  const rtl = s.dir === 'rtl';

  return (
    <AbsoluteFill>
      <Bg from={C.navy2} to={C.navy} />
      <Dots />
      <AbsoluteFill style={{ transform: `scale(${cam})` }}>
        <div style={{ position: 'absolute', top: 210, width: '100%', textAlign: 'center', fontFamily: UI, fontWeight: 700, fontSize: 38,
          letterSpacing: rtl ? 2 : 10, color: C.peach, opacity: interpolate(frame, [6, 18], [0, 1], { extrapolateRight: 'clamp' }) }}>
          {s.city}
        </div>

        <svg width="1080" height="1920" style={{ position: 'absolute', transform: rtl ? 'scaleX(-1)' : undefined }}>
          <defs>
            <mask id="hookArc">
              <path d={ARC} fill="none" stroke="#fff" strokeWidth="70" strokeLinecap="round" strokeDasharray={reveal.strokeDasharray} strokeDashoffset={reveal.strokeDashoffset} />
            </mask>
          </defs>
          <path d={ARC} fill="none" stroke="#fff" strokeWidth="26" strokeLinecap="round" strokeDasharray="0 54" mask="url(#hookArc)" opacity=".92" />
          <ellipse cx={900} cy={705} rx={150 * Math.min(1, p * 1.2)} ry={26} fill="#000" opacity={0.25 * p} />
        </svg>

        <div style={{ position: 'absolute', left: rtl ? 1080 - pt.x : pt.x, top: pt.y + bob, transform: `translate(-50%, -50%) rotate(${rtl ? -rot : rot}deg) scale(${1 / squash}, ${squash})`,
          transformOrigin: '50% 80%', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.35))' }}>
          <Parcel size={290} />
        </div>
        <Burst at={LAND} x={rtl ? 180 : 900} y={560} color={C.orangeLight} r0={190} r1={330} n={12} />

        <div style={{ position: 'absolute', top: 1060, width: '100%' }}>
          <Words text={s.hook1} delay={38} size={220} dir={s.dir} />
        </div>
        <div style={{ position: 'absolute', top: 1330, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', padding: '18px 56px 30px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 40, background: C.orange, transform: `scaleX(${pill}) rotate(-3deg)`,
              transformOrigin: rtl ? '100% 50%' : '0% 50%', boxShadow: '0 24px 60px rgba(255,106,19,.45)' }} />
            <Pop delay={50} y={40} from={0.6}>
              <div dir={s.dir} style={{ position: 'relative', fontFamily: DISPLAY, fontWeight: 700, fontSize: 150, color: '#fff', whiteSpace: 'nowrap', transform: 'rotate(-3deg)' }}>
                {s.hook2}
              </div>
            </Pop>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
