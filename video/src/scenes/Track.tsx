import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { AppIcon, Pop, useHop } from '../components';
import { C, DISPLAY, UI } from '../theme';
import { Strings } from '../strings';

const XS = [300, 520, 740, 960, 1180];
const YS = [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900, 2100];
const ROUTE = 'M 520 1900 V 1500 H 740 V 900 H 960 V 700';
const DONE = 104;

const MapArt: React.FC = () => {
  const blocks: React.ReactNode[] = [];
  for (let xi = 0; xi < XS.length; xi++) {
    for (let yi = 0; yi < YS.length - 1; yi++) {
      const x0 = XS[xi] + 24, y0 = YS[yi] + 24, w = (xi < XS.length - 1 ? XS[xi + 1] : 1400) - XS[xi] - 48, h = YS[yi + 1] - YS[yi] - 48;
      const park = random(`park${xi}-${yi}`) < 0.12;
      if (park) {
        blocks.push(<rect key={`p${xi}-${yi}`} x={x0} y={y0} width={w} height={h} rx={18} fill="#CDEBC8" />);
        for (let t = 0; t < 6; t++) {
          blocks.push(<circle key={`t${xi}-${yi}-${t}`} cx={x0 + 30 + random(`tx${xi}${yi}${t}`) * (w - 60)} cy={y0 + 30 + random(`ty${xi}${yi}${t}`) * (h - 60)} r={16 + random(`tr${xi}${yi}${t}`) * 10} fill="#B3DFAC" />);
        }
        continue;
      }
      const n = 2 + Math.floor(random(`n${xi}-${yi}`) * 3);
      for (let b = 0; b < n; b++) {
        const bw = w / n - 14;
        blocks.push(<rect key={`b${xi}-${yi}-${b}`} x={x0 + b * (w / n) + 7} y={y0 + 8 + random(`by${xi}${yi}${b}`) * 20} width={bw} height={h - 30 - random(`bh${xi}${yi}${b}`) * 40} rx={10} fill="#E4E1DA" />);
      }
    }
  }
  return (
    <>
      <rect x="0" y="0" width="1400" height="2300" fill="#F3F1EC" />
      {blocks}
      {XS.map(x => <line key={`vx${x}`} x1={x} y1={0} x2={x} y2={2300} stroke="#E1DED6" strokeWidth={x === 740 ? 62 : 40} />)}
      {YS.map(y => <line key={`hy${y}`} x1={0} y1={y} x2={1400} y2={y} stroke="#E1DED6" strokeWidth={y === 1300 ? 56 : 40} />)}
      {XS.map(x => <line key={`vw${x}`} x1={x} y1={0} x2={x} y2={2300} stroke={x === 740 ? '#FFE3A6' : '#fff'} strokeWidth={x === 740 ? 52 : 30} />)}
      {YS.map(y => <line key={`hw${y}`} x1={0} y1={y} x2={1400} y2={y} stroke={y === 1300 ? '#FFE3A6' : '#fff'} strokeWidth={y === 1300 ? 46 : 30} />)}
      {/* La mer et la plage, côté ouest comme à Netanya */}
      <path d="M 0 0 H 205 C 250 300, 170 600, 215 900 S 180 1500, 225 1800 S 200 2200, 215 2300 H 0 Z" fill="#F4E2B6" />
      <path d="M 0 0 H 160 C 205 300, 125 600, 170 900 S 135 1500, 180 1800 S 155 2200, 170 2300 H 0 Z" fill="#9FD8F1" />
      <path d="M 40 300 q 30 -14 60 0 M 60 900 q 30 -14 60 0 M 30 1500 q 30 -14 60 0 M 70 2000 q 30 -14 60 0" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
    </>
  );
};

