import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, Easing } from 'remotion';
import { HoppyHop } from './HoppyHop';
import { C, DISPLAY, UI } from './theme';
import { Grain, Vignette, Wordmark } from './Reel';

// « Film de lancement » HOP! : 26 s, 1080 × 1920, refait en motion design à partir du film du patron.
// 6 scènes de 3,5 s (une envie, l'appli, les courses, les fleurs, tout le reste, la vie simple) + 5 s de fin.
// Images : public/lancement/ (visuels du patron recadrés, sans leurs textes) et une vraie capture de l'appli.
export const LANCEMENT_FRAMES = 780;
export type LancementLang = 'fr' | 'he';
const SC = 105, OUT = 630;
const CUTS = [SC, 2 * SC, 3 * SC, 4 * SC, 5 * SC, OUT];

type Scene = { kick: string; a: string; b: string; chips: string[]; img?: string; sky?: boolean; badge: string; pos?: string };
const STR: Record<LancementLang, { rtl: boolean; city: string; scenes: Scene[]; out: [string, string]; info: string; toast: string }> = {
  fr: { rtl: false, city: 'NETANYA', toast: '✓ Commande envoyée',
    scenes: [
      { kick: 'LA LIVRAISON QUI FAIT HOP !', a: 'Une envie ?', b: 'Hoppy arrive.', chips: ['📍 Partout à Netanya'], img: 'envie.jpg', badge: '⚡' },
      { kick: 'TOUT COMMENCE ICI', a: 'Votre envie.', b: 'En quelques clics.', chips: ['Choisissez', 'Commandez', 'Profitez'], badge: '📱' },
      { kick: 'VOS COMMERCES PRÉFÉRÉS', a: 'Vos courses.', b: "On s'en occupe.", chips: ['🛒 Épicerie', '👟 Boutiques', '🎁 Cadeaux'], img: 'courses.jpg', sky: true, badge: '🛍️', pos: '92% 50%' },
      { kick: 'LE PLAISIR DE FAIRE PLAISIR', a: 'Des fleurs ?', b: 'Et hop !', chips: ['💐 Livrées avec soin, à la porte'], img: 'fleurs.jpg', sky: true, badge: '💐', pos: '92% 50%' },
      { kick: "TOUT CE QU'IL VOUS FAUT", a: 'Repas. Colis.', b: 'Et bien plus.', chips: ['🍕 Restaurants', '💊 Pharmacie', '📦 Colis'], img: 'repas.jpg', badge: '🍕' },
      { kick: 'VOUS PROFITEZ, ON LIVRE', a: 'La vie est', b: 'plus simple.', chips: ['😌 Votre quotidien, en un saut'], img: 'repos.jpg', badge: '😌' },
    ],
    out: ['Demandez.', 'On livre !'], info: '📍 Suivi en direct · 💵 Espèces ou Bit' },
  he: { rtl: true, city: 'נתניה', toast: '✓ ההזמנה נשלחה',
    scenes: [
      { kick: 'המשלוחים שעושים הופ!', a: 'בא לכם משהו?', b: 'הופי מגיע.', chips: ['📍 בכל נתניה'], img: 'envie.jpg', badge: '⚡' },
      { kick: 'הכול מתחיל כאן', a: 'מה שבא לכם.', b: 'בכמה קליקים.', chips: ['בוחרים', 'מזמינים', 'נהנים'], badge: '📱' },
      { kick: 'החנויות שאתם אוהבים', a: 'הקניות שלכם.', b: 'אנחנו דואגים.', chips: ['🛒 מכולת', '👟 חנויות', '🎁 מתנות'], img: 'courses.jpg', sky: true, badge: '🛍️', pos: '92% 50%' },
      { kick: 'הכיף לשמח', a: 'פרחים?', b: 'והופ!', chips: ['💐 באהבה, עד פתח הדלת'], img: 'fleurs.jpg', sky: true, badge: '💐', pos: '92% 50%' },
      { kick: 'כל מה שצריך', a: 'אוכל. חבילות.', b: 'ועוד הרבה.', chips: ['🍕 מסעדות', '💊 פארם', '📦 חבילות'], img: 'repas.jpg', badge: '🍕' },
      { kick: 'אתם נהנים, אנחנו מביאים', a: 'החיים', b: 'פשוטים יותר.', chips: ['😌 היומיום שלכם, בקפיצה אחת'], img: 'repos.jpg', badge: '😌' },
    ],
    out: ['אתם מבקשים.', 'אנחנו מביאים!'], info: '📍 מעקב בזמן אמת · 💵 מזומן או ביט' },
};
let T = STR.fr;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, i: number[], o: number[], e?: (t: number) => number) => interpolate(f, i, o, e ? { ...clamp, easing: e } : clamp);
const sp = (f: number, d: number, damping = 13, stiffness = 200, mass = 0.7) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const outQ = Easing.out(Easing.cubic);
const SKY = 'linear-gradient(180deg, #1FA6E8 0%, #49C3F5 55%, #8ADBFF 100%)';
const NAVY = `radial-gradient(ellipse 90% 70% at 50% 42%, #1E3E86 0%, ${C.navy2} 45%, ${C.navy} 100%)`;

