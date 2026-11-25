import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/heebo/900.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/caveat/700.css';
import { HoppyHop } from './HoppyHop';
import { Wordmark } from './Reel';

// « La révolution à Netanya » au design 5 de l'appli (patron, 25/11) : 30 s, 1080 × 1920, 120 BPM (1 temps = 15 images).
// Palette Mer & agrumes de l'appli (bleu, citron, corail, vert, encre), gros titres Bricolage Grotesque, accroches en Caveat,
// grands blocs de couleur, pastilles qui rebondissent, et les VRAIES captures de l'appli (public/revo5/) dans un téléphone.
// 1. accroche · 2. tout, livré (l'accueil) · 3. on compare les prix · 4. vos restos (Rendez-Vous, Bassari / Halavi)
// 5. dites-le à Hoppy · 6. on y va pour vous, dès 25 ₪ en ville · 7. fin HOP!.
// Règles : aucun concurrent nommé, pas de durée chiffrée, « dès 25 ₪ en ville », Hoppy officiel.
export const REVO5_FRAMES = 915;
type Lang = 'fr' | 'he';
const BLUE = '#1E9BF0', LEMON = '#FFE14A', CORAL = '#FF5D73', MINT = '#7ED9A6', INK = '#0B4A6F', NAVY = '#0F1F3D', NIGHT = '#081226', OR = '#FF6A13';
const STR = {
  fr: {
    hook: ['LA', 'RÉVOLUTION'], hookS: 'à Netanya', pills: ['Courses', 'Restos', 'Pharmacie', 'Colis'],
    tout: ['Tout,', 'livré.'], toutS: 'choisissez, on y va pour vous',
    cmp: ['On compare', 'les prix.'], cmpS: 'le moins cher, en un clin d’œil', cheap: 'Moins cher', big: '7,20 ₪', shops: [['Osher Ad', '7,20'], ['Rami Lévy', '7,20']],
    resto: ['Vos restos', 'préférés.'], restoS: 'votre plat arrive chaud', bassari: 'Bassari', halavi: 'Halavi', comp: ['Composez', 'votre plat.'], compS: 'comme vous l’aimez',
    voice: ['Dites-le', 'à Hoppy.'], say: '« Du lait et du pain »',
    go: ['On y va', 'pour vous.'], price: 'Dès 25 ₪ en ville', fast: 'au plus vite',
    end: 'On fait vos courses pour vous',
  },
  he: {
    hook: ['המהפכה'], hookS: 'בנתניה', pills: ['קניות', 'מסעדות', 'בית מרקחת', 'חבילות'],
    tout: ['הכול,', 'עד הבית.'], toutS: 'אתם בוחרים, אנחנו הולכים',
    cmp: ['משווים', 'מחירים.'], cmpS: 'הכי זול, במבט אחד', cheap: 'הכי זול', big: '7.20 ₪', shops: [['אושר עד', '7.20'], ['רמי לוי', '7.20']],
    resto: ['המסעדות', 'שאתם אוהבים.'], restoS: 'האוכל מגיע חם', bassari: 'בשרי', halavi: 'חלבי', comp: ['מרכיבים', 'את המנה.'], compS: 'בדיוק כמו שאתם אוהבים',
    voice: ['תגידו', 'להופי.'], say: '«חלב ולחם»',
    go: ['אנחנו הולכים', 'בשבילכם.'], price: 'החל מ־25 ₪ בעיר', fast: 'הכי מהר',
    end: 'עושים לכם את הקניות',
  },
};
let S: (typeof STR)['fr'] = STR.fr, RTL = false, L: Lang = 'fr';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], e?: (t: number) => number) => interpolate(f, a, b, { ...clamp, easing: e });
const outExpo = Easing.out(Easing.exp), inOut = Easing.inOut(Easing.cubic);
const sp = (f: number, d: number, damping = 12, stiffness = 220, mass = 0.7) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const TITLE = () => (RTL ? 'Heebo, sans-serif' : '"Bricolage Grotesque", Heebo, sans-serif');
const SCRIPT = () => (RTL ? 'Heebo, sans-serif' : 'Caveat, cursive');
const iso: React.CSSProperties = { unicodeBidi: 'isolate', direction: 'ltr' };
const cap = (p: string) => staticFile(`revo5/${p}-${L}.jpg`);

