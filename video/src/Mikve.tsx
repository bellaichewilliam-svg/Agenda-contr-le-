import React from 'react';
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import { HoppyHop } from './HoppyHop';

// « Votre vaisselle au mikvé, et retour » (patron, 18/11) : la vidéo Gemini du patron (déjà verticale, 10 s,
// public/mikve/gemini-v1.mp4) en plein écran, le titre FR / HE de chaque plan en haut, le prix fixe en bas
// (85 ₪ tout compris = aller-retour 35 ₪ + service 50 ₪, carré « Vaisselle au mikvé » de l'appli),
// puis une fin avec Hoppy, le logo HOP!, les 3 étapes et « Commandez sur HOP! ».
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const NAVY = '#0B1830', NAVY2 = '#0F1F3D', ORANGE = '#FF6A13';
type Lang = 'fr' | 'he';
const font = (lang: Lang) => (lang === 'he' ? 'Rubik' : 'Fredoka');
const FPS = 30, VID = 300, END = 105;
export const MIKVE_FRAMES = VID + END;
// Les plans de la vidéo Gemini (secondes) : déballage, carton à Hoppy, scooter, mikvé, retour, table mise
const CUTS = [0, 1.46, 3, 4.46, 6, 7.5, 10];
const VIDEO = 'mikve/gemini-v1.mp4';

const TXT = {
  fr: {
    heads: [['Nouvelle', 'vaisselle ?'], ['HOP! vient', 'la chercher'], ['Direction', 'le mikvé'], ['Trempée au', 'mikvé de kelim'], ['… et ramenée', 'chez vous'], ['Sans bouger', 'de chez vous']],
    price: '85 ₪ tout compris',
    steps: ['On la récupère', 'Trempée au mikvé', 'Retour chez vous'],
    endT: ['Votre vaisselle', 'au mikvé, et retour'], endS: 'Aller-retour + trempage : 85 ₪ tout compris', cta: 'Commandez sur HOP!',
  },
  he: {
    heads: [['כלים', 'חדשים?'], ['HOP! בא', 'לאסוף'], ['בדרך', 'למקווה'], ['טבילה', 'במקוות כלים'], ['…ומחזירים', 'אליכם הביתה'], ['בלי לצאת', 'מהבית']],
    price: '85 ₪ הכול כלול',
    steps: ['אוספים מכם', 'טבילה במקווה', 'חזרה אליכם'],
    endT: ['הכלים שלכם', 'לטבילה, וחזרה'], endS: 'הלוך ושוב + טבילה: 85 ₪ הכול כלול', cta: 'מזמינים ב־HOP!',
  },
};
// « HOP! » toujours de gauche à droite, avec le « ! » orange
const Hop: React.FC<{ s: string }> = ({ s }) => {
  const parts = s.split('HOP!');
  return <>{parts.map((p, i) => <React.Fragment key={i}>{p}{i < parts.length - 1 && <bdi dir="ltr" style={{ unicodeBidi: 'isolate' }}>HOP<span style={{ color: ORANGE }}>!</span></bdi>}</React.Fragment>)}</>;
};
const Logo: React.FC<{ size: number }> = ({ size }) =>
  <div style={{ direction: 'ltr', fontFamily: 'Fredoka', fontWeight: 700, fontSize: size, color: '#fff', letterSpacing: -2, lineHeight: 1, textShadow: '0 6px 24px rgba(0,0,0,.45)' }}>HOP<span style={{ color: ORANGE }}>!</span></div>;

const Bg: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${NAVY2} 0%, ${NAVY} 55%, #08111f 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${30 + Math.sin(f / 40) * 4}%, rgba(255,106,19,.16) 0%, transparent 45%)` }} />
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 2px, transparent 2px)', backgroundSize: '44px 44px' }} />
    </AbsoluteFill>
  );
};

