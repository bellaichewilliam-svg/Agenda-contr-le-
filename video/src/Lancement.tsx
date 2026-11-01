import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, Easing } from 'remotion';
import { HoppyHop } from './HoppyHop';
import { C, DISPLAY, UI } from './theme';
import { Grain, Vignette, Wordmark } from './Reel';
import { SPLASH_SVG } from './splashLogo';

// « Film de lancement » HOP! : 26 s, 1080 × 1920, construit sur les vraies affiches du patron (public/lancement/affiches,
// versions FR et HE). Ouverture logo (2 s), 6 affiches de 3,3 s (entrée en 3D, reflet, mouvement de caméra vers le prix),
// fin « Demandez. On livre ! » avec l'adresse et Hoppy qui arrive en sautant.
export const LANCEMENT_FRAMES = 780;
export type LancementLang = 'fr' | 'he';
const INTRO = 60, P = 100, OUT = INTRO + 6 * P, END = 735; // 660 ; écran d'ouverture final à 735
const CUTS = [INTRO, ...Array.from({ length: 5 }, (_, i) => INTRO + (i + 1) * P), OUT];

type Poster = { id: string; sq?: boolean; fx: number; fy: number; cap: string };
const POSTERS: Omit<Poster, 'cap'>[] = [
  { id: 'pensez', sq: true, fx: 0.5, fy: 0.86 },
  { id: 'livre', fx: 0.82, fy: 0.34 },
  { id: 'magasins', fx: 0.5, fy: 0.52 },
  { id: 'halot', fx: 0.8, fy: 0.41 },
  { id: 'visite', fx: 0.83, fy: 0.38 },
  { id: 'client', fx: 0.82, fy: 0.38 },
];
const STR: Record<LancementLang, { rtl: boolean; city: string; tag: string; word: string; caps: string[]; out: [string, string]; info: string }> = {
  fr: { rtl: false, city: 'NETANYA', tag: 'La livraison qui fait HOP !', word: 'LIVRAISON',
    caps: ['Vous y pensez…', '… on vous le livre.', 'Vos magasins préférés', 'Les hallot du vendredi', 'Du nouveau chaque semaine', 'Votre 1re course : 15 ₪'],
    out: ['Demandez.', 'On livre !'], info: '📍 Suivi en direct · 💵 Espèces ou Bit' },
  he: { rtl: true, city: 'נתניה', tag: 'המשלוחים שעושים הופ!', word: 'משלוחים',
    caps: ['חושבים על משהו…', '… ואנחנו מביאים.', 'החנויות שאתם אוהבים', 'החלות של יום שישי', 'חדש בכל שבוע', 'המשלוח הראשון: 15 ₪'],
    out: ['אתם מבקשים.', 'אנחנו מביאים!'], info: '📍 מעקב בזמן אמת · 💵 מזומן או ביט' },
};
let T = STR.fr;
let LANG: LancementLang = 'fr';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, i: number[], o: number[], e?: (t: number) => number) => interpolate(f, i, o, e ? { ...clamp, easing: e } : clamp);
const sp = (f: number, d: number, damping = 13, stiffness = 200, mass = 0.7) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const io = Easing.inOut(Easing.cubic);
const NAVY = `radial-gradient(ellipse 90% 70% at 50% 42%, #1E3E86 0%, ${C.navy2} 45%, ${C.navy} 100%)`;

const Speed: React.FC<{ o?: number }> = ({ o = 0.35 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: o }}>
      {Array.from({ length: 14 }).map((_, k) => {
        const y = 200 + ((k * 137) % 1550), len = 160 + (k % 4) * 90, v = 22 + (k % 5) * 8;
        const x = 1200 - ((f * v + k * 260) % 1700);
        return <div key={k} style={{ position: 'absolute', left: x, top: y, width: len, height: 6 + (k % 3) * 2, borderRadius: 9, background: k % 4 === 0 ? C.orange : '#fff', opacity: 0.25 + (k % 3) * 0.15 }} />;
      })}
    </AbsoluteFill>
  );
};