// Traits de vitesse qui filent derrière la scène
const Speed: React.FC<{ sky?: boolean }> = ({ sky }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: sky ? 0.55 : 0.35 }}>
      {Array.from({ length: 14 }).map((_, k) => {
        const y = 300 + ((k * 137) % 1400), len = 160 + (k % 4) * 90, v = 22 + (k % 5) * 8;
        const x = 1200 - ((f * v + k * 260) % 1700);
        return <div key={k} style={{ position: 'absolute', left: x, top: y, width: len, height: 6 + (k % 3) * 2, borderRadius: 9, background: k % 4 === 0 ? C.orange : '#fff', opacity: 0.25 + (k % 3) * 0.15 }} />;
      })}
    </AbsoluteFill>
  );
};

// Le titre : chaque ligne monte depuis un masque, la 2e en orange
const Title: React.FC<{ s: Scene; sky?: boolean }> = ({ s, sky }) => {
  const f = useCurrentFrame();
  const k = lerp(f, [2, 12], [0, 1], outQ);
  const line = (txt: string, d: number, color: string) => {
    const p = sp(f, d, 14, 220, 0.6);
    return (
      <div style={{ overflow: 'hidden', paddingBottom: 8 }}>
        <div style={{ font: `700 ${T.rtl ? 112 : 116}px/1.04 ${DISPLAY}`, color, transform: `translateY(${(1 - p) * 130}%)`, whiteSpace: 'nowrap' }}>{txt}</div>
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', top: 205, left: 70, right: 70, textAlign: T.rtl ? 'right' : 'left', direction: T.rtl ? 'rtl' : 'ltr' }}>
      <div style={{ font: `800 ${T.rtl ? 36 : 30}px/1 ${UI}`, letterSpacing: T.rtl ? 0 : 5, color: sky ? C.navy : '#7CC6FF', opacity: k, transform: `translateX(${(T.rtl ? 1 : -1) * (1 - k) * 40}px)` }}>{s.kick}</div>
      <div style={{ height: 22 }} />
      {line(s.a, 4, sky ? C.navy : '#fff')}
      {line(s.b, 9, sky ? '#fff' : C.orange)}
      <div style={{ marginTop: 18, height: 10, width: 140 * lerp(f, [12, 24], [0, 1], outQ), borderRadius: 9, background: C.orange, marginInlineStart: 0 }} />
    </div>
  );
};

// La carte image : arrive en ressort, zoom lent, pastille qui claque dans le coin
const Card: React.FC<{ img: string; badge: string; pos?: string }> = ({ img, badge, pos = '50% 50%' }) => {
  const f = useCurrentFrame();
  const p = sp(f, 3, 12, 150, 0.8);
  const zoom = lerp(f, [0, SC], [1.04, 1.16]);
  const b = sp(f, 16, 7, 260, 0.5);
  return (
    <div style={{ position: 'absolute', left: 60, top: 620, width: 960, height: 860, transform: `translateY(${(1 - p) * 260}px) scale(${0.86 + 0.14 * p}) rotate(${(1 - p) * -5}deg)`, opacity: Math.min(1, p * 2) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 60, overflow: 'hidden', boxShadow: '0 50px 90px rgba(0,0,0,.45), 0 0 0 6px rgba(255,255,255,.12)' }}>
        <Img src={staticFile(`lancement/${img}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transformOrigin: pos, transform: `scale(${zoom}) translateY(${lerp(f, [0, SC], [10, -14])}px)` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(0,0,0,.25) 100%)' }} />
      </div>
      <div style={{ position: 'absolute', top: -46, [T.rtl ? 'left' : 'right']: -26, width: 150, height: 150, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', fontSize: 78, boxShadow: '0 18px 40px rgba(255,106,19,.5), 0 0 0 10px rgba(255,255,255,.9)', transform: `scale(${b}) rotate(${(1 - b) * 90 + Math.sin(f / 6) * 6}deg)` }}>{badge}</div>
    </div>
  );
};

// Le téléphone avec la vraie appli qui défile, un doigt qui touche, « commande envoyée »
const Phone: React.FC<{ lang: LancementLang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const p = sp(f, 2, 12, 140, 0.8);
  const scroll = lerp(f, [20, 62], [0, -300], Easing.inOut(Easing.cubic));
  const tap = lerp(f, [64, 72], [0, 1]), tapOut = lerp(f, [72, 80], [1, 0]);
  const toast = sp(f, 70, 12, 220, 0.6);
  const W = 470, H = 960;
  const orbit = ['🍕', '🛒', '💐', '📦', '💊', '🥖'];
  return (
    <>
      {orbit.map((e, k) => {
        const a = (k / orbit.length) * Math.PI * 2 + f / 26;
        const s = sp(f, 8 + k * 3, 10, 240, 0.5);
        return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(a) * 410 - 55, top: 1080 + Math.sin(a) * 470 - 55, width: 110, height: 110, borderRadius: 34, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 62, boxShadow: '0 16px 30px rgba(0,0,0,.3)', transform: `scale(${s}) rotate(${Math.sin(a) * 10}deg)` }}>{e}</div>;
      })}
      <div style={{ position: 'absolute', left: 540 - W / 2, top: 600, width: W, height: H, borderRadius: 70, background: '#0B1426', padding: 14, boxShadow: '0 60px 100px rgba(0,0,0,.55), inset 0 0 0 3px #2B3D63', transform: `translateY(${(1 - p) * 500}px) rotate(${(1 - p) * 8}deg)` }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 58, overflow: 'hidden', background: '#fff' }}>
          <Img src={staticFile(`lancement/app-${lang}.jpg`)} style={{ position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${scroll}px)` }} />
          <div style={{ position: 'absolute', top: 16, left: '50%', width: 130, height: 34, marginLeft: -65, borderRadius: 20, background: '#0B1426' }} />
          <div style={{ position: 'absolute', left: 24, right: 24, top: 70, padding: '20px 22px', borderRadius: 26, background: C.green, color: '#fff', font: `700 30px/1 ${UI}`, textAlign: 'center', transform: `translateY(${(1 - toast) * -200}px)`, boxShadow: '0 14px 30px rgba(0,0,0,.25)' }}>{T.toast}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 540 - 60, top: 1280 - 60, width: 120, height: 120, borderRadius: '50%', border: `8px solid ${C.orange}`, opacity: tap * tapOut, transform: `scale(${0.4 + tap * 0.9})` }} />
      <div style={{ position: 'absolute', left: 540 - 34, top: 1280 - 34, width: 68, height: 68, borderRadius: '50%', background: 'rgba(255,255,255,.85)', boxShadow: '0 6px 16px rgba(0,0,0,.3)', opacity: lerp(f, [56, 62, 80, 86], [0, 1, 1, 0]), transform: `scale(${1 - 0.18 * tap * tapOut})` }} />
    </>
  );
};