// La vidéo du patron en plein écran, un petit « coup de zoom » à chaque coupe, des dégradés sombres en haut et en bas pour les textes
const Film: React.FC = () => {
  const f = useCurrentFrame(); const t = f / FPS;
  const c = [...CUTS].reverse().find(x => t >= x) ?? 0;
  const since = f - Math.round(c * FPS);
  const punch = c > 0 ? interpolate(since, [0, 8], [1.05, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const flash = c > 0 ? interpolate(since, [0, 2, 8], [0.35, 0.2, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{ transform: `scale(${punch})` }}>
      <OffthreadVideo src={staticFile(VIDEO)} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        volume={v => interpolate(v, [0, 4, VID - 12, VID], [0, 1, 1, 0], clamp)} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,17,31,.82) 0%, rgba(8,17,31,.35) 26%, transparent 40%, transparent 72%, rgba(8,17,31,.75) 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle, #fff 0%, rgba(255,106,19,.6) 100%)', mixBlendMode: 'screen', opacity: flash }} />
    </AbsoluteFill>
  );
};

// Le titre du plan en cours (il change à chaque coupe)
const Heads: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const k = Math.max(0, CUTS.findIndex((c, i) => t >= c && t < (CUTS[i + 1] ?? 99)));
  const from = Math.round(CUTS[k] * FPS), to = Math.round((CUTS[k + 1] ?? 10) * FPS);
  const lines = TXT[lang].heads[k] || [];
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
      direction: lang === 'he' ? 'rtl' : 'ltr', textAlign: 'center' }}>
      {lines.map((l, i) => {
        const s = spring({ frame: f - from - i * 4, fps: FPS, config: { damping: 12, mass: 0.6 } });
        const o = interpolate(f, [to - 5, to], [1, 0], clamp);
        return <div key={`${k}-${i}`} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: 108, lineHeight: 1.06,
          color: i === lines.length - 1 ? ORANGE : '#fff', opacity: s * o, transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + 0.15 * s})`,
          textShadow: '0 8px 30px rgba(0,0,0,.65)' }}><Hop s={l} /></div>;
      })}
    </div>
  );
};

const Chip: React.FC<{ lang: Lang; at: number; top: number; size?: number; children: React.ReactNode }> = ({ lang, at, top, size = 62, children }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - Math.round(at * FPS), fps: FPS, config: { damping: 9, mass: 0.6 } });
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center' }}>
    <div style={{ direction: lang === 'he' ? 'rtl' : 'ltr', padding: '20px 52px', borderRadius: 999, background: '#fff', color: NAVY2, fontFamily: 'Rubik', fontWeight: 800, fontSize: size,
      opacity: Math.min(1, s), transform: `scale(${s})`, boxShadow: '0 0 0 6px rgba(255,106,19,.9), 0 16px 40px rgba(255,106,19,.45)' }}>{children}</div></div>;
};

// Les 3 étapes du service (1 · 2 · 3)
const Steps: React.FC<{ lang: Lang; top: number; at: number }> = ({ lang, top, at }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 30, right: 30, top, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', direction: lang === 'he' ? 'rtl' : 'ltr' }}>
      {TXT[lang].steps.map((n, i) => {
        const s = spring({ frame: f - Math.round((at + i * 0.25) * FPS), fps: FPS, config: { damping: 10, mass: 0.6 } });
        return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 34px 14px 16px', borderRadius: 999, background: '#13233F',
          border: '3px solid rgba(255,106,19,.85)', color: '#fff', fontFamily: 'Rubik', fontWeight: 800, fontSize: 48,
          opacity: Math.min(1, s), transform: `translateX(${(1 - Math.min(1, s)) * (lang === 'he' ? 160 : -160)}px)`, boxShadow: '0 12px 28px rgba(0,0,0,.35)' }}>
          <span style={{ width: 60, height: 60, borderRadius: 999, background: ORANGE, display: 'grid', placeItems: 'center', fontSize: 36, direction: 'ltr' }}>{i + 1}</span>
          <bdi>{n}</bdi></div>;
      })}
    </div>
  );
};

// La fin : logo, slogan, prix, les 3 étapes, « Commandez sur HOP! », Hoppy arrive en sautant
const EndCard: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - 4, fps: FPS, config: { damping: 11 } });
  const T = TXT[lang];
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 100, display: 'flex', justifyContent: 'center', opacity: s, transform: `scale(${0.7 + 0.3 * s})` }}><Logo size={180} /></div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 330, textAlign: 'center', direction: lang === 'he' ? 'rtl' : 'ltr' }}>
        {T.endT.map((l, i) => {
          const k = spring({ frame: f - 10 - i * 5, fps: FPS, config: { damping: 12 } });
          return <div key={i} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: i ? 76 : 92, lineHeight: 1.1, color: i ? ORANGE : '#fff', opacity: k,
            transform: `translateY(${(1 - k) * 40}px)` }}>{l}</div>;
        })}
        <div style={{ marginTop: 18, fontFamily: 'Rubik', fontWeight: 600, fontSize: 40, color: 'rgba(255,255,255,.9)', opacity: spring({ frame: f - 22, fps: FPS }) }}>{T.endS}</div>
      </div>
      <Steps lang={lang} top={650} at={0.9} />
      <Chip lang={lang} at={1.7} top={1010}><Hop s={T.cta} /></Chip>
      <HoppyHop x={540} bottom={1890} h={700} at={0.15} />
    </AbsoluteFill>
  );
};

export const Mikve: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence durationInFrames={VID + 2}>
        <Film />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center' }}><Logo size={92} /></div>
        <Heads lang={lang} />
        <Chip lang={lang} at={1.6} top={1700} size={58}>{TXT[lang].price}</Chip>
      </Sequence>
      <Sequence from={VID} durationInFrames={END}>
        <EndCard lang={lang} />
        {music && <Audio src={staticFile('lancement-music.wav')} volume={v => interpolate(v, [0, 5, END - 12, END], [0, 0.9, 0.9, 0], clamp)} />}
      </Sequence>
    </AbsoluteFill>
  );
};
