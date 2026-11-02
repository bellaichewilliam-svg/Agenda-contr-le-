import React from 'react';
import { AbsoluteFill, Audio, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { HoppyHop } from './HoppyHop';
import { C, DISPLAY, UI } from './theme';
import { Digit, Grain, Vignette, Wordmark, inExpo as inExpoRaw, lerp, outExpo, shake } from './Reel';

// « Arrêtez de payer plus cher. Optez pour HOP! » : 18,5 s, 1080 × 1920, 120 BPM (1 temps = 15 images).
// 1. une étiquette de prix gonfle jusqu'à éclater · 2. les mots claquent · 3. écran coupé en deux : ailleurs les frais
// s'empilent et s'écroulent, chez HOP! tout est simple · 4. « dès 25 ₪ » · 5. on livre tout · 6. fin + Hoppy.
// Aucune plateforme nommée, aucune durée de livraison. Musique : scripts/stop_music.py (mêmes images clés).
export const STOP_FRAMES = 555;
export type StopLang = 'fr' | 'he';
const RED = '#F04438', REDDARK = '#3A0B10';
const STR = {
  fr: { rtl: false, words: ['ARRÊTEZ', 'DE PAYER', 'PLUS CHER.'], band: '+ FRAIS', elsewhere: '🧾 AILLEURS',
    fees: ['Menu plus cher que sur place', 'Frais de service', 'Frais de livraison', 'Petite commande', 'Heure de pointe'], tooMuch: 'TROP CHER !',
    hop: ['Le prix du resto', '0 ₪ de frais de service', 'Livraison dès 25 ₪'], from: 'LA LIVRAISON, DÈS', sub: ['Dans Netanya.', 'Sans frais cachés.'],
    allT: 'ET ON LIVRE TOUT', all: [['🍔', 'Vos restos'], ['💊', 'La pharmacie'], ['📦', 'Vos colis'], ['🔑', 'Les clés oubliées'], ['💐', 'Les fleurs'], ['👔', 'Le pressing']],
    out: ['Arrêtez de payer plus cher.', 'Optez pour HOP!'] },
  he: { rtl: true, words: ['מספיק', 'לשלם', 'ביוקר.'], band: '+ עמלות', elsewhere: '🧾 במקום אחר',
    fees: ['תפריט יקר יותר מבמקום', 'דמי שירות', 'דמי משלוח', 'תוספת הזמנה קטנה', 'תוספת שעות עומס'], tooMuch: 'יקר מדי!',
    hop: ['המחיר של המסעדה', '0 ₪ דמי שירות', 'משלוח החל מ־25 ₪'], from: 'המשלוח, החל מ־', sub: ['בנתניה.', 'בלי עמלות נסתרות.'],
    allT: 'ומביאים הכול', all: [['🍔', 'המסעדות שלכם'], ['💊', 'בית המרקחת'], ['📦', 'החבילות שלכם'], ['🔑', 'מפתחות ששכחתם'], ['💐', 'פרחים'], ['👔', 'ניקוי יבש']],
    out: ['מספיק לשלם ביוקר.', 'עברו ל־HOP!'] },
};
let T = STR.fr; // fixé par <Stop lang> avant le rendu des scènes
const iso = { unicodeBidi: 'isolate' as const, direction: 'ltr' as const };
const inExpo = (t: number) => (t <= 0 ? 0 : inExpoRaw(t));
const sp = (f: number, d: number, damping = 11, stiffness = 260, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
// « HOP! » toujours de gauche à droite, même dans une phrase en hébreu
const withHop = (s: string, bang = C.orange) => {
  const [a, b] = s.split('HOP!');
  return b === undefined ? s : <>{a}<span style={{ ...iso, display: 'inline-block' }}>HOP<span style={{ color: bang }}>!</span></span>{b}</>;
};
const CUTS = [60, 150, 270, 360, 450];
const Flashes: React.FC = () => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...CUTS.map(c => (f >= c ? lerp(f, [c, c + 6], [0.6, 0]) : 0)));
  return <AbsoluteFill style={{ background: '#fff', opacity: o, pointerEvents: 'none' }} />;
};