const Chips: React.FC<{ chips: string[]; sky?: boolean; top?: number }> = ({ chips, sky, top = 1545 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top, left: 50, right: 50, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, direction: T.rtl ? 'rtl' : 'ltr' }}>
      {chips.map((c, k) => {
        const s = sp(f, 20 + k * 5, 9, 260, 0.5);
        return <div key={k} style={{ padding: '22px 34px', borderRadius: 999, background: sky ? C.navy : 'rgba(255,255,255,.1)', border: sky ? 'none' : '2px solid rgba(255,255,255,.22)', color: '#fff', font: `700 ${T.rtl ? 42 : 40}px/1 ${UI}`, transform: `scale(${s})`, whiteSpace: 'nowrap' }}>{c}</div>;
      })}
    </div>
  );
};

const SceneView: React.FC<{ i: number; lang: LancementLang }> = ({ i, lang }) => {
  const s = T.scenes[i];
  return (
    <AbsoluteFill style={{ background: s.sky ? SKY : NAVY, overflow: 'hidden' }}>
      <Speed sky={s.sky} />
      <Title s={s} sky={s.sky} />
      {s.img ? <Card img={s.img} badge={s.badge} pos={s.pos} /> : <Phone lang={lang} />}
      <Chips chips={s.chips} sky={s.sky} top={s.img ? 1545 : 1610} />
    </AbsoluteFill>
  );
};

