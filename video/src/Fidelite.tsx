import React from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import '@fontsource/rubik/900.css';

// « Carte fidélité dans le Wallet » v2 (patron, 26/11) : vidéo explicative de l'offre aux commerces, SANS marque, FR + HE.
// Style demandé (vidéo de référence du patron) : illustration à plat, gros contours noirs + ombre décalée, aplats vifs
// orange / lilas / vert / pêche, titres en majuscules blancs cernés de noir avec un mot surligné dans une étiquette,
// téléphones dessinés, notifications sur l'écran verrouillé, pastilles qui défilent. Tutoiement (on parle au commerçant).
// 48,5 s, 1080 × 1920, 30 i/s. Musique : python3 scripts/fidelite_music.py
export const FID_FRAMES = 1455;
type Lang = 'fr' | 'he';
const K = { ink: '#141414', orange: '#F7841B', lilac: '#E79BF9', green: '#8BE36A', peach: '#FFE1CC', white: '#FFFFFF', sun: '#FFD43B', red: '#E5484D', sky: '#9FD8FF', screen: '#FFE9DA' };
const STR = {
  fr: {
    s1: [['TA', 'CARTE'], ['EN', 'CARTON', '?']], lost: ['PERDUE', 'OUBLIÉE', 'JETÉE'], cafe: 'Café Lumière', rule: '10 cafés = 1 offert',
    s2: [['ET', 'SI', 'ELLE'], ['ÉTAIT', 'DANS', 'LE'], ['WALLET', '?']],
    s3: [['TON', 'CLIENT'], ['SCANNE', '.']], scan: 'SCANNE-MOI', scanS: 'ta carte fidélité', scanF: 'sans appli · 20 secondes', pizza: 'PIZZA ROMA',
    s4: [['SANS', 'AUCUNE'], ['APPLI', '.']], noApp: '0 APPLI',
    s5: [['TOUT', 'EST'], ['CONFIGURABLE', '.']], pills: ['TAMPONS', 'COULEURS', 'LOGO', 'CADEAU'],
    shops: [['Pizza Roma', 'PIZZA'], ['Le Petit Café', 'CAFÉ'], ['Sushi Zen', 'SUSHI'], ['Fleurs & Co', 'FLEURS']],
    s6: [['UN', 'TAMPON'], ['À', 'CHAQUE', 'PASSAGE']], member: 'Membre', stamps: 'Tampons',
    notifStamp: 'Nouveau tampon ! Plus que 2 avant ton café offert ☕',
    lock: [[['APRÈS', 'LE', 'REPAS', '?']], [['SON', 'ANNIVERSAIRE', '?']], [['IL', 'NE', 'REVIENT'], ['PLUS', '?']], [['IL', 'PASSE'], ['DEVANT', '?']]],
    lockHi: ['REPAS', 'ANNIVERSAIRE', 'REVIENT', 'DEVANT'], lockTag: ['APRÈS LE REPAS', 'ANNIVERSAIRE', 'RELANCE AUTO', 'À 100 MÈTRES'],
    notifs: ['Merci pour ta visite ! Tu nous laisses un avis ? ⭐', 'Joyeux anniversaire Julie ! Le dessert est pour nous 🎂', 'Ça fait un moment… Ton café t’attend, offert ☕', 'Tu es tout près ! Ton tampon t’attend 👋'],
    date: 'jeudi 6 novembre', now: 'maintenant',
    s8: [['UNE', 'PROMO', '?'], ['TOUT', 'LE', 'MONDE'], ['EST', 'PRÉVENU', '.']], msgH: 'NOUVEAU MESSAGE · TOUS LES CLIENTS', msg: 'Ce week-end : tampons doublés !', sendAll: 'ENVOYER À TOUS',
    s9: [['TES', 'HABITUÉS', '.']], dashH: 'TABLEAU DE BORD', dashT: 'MES HABITUÉS', people: [['Julie M.', '12 visites', 'hier'], ['Mehdi H.', '9 visites', 'avant-hier'], ['Sophie L.', '7 visites', 'il y a 3 jours'], ['Lucas B.', '6 visites', 'il y a 5 jours'], ['Inès M.', '5 visites', 'la semaine dernière']], last: 'Dernière visite',
    s10: [['TOUTES', 'LES'], ['FONCTIONNALITÉS', '.']],
    feats: ['APPLE & GOOGLE WALLET', 'NOTIFICATIONS', 'PARRAINAGE', 'AVIS GOOGLE', 'ANNIVERSAIRES', 'RELANCE AUTO', 'À 100 MÈTRES', 'STATISTIQUES', 'SCAN AU COMPTOIR', 'MESSAGE À TOUS', 'FR + עברית', 'TON LOGO'],
    s11: [['TA', 'CARTE'], ['DE', 'FIDÉLITÉ', '.']], end1: 'Simple. Jolie. Dans le téléphone de tes clients.', cta: 'CRÉE LA TIENNE',
  },
  he: {
    s1: [['הכרטיס', 'שלך'], ['עדיין', 'מקרטון', '?']], lost: ['הולך לאיבוד', 'נשכח', 'נזרק'], cafe: 'קפה אור', rule: '10 קפה = 1 מתנה',
    s2: [['ומה', 'אם'], ['הוא', 'היה'], ['בארנק', '?']],
    s3: [['הלקוח', 'שלך'], ['סורק', '.']], scan: 'סרקו אותי', scanS: 'כרטיס המועדון שלך', scanF: 'בלי אפליקציה · 20 שניות', pizza: 'פיצה רומא',
    s4: [['בלי', 'שום'], ['אפליקציה', '.']], noApp: '0 אפליקציות',
    s5: [['הכול', 'ניתן'], ['להתאמה', '.']], pills: ['חותמות', 'צבעים', 'לוגו', 'מתנה'],
    shops: [['פיצה רומא', 'פיצה'], ['הקפה הקטן', 'קפה'], ['סושי זן', 'סושי'], ['פרחים ושות׳', 'פרחים']],
    s6: [['חותמת', 'בכל'], ['ביקור', '.']], member: 'חבר/ה', stamps: 'חותמות',
    notifStamp: 'חותמת חדשה! עוד 2 עד הקפה במתנה ☕',
    lock: [[['אחרי', 'הארוחה', '?']], [['יום', 'ההולדת', 'שלו', '?']], [['הוא', 'לא'], ['חוזר', '?']], [['הוא', 'עובר'], ['ליד', '?']]],
    lockHi: ['הארוחה', 'ההולדת', 'חוזר', 'ליד'], lockTag: ['אחרי הארוחה', 'יום הולדת', 'תזכורת אוטומטית', 'ב-100 מטר'],
    notifs: ['תודה על הביקור! תשאיר לנו ביקורת? ⭐', 'יום הולדת שמח נועה! הקינוח עלינו 🎂', 'מזמן לא ראינו אותך… הקפה מחכה, במתנה ☕', 'אתה ממש קרוב! החותמת מחכה לך 👋'],
    date: 'יום חמישי, 6 בנובמבר', now: 'עכשיו',
    s8: [['יש', 'מבצע', '?'], ['כולם'], ['יודעים', '.']], msgH: 'הודעה חדשה · לכל הלקוחות', msg: 'בסוף השבוע: חותמות כפולות!', sendAll: 'שליחה לכולם',
    s9: [['הלקוחות', 'הקבועים', '.']], dashH: 'לוח בקרה', dashT: 'הלקוחות הקבועים', people: [['נועה כ.', '12 ביקורים', 'אתמול'], ['מאיר ח.', '9 ביקורים', 'שלשום'], ['שירה ל.', '7 ביקורים', 'לפני 3 ימים'], ['איתי ב.', '6 ביקורים', 'לפני 5 ימים'], ['מיכל מ.', '5 ביקורים', 'בשבוע שעבר']], last: 'ביקור אחרון',
    s10: [['כל', 'האפשרויות', '.']],
    feats: ['APPLE & GOOGLE WALLET', 'התראות', 'חבר מביא חבר', 'ביקורות בגוגל', 'ימי הולדת', 'תזכורת אוטומטית', 'ב-100 מטר', 'סטטיסטיקות', 'סריקה בקופה', 'הודעה לכולם', 'עברית + FR', 'הלוגו שלך'],
    s11: [['כרטיס', 'המועדון'], ['שלך', '.']], end1: 'פשוט. יפה. בטלפון של הלקוחות.', cta: 'צור את שלך',
  },
};
let S: (typeof STR)['fr'] = STR.fr, RTL = false;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (f: number, a: number[], b: number[], e = Easing.inOut(Easing.cubic)) => interpolate(f, a, b, { ...clamp, easing: e });
const sp = (f: number, d: number, damping = 12, stiffness = 230, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const FONT = 'Rubik, sans-serif';
const dir = () => (RTL ? 'rtl' : 'ltr') as const;
const iso: React.CSSProperties = { unicodeBidi: 'isolate', direction: 'ltr', display: 'inline-block' };
const box = (bg: string, r = 24, sh = 10): React.CSSProperties => ({ background: bg, border: `6px solid ${K.ink}`, borderRadius: r, boxShadow: `${RTL ? -sh : sh}px ${sh}px 0 ${K.ink}` });

// ---------- Titre « autocollant » : mots blancs cernés de noir, un mot dans une étiquette colorée ----------
const Title: React.FC<{ rows: string[][]; at?: number; y?: number; hi?: string; hiBg?: string; size?: number; out?: number }> = ({ rows, at = 2, y = 190, hi, hiBg = K.orange, size = 112, out }) => {
  const f = useCurrentFrame();
  const ex = out != null ? lerp(f, [out, out + 7], [0, 1], Easing.in(Easing.quad)) : 0;
  let idx = 0;
  return (
    <div style={{ position: 'absolute', left: 30, right: 30, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transform: `translateY(${-ex * 140}px)`, opacity: 1 - ex, zIndex: 10 }}>
      {rows.map((row, ri) => {
        const len = row.join(' ').length, sz = Math.min(size, 1000 / Math.max(1, len * (RTL ? 0.62 : 0.66)));
        return (
          <div key={ri} style={{ display: 'flex', gap: sz * 0.2, alignItems: 'center', direction: dir(), flexWrap: 'nowrap' }}>
            {row.map((w, wi) => {
              const k = sp(f, at + (idx++) * 3, 11, 320, 0.5), isHi = w === hi, punct = /^[?.!]$/.test(w);
              return (
                <span key={wi} style={{ display: 'inline-block', fontFamily: FONT, fontWeight: 900, fontSize: sz, lineHeight: 1.05, letterSpacing: RTL ? 0 : '-0.02em',
                  color: isHi ? K.ink : K.white, WebkitTextStroke: isHi ? 'none' : `${sz * 0.055}px ${K.ink}`, paintOrder: 'stroke fill',
                  textShadow: isHi ? 'none' : `${RTL ? -sz * 0.06 : sz * 0.06}px ${sz * 0.06}px 0 ${K.ink}`,
                  transform: `scale(${0.3 + 0.7 * k}) rotate(${(1 - k) * -12 + (isHi ? -2 : 0)}deg)`, opacity: Math.min(1, k * 3),
                  marginInlineStart: punct ? -sz * 0.18 : 0,
                  ...(isHi ? { background: hiBg, border: `${sz * 0.06}px solid ${K.ink}`, borderRadius: sz * 0.16, padding: `0 ${sz * 0.14}em`.replace('em', 'px'), boxShadow: `${RTL ? -sz * 0.07 : sz * 0.07}px ${sz * 0.07}px 0 ${K.ink}` } : {}) }}>{w}</span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
const Pill: React.FC<{ text: string; bg: string; at: number; x: number; y: number; rot?: number; size?: number; icon?: React.ReactNode }> = ({ text, bg, at, x, y, rot = -4, size = 40, icon }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 10, 300, 0.5);
  return <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${k}) rotate(${rot + Math.sin((f + at) / 14) * 1.5}deg)`, ...box(bg, 999, 7), padding: `${size * 0.32}px ${size * 0.7}px`,
    fontFamily: FONT, fontWeight: 900, fontSize: size, color: K.ink, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 12, direction: dir() }}>{icon}{text}</div>;
};
const Bg: React.FC<{ c: string; children: React.ReactNode }> = ({ c, children }) => {
  const f = useCurrentFrame();
  const r = lerp(f, [0, 10], [0, 2300], Easing.out(Easing.exp));
  return <AbsoluteFill style={{ background: c, clipPath: `circle(${r}px at 540px 1100px)`, overflow: 'hidden' }}>{children}</AbsoluteFill>;
};
// Téléphone dessiné (contour noir épais + ombre décalée)
const Phone: React.FC<{ x: number; y: number; w?: number; screen?: string; children?: React.ReactNode; rot?: number; scale?: number }> = ({ x, y, w = 520, screen = '#F2F2F2', children, rot = 0, scale = 1 }) => (
  <div style={{ position: 'absolute', left: x - w / 2, top: y, width: w, height: w * 1.95, transform: `rotate(${rot}deg) scale(${scale})`, transformOrigin: '50% 30%',
    background: K.ink, borderRadius: w * 0.16, padding: w * 0.035, boxShadow: `${RTL ? -16 : 16}px 16px 0 #2B1F3A` }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', background: screen, borderRadius: w * 0.13, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: w * 0.03, left: '50%', width: w * 0.3, height: w * 0.08, marginLeft: -w * 0.15, background: K.ink, borderRadius: 99, zIndex: 9 }} />
      {children}
    </div>
  </div>
);
const Qr: React.FC<{ size: number }> = ({ size }) => {
  const n = 21, c = size / n, cells: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fin = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    let on: boolean;
    if (fin) { const lx = x > 13 ? x - 14 : x, ly = y > 13 ? y - 14 : y; on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx > 1 && lx < 5 && ly > 1 && ly < 5); }
    else on = ((x * 7 + y * 13 + x * y) % 5) < 2;
    if (on) cells.push(<rect key={x + '-' + y} x={x * c} y={y * c} width={c + 0.5} height={c + 0.5} fill={K.ink} />);
  }
  return <svg width={size} height={size}>{cells}</svg>;
};
const ICO: Record<string, string> = {
  cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 11h1.5a2.5 2.5 0 0 1 0 5H16 M8.5 3.5c-1 1 1 2 0 3 M12.5 3.5c-1 1 1 2 0 3',
  pizza: 'M12 21 3.5 6.5a14 14 0 0 1 17 0z M5.6 10a11 11 0 0 1 12.8 0 M10 12.5h.01 M14 13.5h.01 M12 16.5h.01',
  sushi: 'M4 9a8 3 0 0 0 16 0a8 3 0 0 0-16 0v6a8 3 0 0 0 16 0V9 M9 9a3 1 0 0 0 6 0',
  flower: 'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M12 3.5a3 3 0 1 0 0 6 M12 14.5a3 3 0 1 0 0 6 M3.5 12a3 3 0 1 0 6 0 M14.5 12a3 3 0 1 0 6 0',
  gift: 'M4.5 10.5h15V20h-15z M3.5 7.5h17v3h-17z M12 7.5V20 M12 7.5C10 3.5 6 4.5 8 7.5 M12 7.5c2-4 6-3 4 0',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0', pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z', chart: 'M5 20V12 M10 20V6 M15 20v-9 M20 20V9',
  scan: 'M4 8V5h3 M17 5h3v3 M20 16v3h-3 M7 19H4v-3 M4 12h16', wallet: 'M4 7h16v12H4z M4 7l12-3v3 M16 13h2', cake: 'M4 20h16v-7H4z M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0 M12 9v4',
  back: 'M4 12a8 8 0 1 0 2.5-5.8 M4 4v4h4', send: 'M3 11l18-8-8 18-2-8z',
};
const Ic: React.FC<{ d: string; s?: number; c?: string; w?: number }> = ({ d, s = 40, c = K.ink, w = 2.4 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d={ICO[d]} /></svg>;

// La carte Wallet (aplat, tampons en pastilles)
const WCard: React.FC<{ name: string; color: string; icon: string; stamps: number; w?: number; pop?: number; member?: string }> = ({ name, color, icon, stamps, w = 460, pop = -1, member }) => {
  member = member || (RTL ? 'נועה כ.' : 'Julie M.');
  const f = useCurrentFrame(), u = w / 460;
  return (
    <div style={{ width: w, background: color, borderRadius: 26 * u, border: `${5 * u}px solid ${K.ink}`, overflow: 'hidden', direction: dir() }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u, padding: `${16 * u}px ${18 * u}px` }}>
        <div style={{ width: 54 * u, height: 54 * u, borderRadius: 16 * u, background: K.white, border: `${3 * u}px solid ${K.ink}`, display: 'grid', placeItems: 'center' }}><Ic d={icon} s={32 * u} /></div>
        <div style={{ flex: 1, fontFamily: FONT, fontWeight: 900, fontSize: 30 * u, color: K.white, WebkitTextStroke: `${1.5 * u}px ${K.ink}`, paintOrder: 'stroke fill' }}>{name}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 * u, padding: `${6 * u}px ${20 * u}px ${16 * u}px`, direction: dir() }}>
        {Array.from({ length: 10 }, (_, i) => {
          const on = i < stamps, k = i === pop ? sp(f, 0, 8, 320, 0.45) : 1;
          return <div key={i} style={{ aspectRatio: '1', borderRadius: 14 * u, border: `${3 * u}px solid ${K.ink}`, background: on ? K.white : 'rgba(255,255,255,.28)', display: 'grid', placeItems: 'center',
            transform: `scale(${i === pop ? 0.3 + 0.7 * k : 1}) rotate(${on ? ((i * 37) % 11) - 5 : 0}deg)` }}>{i === 9 ? <Ic d="gift" s={30 * u} /> : <Ic d={icon} s={30 * u} c={on ? K.ink : 'rgba(20,20,20,.35)'} />}</div>;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: `0 ${20 * u}px ${16 * u}px`, fontFamily: FONT, color: K.white }}>
        <div><div style={{ fontSize: 15 * u, fontWeight: 700, opacity: 0.85 }}>{S.member}</div><div style={{ fontSize: 26 * u, fontWeight: 800 }}>{member}</div></div>
        <div style={{ textAlign: RTL ? 'left' : 'right' }}><div style={{ fontSize: 15 * u, fontWeight: 700, opacity: 0.85 }}>{S.stamps}</div><div style={{ fontSize: 26 * u, fontWeight: 800 }}><span style={iso}>{stamps}/10</span></div></div>
      </div>
    </div>
  );
};
const Notif: React.FC<{ at: number; text: string; name: string; y: number; w?: number; color?: string }> = ({ at, text, name, y, w = 600, color = K.orange }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 13, 220, 0.7);
  return (
    <div style={{ position: 'absolute', left: '50%', top: y, width: w, marginLeft: -w / 2, transform: `translateY(${(1 - k) * -80}px) scale(${0.85 + 0.15 * k})`, opacity: Math.min(1, k * 2),
      background: K.white, borderRadius: 30, padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 8px 0 rgba(20,20,20,.12)', direction: dir() }}>
      <div style={{ width: 70, height: 70, borderRadius: 18, background: color, border: `3px solid ${K.ink}`, flex: 'none', display: 'grid', placeItems: 'center' }}><Ic d="cup" s={40} c={K.white} /></div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT }}><b style={{ fontSize: 26, fontWeight: 900, color: K.ink }}>{name}</b><span style={{ fontSize: 22, color: '#666' }}>{S.now}</span></div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 28, color: K.ink, lineHeight: 1.25 }}>{text}</div>
      </div>
    </div>
  );
};
const Star: React.FC<{ x: number; y: number; c: string; s?: number; at?: number }> = ({ x, y, c, s = 90, at = 0 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = sp(f, at, 9, 260, 0.5);
  return <svg style={{ position: 'absolute', left: x, top: y, transform: `scale(${k}) rotate(${f * 0.8}deg)` }} width={s} height={s} viewBox="0 0 24 24"><path d={ICO.star} fill={c} stroke={K.ink} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
};

// ================= SCÈNES =================
const S1: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 6, 13, 150, 0.8), fall = lerp(f, [96, 120], [0, 1], Easing.in(Easing.quad));
  return (
    <Bg c={K.peach}>
      <Title rows={S.s1} hi={RTL ? 'מקרטון' : 'CARTON'} out={110} />
      <div style={{ position: 'absolute', left: 150, top: 760, width: 780, transform: `translateY(${(1 - k) * 700 + fall * 1400}px) rotate(${-7 + Math.sin(f / 14) * 2 + fall * 60}deg)` }}>
        <div style={{ ...box('#E9C99A', 28, 12), padding: 40, direction: dir() }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: '#6B3A1E', textAlign: 'center' }}>{S.cafe}</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 34, color: '#6B3A1E', textAlign: 'center', marginBottom: 24 }}>{S.rule}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 18 }}>
            {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: '50%', border: `5px dashed #6B3A1E`, display: 'grid', placeItems: 'center' }}>{i < 3 ? <Ic d="star" s={56} c={K.red} w={3} /> : null}</div>)}
          </div>
        </div>
      </div>
      {S.lost.map((w, i) => {
        const d = 40 + i * 16;
        if (f < d) return null;
        const q = sp(f, d, 8, 340, 0.5);
        return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 860 + i * 190, textAlign: 'center', zIndex: 5, opacity: 1 - lerp(f, [104, 112], [0, 1]) }}>
          <span style={{ display: 'inline-block', transform: `scale(${2.2 - 1.2 * q}) rotate(${-9 + i * 8}deg)`, opacity: Math.min(1, q * 3), ...box(K.white, 18, 8), fontFamily: FONT, fontWeight: 900,
            fontSize: Math.min(110, 900 / (w.length * 0.7)), color: K.red, padding: '0 34px', direction: dir() }}>{w}</span></div>;
      })}
    </Bg>
  );
};
const S2: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 18, 14, 140, 0.85), cardK = sp(f, 52, 13, 150, 0.8);
  return (
    <Bg c={K.lilac}>
      <Title rows={S.s2} hi={RTL ? 'בארנק' : 'WALLET'} y={150} out={112} />
      <Phone x={540} y={720 + (1 - k) * 1000} w={520}>
        <div style={{ position: 'absolute', top: 80, left: 30, right: 30, fontFamily: FONT, fontWeight: 900, fontSize: 48, color: K.ink }}><span style={iso}>Wallet</span></div>
        {[['#222', 'Ma Banque', 160], ['#3B5BFF', 'nova', 230], ['#1F7A5A', 'Banque du Port', 300]].map(([c, n, t], i) => (
          <div key={i} style={{ position: 'absolute', left: 26, right: 26, top: Number(t), height: 200, borderRadius: 22, background: String(c), border: `4px solid ${K.ink}`, padding: '16px 20px', fontFamily: FONT, fontWeight: 800, fontSize: 26, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
            <span style={iso}>{n}</span><span style={iso}>•••• 48{21 + i}</span></div>
        ))}
        <div style={{ position: 'absolute', left: 26, top: 370 + (1 - cardK) * -700, transform: `rotate(${(1 - cardK) * 8}deg)` }}>
          <WCard name={S.shops[0][0]} color="#C8382E" icon="pizza" stamps={2} w={432} /></div>
      </Phone>
      <Star x={90} y={900} c={K.sun} at={70} /><Star x={880} y={1200} c={K.green} at={78} s={70} />
    </Bg>
  );
};
const S3: React.FC = () => {
  const f = useCurrentFrame();
  const sk = sp(f, 4, 13, 160, 0.8), pk = sp(f, 14, 14, 140, 0.85), line = lerp(f, [44, 70], [0, 1]), ok = f > 74;
  return (
    <Bg c={K.orange}>
      <Title rows={S.s3} hi={RTL ? 'סורק' : 'SCANNE'} hiBg={K.green} y={170} out={112} />
      <div style={{ position: 'absolute', left: -20, right: 0, top: 1480, height: 34, background: K.white, borderTop: `6px solid ${K.ink}`, borderBottom: `6px solid ${K.ink}` }} />
      <div style={{ position: 'absolute', [RTL ? 'right' : 'left']: 50, top: 860 + (1 - sk) * 900, width: 360, ...box(K.white, 26, 10), overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ background: K.orange, borderBottom: `6px solid ${K.ink}`, fontFamily: FONT, fontWeight: 900, fontSize: 46, padding: '14px 0', color: K.ink }}>{S.scan}</div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, marginTop: 14 }}>{S.scanS}</div>
        <div style={{ margin: '12px auto', width: 230, lineHeight: 0, border: `6px solid ${K.green}`, borderRadius: 12, padding: 8 }}><Qr size={202} /></div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 32 }}>{S.pizza}</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, color: '#555', marginBottom: 16 }}>{S.scanF}</div>
      </div>
      <Phone x={RTL ? 320 : 760} y={700 + (1 - pk) * 1000} w={440} screen={ok ? '#F2F2F2' : '#2A2A2A'}>
        {!ok ? <div style={{ position: 'absolute', left: '50%', top: 300, width: 260, height: 260, marginLeft: -130, background: K.white, borderRadius: 18, lineHeight: 0, padding: 16 }}>
          <Qr size={228} /><div style={{ position: 'absolute', left: 4, right: 4, top: 16 + line * 220, height: 7, background: K.green, boxShadow: `0 0 20px ${K.green}` }} />
          {[[-14, -14], [-14, 1], [1, -14], [1, 1]].map(([a, b], i) => <div key={i} style={{ position: 'absolute', width: 54, height: 54, [a < 0 ? 'left' : 'right']: -14, [b < 0 ? 'top' : 'bottom']: -14,
            borderColor: K.orange, borderStyle: 'solid', borderWidth: `${b < 0 ? 7 : 0}px ${a > 0 ? 7 : 0}px ${b > 0 ? 7 : 0}px ${a < 0 ? 7 : 0}px`, borderRadius: 8 }} />)}
        </div> : <div style={{ position: 'absolute', left: 18, top: 160, transform: `scale(${0.6 + 0.4 * sp(f, 74, 11, 220, 0.6)})`, transformOrigin: '50% 20%' }}><WCard name={S.shops[0][0]} color="#C8382E" icon="pizza" stamps={1} w={364} pop={0} /></div>}
      </Phone>
    </Bg>
  );
};
const S4: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 8, 14, 150, 0.85), ik = sp(f, 24, 10, 260, 0.5);
  return (
    <Bg c={K.orange}>
      <Title rows={S.s4} hi={RTL ? 'שום' : 'AUCUNE'} hiBg={K.green} y={170} out={82} />
      <div style={{ position: 'absolute', [RTL ? 'right' : 'left']: 80, top: 1040, transform: `scale(${ik}) rotate(${-8 + Math.sin(f / 10) * 3}deg)`, textAlign: 'center' }}>
        <div style={{ width: 230, height: 230, borderRadius: '50%', ...box(K.white, 999, 9), display: 'grid', placeItems: 'center', position: 'relative' }}>
          <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke={K.ink} strokeWidth="2.6" strokeLinecap="round"><path d="M12 4v11 M7 10l5 5 5-5 M5 19h14" /></svg>
          <div style={{ position: 'absolute', width: 250, height: 22, background: K.orange, border: `5px solid ${K.ink}`, borderRadius: 99, transform: 'rotate(40deg)' }} />
        </div>
        <div style={{ marginTop: 24, display: 'inline-block', ...box('#C96A10', 999, 6), padding: '6px 26px', fontFamily: FONT, fontWeight: 900, fontSize: 36, color: '#FFE1CC', direction: dir() }}>{S.noApp}</div>
      </div>
      <Phone x={RTL ? 300 : 780} y={680 + (1 - k) * 1000} w={430}>
        <div style={{ position: 'absolute', top: 70, left: 26, fontFamily: FONT, fontWeight: 900, fontSize: 42 }}><span style={iso}>Wallet</span></div>
        <div style={{ position: 'absolute', left: 18, top: 150 }}><WCard name={S.shops[0][0]} color="#C8382E" icon="pizza" stamps={2} w={364} /></div>
      </Phone>
    </Bg>
  );
};
const S5: React.FC = () => {
  const f = useCurrentFrame();
  const cols = ['#C8382E', '#5B3A24', '#3A2A55', '#B05FA8'], icons = ['pizza', 'cup', 'sushi', 'flower'];
  return (
    <Bg c={K.peach}>
      <Title rows={S.s5} hi={RTL ? 'להתאמה' : 'CONFIGURABLE'} hiBg={K.green} y={170} out={112} />
      <div style={{ position: 'absolute', left: RTL ? 400 : 70, top: 600, width: 600 }}>
        {S.shops.map(([n], i) => {
          const k = sp(f, 10 + i * 12, 13, 200, 0.7), last = i === 3;
          return <div key={i} style={{ position: 'absolute', top: i * 120 + (1 - k) * 900, left: 0, transform: `rotate(${(1 - k) * 6}deg)`, zIndex: i }}>
            <div style={{ ...box(cols[i], 26, 10), width: 600, height: last ? 700 : 140, overflow: 'hidden' }}>
              {last ? <WCard name={String(n)} color={cols[i]} icon={icons[i]} stamps={4} w={588} /> :
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 24, direction: dir() }}><div style={{ width: 70, height: 70, borderRadius: 18, background: K.white, border: `4px solid ${K.ink}`, display: 'grid', placeItems: 'center' }}><Ic d={icons[i]} s={44} /></div>
                  <b style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: K.white, WebkitTextStroke: `2px ${K.ink}`, paintOrder: 'stroke fill' }}>{n}</b></div>}
            </div></div>;
        })}
      </div>
      {S.pills.map((p, i) => <Pill key={i} text={p} bg={[K.orange, K.green, K.lilac, K.white][i]} at={50 + i * 8} x={RTL ? 60 : 700} y={640 + i * 130} rot={[-4, 3, -3, 4][i]} size={36} />)}
    </Bg>
  );
};
const S6: React.FC = () => {
  const f = useCurrentFrame();
  const ev = [30, 64, 98], n = 5 + ev.filter(e => f >= e).length, last = [...ev].reverse().find(e => f >= e);
  return (
    <Bg c={K.green}>
      <Title rows={S.s6} hi={RTL ? 'חותמת' : 'TAMPON'} hiBg={K.white} y={170} out={142} />
      <div style={{ position: 'absolute', left: 90, top: 760, transform: `rotate(${-3 + Math.sin(f / 18) * 1.5}deg)`, ...box('transparent', 30, 14), borderRadius: 30 }}>
        <Sequence from={last ?? 0} layout="none"><WCard name={S.shops[1][0]} color="#5B3A24" icon="cup" stamps={n} w={888} pop={last != null ? n - 1 : -1} /></Sequence>
      </div>
      <Notif at={104} text={S.notifStamp} name={S.shops[1][0]} y={560} w={880} color="#5B3A24" />
      {ev.map((e, i) => f >= e && f < e + 8 ? <AbsoluteFill key={i} style={{ background: K.white, opacity: lerp(f, [e, e + 8], [0.35, 0]) }} /> : null)}
    </Bg>
  );
};
// Écran verrouillé : les notifications arrivent une à une (avis, anniversaire, relance, à 100 m)
const S7: React.FC = () => {
  const f = useCurrentFrame(), step = Math.min(3, Math.floor(f / 75));
  const pk = sp(f, 0, 14, 140, 0.85);
  return (
    <AbsoluteFill style={{ background: K.lilac, overflow: 'hidden' }}>
      {[0, 1, 2, 3].map(i => <Sequence key={i} from={i * 75} durationInFrames={75} layout="none"><Title rows={S.lock[i]} hi={S.lockHi[i]} hiBg={[K.orange, K.orange, K.green, K.sun][i]} y={150} size={104} /></Sequence>)}
      <Pill key={step} text={S.lockTag[step]} bg={[K.green, K.orange, K.white, K.sun][step]} at={step * 75 + 6} x={RTL ? 380 : 330} y={455} size={34} />
      <Phone x={540} y={580 + (1 - pk) * 900} w={560} screen={K.screen}>
        <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: K.ink, direction: dir() }}>{S.date}</div>
        <div style={{ position: 'absolute', top: 115, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 150, color: K.ink }}><span style={iso}>12:30</span></div>
        {[0, 1, 2, 3].map(i => {
          const at = i * 75 + 14;
          if (f < at) return null;
          const pos = (step - i) * 172;   // la plus récente en haut, les autres glissent dessous
          return <Notif key={i} at={at} text={S.notifs[i]} name={S.shops[[0, 0, 1, 1][i]][0]} y={330 + pos} w={500} color={['#C8382E', '#C8382E', '#5B3A24', '#5B3A24'][i]} />;
        })}
      </Phone>
      <Star x={50} y={760} c={K.orange} at={30} /><Star x={900} y={900} c={K.white} at={40} s={70} /><Star x={930} y={1050} c={K.green} at={50} s={60} />
      {f > 85 ? <div style={{ position: 'absolute', left: -40, top: 1250, transform: `scale(${sp(f, 85, 10, 240, 0.5)}) rotate(-8deg)` }}><div style={{ ...box(K.white, 16, 8), width: 200, height: 110, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 90, top: -80, width: 18, height: 70, background: K.white, border: `4px solid ${K.ink}` }} /><div style={{ position: 'absolute', left: 86, top: -112, width: 26, height: 36, borderRadius: '50% 50% 50% 50%', background: K.orange, border: `3px solid ${K.ink}` }} /></div></div> : null}
    </AbsoluteFill>
  );
};
const S8: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 8, 13, 170, 0.8), press = f > 44 && f < 52, lit = f > 52;
  return (
    <Bg c={K.peach}>
      <Title rows={S.s8} hi={RTL ? 'יודעים' : 'PRÉVENU'} y={130} size={100} out={112} />
      <div style={{ position: 'absolute', left: 70, right: 70, top: 560 + (1 - k) * 800, ...box(K.white, 26, 10), padding: 28, display: 'flex', gap: 24, alignItems: 'center', direction: dir() }}>
        <div style={{ width: 150, height: 150, borderRadius: 20, border: `5px solid ${K.ink}`, background: K.orange, display: 'grid', placeItems: 'center', flex: 'none' }}><Ic d="pizza" s={100} /></div>
        <div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, letterSpacing: RTL ? 0 : '.08em', color: '#777' }}>{S.msgH}</div>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: K.ink, lineHeight: 1.15 }}>{S.msg}</div></div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', ...box(K.orange, 999, press ? 2 : 8), transform: `translate(${press ? 6 : 0}px, ${press ? 6 : 0}px) scale(${sp(f, 24, 10, 260, 0.5)})`, padding: '22px 60px', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: K.ink }}>{S.sendAll}</span>
      </div>
      {Array.from({ length: 10 }, (_, i) => {
        const x = 40 + (i % 5) * 204, y = 1080 + Math.floor(i / 5) * 330, on = lit && f > 52 + i * 3, q = on ? sp(f, 52 + i * 3, 10, 260, 0.5) : 0;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 168, height: 300, borderRadius: 30, border: `6px solid ${K.ink}`, background: K.screen }}>
          {on ? <div style={{ position: 'absolute', left: 12, right: 12, top: 40, height: 64, borderRadius: 14, background: K.white, transform: `scale(${q})`, display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: K.orange, border: `3px solid ${K.ink}`, flex: 'none' }} /><div style={{ flex: 1 }}><div style={{ height: 9, borderRadius: 9, background: '#DDD', marginBottom: 7 }} /><div style={{ height: 9, width: '70%', borderRadius: 9, background: '#DDD' }} /></div></div> : null}
        </div>;
      })}
    </Bg>
  );
};
const S9: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 6, 14, 160, 0.85);
  return (
    <Bg c={K.green}>
      <Title rows={S.s9} hi={RTL ? 'הקבועים' : 'HABITUÉS'} hiBg={K.white} y={180} out={98} />
      <div style={{ position: 'absolute', left: 40, right: 40, top: 480 + (1 - k) * 900, ...box(K.white, 26, 12), padding: '40px 36px', transform: 'rotate(-2deg)', direction: dir() }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: RTL ? 0 : '.1em', color: '#666' }}>{S.dashH} · {S.pizza}</div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 76, color: K.ink, marginBottom: 20 }}>{S.dashT}</div>
        {S.people.map(([n, v, w], i) => {
          const q = sp(f, 24 + i * 7, 12, 220, 0.6);
          return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 0', borderTop: '3px solid #EEE', transform: `translateX(${(1 - q) * (RTL ? -300 : 300)}px)`, opacity: Math.min(1, q * 2) }}>
            <div style={{ width: 86, height: 86, borderRadius: '50%', background: [K.lilac, K.orange, K.green, K.sky, K.sun][i], border: `4px solid ${K.ink}`, display: 'grid', placeItems: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 32 }}>{n.split(' ').map(x => x[0]).join('')}</div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38 }}>{n}</div><div style={{ fontFamily: FONT, fontSize: 26, color: '#777' }}>{S.last} : {w}</div></div>
            <div style={{ ...box(K.peach, 999, 4), padding: '6px 18px', fontFamily: FONT, fontWeight: 800, fontSize: 26 }}>{v}</div>
          </div>;
        })}
      </div>
    </Bg>
  );
};
const S10: React.FC = () => {
  const f = useCurrentFrame(), cols = [K.green, K.lilac, K.orange, K.white], ic = ['wallet', 'bell', 'heart', 'star', 'cake', 'back', 'pin', 'chart', 'scan', 'send', 'star', 'gift'];
  return (
    <Bg c={K.peach}>
      <Title rows={S.s10} hi={RTL ? 'האפשרויות' : 'FONCTIONNALITÉS'} y={190} size={96} />
      <div style={{ position: 'absolute', left: -300, right: -300, top: 560, transform: 'rotate(-9deg)' }}>
        {[0, 1, 2, 3, 4, 5].map(r => {
          const items = [0, 1, 2, 3, 4, 5].map(j => (r * 2 + j) % S.feats.length), dx = (r % 2 ? -1 : 1) * f * 6 - 400;
          return <div key={r} style={{ display: 'flex', gap: 26, marginBottom: 34, transform: `translateX(${dx}px)` }}>
            {[...items, ...items].map((it, j) => <div key={j} style={{ flex: 'none', ...box(cols[(r + j) % 4], 999, 7), padding: '16px 34px', fontFamily: FONT, fontWeight: 900, fontSize: 40, display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap', direction: dir() }}>
              <Ic d={ic[it]} s={40} />{S.feats[it]}</div>)}
          </div>;
        })}
      </div>
    </Bg>
  );
};
const S11: React.FC = () => {
  const f = useCurrentFrame();
  const k = sp(f, 14, 13, 150, 0.8), c = sp(f, 50, 10, 240, 0.5);
  return (
    <Bg c={K.orange}>
      <Title rows={S.s11} hi={RTL ? 'המועדון' : 'FIDÉLITÉ'} hiBg={K.lilac} y={190} />
      <div style={{ position: 'absolute', left: 150, top: 640 + (1 - k) * 900, transform: `rotate(${-4 + Math.sin(f / 16) * 2}deg)`, ...box('transparent', 30, 14), borderRadius: 30 }}>
        <WCard name={RTL ? 'הקפה הקטן' : 'Le Petit Café'} color="#5B3A24" icon="cup" stamps={8} w={780} /></div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 1420, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 46, color: K.ink, direction: dir(), opacity: Math.min(1, sp(f, 36) * 2) }}>{S.end1}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1580, textAlign: 'center' }}>
        <span style={{ display: 'inline-block', ...box(K.white, 26, 10), transform: `scale(${c * (1 + 0.03 * Math.sin(f / 5))}) rotate(-2deg)`, padding: '24px 60px', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: K.ink, direction: dir() }}>{S.cta}</span></div>
      <Star x={70} y={560} c={K.sun} at={30} /><Star x={900} y={1300} c={K.green} at={40} s={80} />
    </Bg>
  );
};

// ================= MONTAGE =================
export const CUTS = [0, 120, 240, 360, 450, 570, 720, 1020, 1140, 1245, 1335];
export const Fidelite: React.FC<{ lang: Lang; music?: boolean }> = ({ lang, music = true }) => {
  S = STR[lang]; RTL = lang === 'he';
  const scenes = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11];
  return (
    <AbsoluteFill style={{ background: K.peach }}>
      {scenes.map((Sc, i) => <Sequence key={i} from={CUTS[i]} durationInFrames={(CUTS[i + 1] ?? FID_FRAMES) - CUTS[i]}><Sc /></Sequence>)}
      {music ? <Audio src={staticFile(`fidelite-music-${lang}.wav`)} /> : null}
    </AbsoluteFill>
  );
};