// ===== 1. L'étiquette de prix gonfle… et éclate ==============================================
const Tag: React.FC = () => {
  const f = useCurrentFrame();
  const enter = sp(f, 0, 9, 160, 0.8);
  const swing = Math.sin(f / 5) * 12 * lerp(f, [0, 40], [1, 0.3]);
  const grow = lerp(f, [8, 46], [1, 2.15], inExpo) + Math.sin(f * 2.1) * lerp(f, [30, 46], [0, 0.05]);
  const popped = f >= 47;
  const price = Math.round(lerp(f, [6, 46], [19, 999], inExpo));
  const sh = shake(f, 30, lerp(f, [30, 46], [2, 22]), 17);
  const burst = lerp(f, [47, 60], [0, 1], outExpo);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, #1C2A4A 0%, ${C.navy} 55%, #070C18 100%)`, overflow: 'hidden' }}>
      {/* compteur qui s'affole en fond */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: `700 520px/1 ${DISPLAY}`, color: 'transparent',
        WebkitTextStroke: '3px rgba(240,68,56,.18)', ...iso, opacity: popped ? 0 : lerp(f, [10, 30], [0, 1]) }}>{price}</div>
      {!popped && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
          <div style={{ transform: `translateY(${(1 - enter) * -1100}px) rotate(${swing}deg) scale(${grow})`, transformOrigin: '50% -160px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '50%', top: -260, width: 4, height: 230, background: 'linear-gradient(#fff0, #E9D9C4)', transform: 'translateX(-50%)' }} />
            <div style={{ width: 460, height: 300, position: 'relative', background: `linear-gradient(135deg, #FF5A4E, ${RED} 55%, #C01F14)`,
              clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 18% 100%, 0 50%)', borderRadius: 28, boxShadow: '0 40px 80px rgba(0,0,0,.45)',
              display: 'grid', placeItems: 'center', paddingLeft: 70 }}>
              <div style={{ position: 'absolute', left: 52, top: '50%', width: 34, height: 34, borderRadius: '50%', background: C.navy, transform: 'translateY(-50%)' }} />
              <div style={{ font: `700 150px/1 ${DISPLAY}`, color: '#fff', ...iso, textShadow: '0 6px 0 rgba(0,0,0,.18)' }}>{price}<span style={{ fontSize: 90 }}> ₪</span></div>
            </div>
          </div>
        </AbsoluteFill>
      )}
      {popped && (
        <AbsoluteFill>
          <div style={{ position: 'absolute', left: 540, top: 960, width: 60 + burst * 2600, height: 60 + burst * 2600, borderRadius: '50%',
            border: `${lerp(burst, [0, 1], [40, 2])}px solid ${RED}`, transform: 'translate(-50%,-50%)', opacity: 1 - burst }} />
          {Array.from({ length: 34 }).map((_, k) => {
            const a = random(`a${k}`) * Math.PI * 2, d = 200 + random(`d${k}`) * 900, s = 20 + random(`s${k}`) * 50;
            return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(a) * d * burst, top: 960 + Math.sin(a) * d * burst + burst * burst * 300,
              width: s, height: s * 0.6, background: k % 3 ? RED : '#fff', borderRadius: 6, transform: `rotate(${k * 47 + burst * 400}deg)`, opacity: 1 - burst * 0.8 }} />;
          })}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ===== 2. « ARRÊTEZ · DE PAYER · PLUS CHER. » : un mot par temps ===========================
const Words: React.FC = () => {
  const f = useCurrentFrame();
  const BG = [RED, '#fff', C.navy];
  const k = f < 15 ? 0 : f < 30 ? 1 : 2;
  const stack = lerp(f, [45, 58], [0, 1], outExpo);
  const out = lerp(f, [78, 90], [0, 1], inExpo);
  const sh = shake(f, k * 15, 18, 9);
  const angle = -8;
  return (
    <AbsoluteFill style={{ background: stack > 0 ? C.navy : BG[k], overflow: 'hidden' }}>
      {/* bandes « + FRAIS » qui défilent en biais */}
      {[0, 1, 2, 3, 4, 5].map(r => (
        <div key={r} style={{ position: 'absolute', left: -400, top: 120 + r * 300, width: 2400, whiteSpace: 'nowrap', transform: `rotate(${angle}deg) translateX(${(r % 2 ? 1 : -1) * f * 14 - 300}px)`,
          font: `700 150px/1 ${DISPLAY}`, color: 'transparent', WebkitTextStroke: `3px ${stack > 0 ? 'rgba(240,68,56,.28)' : k === 1 ? 'rgba(15,31,61,.12)' : 'rgba(255,255,255,.16)'}` }}>
          {Array(8).fill(T.band).join('  ·  ')}
        </div>
      ))}
      {stack === 0 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
          {(() => {
            const s = sp(f, k * 15, 13, 420, 0.5);
            const w = T.words[k];
            const size = T.rtl ? Math.min(330, 1900 / w.length) : Math.min(300, 1700 / w.length);
            return <div style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: k === 1 ? C.navy : '#fff', whiteSpace: 'nowrap',
              transform: `scale(${3 - 2 * s}) skewX(${(1 - s) * -18}deg)`, filter: `blur(${(1 - s) * 16}px)`, letterSpacing: `${(1 - s) * 0.3}em` }}>{w}</div>;
          })()}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + out * 7}) rotate(${out * -6}deg)`, opacity: 1 - lerp(out, [0.6, 1], [0, 1]) }}>
          {T.words.map((w, i) => {
            const s = sp(f, 45 + i * 3, 12, 300, 0.5);
            const last = i === 2;
            return <div key={i} style={{ font: `700 ${last ? (T.rtl ? 230 : 190) : (T.rtl ? 190 : 165)}px/1.02 ${DISPLAY}`, color: last ? RED : '#fff', whiteSpace: 'nowrap',
              transform: `translateX(${(1 - s) * (i % 2 ? 900 : -900)}px)`, textShadow: last ? `0 0 60px rgba(240,68,56,${0.4 + 0.2 * Math.sin(f / 3)})` : 'none' }}>{w}</div>;
          })}
          <div style={{ marginTop: 26, height: 14, width: 760 * lerp(f, [60, 72], [0, 1], outExpo), background: RED, borderRadius: 8 }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ===== 3. Écran coupé en deux : ailleurs ça s'empile, chez HOP! c'est simple =================
const FeeChip: React.FC<{ i: number; f: number }> = ({ i, f }) => {
  const at = 8 + i * 14;
  const s = sp(f, at, 9, 200, 0.7);
  const fall = lerp(f, [92 + i * 2, 112 + i * 2], [0, 1], inExpo);
  const rot = (random(`r${i}`) - 0.5) * 7 + fall * (i % 2 ? 70 : -60);
  const y = 820 - i * 118;
  if (f < at) return null;
  return (
    <div style={{ position: 'absolute', left: 540, top: y, transform: `translate(-50%, ${(1 - s) * -700 + fall * 1100}px) rotate(${rot}deg)`,
      display: 'flex', alignItems: 'center', gap: 18, padding: '20px 34px', borderRadius: 26, background: '#fff', boxShadow: '0 16px 30px rgba(0,0,0,.35)', whiteSpace: 'nowrap' }}>
      <span style={{ width: 54, height: 54, borderRadius: '50%', background: RED, color: '#fff', display: 'grid', placeItems: 'center', font: `800 44px/1 ${UI}` }}>+</span>
      <span style={{ font: `700 50px/1 ${UI}`, color: '#1D2433' }}>{T.fees[i]}</span>
    </div>
  );
};
const Split: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 12], [0, 1], outExpo);
  const take = lerp(f, [104, 120], [0, 1], inExpo); // la moitié HOP! prend tout l'écran
  const mid = 960 - take * 960;
  const stamp = lerp(f, [76, 84], [0, 1], outExpo);
  const sh = shake(f, 78, 16, 10);
  const shColl = shake(f, 94, 10, 12);
  const meter = lerp(f, [8, 76], [0, 1]);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      {/* moitié haute : ailleurs */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: mid, overflow: 'hidden',
        background: `radial-gradient(circle at 50% 100%, #6B1219 0%, ${REDDARK} 70%)`, transform: `translate(${sh.x + shColl.x}px, ${(1 - open) * -960 + sh.y}px)` }}>
        <div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', font: `800 44px/1 ${UI}`, letterSpacing: T.rtl ? '.06em' : '.3em', color: '#FFB4AE' }}>{T.elsewhere}</div>
        {/* jauge qui monte dans le rouge */}
        <div style={{ position: 'absolute', [T.rtl ? 'left' : 'right']: 50, top: 150, width: 26, height: 740, borderRadius: 14, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${meter * 100}%`, background: `linear-gradient(#FF2D20, #FFB020)` }} />
        </div>
        {T.fees.map((_, i) => <FeeChip key={i} i={i} f={f} />)}
        <div style={{ position: 'absolute', left: 540, top: 470, transform: `translate(-50%,-50%) rotate(-9deg) scale(${1 + (1 - stamp) * 2.6})`, opacity: stamp * (1 - take),
          padding: '26px 56px', border: '10px solid #fff', borderRadius: 26, background: RED, boxShadow: '0 30px 80px rgba(0,0,0,.5)', font: `800 110px/1 ${UI}`, color: '#fff', whiteSpace: 'nowrap' }}>{T.tooMuch}</div>
      </div>
      {/* moitié basse : HOP! */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: mid, bottom: 0, transform: `translateY(${(1 - open) * 960}px)`,
        background: `radial-gradient(circle at 50% 0%, #22406F 0%, ${C.navy} 70%)` }}>
        <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 1 - take }}>
          <Wordmark width={300} />
        </div>
        {T.hop.map((t, i) => {
          const s = sp(f, 22 + i * 18, 12, 220, 0.6);
          const big = i === 2;
          return (
            <div key={i} style={{ position: 'absolute', left: 540, top: 330 + i * 150, transform: `translate(-50%, 0) translateX(${(1 - s) * (T.rtl ? -1 : 1) * 900}px)`, opacity: (f >= 22 + i * 18 ? 1 : 0) * (1 - take),
              display: 'flex', alignItems: 'center', gap: 20, whiteSpace: 'nowrap', padding: '22px 38px', borderRadius: 999,
              background: big ? C.orange : 'rgba(255,255,255,.08)', border: big ? 'none' : '2px solid rgba(255,255,255,.18)' }}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: big ? '#fff' : C.green, color: big ? C.orange : '#fff', display: 'grid', placeItems: 'center', font: `800 38px/1 ${UI}` }}>✓</span>
              <span style={{ font: `700 ${big ? 60 : 54}px/1 ${UI}`, color: '#fff' }}>{t}</span>
            </div>
          );
        })}
      </div>
      {/* la ligne de séparation */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: mid - 4, height: 8, background: C.orange, boxShadow: `0 0 40px ${C.orange}`, transform: `scaleX(${open})`, opacity: 1 - take }} />
    </AbsoluteFill>
  );
};