// La fin : le logo claque, « Demandez. On livre ! », l'adresse, Hoppy arrive en sautant
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const letter = (i: number) => {
    const s = spring({ frame: f - 4 - i * 3, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * 500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * 80 : 0, o: f >= 4 + i * 3 ? 1 : 0 };
  };
  const a = sp(f, 18, 12, 240, 0.6), b = sp(f, 26, 8, 300, 0.5), u = sp(f, 36, 12, 200, 0.6);
  const emo = ['🍕', '🛒', '💐', '📦', '💊', '🥖', '🎁', '👔'];
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden' }}>
      <Speed />
      {emo.map((e, k) => {
        const ang = (k / emo.length) * Math.PI * 2 + f / 40;
        return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(ang) * 470 - 40, top: 760 + Math.sin(ang) * 560 - 40, fontSize: 80, opacity: 0.22 * lerp(f, [0, 20], [0, 1]) }}>{e}</div>;
      })}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 330 }}>
        <Wordmark width={720} anim={letter} />
        <div style={{ marginTop: 70, font: `700 ${T.rtl ? 100 : 108}px/1.05 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - a) * 60}px)`, opacity: Math.min(1, a * 1.5), direction: T.rtl ? 'rtl' : 'ltr' }}>{T.out[0]}</div>
        <div style={{ marginTop: 24, padding: '26px 56px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 ${T.rtl ? 88 : 92}px/1 ${DISPLAY}`, transform: `scale(${b}) rotate(-3deg)`, boxShadow: '0 24px 50px rgba(255,106,19,.45)', direction: T.rtl ? 'rtl' : 'ltr' }}>{T.out[1]}</div>
        <div style={{ marginTop: 64, padding: '24px 44px', borderRadius: 30, background: '#fff', color: C.navy, font: `700 50px/1 ${UI}`, transform: `translateY(${(1 - u) * 80}px)`, opacity: u, direction: 'ltr' }}>hop-livraison.vercel.app</div>
        <div style={{ marginTop: 34, font: `600 ${T.rtl ? 40 : 38}px/1.2 ${UI}`, color: '#C9D3EA', opacity: lerp(f, [44, 54], [0, 1]), direction: T.rtl ? 'rtl' : 'ltr' }}>{T.info}</div>
      </AbsoluteFill>
      <HoppyHop x={T.rtl ? 820 : 260} bottom={1900} h={560} at={1.6} from={T.rtl ? 'right' : 'left'} />
    </AbsoluteFill>
  );
};

// Volet orange en diagonale entre deux scènes
const Wipes: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {CUTS.map(c => {
        const t = lerp(f, [c - 7, c + 7], [0, 1], Easing.inOut(Easing.cubic));
        if (t <= 0 || t >= 1) return null;
        const x = lerp(t, [0, 1], [1400, -2000]);
        return <AbsoluteFill key={c} style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -400, left: x, width: 900, height: 2800, background: C.orange, transform: 'rotate(14deg)' }} />
          <div style={{ position: 'absolute', top: -400, left: x + 900, width: 260, height: 2800, background: '#fff', transform: 'rotate(14deg)' }} />
        </AbsoluteFill>;
      })}
    </>
  );
};

// En-tête fixe (logo + ville) et barre de progression
const Chrome: React.FC = () => {
  const f = useCurrentFrame();
  const scene = Math.min(6, Math.floor(f / SC));
  const sky = f < OUT && T.scenes[scene] && T.scenes[scene].sky;
  return (
    <>
      <div style={{ position: 'absolute', top: 80, left: 70, right: 70, display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: 'ltr', opacity: f < OUT ? 1 : 0 }}>
        <div style={{ font: `700 64px/1 ${DISPLAY}`, color: sky ? C.navy : '#fff' }}>HOP<span style={{ color: C.orange }}>!</span></div>
        <div style={{ padding: '14px 26px', borderRadius: 999, background: sky ? C.navy : 'rgba(255,255,255,.12)', color: '#fff', font: `800 28px/1 ${UI}`, letterSpacing: T.rtl ? 0 : 4 }}>📍 {T.city}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 70, left: 70, right: 70, display: 'flex', gap: 12, direction: T.rtl ? 'rtl' : 'ltr' }}>
        {Array.from({ length: 7 }).map((_, k) => {
          const st = k * SC, en = k === 6 ? 780 : st + SC;
          const fill = lerp(f, [st, en], [0, 1]);
          return <div key={k} style={{ flex: 1, height: 8, borderRadius: 9, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}><div style={{ width: `${fill * 100}%`, height: '100%', background: C.orange }} /></div>;
        })}
      </div>
    </>
  );
};

export const Lancement: React.FC<{ music?: boolean; lang?: LancementLang }> = ({ music = true, lang = 'fr' }) => {
  T = STR[lang];
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      {T.scenes.map((_, i) => <Sequence key={i} from={i * SC} durationInFrames={SC}><SceneView i={i} lang={lang} /></Sequence>)}
      <Sequence from={OUT} durationInFrames={LANCEMENT_FRAMES - OUT}><Outro /></Sequence>
      <Chrome />
      <Wipes />
      <Vignette />
      <Grain />
      {music && <Audio src={staticFile('lancement-music.wav')} />}
    </AbsoluteFill>
  );
};
