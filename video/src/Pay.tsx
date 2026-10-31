import React from 'react';
import { AbsoluteFill, Audio, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { C, DISPLAY, UI } from './theme';
import { Digit, Flashes, Grain, Vignette, Wordmark, inExpo, inOut, lerp, outExpo, shake, useSpring, NIGHT } from './Reel';

// « Payer, c'est simple » : 15 s, 1080 × 1920, sur le même rythme que le showreel (coupes 60, 135, 225, 300, 360, 405).
// Bit, PayBox, espèces (avec la monnaie rendue), lien du commerce, aucune carte bancaire à taper.
export const PAY_FRAMES = 450;
const BIT = '#00B0C8';
export type PayLang = 'fr' | 'he';
const STR = {
  fr: { rtl: false, hook: 'Et hop, livré !', hook2: ['Payé comme', 'vous voulez.'],
    ways: ['BIT', 'PAYBOX', 'ESPÈCES', 'LIEN', 'SANS CARTE'],
    subs: ['à votre livreur, à la livraison', 'aussi simple, au livreur', 'à la porte, il rend la monnaie', 'du commerce, pour vos articles livrés', 'commandez, on livre, rien à taper'],
    label: 'LIVRAISON', phone: ['Votre livraison :', 'payée en 3 touches.'], rider: 'Ilan vous livre · 4 min', payTo: ['Payez', 'à Ilan'],
    steps: ['Ouvrir Bit', 'Coller le numéro', "J'ai payé"], copied: '✓ copié', seen: '✅ Ilan voit votre paiement',
    cash: ['Espèces à la livraison ?', 'Il rend la monnaie.'], cashCard: '🛵 Livraison 25 ₪', payWith: 'Vous payez avec :', exact: "L'appoint", back: 'Ilan vous rend',
    city: ['LA LIVRAISON', 'DANS NETANYA'], stamp: 'LIVRÉ · PAYÉ ✓', chips: ['🧾 Reçu envoyé', '💝 Pourboire 100 % livreur'],
    tiles: ['Aucune carte bancaire à taper', 'Bit ou PayBox, à la livraison', 'Espèces : il rend la monnaie', 'Livré à votre porte, suivi en direct'],
    outro: ['Livré par HOP!', 'payé comme vous voulez.'], pills: ['Bit', 'PayBox', 'Espèces'] },
  he: { rtl: true, hook: 'הופ, וזה אצלכם!', hook2: ['משלמים', 'איך שנוח לכם.'],
    ways: ['ביט', 'פייבוקס', 'מזומן', 'קישור', 'בלי כרטיס'],
    subs: ['לשליח שלכם, ברגע המסירה', 'פשוט באותה מידה, לשליח', 'בדלת, והוא מחזיר עודף', 'של העסק, על המוצרים שנמסרו', 'מזמינים, אנחנו מביאים, בלי להקליד'],
    label: 'משלוח', phone: ['המשלוח שלכם:', 'משולם ב־3 נגיעות.'], rider: "אילן בדרך אליכם · 4 דק'", payTo: ['שלמו', 'לאילן'],
    steps: ['פתחו את ביט', 'הדביקו את המספר', 'שילמתי'], copied: '✓ הועתק', seen: '✅ אילן רואה את התשלום',
    cash: ['מזומן במסירה?', 'הוא מחזיר עודף.'], cashCard: '🛵 משלוח 25 ₪', payWith: 'משלמים עם:', exact: 'סכום מדויק', back: 'אילן מחזיר לכם',
    city: ['משלוח', 'בנתניה'], stamp: 'נמסר · שולם ✓', chips: ['🧾 הקבלה נשלחה', '💝 טיפ 100% לשליח'],
    tiles: ['בלי להקליד כרטיס אשראי', 'ביט או פייבוקס, ברגע המסירה', 'מזומן: הוא מחזיר עודף', 'עד הדלת, עם מעקב חי'],
    outro: ['נמסר על ידי HOP!', 'משלמים איך שנוח לכם.'], pills: ['ביט', 'פייבוקס', 'מזומן'] },
};
let T = STR.fr; // fixé par <Pay lang> avant le rendu des scènes

// ===== 1. Une pièce ₪ tombe en tournant, « Payer ? » → « Comme vous voulez. » ================
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const drop = lerp(f, [0, 22], [-1300, 0], Easing2.inQuad);
  const spin = lerp(f, [0, 22], [0, 1080]) + (f > 22 ? Math.sin((f - 22) / 3) * 18 * lerp(f, [22, 40], [1, 0]) : 0);
  const sh = shake(f, 22, 30, 12);
  const ring = lerp(f, [22, 42], [0, 1], outExpo);
  const q = lerp(f, [24, 32], [0, 1], outExpo), a = lerp(f, [38, 46], [0, 1], outExpo);
  const zoom = lerp(f, [48, 60], [1, 14], inExpo);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.navy2} 0%, ${C.navy} 65%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 760, width: 40 + ring * 2400, height: 40 + ring * 2400, borderRadius: '50%', border: `${lerp(ring, [0, 1], [24, 2])}px solid #FFB020`,
        transform: 'translate(-50%,-50%)', opacity: lerp(ring, [0, 0.08, 1], [0, 1, 0]) }} />
      <AbsoluteFill style={{ alignItems: 'center', transform: `translate(${sh.x}px, ${sh.y}px) scale(${zoom})`, transformOrigin: '50% 40%', perspective: 1400 }}>
        <div style={{ marginTop: 560, width: 400, height: 400, transform: `translateY(${drop}px) rotateY(${spin}deg)`, transformStyle: 'preserve-3d', position: 'relative' }}>
          {[0, 1].map(side => (
            <div key={side} style={{ position: 'absolute', inset: 0, borderRadius: '50%', backfaceVisibility: 'hidden', transform: `rotateY(${side * 180}deg)`,
              background: 'radial-gradient(circle at 35% 30%, #FFE7A3, #F5B014 55%, #C98A12)', boxShadow: 'inset 0 0 0 18px rgba(255,255,255,.35), inset 0 -20px 40px rgba(150,90,0,.35)',
              display: 'grid', placeItems: 'center', font: `700 230px/1 ${DISPLAY}`, color: '#8A5A00' }}>₪</div>
          ))}
        </div>
        <div style={{ position: 'relative', marginTop: 90, height: 260, width: 1000, textAlign: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, font: `700 ${T.rtl ? 116 : 128}px/1 ${DISPLAY}`, color: '#fff', opacity: q * (1 - a), transform: `translateY(${(1 - q) * 60 - a * 60}px)` }}>{T.hook}</div>
          <div style={{ position: 'absolute', inset: 0, font: `700 112px/1.05 ${DISPLAY}`, color: '#fff', opacity: a, transform: `translateY(${(1 - a) * 60}px)` }}>{T.hook2[0]}<br /><span style={{ color: C.orange }}>{T.hook2[1]}</span></div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const Easing2 = { inQuad: (t: number) => t * t };

