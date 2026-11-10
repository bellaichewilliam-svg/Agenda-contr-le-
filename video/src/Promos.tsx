import React from 'react';
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { HoppyHop } from './HoppyHop';

// « HOP! à vos promos » (patron, 10/11) : la vidéo Gemini du patron (horizontale, 10 s, public/promos/gemini-v1.mp4)
// montée en vertical : la vidéo au centre, les textes FR / HE au-dessus, les enseignes et de vraies promos de l'appli
// en dessous, puis une fin avec Hoppy, le logo HOP! et « dès 25 ₪ en ville ».
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const NAVY = '#0B1830', NAVY2 = '#0F1F3D', ORANGE = '#FF6A13';
type Lang = 'fr' | 'he';
const font = (lang: Lang) => (lang === 'he' ? 'Rubik' : 'Fredoka');
const FPS = 30, VID = 300, END = 84;
export const PROMOS_FRAMES = VID + END;
// Les plans de la vidéo Gemini (secondes) : cuisine, rayons, tourbillon, Hoppy chez Rami Lévy, sac, livraison
const CUTS = [0, 1.5, 2.96, 4.5, 6, 8, 10];

const TXT = {
  fr: {
    heads: [['Encore raté', 'la promo ?'], ['Des promos', 'partout…'], ['HOP! à vos', 'promos'], ['On y va', 'pour vous'], ['Ne ratez plus', 'aucune promo'], ['Livrées', 'chez vous']],
    shops: ['Rami Lévy', 'Carrefour', 'Victory', 'BOOOM'],
    deals: [['Dettol', '−67 %'], ['Bella Italia', '3 pour 10 ₪'], ['Vanish', '−57 %']],
    endT: ['Toutes les promos', 'des meilleures enseignes'], endS: 'Réunies dans l’appli, livrées chez vous', price: 'dès 25 ₪ en ville',
  },
  he: {
    heads: [['שוב פספסתם', 'את המבצע?'], ['מבצעים', 'בכל מקום…'], ['HOP!', 'למבצעים'], ['אנחנו הולכים', 'בשבילכם'], ['לא מפספסים', 'אף מבצע'], ['עד הבית', 'שלכם']],
    shops: ['רמי לוי', 'קרפור', 'ויקטורי', 'BOOOM'],
    deals: [['דטול', '−67%'], ['בלה איטליה', '3 ב־10 ₪'], ['וניש', '−57%']],
    endT: ['כל המבצעים', 'של הרשתות הגדולות'], endS: 'במקום אחד באפליקציה, עד הבית', price: 'החל מ־25 ₪ בעיר',
  },
};
const SHOP_STYLE = [
  { bg: '#E30613', fg: '#fff' }, { bg: '#1F4FA3', fg: '#fff' }, { bg: '#1F9D55', fg: '#fff' }, { bg: '#FFD200', fg: '#111' },
];
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
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${30 + Math.sin(f / 40) * 4}%, rgba(255,106,19,.18) 0%, transparent 45%)` }} />
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
  const big = k === 2;
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 190, height: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      direction: lang === 'he' ? 'rtl' : 'ltr', textAlign: 'center' }}>
      {lines.map((l, i) => {
        const s = spring({ frame: f - from - i * 4, fps: FPS, config: { damping: 12, mass: 0.6 } });
        const o = interpolate(f, [to - 5, to], [1, 0], clamp);
        return <div key={`${k}-${i}`} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: big ? 132 : 112, lineHeight: 1.04,
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
  const punch = c > 0 ? interpolate(since, [0, 8], [1.06, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const flash = c > 0 ? interpolate(since, [0, 2, 8], [0.55, 0.35, 0], clamp) : 0;
  const W = 1080, H = 760; // un peu rognée sur les côtés : plus grande à l'écran
  return (
    <div style={{ position: 'absolute', left: (1080 - W) / 2, top: 560, width: W, height: H, borderRadius: 0, overflow: 'hidden',
      boxShadow: '0 -6px 0 0 #FF6A13, 0 6px 0 0 #FF6A13, 0 30px 80px rgba(0,0,0,.55)', transform: `scale(${punch})` }}>
      <OffthreadVideo src={staticFile('promos/gemini-v1.mp4')} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        volume={v => interpolate(v, [0, 4, VID - 12, VID], [0, 1, 1, 0], clamp)} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle, #fff 0%, rgba(255,106,19,.6) 100%)', mixBlendMode: 'screen', opacity: flash }} />
    </div>
  );
};

// Les 4 enseignes, en pastilles (elles arrivent au 2e plan et restent)
const Shops: React.FC<{ lang: Lang; at: number; top: number; size?: number }> = ({ lang, at, top, size = 42 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 30, right: 30, top, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, direction: lang === 'he' ? 'rtl' : 'ltr' }}>
      {TXT[lang].shops.map((n, i) => {
        const s = spring({ frame: f - Math.round(at * FPS) - i * 4, fps: FPS, config: { damping: 9, mass: 0.6 } });
        return <div key={i} style={{ padding: '12px 24px', borderRadius: 999, background: SHOP_STYLE[i].bg, color: SHOP_STYLE[i].fg, fontFamily: 'Rubik', fontWeight: 800, fontSize: size,
          opacity: Math.min(1, s), transform: `scale(${s}) rotate(${(i % 2 ? 1 : -1) * 2 * (1 - Math.min(1, s))}deg)`, boxShadow: '0 10px 26px rgba(0,0,0,.35)' }}>
          <bdi>{n}</bdi></div>;
      })}
    </div>
  );
};

// De vraies promos de l'appli, qui tombent comme des étiquettes
const Deals: React.FC<{ lang: Lang; at: number; out: number; top: number }> = ({ lang, at, out, top }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [out * FPS - 6, out * FPS], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 30, right: 30, top, display: 'flex', justifyContent: 'center', gap: 20, direction: lang === 'he' ? 'rtl' : 'ltr', opacity: o }}>
      {TXT[lang].deals.map(([n, d], i) => {
        const s = spring({ frame: f - Math.round(at * FPS) - i * 6, fps: FPS, config: { damping: 8, mass: 0.7 } });
        return <div key={i} style={{ width: 300, padding: '18px 10px', borderRadius: 26, background: '#fff', textAlign: 'center', opacity: Math.min(1, s),
          transform: `translateY(${(1 - s) * -120}px) rotate(${(i - 1) * 4}deg)`, boxShadow: '0 14px 30px rgba(0,0,0,.35)' }}>
          <div style={{ fontFamily: 'Rubik', fontWeight: 700, fontSize: 34, color: NAVY2 }}><bdi>{n}</bdi></div>
          <div style={{ direction: /^[−\-\d.,]+\s*%$/.test(d) ? 'ltr' : (lang === 'he' ? 'rtl' : 'ltr'), marginTop: 6, fontFamily: 'Rubik', fontWeight: 800, fontSize: 52, color: '#fff', background: '#E5484D', borderRadius: 999, display: 'inline-block', padding: '4px 22px' }}>
            {d}</div>
        </div>;
      })}
    </div>
  );
};

const PriceChip: React.FC<{ lang: Lang; at: number; top: number; size?: number }> = ({ lang, at, top, size = 64 }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - Math.round(at * FPS), fps: FPS, config: { damping: 9, mass: 0.6 } });
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center' }}>
    <div style={{ direction: lang === 'he' ? 'rtl' : 'ltr', padding: '18px 48px', borderRadius: 999, background: ORANGE, color: '#fff', fontFamily: 'Rubik', fontWeight: 800, fontSize: size,
      opacity: Math.min(1, s), transform: `scale(${s})`, boxShadow: '0 16px 40px rgba(255,106,19,.45)' }}>{TXT[lang].price}</div></div>;
};

// La fin : Hoppy arrive en sautant, le logo, le slogan, les enseignes, le prix
const EndCard: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - 4, fps: FPS, config: { damping: 11 } });
  const T = TXT[lang];
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', opacity: s, transform: `scale(${0.7 + 0.3 * s})` }}><Logo size={210} /></div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 390, textAlign: 'center', direction: lang === 'he' ? 'rtl' : 'ltr' }}>
        {T.endT.map((l, i) => {
          const k = spring({ frame: f - 10 - i * 5, fps: FPS, config: { damping: 12 } });
          return <div key={i} style={{ fontFamily: font(lang), fontWeight: lang === 'he' ? 800 : 700, fontSize: 86, lineHeight: 1.08, color: i ? ORANGE : '#fff', opacity: k,
            transform: `translateY(${(1 - k) * 40}px)` }}>{l}</div>;
        })}
        <div style={{ marginTop: 22, fontFamily: 'Rubik', fontWeight: 500, fontSize: 44, color: 'rgba(255,255,255,.85)', opacity: spring({ frame: f - 22, fps: FPS }) }}>{T.endS}</div>
      </div>
      <Shops lang={lang} at={0.9} top={780} size={40} />
      <PriceChip lang={lang} at={1.3} top={985} />
      <HoppyHop x={540} bottom={1880} h={760} at={0.15} />
    </AbsoluteFill>
  );
};

export const Promos: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence durationInFrames={VID + 2}>
        <Bg />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
          <Logo size={92} />
        </div>
        <Heads lang={lang} />
        <Film />
        <Shops lang={lang} at={1.5} top={1370} />
        <Deals lang={lang} at={3.1} out={8} top={1490} />
        <PriceChip lang={lang} at={8.2} top={1520} size={72} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1810, textAlign: 'center', fontFamily: 'Rubik', fontWeight: 500, fontSize: 32, color: 'rgba(255,255,255,.6)',
          direction: lang === 'he' ? 'rtl' : 'ltr', opacity: interpolate(f, [100, 115], [0, 1], clamp) }}>
          {lang === 'he' ? 'מבצעים אמיתיים מהאפליקציה · עד גמר המלאי' : 'Vraies promos de l’appli · selon disponibilité'}
        </div>
      </Sequence>
      <Sequence from={VID} durationInFrames={END}>
        <EndCard lang={lang} />
        {music && <Audio src={staticFile('lancement-music.wav')} volume={v => interpolate(v, [0, 5, END - 12, END], [0, 0.9, 0.9, 0], clamp)} />}
      </Sequence>
    </AbsoluteFill>
  );
};
