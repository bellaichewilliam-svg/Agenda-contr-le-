import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, random, spring, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/heebo/900.css';
import { HoppyHop } from './HoppyHop';
import { Wordmark } from './Reel';

// « La révolution des courses à Netanya » (patron, 24/11) : film vitrine de l'appli, 30 s, 1080 × 1920, 120 BPM
// (1 temps = 15 images). Pas de voix : de gros mots qui claquent sur le rythme, de vraies photos des magasins et des
// plats de l'appli, les clips de Hoppy. 1. accroche · 2. tous les magasins, vous choisissez · 3. on compare, le moins
// cher gagne · 4. toutes les promos · 5. dites-le à Hoppy · 6. on y va pour vous, au plus vite, livré · 7. fin HOP!.
// Règles : aucun concurrent de livraison nommé, pas de durée chiffrée, « dès 25 ₪ en ville », Hoppy officiel.
export const REVO_FRAMES = 900;
type Lang = 'fr' | 'he';
const NAVY = '#0F1F3D', NIGHT = '#081226', OR = '#FF6A13', GREEN = '#12B76A';
const FONT = 'Heebo, sans-serif';
const STR = {
  fr: {
    hook: ['NETANYA,', 'VOS COURSES', 'ONT CHANGÉ.'],
    all: ['TOUS LES', 'MAGASINS.'], choose: ['VOUS', 'CHOISISSEZ.'],
    cmp: ['ON COMPARE', 'TOUT.'], best: ['LE MOINS CHER', 'GAGNE.'], list: 'Ma liste', items: ['Lait 1 L', 'Pain', 'Couches', 'Bananes'], cheapest: 'Le moins cher', all1: 'Tout ici',
    promo: ['TOUTES', 'LES PROMOS.'], promoSub: 'Réunies au même endroit',
    voice: ['DITES-LE', 'À HOPPY.'], voiceSub: '« Du lait et du pain »',
    go: ['ON Y VA', 'POUR VOUS.'], fast: ['AU PLUS', 'VITE.'], done: 'Livré',
    revo: ['LA RÉVOLUTION', 'DES COURSES', 'À NETANYA.'], tag: 'On fait vos courses pour vous', price: 'Dès 25 ₪ en ville',
  },
  he: {
    hook: ['נתניה,', 'הקניות שלכם', 'השתנו.'],
    all: ['כל', 'החנויות.'], choose: ['אתם', 'בוחרים.'],
    cmp: ['משווים', 'הכול.'], best: ['הכי זול', 'מנצח.'], list: 'הרשימה שלי', items: ['חלב 1 ל׳', 'לחם', 'חיתולים', 'בננות'], cheapest: 'הכי זול', all1: 'הכול כאן',
    promo: ['כל', 'המבצעים.'], promoSub: 'במקום אחד',
    voice: ['תגידו', 'להופי.'], voiceSub: '«חלב ולחם»',
    go: ['אנחנו הולכים', 'בשבילכם.'], fast: ['הכי', 'מהר.'], done: 'נמסר',
    revo: ['המהפכה', 'של הקניות', 'בנתניה.'], tag: 'עושים לכם את הקניות', price: 'החל מ־25 ₪ בעיר',
  },
};
let S: (typeof STR)['fr'] = STR.fr, RTL = false;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], e?: (t: number) => number) => interpolate(f, a, b, { ...clamp, easing: e });
const outExpo = Easing.out(Easing.exp), inExpo = Easing.in(Easing.exp);
const sp = (f: number, d: number, damping = 13, stiffness = 260, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const iso: React.CSSProperties = { unicodeBidi: 'isolate', direction: 'ltr' };
const img = (p: string) => staticFile(p);

// Gros mot qui claque : il arrive de très grand avec un flou de mouvement, se pose, tremble à peine
const Slam: React.FC<{ text: string; at: number; size: number; color?: string; y: number; out?: number }> = ({ text, at, size, color = '#fff', y, out }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = lerp(f, [at, at + 6], [0, 1], outExpo);
  const o = out != null ? lerp(f, [out, out + 4], [1, 0]) : 1;
  const s = 2.4 - 1.4 * k, blur = (1 - k) * 18;
  const fit = Math.min(size, 980 / (text.length * 0.6));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: fit, lineHeight: 1, color,
      letterSpacing: RTL ? 0 : '-0.035em', direction: RTL ? 'rtl' : 'ltr', transform: `scale(${s})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: o * Math.min(1, k * 3),
      textShadow: '0 6px 40px rgba(0,0,0,.35)', whiteSpace: 'nowrap' }}>{text}</div>
  );
};
// Deux lignes de titre (2e ligne en orange) sur deux temps
const Title: React.FC<{ lines: string[]; at: number; y: number; size?: number; step?: number; out?: number; color2?: string }> = ({ lines, at, y, size = 150, step = 8, out, color2 = OR }) => (
  <>{lines.map((l, i) => <Slam key={i} text={l} at={at + i * step} size={size} y={y + i * size * 1.02} color={i === lines.length - 1 ? color2 : '#fff'} out={out} />)}</>
);
// Photo plein cadre qui pousse (Ken Burns rapide)
const Photo: React.FC<{ src: string; from?: number; to?: number; dur: number; x?: number; fit?: 'cover' | 'contain'; bg?: string }> = ({ src, from = 1.12, to = 1.0, dur, x = 0, fit = 'cover', bg = NIGHT }) => {
  const f = useCurrentFrame();
  const s = lerp(f, [0, dur], [from, to]);
  return <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}><Img src={img(src)} style={{ width: '100%', height: '100%', objectFit: fit, transform: `scale(${s}) translateX(${x * f / dur}px)` }} /></AbsoluteFill>;
};
const Shade: React.FC<{ o?: number; top?: boolean }> = ({ o = 0.55, top }) => (
  <AbsoluteFill style={{ background: top ? `linear-gradient(180deg, rgba(8,18,38,${o}) 0%, rgba(8,18,38,0) 55%)` : `linear-gradient(180deg, rgba(8,18,38,${o * 0.6}) 0%, rgba(8,18,38,${o}) 100%)` }} />
);
const Flash: React.FC<{ at: number[] }> = ({ at }) => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...at.map(c => (f >= c ? lerp(f, [c, c + 6], [0.7, 0]) : 0)));
  return <AbsoluteFill style={{ background: '#fff', opacity: o, pointerEvents: 'none' }} />;
};
// Petit zoom de caméra sur chaque coup (punch)
const Punch: React.FC<{ at: number[]; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = Math.max(0, ...at.map(c => (f >= c ? lerp(f, [c, c + 10], [0.06, 0], outExpo) : 0)));
  return <AbsoluteFill style={{ transform: `scale(${1 + p})` }}>{children}</AbsoluteFill>;
};
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.16 }}>
    <svg width="100%" height="100%"><filter id="rg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 10} /></filter><rect width="100%" height="100%" filter="url(#rg)" /></svg>
  </AbsoluteFill>;
};
const Navy: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, #1B3364 0%, ${NAVY} 45%, ${NIGHT} 100%)` }}>
    <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: 300 + Math.sin(f / 30) * 80, top: -300, background: 'radial-gradient(circle, rgba(255,106,19,.28), rgba(255,106,19,0) 65%)', filter: 'blur(20px)' }} />
  </AbsoluteFill>;
};

