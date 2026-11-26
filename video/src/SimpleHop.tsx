// « C'est aussi simple que ça avec HOP! » : le clip Gemini du patron (10 s, livreur qui sort du panneau) tel quel,
// puis un rond bleu nuit qui s'ouvre depuis le sac, et le carton de fin : phrase + logo HOP! qui tombe lettre par lettre.
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import './fonts';
import { Wordmark } from './Reel';
import { C, UI } from './theme';

export const SIMPLEHOP_FRAMES = 405; // 10 s de clip + 3,5 s de fin
const CLIP = 300, OPEN = 282;
const NAVY = '#0F1F3D';
const STR = {
  fr: { a: "C'est aussi simple", b: 'que ça.', c: 'avec', url: 'hop-livraison.vercel.app', dir: 'ltr' as const },
  he: { a: 'ככה זה פשוט.', b: '', c: 'עם', url: 'hop-livraison.vercel.app', dir: 'rtl' as const },
};

export const SimpleHop: React.FC<{ lang?: 'fr' | 'he' }> = ({ lang = 'fr' }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), s = STR[lang];
  // Rond bleu nuit qui part du sac (bas de l'image) et couvre tout
  const r = interpolate(f, [OPEN, OPEN + 20], [0, 2300], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const push = interpolate(f, [OPEN - 10, OPEN + 20], [1, 1.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const clipVol = (fr: number) => interpolate(fr, [OPEN, CLIP], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sp = (at: number, cfg = { damping: 13, stiffness: 140, mass: 0.8 }) => spring({ frame: f - at, fps, config: cfg });
  const letter = (i: number) => {
    const k = sp(304 + i * 3, { damping: 11, stiffness: 170, mass: 0.7 });
    return { y: (1 - k) * -420, s: 0.6 + 0.4 * k, r: (1 - k) * (i % 2 ? 14 : -14), o: Math.min(1, k * 2) };
  };
  const l1 = sp(296), l2 = sp(300), wordIn = sp(312), urlIn = sp(334);
  const bang = interpolate(f, [318, 326, 340], [1, 1.25, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const end = interpolate(f, [SIMPLEHOP_FRAMES - 12, SIMPLEHOP_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line = (k: number, txt: string, size: number, weight: number, color = '#fff') => (
    <div style={{ font: `${weight} ${size}px/1.08 ${UI}`, color, opacity: k, transform: `translateY(${(1 - k) * 40}px)`, letterSpacing: lang === 'he' ? 0 : '-0.02em', direction: s.dir }}>{txt}</div>
  );
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence durationInFrames={CLIP}>
        <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 78%' }}>
          <OffthreadVideo src={staticFile('simple-hop-clip.mp4')} volume={clipVol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      </Sequence>
      <AbsoluteFill style={{ clipPath: `circle(${r}px at 50% 78%)`, background: NAVY }}>
        <AbsoluteFill style={{ opacity: end, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 0 }}>
          <div style={{ marginTop: -40 }}>
            {line(l1, s.a, 104, 800)}
            {s.b ? line(l2, s.b, 104, 800) : null}
            <div style={{ height: 70 }} />
            {line(wordIn, s.c, 62, 500, 'rgba(255,255,255,.72)')}
            <div style={{ height: 28 }} />
            <div style={{ display: 'flex', justifyContent: 'center', direction: 'ltr' }}>
              <Wordmark width={720} anim={i => (i === 3 ? { ...letter(i), s: letter(i).s * bang } : letter(i))} bang={C.orange} />
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 210, opacity: urlIn, transform: `translateY(${(1 - urlIn) * 24}px)`, font: `600 40px/1 ${UI}`, color: '#fff',
            background: 'rgba(255,255,255,.1)', padding: '18px 34px', borderRadius: 999, direction: 'ltr' }}>{s.url}</div>
        </AbsoluteFill>
      </AbsoluteFill>
      <Audio src={staticFile('simplehop-sfx.wav')} />
    </AbsoluteFill>
  );
};