// Fond de scène : couleur pleine qui s'ouvre en cercle depuis un point (transition), deux grands ronds qui dérivent
const Stage: React.FC<{ bg: string; a: string; b: string; ox?: number; oy?: number; children: React.ReactNode }> = ({ bg, a, b, ox = 540, oy = 960, children }) => {
  const f = useCurrentFrame();
  const r = lerp(f, [0, 12], [0, 2300], outExpo);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r}px at ${ox}px ${oy}px)`, background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 820, height: 820, borderRadius: '50%', background: a, opacity: 0.55, left: -260 + Math.sin(f / 22) * 40, top: -240 + Math.cos(f / 26) * 30 }} />
      <div style={{ position: 'absolute', width: 640, height: 640, borderRadius: '50%', background: b, opacity: 0.5, right: -220 + Math.cos(f / 20) * 40, bottom: -180 + Math.sin(f / 24) * 30 }} />
      {children}
    </AbsoluteFill>
  );
};
// Gros titre : chaque ligne claque (grandit puis se pose) avec un léger tilt, la 2e ligne dans un bloc de couleur
const Title: React.FC<{ lines: string[]; at: number; y: number; size: number; color?: string; block?: string; blockInk?: string; step?: number }> = ({ lines, at, y, size, color = INK, block, blockInk = '#fff', step = 8 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.08 }}>
      {lines.map((l, i) => {
        const k = sp(f, at + i * step, 11, 260, 0.6);
        if (f < at + i * step) return <div key={i} style={{ height: size * 1.05 }} />;
        const fit = Math.min(size, 940 / Math.max(1, l.length * (RTL ? 0.68 : 0.6)));
        const last = i === lines.length - 1 && block;
        return (
          <div key={i} style={{ transform: `scale(${0.4 + 0.6 * k}) rotate(${(1 - k) * (i % 2 ? 6 : -6) + (last ? -2 : 0)}deg)`, opacity: Math.min(1, k * 2),
            fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: fit, lineHeight: 1.02, letterSpacing: RTL ? 0 : '-0.04em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr',
            color: last ? blockInk : color, background: last ? block : 'transparent', padding: last ? `${fit * 0.06}px ${fit * 0.22}px ${fit * 0.1}px` : 0, borderRadius: last ? fit * 0.28 : 0 }}>{l}</div>
        );
      })}
    </div>
  );
};
// Accroche manuscrite (Caveat jaune ; en hébreu : Heebo gras), qui s'écrit de gauche à droite (de droite à gauche en hébreu)
const Script: React.FC<{ text: string; at: number; y: number; size?: number; color?: string; rot?: number }> = ({ text, at, y, size = 96, color = LEMON, rot = -3 }) => {
  const f = useCurrentFrame();
  const w = lerp(f, [at, at + 14], [0, 100], Easing.out(Easing.cubic));
  if (f < at) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', transform: `rotate(${rot}deg)` }}>
      <span style={{ display: 'inline-block', fontFamily: SCRIPT(), fontWeight: RTL ? 900 : 700, fontSize: RTL ? size * 0.82 : size, color, direction: RTL ? 'rtl' : 'ltr', whiteSpace: 'nowrap', padding: '0 0.25em',
        clipPath: RTL ? `inset(0 0 0 ${100 - w}%)` : `inset(0 ${100 - w}% 0 0)`, textShadow: '0 4px 0 rgba(11,74,111,.25)' }}>{text}</span>
    </div>
  );
};
// Pastille de l'appli (comme les bulles du design 5) : pop + petit balancement
const Pill: React.FC<{ text: string; at: number; x: number; y: number; bg?: string; ink?: string; size?: number; rot?: number }> = ({ text, at, x, y, bg = '#fff', ink = INK, size = 46, rot = -4 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 9, 280, 0.6);
  const bob = Math.sin((f - at) / 9) * 6;
  return (
    <div style={{ position: 'absolute', left: x, top: y + bob, transform: `translate(-50%, -50%) scale(${k}) rotate(${rot + Math.sin((f - at) / 14) * 2}deg)`,
      padding: `${size * 0.32}px ${size * 0.62}px`, borderRadius: size, background: bg, color: ink, fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: size,
      letterSpacing: RTL ? 0 : '-0.02em', whiteSpace: 'nowrap', direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 14px 30px rgba(11,74,111,.25), inset 0 -4px 0 rgba(0,0,0,.08)' }}>{text}</div>
  );
};
// Téléphone : la vraie capture de l'appli, qui arrive en ressort et peut défiler (capture plein écran ou longue)
const Phone: React.FC<{ src: string; at?: number; x?: number; y: number; w?: number; scroll?: [number, number, number, number]; tilt?: number; src2?: string; swap?: number }> =
  ({ src, at = 0, x = 540, y, w = 640, scroll, tilt = -4, src2, swap }) => {
  const f = useCurrentFrame();
  const k = sp(f, at, 14, 140, 0.9);
  const sw = w - 36, sh = sw * 2532 / 1173;
  const off = scroll ? lerp(f, [scroll[0], scroll[1]], [0, -scroll[2]], inOut) + lerp(f, [scroll[1] + 6, scroll[3]], [0, -40], inOut) : 0;
  const b = src2 != null && swap != null ? lerp(f, [swap, swap + 8], [0, 1]) : 0;
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y, width: w, height: sh + 36, borderRadius: 92, background: '#0B1220', padding: 18, boxSizing: 'border-box',
      transform: `translateY(${(1 - k) * 900}px) rotate(${tilt * (1 - k * 0.6)}deg) perspective(1600px) rotateY(${(1 - k) * 18}deg)`,
      boxShadow: '0 50px 90px rgba(8,18,38,.45), inset 0 0 0 3px #2A3550' }}>
      <div style={{ position: 'relative', width: sw, height: sh, borderRadius: 76, overflow: 'hidden', background: '#fff' }}>
        <Img src={src} style={{ position: 'absolute', left: 0, top: off, width: sw }} />
        {src2 ? <Img src={src2} style={{ position: 'absolute', left: 0, top: 0, width: sw, opacity: b }} /> : null}
        <div style={{ position: 'absolute', top: 16, left: '50%', width: 190, height: 52, marginLeft: -95, borderRadius: 30, background: '#0B1220' }} />
      </div>
    </div>
  );
};
// Petit zoom de caméra sur les coups
const Punch: React.FC<{ at: number[]; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = Math.max(0, ...at.map(c => (f >= c ? lerp(f, [c, c + 10], [0.05, 0], outExpo) : 0)));
  return <AbsoluteFill style={{ transform: `scale(${1 + p})` }}>{children}</AbsoluteFill>;
};
const Flash: React.FC<{ at: number[] }> = ({ at }) => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...at.map(c => (f >= c ? lerp(f, [c, c + 5], [0.5, 0]) : 0)));
  return <AbsoluteFill style={{ background: '#fff', opacity: o, pointerEvents: 'none' }} />;
};

// ===== 1. Accroche (0–120) =====
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const big = RTL ? 250 : 210;
  return (
    <Stage bg={BLUE} a="#3FB0FF" b={MINT}>
      <Punch at={[0, 15, 30]}>
        <Title lines={S.hook} at={RTL ? 15 : 0} y={RTL ? 470 : 380} size={big} color="#fff" step={15} />
        <Script text={S.hookS} at={45} y={RTL ? 800 : 860} size={150} />
        {S.pills.map((p, i) => <Pill key={p} text={p} at={66 + i * 6} x={[250, 800, 230, 820][i]} y={[1130, 1170, 1330, 1350][i]} bg={['#fff', LEMON, CORAL, '#fff'][i]} ink={i === 2 ? '#fff' : INK} rot={[-6, 5, 4, -5][i]} />)}
      </Punch>
      <Sequence from={54} layout="none"><HoppyHop x={540} bottom={1900} h={520} at={0.05} from={RTL ? 'right' : 'left'} /></Sequence>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, background: `linear-gradient(0deg, rgba(11,74,111,.25), transparent)`, opacity: lerp(f, [0, 20], [0, 1]) }} />
    </Stage>
  );
};
// ===== 2. Tout, livré (120–270) : l'accueil qui défile =====
const Tout: React.FC = () => (
  <Stage bg={LEMON} a="#FFEE80" b={CORAL} ox={540} oy={1700}>
    <Title lines={S.tout} at={4} y={110} size={150} block={CORAL} step={10} />
    <Script text={S.toutS} at={26} y={448} size={78} color={INK} rot={-2} />
    <Phone src={cap('home')} at={8} y={590} w={640} scroll={[30, 105, 2600, 120]} tilt={-3} />
  </Stage>
);
// ===== 3. On compare (270–450) : la recherche « Lait » et le comparateur =====
const Compare: React.FC = () => {
  const f = useCurrentFrame();
  const price = sp(f, 105, 8, 300, 0.5);
  return (
    <Stage bg={MINT} a="#A6EBC4" b={LEMON} ox={900} oy={300}>
      <Title lines={S.cmp} at={4} y={90} size={140} block={INK} step={10} />
      <Script text={S.cmpS} at={26} y={410} size={74} color={INK} rot={-2} />
      <Phone src={cap('cmp')} at={8} x={RTL ? 600 : 480} y={560} w={600} tilt={RTL ? 3 : -3} />
      {S.shops.map(([n, p], i) => (
        <Pill key={n} text={`${n} · ${p} ₪`} at={60 + i * 15} x={RTL ? 300 : 780} y={1010 + i * 150} bg="#fff" ink={INK} size={40} rot={i ? 3 : -3} />
      ))}
      <Pill text={`✓ ${S.cheap}`} at={90} x={RTL ? 300 : 780} y={1320} bg="#16A34A" ink="#fff" size={44} rot={-5} />
      {f >= 105 ? <div style={{ position: 'absolute', left: RTL ? 160 : 640, top: 1460, width: 300, height: 300, borderRadius: '50%', background: CORAL, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${price}) rotate(${-12 + (1 - price) * 40}deg)`, boxShadow: '0 20px 40px rgba(11,74,111,.3)',
        fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800, fontSize: 92, letterSpacing: '-0.04em', ...iso }}>{S.big}</div> : null}
    </Stage>
  );
};
// ===== 4. La vitrine (375–600) : Rendez-Vous à son identité, puis « composez votre plat » (vraies captures, vrais touchers) =====
// Captures : rdv (haut de page de l'enseigne), vt1 (Cheese Burger et ses ingrédients), vt2 (sans salade), vt3 (sans cornichons),
// vt4 (la salade revient), vt5a (bouton Ajouter), vt5 (ajouté au panier). Touchers aux vraies positions (en points CSS de l'écran 390 px).
const VT_SHOTS: [number, string][] = [[0, 'rdv'], [42, 'vt1'], [80, 'vt2'], [118, 'vt3'], [156, 'vt4'], [186, 'vt5a'], [204, 'vt5']];
const VT_TAPS: Record<Lang, [number, number, number][]> = {
  fr: [[74, 338, 368], [112, 52, 530], [150, 338, 368], [198, 195, 530]],
  he: [[74, 52, 368], [112, 338, 530], [150, 52, 368], [198, 195, 530]],
};
const Vitrine: React.FC = () => {
  const f = useCurrentFrame();
  const W = 780, X = 540, Y = 470, sw = W - 36, k0 = sp(f, 6, 14, 140, 0.9), zoom = sw / 390;
  return (
    <Stage bg={CORAL} a="#FF8496" b={LEMON} ox={180} oy={1500}>
      <AbsoluteFill style={{ opacity: lerp(f, [34, 40], [1, 0]) }}>
        <Title lines={S.resto} at={4} y={70} size={130} color="#fff" block={LEMON} blockInk={INK} step={8} />
        <Script text={S.restoS} at={20} y={370} size={74} color={LEMON} rot={-3} />
      </AbsoluteFill>
      {f >= 40 ? <>
        <Title lines={S.comp} at={40} y={70} size={130} color="#fff" block={INK} step={8} />
        <Script text={S.compS} at={58} y={370} size={80} color={LEMON} rot={-3} />
      </> : null}
      <div style={{ position: 'absolute', left: X - W / 2, top: Y, width: W, borderRadius: 100, background: '#0B1220', padding: 18, boxSizing: 'border-box',
        transform: `translateY(${(1 - k0) * 900}px) rotate(${(1 - k0) * 4}deg)`, boxShadow: '0 50px 90px rgba(8,18,38,.45), inset 0 0 0 3px #2A3550' }}>
        <div style={{ position: 'relative', width: sw, height: sw * 2532 / 1173, borderRadius: 84, overflow: 'hidden', background: '#fff' }}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: `${195 * zoom}px ${450 * zoom}px`,
            transform: `scale(${f < 186 ? 1 : 1})` }}>
          {VT_SHOTS.map(([at, n], i) => {
            const next = VT_SHOTS[i + 1];
            const o = (f >= at ? lerp(f, [at, at + 5], [i === 0 ? 1 : 0, 1]) : 0) * (next && f >= next[0] + 5 ? 0 : 1);
            return o > 0 ? <Img key={n} src={cap(n)} style={{ position: 'absolute', left: 0, top: 0, width: sw, opacity: o }} /> : null;
          })}
          {VT_TAPS[L].map(([at, x, y], i) => {
            if (f < at - 6 || f > at + 16) return null;
            const t = lerp(f, [at, at + 16], [0, 1]), pre = lerp(f, [at - 6, at], [0, 1]);
            return <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: x * zoom - 60, top: y * zoom - 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.55)',
                transform: `scale(${f < at ? 0.6 + 0.2 * pre : 0.8 - 0.25 * Math.min(1, t * 3)})`, opacity: f < at ? pre : 1 - t, boxShadow: '0 0 0 6px rgba(11,74,111,.35)' }} />
              <div style={{ position: 'absolute', left: x * zoom - 90, top: y * zoom - 90, width: 180, height: 180, borderRadius: '50%', border: '6px solid #fff',
                transform: `scale(${0.5 + t * 1.2})`, opacity: f < at ? 0 : 1 - t }} />
            </React.Fragment>;
          })}
          </div>
          <div style={{ position: 'absolute', top: 18, left: '50%', width: 210, height: 56, marginLeft: -105, borderRadius: 30, background: '#0B1220' }} />
        </div>
      </div>
    </Stage>
  );
};
// ===== 5. Dites-le à Hoppy (600–720) : la commande à la voix =====
const Voice: React.FC = () => {
  const f = useCurrentFrame();
  const ring = (d: number) => { const t = ((f - 30 - d) % 30) / 30; return f < 30 + d ? 0 : t; };
  const sayK = sp(f, 60, 10, 220, 0.6);
  return (
    <Stage bg={BLUE} a="#3FB0FF" b={LEMON} ox={540} oy={1700}>
      <Title lines={S.voice} at={4} y={90} size={150} color="#fff" block={LEMON} blockInk={INK} step={10} />
      <Phone src={cap('voice')} at={8} y={560} w={600} tilt={-3} />
      {[0, 10, 20].map(d => (
        <div key={d} style={{ position: 'absolute', left: 540 - 170, top: 1600 - 170, width: 340, height: 340, borderRadius: '50%', border: '6px solid #fff',
          transform: `scale(${0.5 + ring(d) * 1.1})`, opacity: (1 - ring(d)) * (f >= 30 ? 0.8 : 0) }} />
      ))}
      {f >= 30 ? <div style={{ position: 'absolute', left: 540 - 95, top: 1600 - 95, width: 190, height: 190, borderRadius: '50%', background: '#fff', transform: `scale(${sp(f, 30, 9, 260, 0.6)})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 18px 40px rgba(11,74,111,.35)' }}>
        <svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
        <div style={{ position: 'absolute', top: 18, right: 22, width: 26, height: 26, borderRadius: '50%', background: OR }} />
      </div> : null}
      {f >= 60 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, display: 'flex', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${sayK})`, background: '#fff', color: INK, borderRadius: 50, padding: '26px 48px', fontFamily: RTL ? 'Heebo, sans-serif' : 'Caveat, cursive',
          fontWeight: 700, fontSize: RTL ? 64 : 84, direction: RTL ? 'rtl' : 'ltr', boxShadow: '0 18px 40px rgba(11,74,111,.3)' }}>{S.say}</div>
      </div> : null}
    </Stage>
  );
};
// ===== 6. On y va pour vous (720–810) =====
const Go: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Stage bg={LEMON} a="#FFEE80" b={MINT} ox={540} oy={300}>
      <Punch at={[30, 60]}>
        <Title lines={S.go} at={4} y={440} size={RTL ? 150 : 170} block={INK} step={10} />
        <Pill text={S.price} at={30} x={540} y={1060} bg={CORAL} ink="#fff" size={78} rot={-4} />
        <Script text={S.fast} at={60} y={1210} size={130} color={INK} rot={-4} />
      </Punch>
      {/* rayures de vitesse */}
      {[0, 1, 2, 3, 4].map(i => {
        const x = ((f * 38 + i * 260) % 1500) - 300;
        return <div key={i} style={{ position: 'absolute', top: 1500 + i * 70, left: RTL ? undefined : x, right: RTL ? x : undefined, width: 260 - i * 30, height: 18, borderRadius: 9, background: INK, opacity: 0.18 }} />;
      })}
    </Stage>
  );
};
// ===== 7. Fin (810–900) =====
const End: React.FC = () => {
  const f = useCurrentFrame();
  const letter = (i: number) => { const k = sp(f, 4 + i * 3, 10, 240, 0.6); return { y: (1 - k) * -260, s: 0.6 + 0.4 * k, o: Math.min(1, k * 2) }; };
  return (
    <Stage bg={NAVY} a="#1B3364" b={OR} ox={540} oy={960}>
      <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 50% 30%, rgba(30,155,240,.25) 0%, rgba(15,31,61,0) 60%)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center' }}><Wordmark width={760} anim={letter} /></div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', fontFamily: TITLE(), fontWeight: RTL ? 900 : 800, fontSize: RTL ? 72 : 66, color: '#fff',
        letterSpacing: RTL ? 0 : '-0.03em', direction: RTL ? 'rtl' : 'ltr', opacity: lerp(f, [22, 32], [0, 1]), transform: `translateY(${lerp(f, [22, 34], [30, 0], outExpo)}px)` }}>{S.end}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 770, display: 'flex', justifyContent: 'center', opacity: lerp(f, [30, 38], [0, 1]) }}>
        <div style={{ padding: '18px 46px', borderRadius: 60, background: LEMON, color: INK, fontFamily: '"Bricolage Grotesque", Heebo, sans-serif', fontWeight: 800, fontSize: 52, letterSpacing: '-0.02em', ...iso }}>hop-livraison.vercel.app</div>
      </div>
      <Sequence from={12} layout="none"><HoppyHop x={540} bottom={1880} h={760} at={0.2} from={RTL ? 'right' : 'left'} /></Sequence>
    </Stage>
  );
};

// Montage : 120 BPM, coupes sur les temps
export const CUTS_REVO5 = [105, 225, 375, 600, 720, 810];
export const Revolution5: React.FC<{ lang?: Lang; music?: boolean }> = ({ lang = 'fr', music = true }) => {
  L = lang; S = STR[lang]; RTL = lang === 'he';
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      <Sequence durationInFrames={105}><Hook /></Sequence>
      <Sequence from={105} durationInFrames={120}><Tout /></Sequence>
      <Sequence from={225} durationInFrames={150}><Compare /></Sequence>
      <Sequence from={375} durationInFrames={225}><Vitrine /></Sequence>
      <Sequence from={600} durationInFrames={120}><Voice /></Sequence>
      <Sequence from={720} durationInFrames={90}><Go /></Sequence>
      <Sequence from={810} durationInFrames={105}><End /></Sequence>
      <Flash at={CUTS_REVO5} />
      {music ? <Audio src={staticFile('revo5-music.wav')} /> : null}
    </AbsoluteFill>
  );
};