// ===== 2. Un moyen de paiement par temps ===================================================
const WAYS = [
  { w: 'BIT', e: '📱', bg: BIT, fg: '#fff', out: 'rgba(255,255,255,.2)', sub: 'à votre livreur, à la livraison' },
  { w: 'PAYBOX', e: '📲', bg: C.navy, fg: '#8EC5FF', out: 'rgba(142,197,255,.14)', sub: 'aussi simple, au livreur' },
  { w: 'ESPÈCES', e: '💵', bg: C.green, fg: '#fff', out: 'rgba(255,255,255,.18)', sub: 'à la porte, il rend la monnaie' },
  { w: 'LIEN', e: '🔗', bg: '#fff', fg: C.orangeDeep, out: 'rgba(224,66,10,.1)', sub: 'du commerce, pour vos articles livrés' },
  { w: 'SANS CARTE', e: '🔒', bg: C.orange, fg: '#fff', out: 'rgba(255,255,255,.18)', sub: 'commandez, on livre, rien à taper' },
];
const Way: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const w = { ...WAYS[i], w: T.ways[i], sub: T.subs[i] }, dir = (i % 2 ? -1 : 1) * (T.rtl ? -1 : 1);
  const wipe = lerp(f, [0, 5], [1, 0], outExpo);
  const em = useSpring(2, 9, 220, 0.6);
  const sh = shake(f, 0, 14, 6);
  const size = T.rtl ? Math.min(260, 1700 / w.w.length) : Math.min(280, 1500 / w.w.length);
  return (
    <AbsoluteFill style={{ background: w.bg, overflow: 'hidden', clipPath: `inset(0 ${dir > 0 ? 0 : wipe * 100}% 0 ${dir > 0 ? wipe * 100 : 0}%)` }}>
      {[-1, 0, 1, 2].map(row => (
        <div key={row} style={{ position: 'absolute', left: 0, top: 440 + row * 330, whiteSpace: 'nowrap', font: `700 300px/1 ${DISPLAY}`, color: 'transparent',
          WebkitTextStroke: `4px ${w.out}`, transform: `translateX(${(row % 2 ? 1 : -1) * (f * 18) - 600}px)` }}>{`${w.w} · ${w.w} · ${w.w} · ${w.w}`}</div>
      ))}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ fontSize: 250, transform: `scale(${em}) rotate(${(1 - em) * -40 * dir}deg) translateY(-30px)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.25))' }}>{w.e}</div>
        <div style={{ display: 'flex' }}>
          {(T.rtl ? [w.w] : w.w.split('')).map((ch, k) => {
            const ls = spring({ frame: f - k * 0.8, fps: 30, config: { damping: 12, stiffness: 320, mass: 0.45 } });
            return <span key={k} style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: w.fg, display: 'inline-block', whiteSpace: 'pre',
              transform: `translateX(${(1 - ls) * 260 * dir}px) skewX(${(1 - ls) * -22 * dir}deg)`, opacity: ls }}>{ch}</span>;
          })}
        </div>
        <div style={{ marginTop: 26, font: `700 48px/1.2 ${UI}`, color: w.fg, opacity: lerp(f, [4, 9], [0, 0.92]), transform: `translateY(${lerp(f, [4, 9], [20, 0], outExpo)}px)` }}>{w.sub}</div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', font: `800 40px/1 ${UI}`, letterSpacing: T.rtl ? '.1em' : '.35em', color: w.fg, opacity: 0.85 }}>
        {T.label} · <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>{String(i + 1).padStart(2, '0')}/05</span>
      </div>
    </AbsoluteFill>
  );
};
const Ways: React.FC = () => <AbsoluteFill>{WAYS.map((_, i) => <Sequence key={i} from={i * 15} durationInFrames={15}><Way i={i} /></Sequence>)}</AbsoluteFill>;

// ===== 3. Le téléphone : payer par Bit en 3 touches ==========================================
const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame();
  const k = lerp(f, [at - 6, at], [0, 1], outExpo), r = lerp(f, [at, at + 12], [0, 1], outExpo);
  if (f < at - 8 || f > at + 14) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: '50%', background: 'rgba(255,255,255,.85)', boxShadow: '0 6px 18px rgba(0,0,0,.3)',
        transform: `scale(${0.6 + 0.4 * k - 0.2 * r})`, opacity: k * (1 - r * 0.8) }} />
      <div style={{ position: 'absolute', left: x, top: y, width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: '50%', border: '6px solid #fff', transform: `scale(${1 + r * 1.6})`, opacity: 1 - r }} />
    </>
  );
};
const PhoneScene: React.FC = () => {
  const f = useCurrentFrame();
  const enter = useSpring(0, 14, 130, 0.9);
  const copied = f >= 38, paid = f >= 62;
  const paidS = useSpring(62, 9, 220, 0.6);
  const head = lerp(f, [3, 14], [0, 1], outExpo);
  const step = (n: number, label: string, on: boolean, color: string, extra?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '26px 26px', borderRadius: 28, background: on ? color : '#141B2D', border: `2px solid ${on ? color : '#232C44'}`, color: '#fff' }}>
      <span style={{ width: 62, height: 62, borderRadius: '50%', background: on ? 'rgba(255,255,255,.25)' : '#232C44', display: 'grid', placeItems: 'center', font: `800 34px/1 ${UI}` }}>{n}</span>
      <span style={{ font: `700 40px/1.15 ${UI}` }}>{label}{extra}</span>
    </div>
  );
  const exit = lerp(f, [82, 90], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #0E3A66 0%, ${NIGHT} 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 140, left: 0, right: 0, textAlign: 'center', font: `700 96px/1.05 ${DISPLAY}`, color: '#fff', opacity: head, transform: `translateY(${(1 - head) * 60}px)` }}>
        {T.phone[0]}<br /><span style={{ color: BIT }}>{T.phone[1]}</span>
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1800 }}>
        <div style={{ position: 'relative', marginTop: 360, width: 700, height: 1180, borderRadius: 96, background: '#05070D', padding: 20, boxShadow: '0 80px 120px rgba(0,0,0,.5)',
          transform: `translateY(${(1 - enter) * 1500 + exit * 300}px) rotateX(${(1 - enter) * 20 + 4}deg) scale(${1 - exit * 0.1})` }}>
          <div style={{ position: 'absolute', inset: 20, borderRadius: 78, background: NIGHT, padding: '70px 40px', display: 'flex', flexDirection: 'column', gap: 26, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, font: `600 34px/1 ${UI}`, color: '#A9B3CA' }}><span style={{ width: 54, height: 54, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', fontSize: 30 }}>🛵</span>{T.rider}</div>
            <div style={{ font: `700 72px/1.05 ${DISPLAY}`, color: '#fff' }}>{T.payTo[0]} <span style={{ color: BIT, unicodeBidi: 'isolate' }}>25 ₪</span><br />{T.payTo[1]}</div>
            {step(1, T.steps[0], f >= 22, BIT)}
            {step(2, T.steps[1], copied, BIT, copied ? <small style={{ display: 'block', font: `500 30px/1.2 ${UI}`, opacity: 0.9 }}><span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>052-111-2233</span> {T.copied}</small> : null)}
            {step(3, paid ? T.steps[2] + ' ✓' : T.steps[2], paid, C.green)}
            <div style={{ marginTop: 8, padding: '26px 30px', borderRadius: 28, background: paid ? 'rgba(18,183,106,.15)' : 'transparent', border: paid ? `2px solid ${C.green}` : '2px solid transparent',
              transform: `scale(${paid ? paidS : 0.9})`, opacity: paid ? 1 : 0, font: `700 40px/1.2 ${UI}`, color: '#6CE9A6' }}>{T.seen}</div>
          </div>
          <Tap x={350} y={386} at={22} />
          <Tap x={350} y={528} at={38} />
          <Tap x={350} y={692} at={62} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 4. Les espèces : on choisit le billet, le livreur rend la monnaie =======================
const Bill: React.FC<{ k: number; f: number }> = ({ k, f }) => {
  const x = random(`bx${k}`) * 1300 - 110, sp = 9 + random(`bs${k}`) * 10, r0 = random(`br${k}`) * 360;
  const y = -300 + ((f * sp + random(`by${k}`) * 2200) % 2300);
  return <div style={{ position: 'absolute', left: x, top: y, width: 230, height: 120, borderRadius: 14, background: 'linear-gradient(135deg,#B7E4C7,#52B788)', border: '6px solid #E9F7EF',
    transform: `rotate(${r0 + f * (random(`bw${k}`) * 6 - 3)}deg) rotateX(${f * 7 + k * 40}deg)`, opacity: 0.55, display: 'grid', placeItems: 'center', font: `800 54px/1 ${UI}`, color: '#1B4332' }}>₪</div>;
};
const CashScene: React.FC = () => {
  const f = useCurrentFrame();
  const head = lerp(f, [2, 12], [0, 1], outExpo);
  const chips = [T.exact, '50 ₪', '100 ₪', '200 ₪'];
  const pick = f >= 20;
  const back = useSpring(43, 10, 200, 0.6);
  const coins = Array.from({ length: 14 }).map((_, k) => {
    const t = Math.max(0, f - 45) / 30;
    return { x: (random(`cx${k}`) - 0.5) * 700, y: -200 + 1400 * t * t + random(`cy${k}`) * 80 - 60, r: random(`cr${k}`) * 900 * t };
  });
  const sh = shake(f, 43, 18, 8);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, #15A36A 0%, #0B7A4E 100%)`, overflow: 'hidden' }}>
      {Array.from({ length: 12 }).map((_, k) => <Bill key={k} k={k} f={f} />)}
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', font: `700 96px/1.05 ${DISPLAY}`, color: '#fff', opacity: head, transform: `translateY(${(1 - head) * 60}px)` }}>
        {T.cash[0]}<br /><span style={{ color: '#FFE7A3' }}>{T.cash[1]}</span>
      </div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y + 160}px)` }}>
        {coins.map((c, k) => f > 45 && <div key={k} style={{ position: 'absolute', left: '50%', top: '40%', width: 80, height: 80, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #FFE7A3, #F5B014 60%, #C98A12)', transform: `translate(${c.x * 1.4}px, ${c.y}px) rotateY(${c.r}deg)` }} />)}
        <div style={{ position: 'relative', width: 900, padding: 50, borderRadius: 48, background: '#fff', boxShadow: '0 50px 90px rgba(0,40,20,.4)', transform: `scale(${lerp(f, [0, 14], [0.85, 1], outExpo)})` }}>
          <div style={{ font: `600 36px/1 ${UI}`, color: C.muted, marginBottom: 18 }}>{T.cashCard}</div><div style={{ font: `700 50px/1 ${UI}`, color: C.ink }}>{T.payWith}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 34 }}>
            {chips.map((c, k) => {
              const on = pick && k === 1;
              return <div key={k} style={{ padding: '24px 34px', borderRadius: 999, font: `700 46px/1 ${UI}`, background: on ? C.green : '#F2F4F7', color: on ? '#fff' : C.ink,
                border: `3px solid ${on ? C.green : '#E4E7EC'}`, transform: `scale(${on ? 1 + 0.08 * Math.max(0, 1 - (f - 20) / 8) : 1})` }}>{c}</div>;
            })}
          </div>
          <div style={{ marginTop: 40, padding: '30px 34px', borderRadius: 30, background: '#ECFDF3', display: 'flex', alignItems: 'center', gap: 22, transform: `scale(${back})`, opacity: Math.min(1, back) }}>
            <span style={{ fontSize: 80 }}>🪙</span>
            <span style={{ font: `700 54px/1.15 ${UI}`, color: '#067647' }}>{T.back}<br /><b style={{ font: `700 76px/1 ${DISPLAY}` }}>25 ₪</b></span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 5. 25 ₪, tampon « PAYÉ » ============================================================
const PaidScene: React.FC = () => {
  const f = useCurrentFrame();
  const stamp = useSpring(30, 8, 300, 0.6);
  const sh = shake(f, 30, 30, 10);
  const ring = lerp(f, [30, 50], [0, 1], outExpo);
  const lab = lerp(f, [2, 14], [0, 1], outExpo);
  const chip = (d: number) => spring({ frame: f - d, fps: 30, config: { damping: 10, stiffness: 220, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: C.cream, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(-45deg, rgba(18,183,106,.07) 0 40px, transparent 40px 80px)', transform: `translateX(${f * 3}px)` }} />
      <div style={{ position: 'absolute', left: 540, top: 900, width: 40 + ring * 2200, height: 40 + ring * 2200, borderRadius: '50%', border: `${lerp(ring, [0, 1], [20, 2])}px solid ${C.green}`, transform: 'translate(-50%,-50%)', opacity: 1 - ring }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ font: `800 46px/1.25 ${UI}`, letterSpacing: `${(T.rtl ? 0.12 : 0.3) - 0.12 * lab}em`, color: '#067647', opacity: lab, marginBottom: 30, textAlign: 'center' }}>{T.city[0]}<br />{T.city[1]}</div>
        <div style={{ display: 'flex', alignItems: 'center', direction: 'ltr' }}>
          <Digit to={2} land={24} /><Digit to={5} land={30} />
          <div style={{ font: `700 260px/1 ${DISPLAY}`, color: C.orange, transform: `scale(${stamp}) rotate(${(1 - stamp) * -60}deg)`, marginLeft: 10 }}>₪</div>
        </div>
        <div style={{ marginTop: 40, padding: '28px 60px', border: `12px solid ${C.green}`, borderRadius: 30, font: `800 80px/1 ${UI}`, color: C.green, letterSpacing: '.04em', whiteSpace: 'nowrap',
          transform: `scale(${1 + Math.max(0, 1 - stamp) * 2.4}) rotate(-7deg)`, opacity: Math.min(1, stamp) }}>{T.stamp}</div>
        <div style={{ display: 'flex', gap: 22, marginTop: 70 }}>
          {T.chips.map((t, k) => <div key={k} style={{ transform: `scale(${chip(40 + k * 7)})`, padding: '22px 34px', borderRadius: 999, background: C.navy, color: '#fff', font: `700 40px/1 ${UI}` }}>{t}</div>)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 6. Quatre tuiles, puis elles se replient en un point =====================================
const TILES = [
  { big: '🔒', t: 'Aucune carte bancaire à taper', bg: C.orange, fg: '#fff' },
  { big: '📱', t: 'Bit ou PayBox, à la livraison', bg: BIT, fg: '#fff' },
  { big: '💵', t: 'Espèces : il rend la monnaie', bg: C.green, fg: '#fff' },
  { big: '🛵', t: 'Livré à votre porte, suivi en direct', bg: '#fff', fg: C.navy },
];
const TilesScene: React.FC = () => {
  const f = useCurrentFrame();
  const fold = lerp(f, [32, 45], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 60, top: 300, width: 960, height: 1320, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30,
        transform: `scale(${1 - fold * 0.98}) rotate(${fold * 90}deg)`, opacity: 1 - lerp(fold, [0.85, 1], [0, 1]) }}>
        {TILES.map((x, k) => {
          const s = spring({ frame: f - k * 6, fps: 30, config: { damping: 12, stiffness: 200, mass: 0.6 } });
          const from = [[-700, -900], [700, -900], [-700, 900], [700, 900]][k];
          return (
            <div key={k} style={{ background: x.bg, color: x.fg, borderRadius: 44, padding: 46, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              transform: `translate(${from[0] * (1 - s)}px, ${from[1] * (1 - s)}px) rotate(${(1 - s) * (k % 2 ? 25 : -25)}deg) scale(${0.5 + 0.5 * s})`, boxShadow: '0 30px 60px rgba(0,0,0,.3)' }}>
              <div style={{ fontSize: 170, lineHeight: 1 }}>{x.big}</div>
              <div style={{ font: `700 52px/1.15 ${UI}` }}>{T.tiles[k]}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${fold})`, boxShadow: `0 0 80px ${C.orange}` }} />
    </AbsoluteFill>
  );
};