// ===== L'écran d'ouverture de l'appli, à l'identique (bleu nuit, logo HOP!, « LIVRAISON » espacé) ========
// Au début : il apparaît comme quand on ouvre HOP!. À la fin : on y revient.
const Splash: React.FC<{ fadeIn?: number }> = ({ fadeIn = 8 }) => {
  const f = useCurrentFrame();
  const o = lerp(f, [0, fadeIn], [0, 1]);
  const s = sp(f, 0, 16, 120, 0.8);
  const w = lerp(f, [6, 18], [0, 1], Easing.out(Easing.cubic));
  return (
    <AbsoluteFill style={{ background: '#0F1F3D', alignItems: 'center', justifyContent: 'center', gap: 34, opacity: o }}>
      <div style={{ width: 640, transform: `scale(${0.9 + 0.1 * s})` }} dangerouslySetInnerHTML={{ __html: SPLASH_SVG.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ') }} />
      <div style={{ font: `700 ${T.rtl ? 46 : 42}px/1 Rubik, sans-serif`, letterSpacing: T.rtl ? '0.25em' : '0.42em', marginInlineStart: T.rtl ? 0 : '0.42em', color: '#fff', opacity: 0.92 * w, direction: T.rtl ? 'rtl' : 'ltr' }}>{T.word}</div>
    </AbsoluteFill>
  );
};

// ===== Une affiche : fond flouté de l'affiche, entrée en 3D, reflet, caméra qui pousse vers le prix =====
const PosterScene: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const p = { ...POSTERS[i], cap: T.caps[i] };
  const src = staticFile(`lancement/affiches/${p.id}-${LANG}.jpg`);
  const W = 1000, H = p.sq ? 1000 : 1250, L = 40, TOP = p.sq ? 390 : 290;
  const dir = i % 2 ? -1 : 1;
  const e = sp(f, 0, 14, 120, 0.9);
  const cam = lerp(f, [30, 100], [1, 1.045], io); // léger : l'affiche reste toujours entière
  const ox = L + p.fx * W, oy = TOP + p.fy * H;
  const shine = lerp(f, [14, 34], [-0.4, 1.4]);
  const c = sp(f, 18, 12, 220, 0.6);
  const capOut = lerp(f, [40, 52], [1, 0]);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <Img src={src} style={{ position: 'absolute', inset: -120, width: 1320, height: 2160, objectFit: 'cover', filter: 'blur(42px) saturate(1.3)', transform: `scale(${1.1 + f * 0.0015})` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(15,31,61,.55) 0%, rgba(15,31,61,.35) 45%, rgba(15,31,61,.8) 100%)' }} />
      <Speed o={0.25} />
      <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, transform: `scale(${cam})` }}>
        <div style={{ position: 'absolute', left: L, top: TOP, width: W, height: H, perspective: 2200 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 34, overflow: 'hidden', boxShadow: '0 60px 120px rgba(0,0,0,.55), 0 0 0 4px rgba(255,255,255,.15)',
            transform: `translateX(${dir * (1 - e) * 520}px) rotateY(${dir * (1 - e) * -62}deg) rotateZ(${dir * (1 - e) * 6}deg) scale(${0.75 + 0.25 * e})`, opacity: Math.min(1, e * 2.5) }}>
            <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: -200, bottom: -200, width: 260, left: `${shine * 100}%`, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.45), rgba(255,255,255,0))', transform: 'rotate(18deg)' }} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 60, right: 60, top: p.sq ? 1450 : 1585, textAlign: 'center', direction: T.rtl ? 'rtl' : 'ltr', opacity: capOut, transform: `translateY(${(1 - c) * 80 + (1 - capOut) * 40}px)` }}>
        <span style={{ display: 'inline-block', padding: '24px 46px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 ${T.rtl ? 64 : 62}px/1.1 ${DISPLAY}`, boxShadow: '0 24px 50px rgba(255,106,19,.45)', transform: `scale(${0.6 + 0.4 * c})` }}>{p.cap}</span>
      </div>
    </AbsoluteFill>
  );
};