// ===== 4. « dès 25 ₪ » : les chiffres tournent et tombent pile ===============================
const TwentyFive: React.FC = () => {
  const f = useCurrentFrame();
  const card = sp(f, 0, 12, 180, 0.7);
  const land = 30;
  const ring = lerp(f, [land, land + 22], [0, 1], outExpo);
  const sh = shake(f, land, 14, 10);
  const sub = (d: number) => lerp(f, [d, d + 10], [0, 1], outExpo);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 65%)`, overflow: 'hidden' }}>
      {/* rayons qui tournent */}
      <div style={{ position: 'absolute', left: 540, top: 900, width: 2600, height: 2600, transform: `translate(-50%,-50%) rotate(${f * 0.6}deg)`, opacity: 0.22,
        background: `repeating-conic-gradient(${C.orange} 0deg 6deg, transparent 6deg 22deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 60%)' }} />
      <div style={{ position: 'absolute', left: 540, top: 900, width: 100 + ring * 2000, height: 100 + ring * 2000, borderRadius: '50%', border: `${lerp(ring, [0, 1], [26, 2])}px solid ${C.orange}`,
        transform: 'translate(-50%,-50%)', opacity: f >= land ? 1 - ring : 0 }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ font: `800 50px/1 ${UI}`, letterSpacing: T.rtl ? '.05em' : '.22em', color: C.peach, marginBottom: 40, opacity: sub(4) }}>{T.from}</div>
        <div style={{ display: 'flex', alignItems: 'center', ...iso, padding: '20px 60px 20px 40px', borderRadius: 70, background: '#fff', boxShadow: `0 40px 100px rgba(0,0,0,.45), 0 0 ${80 * (1 - ring)}px ${C.orange}`,
          transform: `scale(${0.4 + 0.6 * card}) rotate(${(1 - card) * -12}deg)` }}>
          <Digit to={2} land={land - 6} />
          <Digit to={5} land={land} />
          <div style={{ font: `700 230px/1 ${DISPLAY}`, color: C.orange, marginLeft: 10, transform: `scale(${f >= land ? sp(f, land, 8, 300, 0.5) : 0})` }}>₪</div>
        </div>
        <div style={{ marginTop: 60, textAlign: 'center', font: `700 76px/1.15 ${DISPLAY}`, color: '#fff' }}>
          <div style={{ opacity: sub(40), transform: `translateY(${(1 - sub(40)) * 40}px)` }}>{T.sub[0]}</div>
          <div style={{ color: C.orange, opacity: sub(50), transform: `translateY(${(1 - sub(50)) * 40}px)` }}>{T.sub[1]}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 5. Et on livre tout : un mot par temps ================================================
