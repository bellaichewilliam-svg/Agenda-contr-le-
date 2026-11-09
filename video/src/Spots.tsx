import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { HoppyHop } from './HoppyHop';

// Spots courts (5–6 s) faits avec les images Gemini du patron (09/11) : public/spot/*.webp (objets détourés),
// public/spot/*.jpg (décor et effets de lumière, fond noir → mélange « screen »). FR + HE.
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const NAVY = '#0F1F3D', ORANGE = '#FF6A13';
// largeur / hauteur de chaque image détourée (pour les poser à une hauteur donnée)
const AR: Record<string, number> = { 'baguette-a': 0.37, 'baguette-b': 0.58, 'baguette-c': 0.345, 'chips-a': 0.598, 'chips-b': 0.433, 'chips-c': 0.6, 'lait-a': 0.475, 'lait-b': 0.541, 'lait-c': 0.532, 'pommes-a': 0.913, 'pommes-b': 1.035, 'pommes-c': 0.888, 'sac-000': 0.779, 'sac-045': 0.837, 'sac-090': 0.57, 'sac-135': 0.765, 'sac-180': 0.757, 'sac-225': 0.769, 'sac-270': 0.611, 'sac-315': 0.803, 'sac-dessus': 0.882, 'sac-ferme': 1.137, 'soda-000': 0.294, 'soda-045': 0.311, 'soda-090': 0.315, 'soda-135': 0.319, 'soda-180': 0.31, 'soda-225': 0.316, 'soda-270': 0.31, 'soda-315': 0.298 };
type Lang = 'fr' | 'he';
const font = (lang: Lang) => (lang === 'he' ? 'Rubik' : 'Fredoka');

// Le décor : le studio bleu nuit de Gemini, un léger zoom, les bulles de lumière qui dérivent, un vignettage
const Stage: React.FC<{ zoom?: [number, number]; bokeh?: number; children?: React.ReactNode }> = ({ zoom = [1.04, 1.12], bokeh = 0.22, children }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig();
  const z = interpolate(f, [0, durationInFrames], zoom);
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden' }}>
      <Img src={staticFile('spot/studio.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, transformOrigin: '50% 62%' }} />
      <Img src={staticFile('spot/bokeh.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen', opacity: bokeh, filter: 'blur(6px)',
        transform: `translateY(${-f * 0.6}px) scale(1.15)` }} />
      {children}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.55) 100%)', pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
// Un effet de lumière (fond noir) posé par-dessus en mélange « screen »
const Fx: React.FC<{ src: string; opacity: number; style?: React.CSSProperties }> = ({ src, opacity, style }) =>
  opacity <= 0.001 ? null : <Img src={staticFile(`spot/${src}`)} style={{ position: 'absolute', mixBlendMode: 'screen', opacity, ...style }} />;
// Un objet posé sur le sol, avec son ombre et son reflet
const OnFloor: React.FC<{ name: string; cx: number; floor: number; h: number; opacity?: number; sx?: number; refl?: number }> = ({ name, cx, floor, h, opacity = 1, sx = 1, refl = 0.22 }) => {
  const w = h * (AR[name] || 0.8);
  const img = staticFile(`spot/${name}.webp`);
  return (
    <>
      <Img src={img} style={{ position: 'absolute', left: cx - w / 2, top: floor, width: w, height: h, opacity: opacity * refl, transform: `scale(${sx}, -1)`, transformOrigin: '50% 0%',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,.9), transparent 45%)', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.9), transparent 45%)', filter: 'blur(2px)' }} />
      <Img src={img} style={{ position: 'absolute', left: cx - w / 2, top: floor - h, width: w, height: h, opacity, transform: `scaleX(${sx})`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.45))' }} />
    </>
  );
};
const Title: React.FC<{ lang: Lang; lines: string[]; at: number; top: number; size?: number; out?: number }> = ({ lang, lines, at, top, size = 104, out }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top, textAlign: 'center', direction: lang === 'he' ? 'rtl' : 'ltr' }}>
      {lines.map((l, i) => {
        const s = spring({ frame: f - Math.round((at + i * 0.18) * fps), fps, config: { damping: 14, mass: 0.7 } });
        const o = out != null ? interpolate(f / fps, [out, out + 0.3], [1, 0], clamp) : 1;
        return <div key={i} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: size, lineHeight: 1.05, color: i === lines.length - 1 ? ORANGE : '#fff',
          opacity: s * o, transform: `translateY(${(1 - s) * 50}px)`, textShadow: '0 10px 34px rgba(0,0,0,.5)' }}>{l}</div>;
      })}
    </div>
  );
};
const PriceChip: React.FC<{ lang: Lang; text: string; at: number; top: number }> = ({ lang, text, at, top }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f - Math.round(at * fps), fps, config: { damping: 9, mass: 0.6 } });
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center' }}>
    <div style={{ direction: lang === 'he' ? 'rtl' : 'ltr', padding: '16px 40px', borderRadius: 999, background: ORANGE, color: '#fff', fontFamily: 'Rubik', fontWeight: 800, fontSize: 58,
      transform: `scale(${s})`, boxShadow: '0 14px 40px rgba(255,106,19,.45)' }}>{text}</div></div>;
};
const Logo: React.FC<{ at: number; top: number; size?: number }> = ({ at, top, size = 150 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f - Math.round(at * fps), fps, config: { damping: 11 } });
  return <div style={{ position: 'absolute', left: 0, right: 0, top, textAlign: 'center', direction: 'ltr', fontFamily: 'Fredoka', fontWeight: 700, fontSize: size, color: '#fff', letterSpacing: -2,
    opacity: s, transform: `scale(${0.7 + 0.3 * s})`, textShadow: '0 8px 30px rgba(0,0,0,.45)' }}>HOP<span style={{ color: ORANGE }}>!</span></div>;
};
const Music: React.FC<{ frames: number }> = ({ frames }) =>
  <Audio src={staticFile('lancement-music.wav')} volume={v => interpolate(v, [0, 6, frames - 18, frames], [0, 0.95, 0.95, 0], clamp)} />;

