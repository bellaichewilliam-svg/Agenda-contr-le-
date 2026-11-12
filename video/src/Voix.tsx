import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { HoppyHop } from './HoppyHop';
import { C, DISPLAY, UI } from './theme';
import { Grain, Vignette, Wordmark, lerp, outExpo } from './Reel';

// « Parlez. C'est livré. » : la 1re appli de livraison à commande vocale (patron, 12/11).
// 23 s, 1080 × 1920, 120 BPM (1 temps = 15 images). 100 % animé, aucune phrase coupée.
// 1. on arrête de taper (le clavier éclate) · 2. PARLEZ : le micro, la voix, la phrase · 3. le téléphone se remplit
// tout seul jusqu'à « Commande envoyée » · 4. ça marche pour tout · 5. la 1re appli à commande vocale · 6. fin + Hoppy.
// Aucune plateforme nommée, aucune durée de livraison, « dès 25 ₪ ». Musique : scripts/voix_music.py (mêmes images clés).
export const VOIX_FRAMES = 690;
export type VoixLang = 'fr' | 'he';
const GREEN = '#12B76A', NIGHT = '#0B1830', CARD = '#13233F', FIELD = '#172A4B';
const STR = {
  fr: { rtl: false, typed: ['', 'l', 'lz', 'l', 'la', 'lai', 'laiy', 'lai', 'lait', 'lait,', 'lait, c', 'lait, co', 'lait, cp'], stop: ['ARRÊTEZ', 'DE TAPER.'],
    speak: 'PARLEZ.', said: ['Du', 'lait,', 'des', 'couches', 'et', 'un', 'Mars.', 'À', 'la', 'maison.'], listening: 'Hoppy vous écoute…',
    fills: 'Tout se remplit tout seul.', touched: ['Vous n’avez', 'rien touché.'],
    items: [['🥛', 'Lait 1 L'], ['👶', 'Couches'], ['🍫', 'Mars']], home: 'À la maison', homeTag: 'Livrer à', fee: 'Livraison dès 25 ₪', order: 'Commander', sent: 'Commande envoyée',
    allT: 'Dites-le, tout simplement', all: [['🍕', '« Une pizza', 'pour ce soir »'], ['💊', '« Ma pharmacie,', 's’il vous plaît »'], ['📦', '« Récupérez', 'mon colis »'], ['🔁', '« Comme la', 'dernière fois »']],
    badge: 'NOUVEAU · EXCLUSIF', first: '1', firstSup: 're', claim: ['APPLI DE LIVRAISON', 'À COMMANDE VOCALE'], langs: 'En français et en hébreu',
    out: ['Parlez.', 'C’est livré.'], foot: 'Dès 25 ₪ · Netanya' },
  he: { rtl: true, typed: ['', 'ח', 'חך', 'ח', 'חל', 'חלב', 'חלבץ', 'חלב', 'חלב,', 'חלב, ח', 'חלב, חי', 'חלב, חית', 'חלב, חיתן'], stop: ['מספיק', 'להקליד.'],
    speak: 'דברו.', said: ['חלב,', 'חיתולים', 'ומארס.', 'הביתה.'], listening: 'הופי מקשיב לכם…',
    fills: 'הכול מתמלא לבד.', touched: ['לא נגעתם', 'בכלום.'],
    items: [['🥛', 'חלב 1 ליטר'], ['👶', 'חיתולים'], ['🍫', 'מארס']], home: 'הביתה', homeTag: 'משלוח אל', fee: 'משלוח החל מ־25 ₪', order: 'להזמין', sent: 'ההזמנה נשלחה',
    allT: 'פשוט תגידו', all: [['🍕', '«פיצה', 'להערב»'], ['💊', '«בית המרקחת', 'שלי, בבקשה»'], ['📦', '«תאספו את', 'החבילה שלי»'], ['🔁', '«כמו בפעם', 'הקודמת»']],
    badge: 'חדש · בלעדי', first: 'הראשונה', firstSup: '', claim: ['אפליקציית המשלוחים', 'בהזמנה קולית'], langs: 'בעברית ובצרפתית',
    out: ['דברו.', 'זה אצלכם.'], foot: 'החל מ־25 ₪ · נתניה' },
};
let T: (typeof STR)['fr'] = STR.fr; // fixé par <Voix lang> avant le rendu des scènes
const iso = { unicodeBidi: 'isolate' as const, direction: 'ltr' as const };
const sp = (f: number, d: number, damping = 11, stiffness = 240, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
// Taille de texte qui tient toujours dans la largeur (jamais de phrase coupée)
const fit = (s: string, max: number, width = 940, k = 0.58) => Math.floor(Math.min(max, width / (Math.max(1, s.length) * k)));

// Fond vivant : bleu nuit, deux halos qui dérivent lentement
const Aura: React.FC<{ warm?: number }> = ({ warm = 0.55 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #16294F 0%, ${C.navy} 45%, #070C18 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1100, height: 1100, borderRadius: '50%', left: 380 + Math.sin(f / 37) * 120, top: -360 + Math.cos(f / 43) * 90,
        background: `radial-gradient(circle, rgba(255,106,19,${warm}) 0%, rgba(255,106,19,0) 62%)`, filter: 'blur(30px)' }} />
      <div style={{ position: 'absolute', width: 1200, height: 1200, borderRadius: '50%', left: -520 + Math.cos(f / 51) * 110, top: 1050 + Math.sin(f / 33) * 100,
        background: 'radial-gradient(circle, rgba(64,132,255,.42) 0%, rgba(64,132,255,0) 62%)', filter: 'blur(30px)' }} />
    </AbsoluteFill>
  );
};
const CUTS = [75, 180, 375, 465, 555];
const Flashes: React.FC = () => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...CUTS.map(c => (f >= c ? lerp(f, [c, c + 7], [0.55, 0]) : 0)));
  return <AbsoluteFill style={{ background: '#fff', opacity: o, pointerEvents: 'none' }} />;
};
const Mic: React.FC<{ size: number; color?: string }> = ({ size, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2.5" width="6" height="11.5" rx="3" fill={color} stroke="none" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3.5" /><path d="M8.5 21.5h7" />
  </svg>
);
// Ondes de la voix : des barres qui respirent sans à-coups
const Wave: React.FC<{ n: number; w: number; h: number; amp: number; color?: string; seed?: string }> = ({ n, w, h, amp, color = '#fff', seed = 'w' }) => {
  const f = useCurrentFrame();
  const bw = w / n;
  return (
    <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = Math.floor(f / 4), k = (f % 4) / 4;
        const r = random(`${seed}${i}-${a}`) * (1 - k) + random(`${seed}${i}-${a + 1}`) * k;
        const bell = Math.sin((Math.PI * (i + 0.5)) / n);
        const v = 0.1 + amp * bell * (0.3 + 0.7 * r) * (0.75 + 0.25 * Math.sin(f / 3 + i * 0.8));
        return <div key={i} style={{ width: bw * 0.55, margin: `0 ${bw * 0.225}px`, height: Math.max(bw * 0.55, h * Math.min(1, v)), borderRadius: bw, background: color }} />;
      })}
    </div>
  );
};