// ===== Fin : le logo, « Demandez. On livre ! », l'adresse, Hoppy arrive en sautant ==================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const letter = (i: number) => {
    const s = spring({ frame: f - 4 - i * 3, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * 500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * 80 : 0, o: f >= 4 + i * 3 ? 1 : 0 };
  };
  const a = sp(f, 16, 12, 240, 0.6), b = sp(f, 24, 8, 300, 0.5), u = sp(f, 34, 12, 200, 0.6);
  const thumbs = POSTERS.map(x => x.id);
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden' }}>
      <Speed />
      {/* les 6 affiches en mosaïque qui défile doucement derrière */}
      <div style={{ position: 'absolute', left: -120, top: -200, width: 1400, display: 'flex', flexWrap: 'wrap', gap: 30, opacity: 0.13, transform: `rotate(-12deg) translateY(${-f * 1.2}px)` }}>
        {[...thumbs, ...thumbs, ...thumbs].map((id, k) => <Img key={k} src={staticFile(`lancement/affiches/${id}-${LANG}.jpg`)} style={{ width: 300, height: 375, objectFit: 'cover', borderRadius: 20 }} />)}
      </div>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 330 }}>
        <Wordmark width={720} anim={letter} />
        <div style={{ marginTop: 70, font: `700 ${T.rtl ? 100 : 108}px/1.05 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - a) * 60}px)`, opacity: Math.min(1, a * 1.5), direction: T.rtl ? 'rtl' : 'ltr' }}>{T.out[0]}</div>
        <div style={{ marginTop: 24, padding: '26px 56px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 ${T.rtl ? 88 : 92}px/1 ${DISPLAY}`, transform: `scale(${b}) rotate(-3deg)`, boxShadow: '0 24px 50px rgba(255,106,19,.45)', direction: T.rtl ? 'rtl' : 'ltr' }}>{T.out[1]}</div>
        <div style={{ marginTop: 64, padding: '24px 44px', borderRadius: 30, background: '#fff', color: C.navy, font: `700 50px/1 ${UI}`, transform: `translateY(${(1 - u) * 80}px)`, opacity: u, direction: 'ltr' }}>hop-livraison.vercel.app</div>
        <div style={{ marginTop: 34, font: `600 ${T.rtl ? 40 : 38}px/1.2 ${UI}`, color: '#C9D3EA', opacity: lerp(f, [42, 52], [0, 1]), direction: T.rtl ? 'rtl' : 'ltr' }}>{T.info}</div>
      </AbsoluteFill>
      <HoppyHop x={T.rtl ? 820 : 260} bottom={1900} h={560} at={0.9} from={T.rtl ? 'right' : 'left'} />
    </AbsoluteFill>
  );
};

// Volet orange en diagonale entre deux scènes
const Wipes: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {CUTS.map(c => {
        const t = lerp(f, [c - 7, c + 7], [0, 1], io);
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

// En-tête (logo + ville) et barre de progression pendant les affiches
const Chrome: React.FC = () => {
  const f = useCurrentFrame();
  const on = f >= INTRO && f < OUT ? 1 : 0;
  return (
    <>
      <div style={{ position: 'absolute', top: 90, left: 70, right: 70, display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: 'ltr', opacity: on }}>
        <div style={{ font: `700 64px/1 ${DISPLAY}`, color: '#fff', textShadow: '0 6px 20px rgba(0,0,0,.35)' }}>HOP<span style={{ color: C.orange }}>!</span></div>
        <div style={{ padding: '14px 26px', borderRadius: 999, background: 'rgba(15,31,61,.6)', color: '#fff', font: `800 28px/1 ${UI}`, letterSpacing: T.rtl ? 0 : 4 }}>📍 {T.city}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 70, left: 70, right: 70, display: 'flex', gap: 12, direction: T.rtl ? 'rtl' : 'ltr', opacity: on }}>
        {POSTERS.map((_, k) => {
          const st = INTRO + k * P;
          const fill = lerp(f, [st, st + P], [0, 1]);
          return <div key={k} style={{ flex: 1, height: 8, borderRadius: 9, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}><div style={{ width: `${fill * 100}%`, height: '100%', background: C.orange }} /></div>;
        })}
      </div>
    </>
  );
};

export const Lancement: React.FC<{ music?: boolean; lang?: LancementLang }> = ({ music = true, lang = 'fr' }) => {
  T = STR[lang]; LANG = lang;
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      <Sequence durationInFrames={INTRO}><Splash fadeIn={6} /></Sequence>
      {POSTERS.map((_, i) => <Sequence key={i} from={INTRO + i * P} durationInFrames={P}><PosterScene i={i} /></Sequence>)}
      <Sequence from={OUT} durationInFrames={END - OUT + 10}><Outro /></Sequence>
      <Sequence from={END}><Splash fadeIn={10} /></Sequence>
      <Chrome />
      <Wipes />
      <Vignette />
      <Grain />
      {music && <Audio src={staticFile('lancement-music.wav')} />}
    </AbsoluteFill>
  );
};
