import React from 'react';
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import { HoppyHop } from './HoppyHop';

// « Vos mezouzot chez le sofer, et retour » (patron, 11/11) : la vidéo Gemini du patron (horizontale, 10 s,
// public/mezouzot/gemini-v1.mp4) montée en vertical comme « HOP! à vos promos » : la vidéo au centre, le titre FR / HE
// de chaque plan au-dessus, les 3 étapes du service en dessous, puis une fin avec Hoppy et le logo HOP!.
// Pas de prix (course aller-retour, prix calculé dans l'appli).
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const NAVY = '#0B1830', NAVY2 = '#0F1F3D', ORANGE = '#FF6A13';
type Lang = 'fr' | 'he';
const font = (lang: Lang) => (lang === 'he' ? 'Rubik' : 'Fredoka');
const FPS = 30, VID = 300, END = 90;
export const MEZOUZOT_FRAMES = VID + END;
// Les plans de la vidéo Gemini (secondes) : mezouza décrochée, remise à Hoppy, scooter, sofer, retour, mezouza remise
const CUTS = [0, 2.1, 3.37, 5, 6.67, 8.29, 10];

const TXT = {
  fr: {
    heads: [['Vos mezouzot', 'à faire vérifier ?'], ['HOP! vient', 'les chercher'], ['En route', 'vers votre sofer'], ['Vérifiées', 'par le sofer'], ['… et rapportées', 'chez vous'], ['Sans bouger', 'de chez vous']],
    steps: ['On les récupère', 'Chez votre sofer', 'Retour chez vous'],
    endT: ['Vos mezouzot', 'chez le sofer, et retour'], endS: 'Aller-retour, sans bouger de chez vous', cta: 'Commandez sur HOP!',
    foot: 'Vous payez votre sofer directement',
  },
  he: {
    heads: [['המזוזות שלכם', 'צריכות בדיקה?'], ['HOP! בא', 'לאסוף אותן'], ['בדרך', 'לסופר שלכם'], ['נבדקות', 'אצל הסופר'], ['…ומוחזרות', 'אליכם הביתה'], ['בלי לצאת', 'מהבית']],
    steps: ['אוספים מכם', 'אצל הסופר שלכם', 'חזרה אליכם'],
    endT: ['המזוזות שלכם', 'אצל הסופר, וחזרה'], endS: 'הלוך ושוב, בלי לצאת מהבית', cta: 'מזמינים ב־HOP!',
    foot: 'את הסופר אתם משלמים ישירות',
  },
};
// « HOP! » toujours de gauche à droite, avec le « ! » orange
const Hop: React.FC<{ s: string }> = ({ s }) => {
  const parts = s.split('HOP!');
  return <>{parts.map((p, i) => <React.Fragment key={i}>{p}{i < parts.length - 1 && <bdi dir="ltr" style={{ unicodeBidi: 'isolate' }}>HOP<span style={{ color: ORANGE }}>!</span></bdi>}</React.Fragment>)}</>;
};
const Logo: React.FC<{ size: number }> = ({ size }) =>
  <div style={{ direction: 'ltr', fontFamily: 'Fredoka', fontWeight: 700, fontSize: size, color: '#fff', letterSpacing: -2, lineHeight: 1 }}>HOP<span style={{ color: ORANGE }}>!</span></div>;

const Bg: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${NAVY2} 0%, ${NAVY} 55%, #08111f 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${30 + Math.sin(f / 40) * 4}%, rgba(255,106,19,.16) 0%, transparent 45%)` }} />
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 2px, transparent 2px)', backgroundSize: '44px 44px' }} />
    </AbsoluteFill>
  );
};

