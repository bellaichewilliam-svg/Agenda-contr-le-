import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { AppIcon, Pop, Words, useHop } from '../components';
import { C, DISPLAY, UI } from '../theme';
import { Strings } from '../strings';

const typed = (text: string, frame: number, a: number, b: number) =>
  text.slice(0, Math.round(interpolate(frame, [a, b], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));

const Field: React.FC<{ label: string; icon: string; value: string; focused: boolean; caret: boolean }> = ({ label, icon, value, focused, caret }) => (
  <div style={{ marginBottom: 26 }}>
    <div style={{ fontFamily: UI, fontWeight: 500, fontSize: 28, color: C.muted, marginBottom: 10 }}>{label}</div>
    <div style={{ height: 96, borderRadius: 24, border: `4px solid ${focused ? C.orange : C.border}`, background: focused ? '#FFFAF6' : '#fff',
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', fontFamily: UI, fontSize: 36, fontWeight: 500, color: C.ink,
      boxShadow: focused ? '0 0 0 8px rgba(255,106,19,.14)' : 'none' }}>
      <span style={{ fontSize: 36 }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
      {caret && <span style={{ width: 4, height: 44, background: C.orange, borderRadius: 2, marginInlineStart: -10 }} />}
    </div>
  </div>
);

export const Order: React.FC<{ s: Strings }> = ({ s }) => {
  const frame = useCurrentFrame();
  const enter = useHop(4, 13, 0.8);
  const blink = Math.floor(frame / 8) % 2 === 0;
  const from = typed(s.fromVal, frame, 26, 56);
  const to = typed(s.toVal, frame, 64, 90);
  const f1 = frame >= 20 && frame < 60;
  const f2 = frame >= 60 && frame < 95;
  const finger = interpolate(frame, [104, 119], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const press = frame >= 121 && frame < 128 ? 0.94 : 1;
  const ripple = interpolate(frame, [121, 136], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const toast = useHop(128, 12, 0.6);
  const float = Math.sin(frame / 18) * 1.2;
  const rtl = s.dir === 'rtl';

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.cream} 0%, #fff 70%)` }}>
      <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: -380, top: 700, background: 'radial-gradient(circle, rgba(255,106,19,.22), transparent 65%)' }} />
      <div style={{ position: 'absolute', width: 800, height: 800, borderRadius: '50%', left: 650, top: 200, background: 'radial-gradient(circle, rgba(255,138,61,.25), transparent 65%)' }} />

      <div style={{ position: 'absolute', top: 120, width: '100%' }}>
        <Words text={s.order1} size={124} color={C.navy} dir={s.dir} delay={2} />
        <Words text={s.order2} size={100} color={C.orange} dir={s.dir} delay={8} step={3} />
      </div>

      <div style={{ position: 'absolute', left: 180, top: 470, width: 720, height: 1400, transform: `translateY(${(1 - enter) * 1300}px) rotate(${(1 - enter) * -12 + float}deg)`,
        borderRadius: 96, background: '#0B0F19', padding: 22, boxShadow: '0 60px 120px rgba(15,31,61,.35), inset 0 0 0 4px #2A3142' }}>
        <div dir={s.dir} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 76, background: C.bg, overflow: 'hidden', padding: '0 40px' }}>
          <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 210, height: 58, borderRadius: 30, background: '#0B0F19' }} />
          <div dir="ltr" style={{ display: 'flex', justifyContent: 'space-between', padding: '30px 34px 0', fontFamily: UI, fontWeight: 700, fontSize: 28, color: C.ink }}>
            <span>9:41</span><span>●●● ▮</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 46 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <AppIcon size={84} />
              <span dir="ltr" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 60, color: C.navy }}>HOP!</span>
            </div>
            <span style={{ fontFamily: UI, fontWeight: 700, fontSize: 26, color: C.muted, padding: '12px 20px', borderRadius: 999, background: '#fff', border: `2px solid ${C.border}` }}>{s.langSwitch}</span>
          </div>

          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 58, color: C.navy, marginTop: 36, lineHeight: 1.1 }}>
            {s.hook1} <span style={{ color: C.orange }}>{s.hook2}</span>
          </div>

          <div style={{ marginTop: 34, background: '#fff', borderRadius: 44, padding: 36, boxShadow: '0 20px 50px rgba(15,31,61,.10)', border: `2px solid ${C.border}` }}>
            <Field label={s.from} icon="📍" value={from} focused={f1} caret={f1 && blink} />
            <Field label={s.to} icon="🏁" value={to} focused={f2} caret={f2 && blink} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px dashed ${C.border}`, paddingTop: 22, marginTop: 6, height: 100 }}>
              <span style={{ fontFamily: UI, fontWeight: 500, fontSize: 32, color: C.muted }}>{s.priceLabel}</span>
              {frame >= 94 && (
                <Pop delay={96} from={0.2} y={10} rotate={-12}>
                  <span dir="ltr" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 76, color: C.orange }}>25 ₪</span>
                </Pop>
              )}
            </div>
            <div style={{ position: 'relative', marginTop: 22, height: 116, borderRadius: 32, background: `linear-gradient(180deg, ${C.orangeLight}, ${C.orange})`, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, fontWeight: 800, fontSize: 40, transform: `scale(${press})`,
              boxShadow: '0 16px 30px rgba(255,106,19,.35)', overflow: 'hidden' }}>
              {s.cta}
              {ripple > 0 && ripple < 1 && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 900 * ripple, height: 900 * ripple, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,255,255,.35)', opacity: 1 - ripple }} />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 30, flexWrap: 'wrap' }}>
            {[s.priceChips[1], `📍 ${s.track}`].map(t => (
              <span key={t} style={{ fontFamily: UI, fontWeight: 500, fontSize: 28, color: C.navy, background: '#fff', border: `2px solid ${C.border}`, padding: '14px 22px', borderRadius: 999 }}>{t}</span>
            ))}
          </div>

          <div style={{ position: 'absolute', left: 30, right: 30, top: 100, transform: `translateY(${(1 - toast) * -260}px)`, opacity: frame >= 128 ? 1 : 0,
            background: '#fff', borderRadius: 34, padding: '28px 34px', boxShadow: '0 26px 60px rgba(15,31,61,.25)', borderInlineStart: `14px solid ${C.green}` }}>
            <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 40, color: C.ink }}>{s.sent}</div>
            <div style={{ fontFamily: UI, fontWeight: 500, fontSize: 30, color: C.muted, marginTop: 6 }}>🛵 {s.sentSub}</div>
          </div>
        </div>
      </div>

      {finger > 0 && frame < 140 && (
        <div style={{ position: 'absolute', left: interpolate(finger, [0, 1], [rtl ? 160 : 940, 540]), top: interpolate(finger, [0, 1], [1800, 1366]),
          width: 120, height: 120, borderRadius: '50%', transform: `translate(-50%,-50%) scale(${frame >= 121 && frame < 127 ? 0.82 : 1})`,
          background: 'rgba(255,255,255,.55)', border: '6px solid rgba(15,31,61,.35)', boxShadow: '0 10px 30px rgba(0,0,0,.25)',
          opacity: interpolate(frame, [104, 110, 132, 140], [0, 1, 1, 0]) }} />
      )}
    </AbsoluteFill>
  );
};
