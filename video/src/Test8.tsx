import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { HoppyHop } from './HoppyHop';

// Essai « La pluie de courses » (8 s, demande du patron 09/11) : les courses tombent du ciel dans le sac HOP!,
// Hoppy arrive, écran de fin. Version brouillon avec les pictos de l'appli (public/test8/*.webp) : les photos
// Gemini (même noms de fichiers dans public/test8/) les remplaceront telles quelles.
export const TEST8_FRAMES = 240;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const NAVY = '#0F1F3D', ORANGE = '#FF6A13';
const ITEMS = [
  { f: 'cupstraw', x: -40, r: -18, s: 250 },
  { f: 'milk', x: 60, r: 14, s: 240 },
  { f: 'baguette', x: -10, r: -30, s: 300 },
  { f: 'apple', x: 70, r: 22, s: 210 },
  { f: 'chocolate', x: -70, r: -12, s: 230 },
  { f: 'egg', x: 30, r: 10, s: 220 },
  { f: 'juice', x: -20, r: -8, s: 240 },
];
const T0 = 1.3, STEP = 0.42, FALL = 0.55;
const TXT = {
  fr: { h1: 'Toutes vos courses', h2: 'Livrées chez vous', price: 'dès 25 ₪ en ville', dir: 'ltr' as const },
  he: { h1: 'כל הקניות שלכם', h2: 'עד הבית', price: 'החל מ־25 ₪ בעיר', dir: 'rtl' as const },
};