// ===== 1. On arrête de taper : le clavier éclate ============================================
const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
const Typing: React.FC = () => {
  const f = useCurrentFrame();
  const typed = T.typed[Math.min(T.typed.length - 1, Math.floor(f / 3))];
  const boom = 40, e = f - boom;
  const jitter = f > 24 && f < boom ? Math.sin(f * 2.3) * lerp(f, [24, boom], [0, 14]) : 0;
  const w1 = sp(f, boom, 8, 300, 0.7), w2 = sp(f, boom + 12, 8, 300, 0.7);
  return (
    <AbsoluteFill>
      <Aura warm={0.25} />
      {/* le champ où l'on s'acharne */}
      <div style={{ position: 'absolute', left: 90, right: 90, top: 640, height: 150, borderRadius: 40, background: FIELD, border: '3px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center',
        padding: '0 44px', font: `500 78px/1 ${UI}`, color: '#fff', transform: `translateX(${jitter}px) scale(${e > 0 ? lerp(e, [0, 8], [1, 0.6]) : 1})`, opacity: e > 0 ? lerp(e, [0, 8], [1, 0]) : lerp(f, [0, 8], [0, 1]) }}>
        <span>{typed}</span><span style={{ width: 5, height: 86, background: C.orange, margin: '0 8px', opacity: Math.floor(f / 6) % 2 ? 0.2 : 1 }} />
      </div>
      {/* le clavier : il tremble, puis vole en éclats */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1110, direction: 'ltr' }}>
        {ROWS.map((row, r) => row.split('').map((ch, i) => {
          const kw = 92, gap = 10, x0 = (1080 - (row.length * (kw + gap) - gap)) / 2 + i * (kw + gap), y0 = r * 132;
          const id = `${r}-${i}`, hit = !(e > 0) && Math.floor(f / 3) % 7 === (i + r * 3) % 7;
          const vx = (random('vx' + id) - 0.5) * 70, vy = -20 - random('vy' + id) * 48, rot = (random('r' + id) - 0.5) * 50;
          const t = Math.max(0, e);
          const x = x0 + vx * t, y = y0 + vy * t + 1.9 * t * t;
          const pre = f > 24 && e <= 0 ? Math.sin(f * 3 + i) * lerp(f, [24, boom], [0, 6]) : 0;
          return <div key={id} style={{ position: 'absolute', left: x, top: y + pre, width: kw, height: 116, borderRadius: 20, background: hit ? C.orange : '#22365E', border: '2px solid rgba(255,255,255,.12)',
            display: 'grid', placeItems: 'center', font: `700 50px/1 ${UI}`, color: '#fff', transform: `rotate(${rot * t}deg)`, opacity: lerp(f, [0, 8], [0, 1]) * (e > 0 ? lerp(e, [10, 26], [1, 0]) : 1), boxShadow: '0 8px 0 rgba(0,0,0,.25)' }}>{ch}</div>;
        }))}
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 6, opacity: e >= 0 ? 1 : 0 }}>
        <div style={{ font: `700 ${fit(T.stop[0], 230)}px/1 ${DISPLAY}`, color: '#fff', transform: `scale(${0.3 + 0.7 * w1}) rotate(${(1 - w1) * -8}deg)`, opacity: Math.min(1, w1 * 2), textShadow: '0 18px 50px rgba(0,0,0,.45)' }}>{T.stop[0]}</div>
        <div style={{ font: `700 ${fit(T.stop[1], 210)}px/1.05 ${DISPLAY}`, color: C.orange, transform: `scale(${0.3 + 0.7 * w2}) rotate(${(1 - w2) * 8}deg)`, opacity: Math.min(1, w2 * 2), textShadow: '0 18px 50px rgba(0,0,0,.45)' }}>{T.stop[1]}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 2. PARLEZ : le micro s'allume, la voix dessine la phrase ==============================