// ===== 1. Accroche : stroboscope de vraies photos, trois mots ================================
const HOOK_PICS = ['revo/raffaello-1.webp', 'revo/carrefour-cover.webp', 'revo/japanjapan-cover.webp', 'revo/roladin-cover.webp', 'spot/livreur-porte.jpg', 'revo/golda-cover.webp',
  'revo/shufersal-cover.webp', 'revo/shiso-cover.webp', 'revo/jus-cover.webp', 'revo/ramilevy-cover.webp', 'lancement/repas.jpg', 'revo/yohananof-cover.webp'];
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const i = Math.min(HOOK_PICS.length - 1, Math.floor(f / 7.5));
  return (
    <AbsoluteFill>
      <Punch at={[0, 30, 60]}><Photo key={i} src={HOOK_PICS[i]} dur={8} from={1.25} to={1.12} /></Punch>
      <AbsoluteFill style={{ background: 'rgba(8,18,38,.5)' }} />
      <Slam text={S.hook[0]} at={0} size={170} y={640} out={28} />
      <Slam text={S.hook[1]} at={30} size={150} y={640} out={58} />
      <Slam text={S.hook[2]} at={60} size={170} y={640} color={OR} />
    </AbsoluteFill>
  );
};

// ===== 2. Tous les magasins : le mur de logos, puis on choisit ===============================
const WALL: [string, string][] = [['carrefour', 'Carrefour'], ['ramilevy', 'Rami Lévy'], ['japanjapan', 'Japan Japan'], ['shufersal', 'Shufersal'], ['golda', 'Golda'], ['yohananof', 'Yohananof'],
  ['raffaello', 'Raffaello'], ['victory', 'Victory'], ['roladin', 'Roladin'], ['osherad', 'Osher Ad'], ['shiso', 'Shiso'], ['tivtaam', 'Tiv Taam'], ['mcd', 'McDonald’s'], ['booom', 'BOOOM'],
  ['laline', 'Laline'], ['lahav', 'Lahav'], ['universe', 'Universe'], ['panzer', 'Panzer']];