export const Track: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const len = getLength(ROUTE);
  const draw = interpolate(frame, [0, 26], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const p = interpolate(frame, [20, DONE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const pt = getPointAtLength(ROUTE, len * p) ?? { x: 0, y: 0 };
  const route = evolvePath(draw, ROUTE);
  const done = evolvePath(p, ROUTE);
  const cam = interpolate(frame, [0, 120], [1.08, 1.22]);
  const ty = interpolate(p, [0, 1], [-330, 330]);
  const pulse = (frame % 30) / 30;
  const eta = Math.max(1, Math.round(interpolate(frame, [12, DONE], [8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const arrived = useHop(DONE, 8, 0.5);
  const step = frame >= DONE ? 3 : frame >= 26 ? 2 : 1;
  const bar = interpolate(frame, [0, 26, DONE, DONE + 8], [0.33, 0.5, 0.86, 1], { extrapolateRight: 'clamp' });
  const bob = Math.sin(frame / 3) * 4;

  return (
    <AbsoluteFill style={{ background: '#F3F1EC', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${cam}) translateY(${ty}px)` }}>
        <svg width="1400" height="2300" viewBox="0 0 1400 2300" style={{ position: 'absolute', left: -160, top: -190, transform: 'rotate(-12deg)' }}>
          <MapArt />
          <path d={ROUTE} fill="none" stroke={C.navy} strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} strokeDasharray={route.strokeDasharray} strokeDashoffset={route.strokeDashoffset} />
          <path d={ROUTE} fill="none" stroke={C.orange} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={route.strokeDasharray} strokeDashoffset={route.strokeDashoffset} />
          <path d={ROUTE} fill="none" stroke={C.orangeDeep} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={done.strokeDasharray} strokeDashoffset={done.strokeDashoffset} />
          <g transform="translate(520 1900)">
            <circle r={44} fill="#fff" stroke={C.navy} strokeWidth={8} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={46} transform="rotate(12)">🏪</text>
          </g>
          <g transform="translate(960 700)">
            <circle r={60 + pulse * 90} fill={C.orange} opacity={0.35 * (1 - pulse)} />
            <g transform={`rotate(12) translate(0 ${-arrived * 18}) scale(${1 + arrived * 0.15})`}>
              <path d="M 0 0 C -16 -34, -62 -60, -62 -104 A 62 62 0 1 1 62 -104 C 62 -60, 16 -34, 0 0 Z" fill={C.orange} stroke="#fff" strokeWidth={8} />
              <text x={0} y={-104} textAnchor="middle" dominantBaseline="central" fontSize={56}>🏠</text>
            </g>
          </g>
          <g transform={`translate(${pt.x} ${pt.y}) rotate(12) translate(0 ${bob})`}>
            <ellipse cx={0} cy={58} rx={52} ry={12} fill="#000" opacity={0.15} />
            <circle r={66} fill="#fff" stroke={C.orange} strokeWidth={8} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={72} transform="scale(-1 1)">🛵</text>
          </g>
        </svg>
      </AbsoluteFill>

      <div style={{ position: 'absolute', left: 60, right: 60, top: 170 }}>
        <Pop delay={2} y={-80} from={0.8}>
          <div dir={s.dir} style={{ background: '#fff', borderRadius: 48, padding: '34px 40px', display: 'flex', alignItems: 'center', gap: 30, boxShadow: '0 30px 70px rgba(15,31,61,.22)' }}>
            <AppIcon size={120} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: UI, fontWeight: 800, fontSize: 26, color: '#E5484D', letterSpacing: s.dir === 'rtl' ? 0 : 3 }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, background: '#E5484D', opacity: frame % 20 < 12 ? 1 : 0.3 }} />{s.live}
              </div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 58, color: C.navy, marginTop: 4 }}>{s.track}</div>
              <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 40, color: frame >= DONE ? C.green : C.orange, marginTop: 4 }}>
                {frame >= DONE ? `✅ ${s.steps[3]}` : s.eta(eta)}
              </div>
            </div>
          </div>
        </Pop>
      </div>

      <div style={{ position: 'absolute', left: 60, right: 60, top: 1360 }}>
        <Pop delay={8} y={120} from={0.8}>
          <div dir={s.dir} style={{ background: C.navy, borderRadius: 44, padding: '34px 40px 30px', boxShadow: '0 30px 70px rgba(15,31,61,.35)' }}>
            <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 42, color: '#fff' }}>{s.enRoute}</div>
            <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'rgba(255,255,255,.18)', marginTop: 30 }}>
              <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${bar * 100}%`, borderRadius: 7, background: C.orange }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
              {s.steps.map((t, i) => (
                <span key={t} style={{ fontFamily: UI, fontWeight: i <= step ? 700 : 500, fontSize: 28, color: i <= step ? '#fff' : 'rgba(255,255,255,.45)' }}>{t}</span>
              ))}
            </div>
          </div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};