const Speak: React.FC = () => {
  const f = useCurrentFrame();
  const title = sp(f, 2, 9, 220, 0.7), orb = sp(f, 6, 10, 180, 0.8);
  const start = 26, step = Math.floor(66 / T.said.length), talking = f >= start && f < start + T.said.length * step + 6;
  const amp = talking ? lerp(f, [start, start + 6], [0.15, 1]) : lerp(f, [start + T.said.length * step + 6, start + T.said.length * step + 16], [1, 0.12]);
  return (
    <AbsoluteFill>
      <Aura warm={0.6} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', font: `700 ${fit(T.speak, 250, 900)}px/1 ${DISPLAY}`, color: '#fff', transform: `translateY(${(1 - title) * -120}px) scale(${0.6 + 0.4 * title})`, opacity: Math.min(1, title * 1.6) }}>{T.speak}</div>
      {/* le micro et ses ondes */}
      <div style={{ position: 'absolute', left: 540, top: 840, width: 0, height: 0 }}>
        {[0, 1, 2].map(i => { const p = ((f + i * 20) % 60) / 60; return <div key={i} style={{ position: 'absolute', left: -170, top: -170, width: 340, height: 340, borderRadius: '50%', border: `5px solid ${C.orange}`, transform: `scale(${1 + p * 1.5 * (0.5 + 0.5 * amp)})`, opacity: (1 - p) * 0.55 * orb }} />; })}
        <div style={{ position: 'absolute', left: -170, top: -170, width: 340, height: 340, borderRadius: '50%', background: `radial-gradient(circle at 35% 28%, #FF9A5A 0%, ${C.orange} 45%, ${C.orangeDeep} 100%)`, display: 'grid', placeItems: 'center',
          transform: `scale(${orb * (1 + 0.05 * amp * Math.sin(f / 2))})`, boxShadow: `0 30px 90px rgba(255,106,19,.55), inset 0 -14px 30px rgba(0,0,0,.18)` }}><Mic size={170} /></div>
      </div>
      <div style={{ position: 'absolute', left: 90, top: 1110, opacity: orb }}><Wave n={38} w={900} h={170} amp={amp} seed="s" /></div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, textAlign: 'center', font: `500 44px/1 ${UI}`, color: '#A9B6CF', opacity: lerp(f, [14, 24], [0, 1]) }}>{T.listening}</div>
      {/* la phrase, mot après mot */}
      <div style={{ position: 'absolute', left: 70, right: 70, top: 1400, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 22px' }}>
        {T.said.map((w, i) => { const s = sp(f, start + i * step, 12, 260, 0.5), now = Math.floor((f - start) / step) === i;
          return <span key={i} style={{ font: `700 ${T.rtl ? 116 : 100}px/1.12 ${DISPLAY}`, color: now ? C.orange : '#fff', transform: `translateY(${(1 - s) * 50}px) scale(${0.7 + 0.3 * s})`, opacity: Math.min(1, s * 1.5), display: 'inline-block' }}>{w}</span>; })}
      </div>
    </AbsoluteFill>
  );
};