const Shops: React.FC = () => {
  const f = useCurrentFrame();
  const scroll = lerp(f, [0, 180], [0, -520], Easing.inOut(Easing.cubic));
  const zoom = lerp(f, [0, 90], [1.25, 1], outExpo);
  const sel = 10, pick = sp(f, 96, 12, 220);
  const dim = lerp(f, [90, 104], [0, 0.6]);
  const T = 300, G = 26, cols = 3, left = (1080 - cols * T - (cols - 1) * G) / 2;
  return (
    <AbsoluteFill>
      <Navy />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {WALL.map(([t, name], k) => {
          const c = k % cols, r = Math.floor(k / cols), p = sp(f, (k % 9) * 2 + Math.floor(k / 9) * 6, 12, 230);
          const isSel = k === sel, s = isSel ? 1 + 0.12 * pick : 1;
          return (
            <div key={k} style={{ position: 'absolute', left: left + c * (T + G), top: 260 + r * (T + G) + scroll + (1 - p) * 220, width: T, height: T, borderRadius: 34, overflow: 'hidden',
              background: '#fff', opacity: Math.min(1, p * 1.5) * (isSel ? 1 : 1 - dim), transform: `scale(${s * (0.7 + 0.3 * p)})`, zIndex: isSel ? 2 : 1,
              boxShadow: isSel && f > 96 ? `0 0 0 ${10 * pick}px ${OR}, 0 30px 80px rgba(0,0,0,.5)` : '0 18px 40px rgba(0,0,0,.35)' }}>
              <Img src={img(`revo/${t}-cover.webp`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '40px 18px 16px', background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.72))', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 36, ...iso, textAlign: 'center' }}>{name}</div>
              {isSel && f > 100 ? <div style={{ position: 'absolute', right: 16, top: 16, width: 64, height: 64, borderRadius: 32, background: OR, transform: `scale(${sp(f, 102)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div> : null}
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,18,38,.0) 45%, rgba(8,18,38,.92) 78%)' }} />
      <Title lines={S.all} at={4} y={1330} size={150} out={86} />
      <Title lines={S.choose} at={92} y={1330} size={150} />
    </AbsoluteFill>
  );
};

// ===== 3. Le comparateur : la liste, trois magasins, le moins cher gagne =====================
const STORES: [string, string, number][] = [['ramilevy', 'Rami Lévy', 128.4], ['shufersal', 'Shufersal', 142.9], ['yohananof', 'Yohananof', 119.8]];
const money = (v: number) => (RTL ? '' : '') + v.toFixed(2).replace('.', ',') + ' ₪';
const Compare: React.FC = () => {
  const f = useCurrentFrame();
  const enter = sp(f, 0, 16, 160, 0.8);
  const count = lerp(f, [26, 64], [0, 1], Easing.out(Easing.cubic));
  const win = sp(f, 72, 11, 240);
  const tilt = lerp(f, [0, 150], [8, -4]);
  return (
    <AbsoluteFill>
      <Navy />
      <Punch at={[72]}>
        <div style={{ position: 'absolute', left: 110, top: 190, width: 860, height: 1120, borderRadius: 64, background: '#fff', transform: `translateY(${(1 - enter) * 900}px) perspective(1600px) rotateX(${tilt}deg)`,
          boxShadow: '0 60px 140px rgba(0,0,0,.55)', padding: '60px 56px', boxSizing: 'border-box', fontFamily: FONT, direction: RTL ? 'rtl' : 'ltr', color: '#111418' }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#5A6270', marginBottom: 18 }}>{S.list}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 46 }}>
            {S.items.map((it, i) => <div key={i} style={{ fontSize: 36, fontWeight: 700, padding: '12px 26px', borderRadius: 40, background: '#F2F3F5', transform: `scale(${sp(f, 6 + i * 4)})` }}>{it}</div>)}
          </div>
          {STORES.map(([id, name, v], i) => {
            const best = i === 2 && f >= 72, row = sp(f, 18 + i * 5);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 26, height: 170, padding: '0 28px', marginBottom: 22, borderRadius: 34, opacity: row,
                transform: `translateX(${(1 - row) * (RTL ? -200 : 200)}px) scale(${best ? 1 + 0.05 * win : 1})`,
                background: best ? '#FFF3EA' : '#F7F8FA', boxShadow: best ? `inset 0 0 0 ${6 * win}px ${OR}` : 'none' }}>
                <Img src={img(`revo/${id}-cover.webp`)} style={{ width: 112, height: 112, borderRadius: 24, objectFit: 'cover' }} />
                <div style={{ flex: 1, fontSize: 44, fontWeight: 800 }}>{name}</div>
                <div style={{ ...iso, fontSize: 52, fontWeight: 900, color: best ? OR : '#111418', fontVariantNumeric: 'tabular-nums' }}>{money(v * count)}</div>
              </div>
            );
          })}
          <div style={{ height: 60, display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 900, color: OR, letterSpacing: RTL ? 0 : '.06em', opacity: win }}>
            {S.cheapest.toUpperCase()} <span style={{ ...iso, margin: '0 18px', padding: '6px 20px', borderRadius: 30, background: GREEN, color: '#fff', fontSize: 32 }}>−23,10 ₪</span>
          </div>
          <div style={{ position: 'absolute', left: 56, right: 56, bottom: 56, height: 120, borderRadius: 60, background: OR, color: '#fff', fontSize: 50, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${f > 118 && f < 126 ? 0.94 : 1})` }}>{S.all1}</div>
        </div>
      </Punch>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,18,38,0) 62%, rgba(8,18,38,.95) 84%)' }} />
      <Title lines={S.cmp} at={2} y={1440} size={140} out={68} />
      <Title lines={S.best} at={74} y={1440} size={140} />
    </AbsoluteFill>
  );
};

// ===== 4. Les promos : les produits rebondissent, les % claquent ==============================
const PRODUCTS: [string, string][] = [['spot/coca-000.webp', '−30%'], ['spot/lait-a.webp', '−25%'], ['spot/chips-a.webp', '−40%'], ['spot/bamba.webp', '−50%']];
const Promos: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Navy />
      {PRODUCTS.map(([p, pct], i) => {
        const at = i * 7, k = sp(f, at, 10, 200), c = i % 2, r = Math.floor(i / 2);
        const x = 90 + c * 470, y = 300 + r * 560, bob = Math.sin((f - at) / 9 + i) * 10;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y + bob + (1 - k) * 700, width: 430, height: 520, transform: `rotate(${(c ? 4 : -4) * k}deg)` }}>
            <Img src={img(p)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.55))' }} />
            <div style={{ ...iso, position: 'absolute', top: 10, [c ? 'left' : 'right']: 0, padding: '14px 26px', borderRadius: 50, background: OR, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 60,
              transform: `scale(${sp(f, at + 15 + i * 3, 9, 300)}) rotate(${c ? -8 : 8}deg)`, boxShadow: '0 14px 30px rgba(0,0,0,.3)' } as React.CSSProperties}>{pct}</div>
          </div>
        );
      })}
      <Title lines={S.promo} at={0} y={1410} size={150} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1730, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 50, color: '#fff', opacity: lerp(f, [24, 34], [0, 1]), direction: RTL ? 'rtl' : 'ltr' }}>{S.promoSub}</div>
    </AbsoluteFill>
  );
};