export const Test8: React.FC<{ lang: 'fr' | 'he'; music?: boolean }> = ({ lang, music = true }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const L = TXT[lang];
  const BX = 410, BY = 1180, BW = 520, BH = 470; // le sac : centre, largeur, hauteur
  // Arrivée du sac (rebond) et petit balancement 3D
  const inS = spring({ frame: f - 4, fps, config: { damping: 11, mass: 0.7 } });
  const turn = Math.sin(t * 1.6) * 7 * interpolate(t, [0, 1.2], [1, 0.35], clamp);
  // Chaque produit qui tombe tasse un peu le sac
  let squash = 0;
  ITEMS.forEach((_, i) => { const tl = T0 + i * STEP + FALL; const d = t - tl; if (d > 0 && d < 0.35) squash = Math.max(squash, Math.sin((d / 0.35) * Math.PI) * 0.06); });
  const close = interpolate(t, [5.6, 6.0], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // Caméra : léger zoom avant tout du long
  const cam = interpolate(t, [0, 8], [1, 1.08], clamp);
  // Lumière qui glisse sur le sac
  const sweep = interpolate(t, [0.6, 1.6], [-0.4, 1.4], clamp);
  const end = interpolate(t, [6.4, 6.9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const h1 = spring({ frame: f - Math.round(1.5 * fps), fps, config: { damping: 13 } });
  const endS = spring({ frame: f - Math.round(6.6 * fps), fps, config: { damping: 10, mass: 0.6 } });

  const bag = (front: boolean) => (
    <div style={{ position: 'absolute', left: BX - BW / 2, top: BY - BH / 2, width: BW, height: BH,
      transform: `perspective(1400px) rotateY(${turn}deg) scale(${inS * (1 + squash * 0.6)}, ${inS * (1 - squash)})`, transformOrigin: '50% 100%' }}>
      {front ? (
        <>
          <div style={{ position: 'absolute', inset: '70px 0 0 0', borderRadius: 46, background: 'linear-gradient(160deg, #1D3563 0%, #16284A 55%, #0E1C38 100%)',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,.12), 0 40px 70px rgba(0,0,0,.45)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', left: `${sweep * 100}%`, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)', transform: 'skewX(-18deg)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: 'Fredoka', fontWeight: 700, fontSize: 150, color: '#fff', letterSpacing: -2 }}>
              HOP<span style={{ color: ORANGE }}>!</span>
            </div>
            <div style={{ position: 'absolute', left: 40, right: 40, bottom: 34, height: 10, borderRadius: 6, background: ORANGE, opacity: 0.9 }} />
          </div>
          {/* Rabat qui se ferme à la fin */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 70, height: 90, borderRadius: '46px 46px 18px 18px', background: '#22407A',
            transformOrigin: '50% 0%', transform: `perspective(900px) rotateX(${(1 - close) * 100}deg)`, opacity: close > 0 ? 1 : 0, boxShadow: '0 6px 18px rgba(0,0,0,.35)' }} />
        </>
      ) : (
        <div style={{ position: 'absolute', left: 14, right: 14, top: 30, height: 120, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 60%, #050C1C 0%, #0B1830 70%)', boxShadow: 'inset 0 -6px 0 #22407A' }} />
      )}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 38%, #1B3466 0%, ${NAVY} 48%, #081226 100%)`, overflow: 'hidden' }}>
      {music && <Audio src={staticFile('tout-music.wav')} volume={v => interpolate(v, [0, 10, TEST8_FRAMES - 25, TEST8_FRAMES], [0, 0.9, 0.9, 0], clamp)} />}
      {/* Petites étoiles qui scintillent */}
      {Array.from({ length: 26 }, (_, i) => { const x = (i * 397) % 1080, y = (i * 613) % 1100 + 60, o = 0.15 + 0.35 * Math.abs(Math.sin(t * 2 + i));
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 6, height: 6, borderRadius: 3, background: '#fff', opacity: o }} />; })}
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: '45% 60%' }}>
        {/* Ombre au sol */}
        <div style={{ position: 'absolute', left: BX - 260, top: BY + BH / 2 - 20, width: 520, height: 60, borderRadius: '50%', background: 'rgba(0,0,0,.4)', filter: 'blur(18px)', opacity: inS }} />
        {bag(false)}
        {/* Les courses tombent dans le sac (derrière la face avant) */}
        {ITEMS.map((it, i) => {
          const t0 = T0 + i * STEP, k = interpolate(t, [t0, t0 + FALL], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
          if (t < t0) return null;
          const y = interpolate(k, [0, 1], [-360, BY - BH / 2 + 40]);
          const sink = interpolate(t, [t0 + FALL, t0 + FALL + 0.3], [0, 90], clamp);
          const blur = k < 1 ? 6 * k : 0;
          return <Img key={it.f} src={staticFile(`test8/${it.f}.webp`)} style={{ position: 'absolute', left: BX + it.x - it.s / 2, top: y + sink - it.s / 2, width: it.s, height: it.s,
            transform: `rotate(${it.r * (1 - k * 0.6)}deg)`, filter: `blur(${blur}px) drop-shadow(0 18px 24px rgba(0,0,0,.35))`, opacity: interpolate(sink, [60, 90], [1, 0], clamp) }} />;
        })}
        {bag(true)}
        {/* Hoppy arrive en sautant à droite du sac */}
        <HoppyHop x={830} bottom={1520} h={600} at={4.9} from="right" />
      </AbsoluteFill>
      {/* Gros titre */}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 230, textAlign: 'center', direction: L.dir, fontFamily: lang === 'he' ? 'Rubik' : 'Fredoka', fontWeight: lang === 'he' ? 800 : 700,
        fontSize: lang === 'he' ? 104 : 112, lineHeight: 1.02, color: '#fff', transform: `translateY(${(1 - h1) * 60}px)`, opacity: h1 * (1 - end), textShadow: '0 8px 30px rgba(0,0,0,.35)' }}>
        {L.h1}
      </div>
      {/* Écran de fin */}
      <AbsoluteFill style={{ background: NAVY, opacity: end, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
        <div style={{ fontFamily: 'Fredoka', fontWeight: 700, fontSize: 260, color: '#fff', letterSpacing: -4, transform: `scale(${0.6 + 0.4 * endS})`, direction: 'ltr' }}>HOP<span style={{ color: ORANGE }}>!</span></div>
        <div style={{ direction: L.dir, fontFamily: lang === 'he' ? 'Rubik' : 'Fredoka', fontWeight: 700, fontSize: 84, color: '#fff', opacity: endS }}>{L.h2}</div>
        <div style={{ direction: L.dir, padding: '14px 36px', borderRadius: 999, background: ORANGE, fontFamily: 'Rubik', fontWeight: 800, fontSize: 60, color: '#fff', opacity: endS, transform: `translateY(${(1 - endS) * 40}px)` }}>{L.price}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