// ===== 3. Le téléphone se remplit tout seul ==================================================
const Check: React.FC<{ p: number; size: number }> = ({ p, size }) => (
  <svg width={size} height={size} viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill={GREEN} opacity={Math.min(1, p * 2)} transform={`scale(${0.5 + 0.5 * Math.min(1, p * 1.4)})`} style={{ transformOrigin: '20px 20px' }} />
    <path d="M11.5 20.5l6 6 11-12.5" fill="none" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={30} strokeDashoffset={30 * (1 - Math.max(0, Math.min(1, (p - 0.25) / 0.75)))} /></svg>
);
const Fill: React.FC = () => {
  const f = useCurrentFrame();
  const inn = sp(f, 0, 14, 120, 0.9);
  const rows = [28, 46, 64], addr = 88, fee = 104, press = 124, sent = 142;
  const done = sp(f, sent, 9, 240, 0.6), fillBtn = lerp(f, [press, sent], [0, 1]);
  const cap1 = lerp(f, [8, 20], [0, 1], outExpo) * lerp(f, [sent - 8, sent], [1, 0]), cap2a = sp(f, sent + 4, 9, 260, 0.6), cap2b = sp(f, sent + 14, 9, 260, 0.6);
  const W = 640, H = 1250, PX = (1080 - W) / 2, PY = 560;
  const float = Math.sin(f / 22) * 10;
  return (
    <AbsoluteFill>
      <Aura warm={0.4} />
      <div style={{ position: 'absolute', left: 60, right: 60, top: 190, textAlign: 'center', font: `700 ${fit(T.fills, 96, 960)}px/1.1 ${DISPLAY}`, color: '#fff', opacity: cap1, transform: `translateY(${(1 - Math.min(1, cap1)) * 40}px)` }}>{T.fills}</div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 130, textAlign: 'center' }}>
        <div style={{ font: `700 ${fit(T.touched[0], 132, 980)}px/1.05 ${DISPLAY}`, color: '#fff', transform: `scale(${cap2a})`, opacity: Math.min(1, cap2a * 2) }}>{T.touched[0]}</div>
        <div style={{ font: `700 ${fit(T.touched[1], 150, 980)}px/1.05 ${DISPLAY}`, color: C.orange, transform: `scale(${cap2b})`, opacity: Math.min(1, cap2b * 2) }}>{T.touched[1]}</div>
      </div>
      {/* le téléphone */}
      <div style={{ position: 'absolute', left: PX, top: PY + (1 - inn) * 1500 + float, width: W, height: H, perspective: 1800 }}>
        <div style={{ width: W, height: H, borderRadius: 78, background: '#05080F', padding: 16, boxShadow: `0 60px 140px rgba(0,0,0,.6), 0 0 0 3px rgba(255,255,255,.14), 0 0 ${60 + 60 * done}px rgba(255,106,19,${0.25 + 0.3 * done})`,
          transform: `rotateX(${(1 - inn) * 28}deg) rotateY(${Math.sin(f / 30) * 3}deg)` }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 64, background: NIGHT, overflow: 'hidden', position: 'relative', padding: '74px 30px 30px', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: '50%', top: 20, width: 170, height: 36, borderRadius: 20, background: '#05080F', transform: 'translateX(-50%)' }} />
            {/* en-tête : Hoppy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
              <div style={{ width: 84, height: 84, borderRadius: '50%', background: CARD, overflow: 'hidden', flex: 'none', display: 'grid', placeItems: 'center' }}><Img src={staticFile('hoppy-cut.png')} style={{ height: 96, marginTop: 14 }} /></div>
              <div style={{ flex: 1 }}><div style={{ font: `700 44px/1 ${DISPLAY}`, color: '#fff' }}>Hoppy</div><div style={{ font: `500 26px/1.3 ${UI}`, color: GREEN }}>● {T.listening}</div></div>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', transform: `scale(${1 + 0.06 * Math.sin(f / 3)})`, boxShadow: '0 0 0 10px rgba(255,106,19,.18)' }}><Mic size={40} /></div>
            </div>
            {/* ce qu'il a dit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, opacity: lerp(f, [10, 20], [0, 1]), transform: `translateY(${lerp(f, [10, 22], [30, 0], outExpo)}px)` }}>
              <div style={{ maxWidth: 480, padding: '18px 26px', borderRadius: '30px 30px 8px 30px', background: C.orange, font: `700 ${T.rtl ? 36 : 32}px/1.25 ${UI}`, color: '#fff' }}>{T.said.join(' ')}</div>
            </div>
            {/* le panier se remplit */}
            {T.items.map(([emo, name], i) => { const s = sp(f, rows[i], 12, 220, 0.6), ck = lerp(f, [rows[i] + 6, rows[i] + 18], [0, 1]);
              return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 18px', marginBottom: 12, borderRadius: 26, background: CARD, transform: `translateX(${(1 - s) * (T.rtl ? -420 : 420)}px) scale(${0.85 + 0.15 * s})`, opacity: Math.min(1, s * 1.6) }}>
                <div style={{ width: 82, height: 82, borderRadius: 22, background: FIELD, display: 'grid', placeItems: 'center', fontSize: 52, flex: 'none' }}>{emo}</div>
                <div style={{ flex: 1, font: `700 ${T.rtl ? 42 : 40}px/1.1 ${UI}`, color: '#fff' }}>{name}</div><Check p={ck} size={58} /></div>; })}
            {/* l'adresse */}
            {(() => { const s = sp(f, addr, 12, 220, 0.6), ck = lerp(f, [addr + 6, addr + 18], [0, 1]);
              return <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 18px', marginTop: 8, borderRadius: 26, background: FIELD, border: `2px solid rgba(255,106,19,${0.5 * s})`, transform: `scale(${0.85 + 0.15 * s})`, opacity: Math.min(1, s * 1.6) }}>
                <div style={{ fontSize: 54, flex: 'none', width: 82, textAlign: 'center' }}>🏠</div>
                <div style={{ flex: 1 }}><div style={{ font: `500 24px/1.2 ${UI}`, color: '#A9B6CF' }}>{T.homeTag}</div><div style={{ font: `700 ${T.rtl ? 42 : 40}px/1.1 ${UI}`, color: '#fff' }}>{T.home}</div></div><Check p={ck} size={58} /></div>; })()}
            <div style={{ marginTop: 20, textAlign: 'center', font: `700 34px/1 ${UI}`, color: '#FFB489', opacity: lerp(f, [fee, fee + 10], [0, 1]) }}>🛵 {T.fee}</div>
            {/* le bouton part tout seul */}
            <div style={{ position: 'absolute', left: 30, right: 30, bottom: 34, height: 118, borderRadius: 60, background: '#22365E', overflow: 'hidden', opacity: lerp(f, [fee + 4, fee + 14], [0, 1]), transform: `scale(${1 + 0.05 * done})`,
              boxShadow: `0 16px 50px rgba(${done > 0.5 ? '18,183,106' : '255,106,19'},.5)` }}>
              <div style={{ position: 'absolute', inset: 0, width: `${100 * Math.max(0.0001, f < press ? 1 : fillBtn)}%`, background: f >= sent ? GREEN : C.orange, left: T.rtl ? 'auto' : 0, right: T.rtl ? 0 : 'auto' }} />
              {f >= sent && <div style={{ position: 'absolute', inset: 0, background: GREEN }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, font: `700 ${T.rtl ? 50 : 46}px/1 ${DISPLAY}`, color: '#fff' }}>
                {f >= sent ? <><span>✅</span><span>{T.sent}</span></> : <span>{T.order}</span>}</div>
            </div>
          </div>
        </div>
      </div>
      {/* petits éclats au moment de l'envoi */}
      {f >= sent && Array.from({ length: 26 }, (_, i) => { const t = f - sent, a = (i / 26) * Math.PI * 2 + random('a' + i), v = 16 + random('v' + i) * 26;
        return <div key={i} style={{ position: 'absolute', left: 540 + Math.cos(a) * v * t, top: 1660 + Math.sin(a) * v * t + 0.9 * t * t, width: 18, height: 18, borderRadius: i % 2 ? 9 : 4, background: [C.orange, '#fff', GREEN, '#FFC7A3'][i % 4], transform: `rotate(${t * 20 + i * 30}deg)`, opacity: lerp(t, [8, 30], [1, 0]) }} />; })}
    </AbsoluteFill>
  );
};