// ===== 5. Hoppy écoute : le clip vidéo de Hoppy, micro et ondes ===============================
const Voice: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 8, 12, 220);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <OffthreadVideo src={img('pubs-veo/liste-hoppy-veo.mp4')} startFrom={95} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${lerp(f, [0, 90], [1.15, 1.05])})` }} />
      </AbsoluteFill>
      <Shade o={0.75} />
      <Title lines={S.voice} at={0} y={1080} size={160} />
      <div style={{ position: 'absolute', left: 140, right: 140, top: 1440, height: 150, borderRadius: 75, background: '#fff', display: 'flex', alignItems: 'center', gap: 26, padding: '0 34px',
        transform: `scale(${k})`, fontFamily: FONT, direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 30px 70px rgba(0,0,0,.4)' }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: OR, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><rect x="9" y="2.5" width="6" height="11.5" rx="3" fill="#fff" stroke="none" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3.5" /></svg>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, height: 90 }}>
          {f < 40 ? Array.from({ length: 22 }, (_, i) => { const a = 0.2 + 0.8 * Math.abs(Math.sin(i * 1.3 + f / 2.2)) * Math.sin(Math.PI * (i + .5) / 22); return <div key={i} style={{ flex: 1, height: 12 + a * 70, borderRadius: 8, background: NAVY }} />; })
            : <div style={{ fontSize: 50, fontWeight: 800, color: '#111418', opacity: lerp(f, [40, 46], [0, 1]) }}>{S.voiceSub}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 6. On y va pour vous : vitesse, la route, la porte, livré ==============================
const Go: React.FC = () => {
  const f = useCurrentFrame();
  // 0–60 : traînées de vitesse sur le sac HOP! ; 60–120 : la porte, « livré »
  const streaks = Array.from({ length: 26 }, (_, i) => {
    const y = random(`y${i}`) * 1920, len = 300 + random(`l${i}`) * 700, sp2 = 60 + random(`s${i}`) * 80;
    const x = ((f * sp2 + random(`x${i}`) * 2400) % 2600) - 700;
    return <div key={i} style={{ position: 'absolute', top: y, left: RTL ? undefined : x, right: RTL ? x : undefined, width: len, height: 4 + random(`h${i}`) * 8, borderRadius: 6,
      background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,${0.25 + random(`o${i}`) * 0.5}))`, transform: RTL ? 'scaleX(-1)' : undefined }} />;
  });
  const door = f >= 60;
  const stamp = sp(f, 92, 9, 280);
  return (
    <AbsoluteFill>
      {!door ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Navy />
          <Img src={img('spot/sac-045.webp')} style={{ position: 'absolute', left: 190, top: 520, width: 700, transform: `translateX(${Math.sin(f / 2) * 6}px) rotate(${-4 + Math.sin(f / 3) * 1.5}deg)`, filter: 'drop-shadow(0 50px 60px rgba(0,0,0,.6))' }} />
          {streaks}
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,18,38,.0) 55%, rgba(8,18,38,.85) 80%)' }} />
          <Title lines={S.go} at={0} y={1380} size={150} out={56} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill>
          <Punch at={[60, 92]}><Photo src="spot/livreur-porte.jpg" dur={60} from={1.35} to={1.15} x={-60} /></Punch>
          <Shade o={0.7} />
          <Title lines={S.fast} at={60} y={1080} size={170} out={88} />
          {f >= 92 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 1150, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '26px 60px 26px 44px', borderRadius: 90, background: GREEN, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 110,
              transform: `scale(${2 - stamp}) rotate(${-6 * stamp}deg)`, opacity: Math.min(1, stamp * 2), boxShadow: '0 30px 80px rgba(0,0,0,.45)', direction: RTL ? 'rtl' : 'ltr' }}>
              <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{S.done}
            </div></div> : null}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ===== 7. Fin : la révolution, HOP!, Hoppy ====================================================