const ALL_BG = [[C.navy, '#fff'], ['#fff', C.navy], [C.orange, '#fff'], [C.navy2, '#fff'], [C.cream, C.navy], [C.navy, '#fff']];
const AllOne: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const [bg, fg] = ALL_BG[i];
  const [emo, word] = T.all[i];
  const dir = (i % 2 ? -1 : 1) * (T.rtl ? -1 : 1);
  const wipe = lerp(f, [0, 5], [1, 0], outExpo);
  const em = sp(f, 1, 9, 240, 0.55);
  const tx = sp(f, 3, 13, 300, 0.5);
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden', clipPath: `inset(0 ${dir > 0 ? 0 : wipe * 100}% 0 ${dir > 0 ? wipe * 100 : 0}%)` }}>
      <div style={{ position: 'absolute', top: 170, left: 0, right: 0, textAlign: 'center', font: `800 46px/1 ${UI}`, letterSpacing: T.rtl ? '.06em' : '.3em', color: fg, opacity: 0.8 }}>
        {T.allT} · <span style={iso}>{i + 1}/6</span>
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 300, lineHeight: 1, transform: `scale(${em}) rotate(${(1 - em) * 30 * dir}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.25))' }}>{emo}</div>
        <div style={{ marginTop: 50, font: `700 ${T.rtl ? 128 : 120}px/1.05 ${DISPLAY}`, color: fg, textAlign: 'center', whiteSpace: 'nowrap',
          transform: `translateX(${(1 - tx) * 500 * dir}px) skewX(${(1 - tx) * -15 * dir}deg)`, opacity: tx }}>{word}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const All: React.FC = () => <AbsoluteFill>{T.all.map((_, i) => <Sequence key={i} from={i * 15} durationInFrames={15}><AllOne i={i} /></Sequence>)}</AbsoluteFill>;

// ===== 6. Fin : le logo, la phrase, Hoppy ====================================================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 12], [0, 1], outExpo);
  const letter = (i: number) => {
    const s = sp(f, 4 + i * 3, i === 3 ? 6 : 10, 240, 0.6);
    return { y: (1 - s) * -500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * -80 : 0, o: f >= 4 + i * 3 ? 1 : 0 };
  };
  const l1 = lerp(f, [18, 28], [0, 1], outExpo), l2 = sp(f, 30, 9, 260, 0.6);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.navy2} 0%, ${C.navy} 62%)`, opacity: open }} />
      <div style={{ position: 'absolute', left: 540, top: 700, width: 1400, height: 1400, transform: `translate(-50%,-50%) rotate(${f * 0.4}deg)`, opacity: 0.12 * open,
        background: `repeating-conic-gradient(${C.orange} 0deg 5deg, transparent 5deg 24deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 62%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 470 }}>
        <Wordmark width={760} anim={letter} />
        <div style={{ marginTop: 70, font: `700 ${T.rtl ? 84 : 72}px/1.12 ${DISPLAY}`, color: '#fff', textAlign: 'center', opacity: l1, transform: `translateY(${(1 - l1) * 40}px)` }}>{T.out[0]}</div>
        <div style={{ marginTop: 28, padding: '26px 54px', borderRadius: 999, background: C.orange, font: `700 ${T.rtl ? 88 : 80}px/1 ${DISPLAY}`, color: '#fff', whiteSpace: 'nowrap',
          transform: `scale(${l2})`, boxShadow: `0 20px 60px rgba(255,106,19,.45)` }}>{withHop(T.out[1], C.navy)}</div>
        <div style={{ marginTop: 50, font: `700 46px/1 ${UI}`, color: '#A9B3CA', opacity: lerp(f, [44, 54], [0, 1]), ...iso }}>hop-livraison.vercel.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Stop: React.FC<{ music?: boolean; lang?: StopLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: C.navy, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={60}><Tag /></Sequence>
    <Sequence from={60} durationInFrames={90}><Words /></Sequence>
    <Sequence from={150} durationInFrames={120}><Split /></Sequence>
    <Sequence from={270} durationInFrames={90}><TwentyFive /></Sequence>
    <Sequence from={360} durationInFrames={90}><All /></Sequence>
    <Sequence from={450} durationInFrames={105}><Outro /><HoppyHop x={190} bottom={1900} h={520} at={0.9} /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('stop-music.wav')} />}
  </AbsoluteFill>
); };