const TXT = {
  fr: { sac: ['Toutes vos courses,', 'livrées chez vous'], price: 'dès 25 ₪ en ville', soda: ['Bien frais,', 'livré chez vous'], soPrice: '≈ 9 ₪', pluie: ['Faites vos courses,', 'on y va pour vous'] },
  he: { sac: ['כל הקניות שלכם,', 'עד הבית'], price: 'החל מ־25 ₪ בעיר', soda: ['קר וטרי,', 'עד הבית'], soPrice: '≈ 9 ₪', pluie: ['עושים קניות,', 'ואנחנו מביאים'] },
};

// ===== Spot 1 : le sac tourne sur lui-même (5 s) =====
export const SPOT_SAC_FRAMES = 150;
const TURN = ['sac-000', 'sac-045', 'sac-090', 'sac-135', 'sac-180', 'sac-225', 'sac-270', 'sac-315', 'sac-000'];
export const SpotSac: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps; const L = TXT[lang];
  const FLOOR = 1395, H = 780, CX = 540;
  const rise = spring({ frame: f - 2, fps, config: { damping: 13, mass: 0.8 } });
  // Un tour complet entre 0,5 s et 3,1 s : lent au début, vif au milieu, il ralentit et s'arrête de face
  const p = interpolate(t, [0.5, 3.1], [0, TURN.length - 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const i = Math.min(TURN.length - 2, Math.floor(p)), k = interpolate(p - Math.floor(p), [0.7, 1], [0, 1], clamp);
  const speed = interpolate(t, [0.5, 1.8, 3.1], [0, 1, 0], clamp);
  // Entre deux vues : fondu, l'objet s'affine un peu (effet de rotation) et un léger flou de mouvement
  const squeeze = 1 - 0.1 * Math.sin(Math.PI * k) * speed;
  const blur = 2.5 * Math.sin(Math.PI * k) * speed;
  const y = (1 - rise) * 500;
  const flare = interpolate(t, [3.05, 3.3, 3.9], [0, 1, 0], clamp);
  const sweep = interpolate(t, [2.7, 3.7], [-900, 900], clamp);
  return (
    <Stage zoom={[1.02, 1.1]}>
      {music && <Music frames={SPOT_SAC_FRAMES} />}
      <div style={{ position: 'absolute', left: CX - 330, top: FLOOR - 40, width: 660, height: 90, borderRadius: '50%', background: 'rgba(0,0,0,.5)', filter: 'blur(22px)', opacity: rise }} />
      <AbsoluteFill style={{ transform: `translateY(${y}px)`, filter: `blur(${blur}px)` }}>
        <OnFloor name={TURN[i]} cx={CX} floor={FLOOR} h={H} opacity={1} sx={squeeze} />
        <OnFloor name={TURN[i + 1]} cx={CX} floor={FLOOR} h={H} opacity={k} sx={squeeze} />
      </AbsoluteFill>
      {/* La lumière orange glisse sur le sac, puis l'éclat sur le « ! » */}
      <Fx src="lumiere-1.jpg" opacity={interpolate(t, [2.6, 3.0, 3.6, 4.2], [0, 0.85, 0.6, 0], clamp)} style={{ left: sweep, top: 0, width: 1080, height: 1920 }} />
      <Fx src="eclat.jpg" opacity={flare} style={{ left: 640 - 380, top: 1010 - 380, width: 760, height: 760, transform: `scale(${0.6 + 0.6 * flare}) rotate(${t * 20}deg)` }} />
      <Fx src="poussieres.jpg" opacity={interpolate(t, [0, 1, 4.6, 5], [0, 0.5, 0.5, 0], clamp)} style={{ left: 0, top: 0, width: 1080, height: 900, transform: `translateY(${t * 18}px)` }} />
      <Title lang={lang} lines={L.sac} at={3.0} top={210} />
      <PriceChip lang={lang} text={L.price} at={3.6} top={1500} />
      <Logo at={3.9} top={1630} size={120} />
    </Stage>
  );
};

// ===== Spot 2 : le soda frais (5 s) =====
export const SPOT_SODA_FRAMES = 150;
const SODA = ['soda-000', 'soda-045', 'soda-090', 'soda-135', 'soda-180', 'soda-225', 'soda-270', 'soda-315', 'soda-000'];
export const SpotSoda: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps; const L = TXT[lang];
  const FLOOR = 1430, H = 1150, CX = 540;
  const inS = spring({ frame: f - 2, fps, config: { damping: 15, mass: 0.9 } });
  const p = interpolate(t, [0.2, 4.0], [0, SODA.length - 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const i = Math.min(SODA.length - 2, Math.floor(p)), k = interpolate(p - Math.floor(p), [0.6, 1], [0, 1], clamp);
  // Les reflets bougent comme si la bouteille tournait : bande de lumière qui traverse l'étiquette
  const band = ((t * 0.45) % 1) * 1.6 - 0.3;
  const flare = interpolate(t, [1.0, 1.25, 1.9], [0, 1, 0], clamp);
  const w = H * 0.31;
  return (
    <Stage zoom={[1.12, 1.02]} bokeh={0.45}>
      {music && <Music frames={SPOT_SODA_FRAMES} />}
      <Fx src="lumiere-2.jpg" opacity={interpolate(t, [0, 0.8, 2.4, 3.2], [0, 0.45, 0.3, 0], clamp)} style={{ left: 0, top: 0, width: 1080, height: 1920, transform: `translateX(${interpolate(t, [0, 3.2], [-200, 200])}px)` }} />
      <div style={{ position: 'absolute', left: CX - 230, top: FLOOR - 36, width: 460, height: 70, borderRadius: '50%', background: 'rgba(0,0,0,.55)', filter: 'blur(20px)', opacity: inS }} />
      <AbsoluteFill style={{ transform: `scale(${0.85 + 0.15 * inS})`, transformOrigin: `${CX}px ${FLOOR}px`, opacity: inS }}>
        <OnFloor name={SODA[i]} cx={CX} floor={FLOOR} h={H} opacity={1} refl={0.3} />
        <OnFloor name={SODA[i + 1]} cx={CX} floor={FLOOR} h={H} opacity={k} refl={0.3} />
        <div style={{ position: 'absolute', left: CX - w / 2, top: FLOOR - H, width: w, height: H, overflow: 'hidden', WebkitMaskImage: `url(${staticFile('spot/soda-000.webp')})`, WebkitMaskSize: '100% 100%', maskImage: `url(${staticFile('spot/soda-000.webp')})`, maskSize: '100% 100%' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', left: `${band * 100}%`, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }} />
        </div>
      </AbsoluteFill>
      <Fx src="eclat-blanc.jpg" opacity={flare} style={{ left: CX - 60 - 330, top: FLOOR - H + 120 - 300, width: 660, height: 590, transform: `scale(${0.7 + 0.5 * flare})` }} />
      <Title lang={lang} lines={L.soda} at={0.9} top={150} size={100} />
      {/* Le prix en pastille, à côté de la bouteille */}
      {(() => { const s = spring({ frame: f - Math.round(2.2 * fps), fps, config: { damping: 8, mass: 0.6 } });
        return <div style={{ position: 'absolute', left: 690, top: 760, width: 270, height: 270, borderRadius: '50%', background: ORANGE, display: 'grid', placeItems: 'center', transform: `scale(${s}) rotate(${(1 - s) * -30 + 8}deg)`,
          boxShadow: '0 20px 50px rgba(255,106,19,.5)', fontFamily: 'Rubik', fontWeight: 800, fontSize: 84, color: '#fff', direction: 'ltr' }}>{L.soPrice}</div>; })()}
      <PriceChip lang={lang} text={TXT[lang].price} at={3.3} top={1540} />
      <Logo at={3.6} top={1660} size={110} />
    </Stage>
  );
};

// ===== Spot 3 : la pluie de courses + Hoppy (6 s) =====
export const SPOT_PLUIE_FRAMES = 180;
const DROPS = [
  { n: 'lait', x: 340, r: -25, h: 440, at: 0.5 },
  { n: 'baguette', x: 500, r: 30, h: 560, at: 0.85 },
  { n: 'chips', x: 370, r: -15, h: 440, at: 1.2 },
  { n: 'pommes', x: 470, r: 20, h: 270, at: 1.55 },
  { n: 'lait', x: 450, r: 15, h: 400, at: 1.9 },
  { n: 'pommes', x: 340, r: -30, h: 250, at: 2.2 },
];
export const SpotPluie: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps; const L = TXT[lang];
  const FLOOR = 1430, CX = 410, BH = 700;
  const MOUTH = FLOOR - BH + 140;
  const inS = spring({ frame: f - 2, fps, config: { damping: 13 } });
  const closed = t > 4.05;
  // Le sac se tasse un peu à chaque produit qui tombe dedans
  let squash = 0;
  DROPS.forEach(d => { const dd = t - (d.at + 0.9); if (dd > 0 && dd < 0.3) squash = Math.max(squash, Math.sin((dd / 0.3) * Math.PI) * 0.05); });
  const bagImg = closed ? 'sac-ferme' : 'sac-000';
  const bh = closed ? BH * 0.78 : BH;
  return (
    <Stage zoom={[1.0, 1.08]} bokeh={0.45}>
      {music && <Music frames={SPOT_PLUIE_FRAMES} />}
      <Fx src="poussieres.jpg" opacity={interpolate(t, [0, 0.6, 4, 4.6], [0, 0.75, 0.75, 0.2], clamp)} style={{ left: 0, top: 0, width: 1080, height: 900 }} />
      <div style={{ position: 'absolute', left: CX - 300, top: FLOOR - 40, width: 600, height: 90, borderRadius: '50%', background: 'rgba(0,0,0,.5)', filter: 'blur(22px)', opacity: inS }} />
      {/* Les produits tombent en tournoyant (3 vues par produit) et plongent dans le sac */}
      {DROPS.map((d, j) => {
        const k = interpolate(t, [d.at, d.at + 0.9], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        if (t < d.at || k >= 1) return null;
        const view = ['a', 'b', 'c'][Math.floor(k * 6) % 3];
        const name = `${d.n}-${view}`, w = d.h * (AR[name] || 0.6);
        const y = interpolate(k, [0, 1], [-d.h - 100, MOUTH]);
        const fade = interpolate(k, [0.82, 1], [1, 0], clamp);
        return <Img key={j} src={staticFile(`spot/${name}.webp`)} style={{ position: 'absolute', left: d.x - w / 2, top: y - d.h / 2, width: w, height: d.h, opacity: fade,
          transform: `rotate(${d.r + k * d.r * 2}deg)`, filter: `blur(${(1 - k) * 2 + (k > 0.6 ? 0 : 1)}px) drop-shadow(0 20px 26px rgba(0,0,0,.4))` }} />;
      })}
      <AbsoluteFill style={{ transform: `translateY(${(1 - inS) * 400}px) scale(${1 + squash * 0.5}, ${1 - squash})`, transformOrigin: `${CX}px ${FLOOR}px` }}>
        <OnFloor name={bagImg} cx={CX} floor={FLOOR} h={bh} />
      </AbsoluteFill>
      {/* Éclat quand le sac se ferme */}
      <Fx src="eclat.jpg" opacity={interpolate(t, [4.0, 4.2, 4.8], [0, 0.9, 0], clamp)} style={{ left: CX - 400, top: FLOOR - bh / 2 - 400, width: 800, height: 800 }} />
      <HoppyHop x={840} bottom={1490} h={600} at={3.3} from="right" />
      <Title lang={lang} lines={L.pluie} at={2.9} top={170} size={98} />
      <PriceChip lang={lang} text={TXT[lang].price} at={4.4} top={1560} />
      <Logo at={4.7} top={1690} size={110} />
    </Stage>
  );
};