const End: React.FC = () => {
  const f = useCurrentFrame();
  const logoIn = (i: number) => { const k = sp(f, 66 + i * 3, 10, 260); return { y: (1 - k) * 260, s: 0.5 + 0.5 * k, o: Math.min(1, k * 2) }; };
  const gone = lerp(f, [56, 64], [1, 0]);
  return (
    <AbsoluteFill>
      <Navy />
      <AbsoluteFill style={{ opacity: gone }}><Title lines={S.revo} at={0} y={560} size={130} step={10} /></AbsoluteFill>
      {f >= 60 ? <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', justifyContent: 'center' }}><Wordmark width={760} anim={logoIn} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 690, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 64, color: '#fff', direction: RTL ? 'rtl' : 'ltr', opacity: lerp(f, [84, 94], [0, 1]), transform: `translateY(${lerp(f, [84, 94], [30, 0], outExpo)}px)` }}>{S.tag}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 800, display: 'flex', justifyContent: 'center', opacity: lerp(f, [96, 104], [0, 1]) }}>
          <div style={{ padding: '16px 44px', borderRadius: 60, background: OR, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 56, direction: RTL ? 'rtl' : 'ltr' }}>{S.price}</div>
        </div>
        <Sequence from={70} layout="none"><HoppyHop x={540} bottom={1800} h={760} at={0.3} from={RTL ? 'right' : 'left'} /></Sequence>
      </> : null}
    </AbsoluteFill>
  );
};

// Montage : 120 BPM, coupes sur les temps
export const CUTS_REVO = [90, 270, 420, 510, 600, 720];
export const Revolution: React.FC<{ lang?: Lang; music?: boolean }> = ({ lang = 'fr', music = true }) => {
  S = STR[lang]; RTL = lang === 'he';
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <Sequence durationInFrames={90}><Hook /></Sequence>
      <Sequence from={90} durationInFrames={180}><Shops /></Sequence>
      <Sequence from={270} durationInFrames={150}><Compare /></Sequence>
      <Sequence from={420} durationInFrames={90}><Promos /></Sequence>
      <Sequence from={510} durationInFrames={90}><Voice /></Sequence>
      <Sequence from={600} durationInFrames={120}><Go /></Sequence>
      <Sequence from={720} durationInFrames={180}><End /></Sequence>
      <Flash at={[...CUTS_REVO, 360, 690]} />
      <Grain />
      {music ? <Audio src={staticFile('revo-music.wav')} /> : null}
    </AbsoluteFill>
  );
};