// Le titre du plan en cours (il change à chaque coupe de la vidéo)
const Heads: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const k = Math.max(0, CUTS.findIndex((c, i) => t >= c && t < (CUTS[i + 1] ?? 99)));
  const from = Math.round(CUTS[k] * FPS), to = Math.round((CUTS[k + 1] ?? 10) * FPS);
  const lines = TXT[lang].heads[k] || [];
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 190, height: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      direction: lang === 'he' ? 'rtl' : 'ltr', textAlign: 'center' }}>
      {lines.map((l, i) => {
        const s = spring({ frame: f - from - i * 4, fps: FPS, config: { damping: 12, mass: 0.6 } });
        const o = interpolate(f, [to - 5, to], [1, 0], clamp);
        return <div key={`${k}-${i}`} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: 104, lineHeight: 1.06,
          color: i === lines.length - 1 ? ORANGE : '#fff', opacity: s * o, transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + 0.15 * s})`,
          textShadow: '0 10px 34px rgba(0,0,0,.5)' }}><Hop s={l} /></div>;
      })}
    </div>
  );
};

// La vidéo du patron, au centre, avec un petit « coup de zoom » à chaque coupe
const Film: React.FC = () => {
  const f = useCurrentFrame(); const t = f / FPS;
  const c = [...CUTS].reverse().find(x => t >= x) ?? 0;
  const since = f - Math.round(c * FPS);
  const punch = c > 0 ? interpolate(since, [0, 8], [1.05, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const flash = c > 0 ? interpolate(since, [0, 2, 8], [0.4, 0.25, 0], clamp) : 0;
  const W = 1080, H = 760; // un peu rognée sur les côtés : plus grande à l'écran
  return (
    <div style={{ position: 'absolute', left: (1080 - W) / 2, top: 560, width: W, height: H, overflow: 'hidden',
      boxShadow: '0 -6px 0 0 #FF6A13, 0 6px 0 0 #FF6A13, 0 30px 80px rgba(0,0,0,.55)', transform: `scale(${punch})` }}>
      <OffthreadVideo src={staticFile('mezouzot/gemini-v1.mp4')} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        volume={v => interpolate(v, [0, 4, VID - 12, VID], [0, 1, 1, 0], clamp)} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle, #fff 0%, rgba(255,106,19,.6) 100%)', mixBlendMode: 'screen', opacity: flash }} />
    </div>
  );
};

// Les 3 étapes du service (1 · 2 · 3), qui s'allument au fil de la vidéo
const Steps: React.FC<{ lang: Lang; top: number; on: number[] }> = ({ lang, top, on }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 30, right: 30, top, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', direction: lang === 'he' ? 'rtl' : 'ltr' }}>
      {TXT[lang].steps.map((n, i) => {
        const s = spring({ frame: f - Math.round(on[i] * FPS), fps: FPS, config: { damping: 10, mass: 0.6 } });
        return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 34px 14px 16px', borderRadius: 999, background: '#13233F',
          border: '3px solid rgba(255,106,19,.85)', color: '#fff', fontFamily: 'Rubik', fontWeight: 800, fontSize: 50,
          opacity: Math.min(1, s), transform: `translateX(${(1 - Math.min(1, s)) * (lang === 'he' ? 160 : -160)}px)`, boxShadow: '0 12px 28px rgba(0,0,0,.35)' }}>
          <span style={{ width: 62, height: 62, borderRadius: 999, background: ORANGE, display: 'grid', placeItems: 'center', fontSize: 38, direction: 'ltr' }}>{i + 1}</span>
          <bdi>{n}</bdi></div>;
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

// La fin : Hoppy arrive en sautant, le logo, le slogan, les 3 étapes, « Commandez sur HOP! »
const EndCard: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - 4, fps: FPS, config: { damping: 11 } });
  const T = TXT[lang];
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', justifyContent: 'center', opacity: s, transform: `scale(${0.7 + 0.3 * s})` }}><Logo size={200} /></div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 370, textAlign: 'center', direction: lang === 'he' ? 'rtl' : 'ltr' }}>
        {T.endT.map((l, i) => {
          const k = spring({ frame: f - 10 - i * 5, fps: FPS, config: { damping: 12 } });
          return <div key={i} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: i ? 74 : 92, lineHeight: 1.1, color: i ? ORANGE : '#fff', opacity: k,
            transform: `translateY(${(1 - k) * 40}px)` }}>{l}</div>;
        })}
        <div style={{ marginTop: 20, fontFamily: 'Rubik', fontWeight: 500, fontSize: 42, color: 'rgba(255,255,255,.85)', opacity: spring({ frame: f - 22, fps: FPS }) }}>{T.endS}</div>
      </div>
      <Chip lang={lang} at={1.0} top={760}><Hop s={T.cta} /></Chip>
      <HoppyHop x={540} bottom={1880} h={800} at={0.15} />
    </AbsoluteFill>
  );
};

export const Mezouzot: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence durationInFrames={VID + 2}>
        <Bg />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center' }}><Logo size={92} /></div>
        <Heads lang={lang} />
        <Film />
        <Steps lang={lang} top={1385} on={[2.2, 5.0, 6.7]} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1810, textAlign: 'center', fontFamily: 'Rubik', fontWeight: 500, fontSize: 32, color: 'rgba(255,255,255,.6)',
          direction: lang === 'he' ? 'rtl' : 'ltr', opacity: interpolate(f, [160, 175], [0, 1], clamp) }}>{TXT[lang].foot}</div>
      </Sequence>
      <Sequence from={VID} durationInFrames={END}>
        <EndCard lang={lang} />
        {music && <Audio src={staticFile('lancement-music.wav')} volume={v => interpolate(v, [0, 5, END - 12, END], [0, 0.9, 0.9, 0], clamp)} />}
      </Sequence>
    </AbsoluteFill>
  );
};