// ===== 7. Fin ================================================================================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 10], [0, 1], outExpo);
  const letter = (i: number) => {
    const s = spring({ frame: f - 4 - i * 3, fps: 30, config: { damping: i === 3 ? 6 : 10, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * -500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * -80 : 0, o: f >= 4 + i * 3 ? 1 : 0 };
  };
  const sub = lerp(f, [14, 24], [0, 1], outExpo);
  const pills = (d: number) => spring({ frame: f - d, fps: 30, config: { damping: 11, stiffness: 200, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${1 + open * 40})`, opacity: 1 - open }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 60%)`, opacity: open }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark width={760} anim={letter} />
        <div style={{ marginTop: 50, font: `700 76px/1.1 ${DISPLAY}`, color: '#fff', textAlign: 'center', opacity: sub, transform: `translateY(${(1 - sub) * 40}px)` }}>
          {T.outro[0].split('HOP!')[0]}<bdi dir="ltr">HOP!</bdi>{T.outro[0].split('HOP!')[1]}<br /><span style={{ color: C.orange }}>{T.outro[1]}</span>
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 60 }}>
          {[[T.pills[0], BIT], [T.pills[1], '#3B82F6'], [T.pills[2], C.green]].map(([t, c], k) => (
            <div key={k} style={{ padding: '22px 34px', borderRadius: 999, background: c, color: '#fff', font: `700 44px/1 ${UI}`, transform: `scale(${pills(14 + k * 3)})` }}>{t}</div>))}
        </div>
        <div style={{ marginTop: 56, font: `700 46px/1 ${UI}`, color: '#A9B3CA', opacity: lerp(f, [30, 38], [0, 1]) }}>hop-livraison.vercel.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Pay: React.FC<{ music?: boolean; lang?: PayLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: C.navy, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={60}><Hook /></Sequence>
    <Sequence from={60} durationInFrames={75}><Ways /></Sequence>
    <Sequence from={135} durationInFrames={90}><PhoneScene /></Sequence>
    <Sequence from={225} durationInFrames={75}><CashScene /></Sequence>
    <Sequence from={300} durationInFrames={60}><PaidScene /></Sequence>
    <Sequence from={360} durationInFrames={45}><TilesScene /></Sequence>
    <Sequence from={405} durationInFrames={45}><Outro /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('pay-music.wav')} />}
  </AbsoluteFill>
); };