// ===== 4. Ça marche pour tout ================================================================
const AllOne: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const [emo, l1, l2] = T.all[i];
  const bgs = [C.orange, C.navy2, '#FFF0E6', '#0B1830'], fg = i === 2 ? C.navy : '#fff', dir = i % 2 ? -1 : 1;
  const em = sp(f, 0, 8, 260, 0.6), tx = lerp(f, [1, 9], [0, 1], outExpo);
  return (
    <AbsoluteFill style={{ background: bgs[i], overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 200, textAlign: 'center', font: `700 ${fit(T.allT, 62, 900)}px/1 ${UI}`, color: fg, opacity: 0.75 }}>{T.allT}</div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 280, lineHeight: 1, transform: `scale(${em}) rotate(${(1 - em) * 26 * dir}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.25))' }}>{emo}</div>
        <div style={{ marginTop: 60, textAlign: 'center', transform: `translateX(${(1 - tx) * 420 * dir}px)`, opacity: tx }}>
          <div style={{ font: `700 ${fit(l1, 124, 960)}px/1.1 ${DISPLAY}`, color: fg }}>{l1}</div>
          <div style={{ font: `700 ${fit(l2, 124, 960)}px/1.1 ${DISPLAY}`, color: i === 0 ? C.navy : C.orange }}>{l2}</div>
        </div>
        <div style={{ marginTop: 70 }}><Wave n={22} w={520} h={110} amp={0.95} color={i === 2 ? C.orange : '#fff'} seed={'a' + i} /></div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const All: React.FC = () => <AbsoluteFill>{T.all.map((_, i) => <Sequence key={i} from={Math.round(i * 22.5)} durationInFrames={23}><AllOne i={i} /></Sequence>)}</AbsoluteFill>;

// ===== 5. La 1re appli de livraison à commande vocale ========================================
const First: React.FC = () => {
  const f = useCurrentFrame();
  const badge = sp(f, 2, 12, 220, 0.6), big = sp(f, 8, 8, 200, 0.9), l1 = lerp(f, [24, 36], [0, 1], outExpo), l2 = sp(f, 36, 9, 260, 0.6), l3 = lerp(f, [54, 66], [0, 1]);
  const shine = lerp(f, [26, 62], [-40, 140]);
  const bigSize = T.firstSup ? 560 : fit(T.first, 300, 940, 0.56);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 36%, #24407A 0%, ${C.navy} 58%, #070C18 100%)` }} />
      <div style={{ position: 'absolute', left: 540, top: 700, width: 1900, height: 1900, transform: `translate(-50%,-50%) rotate(${f * 0.35}deg)`, opacity: 0.16 * big,
        background: `repeating-conic-gradient(${C.orange} 0deg 4deg, transparent 4deg 20deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 60%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: T.firstSup ? 300 : 360 }}>
        <div style={{ padding: '16px 38px', borderRadius: 999, background: 'rgba(255,106,19,.16)', border: `3px solid ${C.orange}`, font: `700 ${T.rtl ? 50 : 42}px/1 ${UI}`, color: '#FFB489', letterSpacing: T.rtl ? 0 : 5, transform: `scale(${badge})` }}>{T.badge}</div>
        {T.firstSup ? <><div style={{ marginTop: T.firstSup ? 10 : 30, display: 'flex', alignItems: 'flex-start', direction: 'ltr', transform: `scale(${0.4 + 0.6 * big}) rotate(${(1 - big) * -6}deg)`, opacity: Math.min(1, big * 1.6),
          filter: 'drop-shadow(0 30px 60px rgba(255,106,19,.45))' }}>
          <div style={{ font: `700 ${bigSize}px/${T.firstSup ? 0.95 : 1.15} ${DISPLAY}`, direction: T.rtl ? 'rtl' : 'ltr', backgroundImage: `linear-gradient(105deg, #FFD0A8 0%, ${C.orange} ${shine - 18}%, #fff ${shine}%, ${C.orange} ${shine + 18}%, ${C.orangeDeep} 100%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{T.first}</div>
          {T.firstSup && <div style={{ font: `700 200px/1 ${DISPLAY}`, color: C.orange, marginTop: 70, marginLeft: 6 }}>{T.firstSup}</div>}
        </div>
<div style={{ marginTop: T.firstSup ? 20 : 80, font: `700 ${fit(T.claim[0], 104, 960, T.rtl ? 0.58 : 0.72)}px/1.1 ${DISPLAY}`, color: '#fff', opacity: l1, transform: `translateY(${(1 - l1) * 50}px)`, whiteSpace: 'nowrap', fontKerning: 'none', letterSpacing: T.rtl ? 0 : 4, wordSpacing: T.rtl ? 0 : 14 }}>{T.claim[0]}</div></> : <><div style={{ marginTop: T.firstSup ? 20 : 80, font: `700 ${fit(T.claim[0], 104, 960, T.rtl ? 0.58 : 0.72)}px/1.1 ${DISPLAY}`, color: '#fff', opacity: l1, transform: `translateY(${(1 - l1) * 50}px)`, whiteSpace: 'nowrap', fontKerning: 'none', letterSpacing: T.rtl ? 0 : 4, wordSpacing: T.rtl ? 0 : 14 }}>{T.claim[0]}</div>
<div style={{ marginTop: T.firstSup ? 10 : 30, display: 'flex', alignItems: 'flex-start', direction: 'ltr', transform: `scale(${0.4 + 0.6 * big}) rotate(${(1 - big) * -6}deg)`, opacity: Math.min(1, big * 1.6),
          filter: 'drop-shadow(0 30px 60px rgba(255,106,19,.45))' }}>
          <div style={{ font: `700 ${bigSize}px/${T.firstSup ? 0.95 : 1.15} ${DISPLAY}`, direction: T.rtl ? 'rtl' : 'ltr', backgroundImage: `linear-gradient(105deg, #FFD0A8 0%, ${C.orange} ${shine - 18}%, #fff ${shine}%, ${C.orange} ${shine + 18}%, ${C.orangeDeep} 100%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{T.first}</div>
          {T.firstSup && <div style={{ font: `700 200px/1 ${DISPLAY}`, color: C.orange, marginTop: 70, marginLeft: 6 }}>{T.firstSup}</div>}
        </div></>}
        <div style={{ marginTop: 30, padding: '28px 50px', borderRadius: 40, background: C.orange, font: `700 ${fit(T.claim[1], 104, 860, T.rtl ? 0.58 : 0.72)}px/1 ${DISPLAY}`, color: '#fff', whiteSpace: 'nowrap', fontKerning: 'none', letterSpacing: T.rtl ? 0 : 4, wordSpacing: T.rtl ? 0 : 14, transform: `scale(${l2})`, boxShadow: '0 24px 70px rgba(255,106,19,.5)' }}>{T.claim[1]}</div>
        <div style={{ marginTop: 64, display: 'flex', alignItems: 'center', gap: 22, opacity: l3 }}>
          <Mic size={62} color={C.orange} /><span style={{ font: `700 ${T.rtl ? 56 : 50}px/1 ${UI}`, color: '#D5DCEC' }}>{T.langs}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 6. Fin : le logo, le slogan, Hoppy ====================================================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 12], [0, 1], outExpo);
  const letter = (i: number) => { const s = sp(f, 4 + i * 3, i === 3 ? 6 : 10, 240, 0.6); return { y: (1 - s) * -500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * -80 : 0, o: f >= 4 + i * 3 ? 1 : 0 }; };
  const l1 = sp(f, 20, 10, 240, 0.6), l2 = sp(f, 32, 9, 260, 0.6), l3 = lerp(f, [48, 60], [0, 1]);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 38%, ${C.navy2} 0%, ${C.navy} 62%)`, opacity: open }} />
      <div style={{ position: 'absolute', left: 540, top: 640, width: 1400, height: 1400, transform: `translate(-50%,-50%) rotate(${f * 0.4}deg)`, opacity: 0.12 * open,
        background: `repeating-conic-gradient(${C.orange} 0deg 5deg, transparent 5deg 24deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 62%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 380 }}>
        <Wordmark width={720} anim={letter} />
        <div style={{ marginTop: 80, font: `700 ${fit(T.out[0], 170, 900)}px/1 ${DISPLAY}`, color: '#fff', transform: `scale(${l1})`, opacity: Math.min(1, l1 * 2) }}>{T.out[0]}</div>
        <div style={{ marginTop: 24, padding: '26px 56px', borderRadius: 999, background: C.orange, font: `700 ${fit(T.out[1], 124, 820)}px/1 ${DISPLAY}`, color: '#fff', whiteSpace: 'nowrap', transform: `scale(${l2})`, boxShadow: '0 20px 60px rgba(255,106,19,.45)' }}>{T.out[1]}</div>
        <div style={{ marginTop: 56, font: `700 ${T.rtl ? 60 : 54}px/1 ${UI}`, color: '#FFB489', opacity: l3 }}>{T.foot}</div>
        <div style={{ marginTop: 26, font: `700 44px/1 ${UI}`, color: '#A9B3CA', opacity: l3, ...iso }}>hop-livraison.vercel.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Voix: React.FC<{ music?: boolean; lang?: VoixLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: C.navy, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={75}><Typing /></Sequence>
    <Sequence from={75} durationInFrames={105}><Speak /></Sequence>
    <Sequence from={180} durationInFrames={195}><Fill /></Sequence>
    <Sequence from={375} durationInFrames={90}><All /></Sequence>
    <Sequence from={465} durationInFrames={90}><First /></Sequence>
    <Sequence from={555} durationInFrames={135}><Outro /><HoppyHop x={190} bottom={1900} h={500} at={1.1} /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('voix-music.wav')} />}
  </AbsoluteFill>
); };
