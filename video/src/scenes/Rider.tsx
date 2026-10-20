import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { Chip, Pop, Words } from '../components';
import { C, UI } from '../theme';
import { Strings } from '../strings';

export const Rider: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const rtl = s.dir === 'rtl';
  const drive = interpolate(frame, [0, 26], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4)) });
  const x = interpolate(drive, [0, 1], [-520, 0]) * (rtl ? -1 : 1);
  const bob = Math.sin(frame / 2.5) * 6;
  const speed = interpolate(frame, [0, 30, 60], [1, 0.35, 0.25], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #fff 0%, ${C.cream} 100%)`, overflow: 'hidden' }}>
      {/* Lignes de vitesse */}
      {Array.from({ length: 14 }).map((_, i) => {
        const y = 560 + random(`ly${i}`) * 520;
        const w = 160 + random(`lw${i}`) * 320;
        const v = 40 + random(`lv${i}`) * 50;
        const pos = ((random(`lx${i}`) * 1600 + frame * v * speed) % 1800) - 300;
        return <div key={i} style={{ position: 'absolute', top: y, [rtl ? 'right' : 'left']: 1080 - pos, width: w, height: 12, borderRadius: 6,
          background: i % 3 ? 'rgba(255,106,19,.25)' : 'rgba(15,31,61,.12)' }} />;
      })}
      <div style={{ position: 'absolute', top: 210, width: '100%' }}>
        <Words text={s.riderKicker} size={104} color={C.orange} dir={s.dir} delay={2} />
        <Words text={s.riderBig} size={136} color={C.navy} dir={s.dir} delay={8} step={4} />
      </div>
      <div style={{ position: 'absolute', top: 620, width: '100%', display: 'flex', justifyContent: 'center', transform: `translateX(${x}px)` }}>
        <div style={{ transform: `translateY(${bob}px) rotate(${(1 - drive) * -6}deg) ${rtl ? '' : 'scaleX(-1)'}`, fontSize: 380, lineHeight: 1, fontFamily: UI,
          filter: 'drop-shadow(0 30px 30px rgba(15,31,61,.25))' }}>🛵</div>
      </div>
      <div style={{ position: 'absolute', top: 1060, left: 330, width: 420, height: 40, borderRadius: '50%', background: 'rgba(15,31,61,.12)', filter: 'blur(6px)' }} />
      <div dir={s.dir} style={{ position: 'absolute', top: 1160, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {s.riderChips.map((t, i) => (
          <Pop key={t} delay={34 + i * 8} y={70} rotate={i % 2 ? 4 : -4}>
            <Chip size={48} bg={i === 1 ? C.orange : C.navy} color="#fff">{t}</Chip>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  );
};
