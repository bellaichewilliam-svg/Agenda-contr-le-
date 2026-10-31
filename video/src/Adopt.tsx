import React from 'react';
import { HoppyHop } from './HoppyHop';
import { AbsoluteFill, Audio, Sequence, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { C, DISPLAY, UI } from './theme';
import { Flashes, Grain, Vignette, Wordmark, inExpo as inExpoRaw, inOut, lerp, outExpo, shake } from './Reel';
import { Person, Punch } from './Cycle';

// « Arrête de payer plus cher. Adopte HOP! » : 15 s, 1080 × 1920, Insta / TikTok, sur les coupes du showreel
// (60, 135, 225, 300, 360, 405) et la même grille musicale (ding à 268, roulement puis tampon à 330).
// Aucune plateforme n'est nommée : « une autre appli ».
export const ADOPT_FRAMES = 450;
export type AdoptLang = 'fr' | 'he';
const RED = '#F04438', INK = '#1D2433', PAPER = '#FFFDF7';
const STR = {
  fr: { rtl: false, other: '🧾 Une autre appli', lines: ['🍕 Pizza (prix majoré)', 'Frais de service', 'Petite commande', 'Frais de livraison', 'Frais de…', 'Et encore…'], total: 'TOTAL',
    hook: 'Encore des frais ?! 😱', fees: [['FRAIS DE', 'SERVICE'], ['PETITE', 'COMMANDE'], ['PRIX', 'MAJORÉS'], ['FRAIS DE', 'LIVRAISON'], ['ET', 'ENCORE… 😩']], plus: '+ FRAIS',
    stop: 'STOP ✋', big: ['Arrête de payer', 'plus cher.'],
    ticket: [['🍕 Pizza', 'prix du resto'], ['🛵 Livraison', 'prix fixe, dès 25 ₪'], ['🧾 Frais de service', '0 ₪'], ['🙈 Frais cachés', '0 ₪']], tout: "✓ C'EST TOUT.",
    certT: "CERTIFICAT D'ADOPTION", certB: ['Je, soussigné(e),', 'adopte', 'pour toutes mes livraisons.'], stamp: 'ADOPTÉ ✓', sign: 'Signé : moi 😎',
    stickers: [['🍕', 'Prix du resto'], ['🛵', 'Livraison prix fixe'], ['0 ₪', 'de frais de service'], ['🏠', 'Livreurs de Netanya']],
    out: ['Arrête de payer plus cher.', 'Adopte HOP!'] },
  he: { rtl: true, other: '🧾 אפליקציה אחרת', lines: ['🍕 פיצה (מחיר מנופח)', 'דמי שירות', 'הזמנה קטנה', 'דמי משלוח', 'עמלת…', 'ועוד…'], total: 'סה"כ',
    hook: 'עוד עמלות?! 😱', fees: [['דמי', 'שירות'], ['הזמנה', 'קטנה'], ['מחירים', 'מנופחים'], ['דמי', 'משלוח'], ['ועוד…', '😩']], plus: '+ עמלות',
    stop: 'די! ✋', big: ['תפסיקו לשלם', 'יותר ביוקר.'],
    ticket: [['🍕 פיצה', 'מחיר המסעדה'], ['🛵 משלוח', 'מחיר קבוע, מ־25 ₪'], ['🧾 דמי שירות', '0 ₪'], ['🙈 עמלות נסתרות', '0 ₪']], tout: '✓ זהו.',
    certT: 'תעודת אימוץ', certB: ['אני, החתום/ה מטה,', 'מאמץ/ת את', 'לכל המשלוחים שלי.'], stamp: 'אומץ ✓', sign: 'חתימה: אני 😎',
    stickers: [['🍕', 'מחיר המסעדה'], ['🛵', 'משלוח במחיר קבוע'], ['0 ₪', 'דמי שירות'], ['🏠', 'שליחים מנתניה']],
    out: ['תפסיקו לשלם יותר.', 'אמצו את HOP!'] },
};
let T = STR.fr; // fixé par <Adopt lang> avant le rendu des scènes
const iso = { unicodeBidi: 'isolate' as const, direction: 'ltr' as const };
const inExpo = (t: number) => (t <= 0 ? 0 : inExpoRaw(t));
const sp = (f: number, d: number, damping = 11, stiffness = 260, mass = 0.6) => spring({ frame: f - d, fps: 30, config: { damping, stiffness, mass } });
const Hop: React.FC<{ size: number; color?: string }> = ({ size, color = C.navy }) => (
  <span style={{ font: `700 ${size}px/1 ${DISPLAY}`, color, ...iso, display: 'inline-block' }}>HOP<span style={{ color: C.orange }}>!</span></span>
);

// ===== 1. Le ticket qui n'en finit pas, le bonhomme horrifié =========================================
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const grow = lerp(f, [2, 44], [0, 1], (t: number) => 1 - Math.pow(1 - t, 2));
  const h = 220 + grow * 1180;
  const shock = sp(f, 22, 8, 300, 0.5);
  const sh = shake(f, 22, 18, 10);
  const zoom = lerp(f, [50, 60], [1, 3], inExpo);
  const spin = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #FFF6EE 0%, #FFE0D1 100%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${zoom})`, transformOrigin: '50% 70%' }}>
        {/* l'imprimante et le ticket qui sort */}
        <div style={{ position: 'absolute', left: 90, top: 300, width: 640, height: 70, borderRadius: 24, background: INK, boxShadow: '0 20px 40px rgba(0,0,0,.25)' }} />
        <div style={{ position: 'absolute', left: 130, top: 340, width: 560, height: h, overflow: 'hidden', background: PAPER, boxShadow: '0 30px 60px rgba(120,40,0,.18)',
          WebkitMaskImage: 'linear-gradient(#000 92%, transparent)', maskImage: 'linear-gradient(#000 92%, transparent)' }}>
          <div style={{ padding: '40px 40px 0', font: `700 46px/1 ${DISPLAY}`, color: '#667085' }}>{T.other}</div>
          <div style={{ margin: '24px 40px', borderTop: '4px dashed #D0D5DD' }} />
          {T.lines.map((l, k) => {
            const on = lerp(f, [6 + k * 6, 10 + k * 6], [0, 1], outExpo);
            return <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, padding: '18px 40px', opacity: on, transform: `translateX(${(1 - on) * -40}px)`,
              font: `600 40px/1.15 ${UI}`, color: k ? RED : INK }}><span>{l}</span><span style={iso}>{k ? '+ ₪' : '₪₪'}</span></div>;
          })}
          <div style={{ margin: '24px 40px', borderTop: '4px dashed #D0D5DD' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', font: `700 60px/1 ${DISPLAY}`, color: RED }}>
            <span>{T.total}</span><span style={iso}>{f < 40 ? `${80 + (spin * 37) % 90} ₪` : '???'}</span>
          </div>
        </div>
        {/* le bonhomme : mains sur la tête */}
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform={`translate(860 1560) scale(1.35)`}>
            <Person aL={lerp(shock, [0, 1], [10, 165])} fL={lerp(shock, [0, 1], [0, 55])} aR={lerp(shock, [0, 1], [10, 165])} fR={lerp(shock, [0, 1], [0, 55])}
              eyes={f >= 22 ? 'open' : 'look'} mouth={f >= 22 ? 'o' : 'flat'} brows={shock} bob={-shock * 10} />
            {f >= 22 && <path d="M 58 -270 q 14 22 0 34 q -14 -12 0 -34 Z" fill="#7CC4FA" transform={`translate(0 ${(f - 22) * 1.5})`} opacity={lerp(f, [22, 50], [1, 0])} />}
          </g>
        </svg>
      </AbsoluteFill>
      <Punch t={T.hook} at={22} y={110} size={108} />
    </AbsoluteFill>
  );
};

// ===== 2. Les frais, un par temps, le porte-monnaie se vide =========================================
const Fee: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const [a, b] = T.fees[i];
  const bg = i % 2 ? INK : RED;
  const s = sp(f, 0, 9, 360, 0.45);
  const sh = shake(f, 0, 16, 7);
  const size = Math.min(190, 1500 / Math.max(a.length, b.length));
  const wallet = 1 - i * 0.16;
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      {Array.from({ length: 16 }).map((_, k) => (
        <div key={k} style={{ position: 'absolute', left: (k * 137) % 1080, top: ((k * 263 + f * 40) % 2200) - 200, font: `800 54px/1 ${UI}`, color: 'rgba(255,255,255,.08)', transform: `rotate(${k * 23}deg)` }}>₪</div>
      ))}
      <div style={{ position: 'absolute', top: 160, left: 0, right: 0, textAlign: 'center', font: `800 44px/1 ${UI}`, letterSpacing: T.rtl ? '.05em' : '.3em', color: '#fff', opacity: 0.85 }}>{T.plus} · <span style={iso}>{i + 1}/5</span></div>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y - 80}px)` }}>
        <div style={{ font: `700 ${size}px/0.98 ${DISPLAY}`, color: '#fff', textAlign: 'center', transform: `scale(${2.4 - 1.4 * s}) rotate(${(i % 2 ? 4 : -4) * s}deg)`, opacity: Math.min(1, s * 2) }}>
          {a}<br /><span style={{ color: i % 2 ? RED : '#FFE0D1' }}>{b}</span>
        </div>
      </AbsoluteFill>
      {/* porte-monnaie qui maigrit, pièces qui s'envolent */}
      <div style={{ position: 'absolute', left: 540, top: 1500, transform: `translate(-50%,-50%) scale(${wallet})`, fontSize: 200 }}>👛</div>
      {Array.from({ length: 5 }).map((_, k) => {
        const t = lerp(f, [1, 14], [0, 1], outExpo), ang = -Math.PI / 2 + (k - 2) * 0.45;
        return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(ang) * 420 * t, top: 1440 + Math.sin(ang) * 520 * t, fontSize: 80, opacity: 1 - t, transform: `translate(-50%,-50%) rotate(${t * 360}deg)` }}>🪙</div>;
      })}
    </AbsoluteFill>
  );
};
const Fees: React.FC = () => <AbsoluteFill>{T.fees.map((_, i) => <Sequence key={i} from={i * 15} durationInFrames={15}><Fee i={i} /></Sequence>)}</AbsoluteFill>;

// ===== 3. STOP : il déchire le ticket ================================================================
const Stop: React.FC = () => {
  const f = useCurrentFrame();          // 0..90
  const rip = lerp(f, [28, 46], [0, 1], outExpo);
  const pull = lerp(f, [16, 28], [0, 1], inOut);
  const sh = shake(f, 28, 22, 10);
  const big = sp(f, 50, 12, 240, 0.6);
  const exit = lerp(f, [82, 90], [0, 1], inExpo);
  const half = (side: -1 | 1) => (
    <div style={{ position: 'absolute', left: 540 + side * (60 + pull * 20) - (side < 0 ? 230 : 0), top: 1120, width: 230, height: 380, background: PAPER,
      transform: `translate(${side * rip * 700}px, ${rip * rip * 900 - rip * 200}px) rotate(${side * rip * 70}deg)`, boxShadow: '0 20px 40px rgba(0,0,0,.25)',
      clipPath: side < 0 ? 'polygon(0 0, 100% 0, 92% 12%, 100% 25%, 90% 38%, 100% 52%, 91% 66%, 100% 80%, 92% 92%, 100% 100%, 0 100%)'
        : 'polygon(8% 0, 100% 0, 100% 100%, 0 100%, 8% 92%, 0 80%, 9% 66%, 0 52%, 10% 38%, 0 25%, 8% 12%)' }}>
      {[0, 1, 2, 3, 4].map(k => <div key={k} style={{ margin: '34px 24px 0', height: 18, borderRadius: 9, background: k % 2 ? '#FECDCA' : '#E4E7EC' }} />)}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.navy2} 0%, ${C.navy} 70%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${1 - exit * 0.2})`, opacity: 1 - exit }}>
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(540 1500) scale(1.9)">
            <Person aL={lerp(pull, [0, 1], [60, 90]) + rip * 40} fL={lerp(pull, [0, 1], [60, 40]) - rip * 30} aR={lerp(pull, [0, 1], [60, 90]) + rip * 40} fR={lerp(pull, [0, 1], [60, 40]) - rip * 30}
              eyes={f < 28 ? 'open' : 'happy'} mouth={f < 28 ? 'flat' : 'grin'} brows={f < 28 ? -0.6 : 0.3} bob={-rip * 14} />
          </g>
        </svg>
        {half(-1)}{half(1)}
        {/* étoiles de la déchirure */}
        {f >= 28 && Array.from({ length: 12 }).map((_, k) => {
          const t = lerp(f, [28, 46], [0, 1], outExpo), a = (k / 12) * Math.PI * 2;
          return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(a) * 380 * t, top: 1300 + Math.sin(a) * 380 * t, fontSize: 60, opacity: 1 - t, transform: 'translate(-50%,-50%)' }}>{k % 2 ? '✨' : '💥'}</div>;
        })}
      </AbsoluteFill>
      <Punch t={T.stop} at={6} until={44} y={260} size={150} color={RED} />
      {f >= 50 && <div style={{ position: 'absolute', top: 200, left: 30, right: 30, textAlign: 'center', font: `700 112px/1.05 ${DISPLAY}`, color: '#fff', opacity: 1 - exit,
        transform: `scale(${big}) rotate(${-3 * big}deg)` }}>{T.big[0]}<br /><span style={{ color: C.orange }}>{T.big[1]}</span></div>}
    </AbsoluteFill>
  );
};

// ===== 4. Le ticket HOP! : court, clair, « c'est tout » ==============================================
const Ticket: React.FC = () => {
  const f = useCurrentFrame();          // 0..75
  const enter = sp(f, 0, 13, 200, 0.7);
  const ok = sp(f, 43, 9, 320, 0.5);
  const sh = shake(f, 43, 14, 8);
  const conf = Array.from({ length: 36 }).map((_, k) => {
    const t = Math.max(0, f - 43) / 30, a = random(`ca${k}`) * Math.PI * 2, v = 700 + random(`cv${k}`) * 1100;
    return { x: Math.cos(a) * v * t, y: Math.sin(a) * v * t + 1500 * t * t, r: random(`cr${k}`) * 720 * t, c: [C.orange, '#fff', C.green, '#FFC857', '#1E9BE0'][k % 5] };
  });
  const exit = lerp(f, [69, 75], [0, 1], inExpo);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.navy2} 0%, ${C.navy} 70%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y + 40}px) scale(${1 - exit * 0.2})`, opacity: 1 - exit }}>
        <div style={{ width: 860, borderRadius: 44, background: PAPER, overflow: 'hidden', boxShadow: '0 60px 120px rgba(0,0,0,.45)', transform: `translateY(${(1 - enter) * 1200}px) rotate(${(1 - enter) * 12 - 2}deg)` }}>
          <div style={{ background: C.navy, padding: '40px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Hop size={84} color="#fff" /><span style={{ font: `700 34px/1 ${UI}`, color: '#A9B3CA' }}>Netanya</span>
          </div>
          <div style={{ padding: '24px 48px 40px' }}>
            {T.ticket.map(([l, r], k) => {
              const on = sp(f, 8 + k * 7, 13, 260, 0.5);
              return <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '26px 0', borderBottom: k < 3 ? '3px dashed #E4E7EC' : 'none',
                transform: `scale(${0.8 + 0.2 * on})`, opacity: Math.min(1, on * 1.5) }}>
                <span style={{ font: `700 48px/1.1 ${DISPLAY}`, color: C.navy }}>{l}</span>
                <span style={{ font: `700 44px/1.1 ${UI}`, color: k >= 2 ? C.green : C.orangeDeep, whiteSpace: 'nowrap' }}>{r}</span>
              </div>;
            })}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 1500, padding: '30px 60px', borderRadius: 30, border: `12px solid ${C.green}`, color: C.green, background: 'rgba(255,255,255,.95)', font: `800 96px/1 ${DISPLAY}`,
          transform: `scale(${1 + Math.max(0, 1 - ok) * 2.4}) rotate(-6deg)`, opacity: Math.min(1, ok), whiteSpace: 'nowrap' }}>{T.tout}</div>
        {f >= 43 && conf.map((c, k) => <div key={k} style={{ position: 'absolute', left: '50%', top: '45%', width: 22, height: 12, borderRadius: 3, background: c.c, transform: `translate(${c.x}px, ${c.y}px) rotate(${c.r}deg)` }} />)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 5. Le certificat d'adoption : signature, tampon « ADOPTÉ » ====================================
const SIGN = 'M 0 40 C 30 -20, 60 80, 90 20 S 140 -10, 160 40 S 230 70, 260 10 Q 280 -20 300 30';
const Adopt: React.FC = () => {
  const f = useCurrentFrame();          // 0..60
  const enter = sp(f, 0, 12, 220, 0.6);
  const sig = lerp(f, [6, 26], [0, 1], inOut);
  const ev = evolvePath(sig, SIGN);
  const stamp = sp(f, 30, 12, 340, 0.55);
  const sh = shake(f, 30, 26, 10);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, ${C.orangeLight} 0%, ${C.orangeDeep} 100%)`, overflow: 'hidden' }}>
      {Array.from({ length: 14 }).map((_, k) => {
        const t = ((f + k * 7) % 50) / 50;
        return <div key={k} style={{ position: 'absolute', left: (k * 167) % 1080, top: 1900 - t * 2000, fontSize: 60 + (k % 3) * 20, opacity: f >= 30 ? Math.sin(Math.PI * t) : 0 }}>{k % 2 ? '❤️' : '🧡'}</div>;
      })}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ position: 'relative', width: 900, padding: '60px 60px 70px', borderRadius: 30, background: PAPER, boxShadow: '0 60px 120px rgba(90,20,0,.4)', textAlign: 'center',
          outline: `10px solid ${PAPER}`, border: `6px double ${C.orange}`, transform: `translateY(${(1 - enter) * 1400}px) rotate(${(1 - enter) * -14 + 2}deg)` }}>
          <div style={{ font: `800 40px/1 ${UI}`, letterSpacing: T.rtl ? '.05em' : '.18em', color: C.orangeDeep }}>{T.certT}</div>
          <div style={{ margin: '30px auto 10px', width: 210, height: 210, borderRadius: '50%', background: C.navy, display: 'grid', placeItems: 'center', fontSize: 120, boxShadow: `0 0 0 10px ${C.cream}, 0 0 0 16px ${C.orange}` }}>🛵</div>
          <div style={{ font: `600 44px/1.3 ${UI}`, color: C.ink, marginTop: 24 }}>{T.certB[0]}</div>
          <div style={{ font: `700 52px/1.2 ${UI}`, color: C.ink }}>{T.certB[1]} <Hop size={96} /></div>
          <div style={{ font: `600 40px/1.3 ${UI}`, color: C.muted }}>{T.certB[2]}</div>
          <svg width={320} height={110} viewBox="-10 -40 330 120" style={{ marginTop: 20, overflow: 'visible' }}>
            <path d={SIGN} stroke={C.navy} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
          </svg>
          <div style={{ font: `600 32px/1 ${UI}`, color: C.muted, opacity: sig }}>{T.sign}</div>
          {/* tampon */}
          <div style={{ position: 'absolute', right: -30, bottom: 60, padding: '22px 34px', borderRadius: 24, border: `10px solid ${RED}`, color: RED, font: `800 84px/1 ${DISPLAY}`,
            transform: `scale(${1 + Math.max(0, 1 - stamp) * 2.6}) rotate(14deg)`, opacity: Math.min(1, stamp) * 0.92, whiteSpace: 'nowrap', background: 'rgba(255,255,255,.4)' }}>{T.stamp}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===== 6. Les atouts en autocollants, puis tout file vers le point ==================================
const ST_BG = ['#fff', C.green, C.navy, '#FFC857'], ST_FG = [C.navy, '#fff', '#fff', C.navy];
const Stickers: React.FC = () => {
  const f = useCurrentFrame();          // 0..45
  const fold = lerp(f, [32, 45], [0, 1], inExpo);
  const pos = [[300, 560, -8], [780, 820, 7], [300, 1140, 5], [780, 1400, -6]];
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      {T.stickers.map(([e, t], k) => {
        const s = sp(f, k * 6, 9, 320, 0.5);
        const [x, y, r] = pos[k];
        return <div key={k} style={{ position: 'absolute', left: x + (540 - x) * fold, top: y + (960 - y) * fold, transform: `translate(-50%,-50%) scale(${s * (1 - fold * 0.95)}) rotate(${r + fold * 90}deg)`,
          width: 470, padding: '34px 30px', borderRadius: 44, background: ST_BG[k], color: ST_FG[k], textAlign: 'center', border: '8px solid #fff', boxShadow: '0 30px 60px rgba(0,0,0,.35)' }}>
          <div style={{ font: `700 104px/1 ${DISPLAY}`, ...iso }}>{e}</div>
          <div style={{ font: `700 52px/1.1 ${DISPLAY}`, marginTop: 14 }}>{t}</div>
        </div>;
      })}
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${fold})`, boxShadow: `0 0 80px ${C.orange}` }} />
    </AbsoluteFill>
  );
};

// ===== 7. Fin : logo HOP! sur bleu nuit ===============================================================
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const open = lerp(f, [0, 10], [0, 1], outExpo);
  const letter = (i: number) => {
    const s = spring({ frame: f - 3 - i * 3, fps: 30, config: { damping: i === 3 ? 7 : 11, stiffness: 240, mass: 0.6 } });
    return { y: (1 - s) * -500, s: 0.5 + 0.5 * s, r: i === 3 ? (1 - s) * -80 : 0, o: f >= 3 + i * 3 ? 1 : 0 };
  };
  const a = sp(f, 14, 12, 260, 0.6), b = sp(f, 20, 9, 300, 0.5);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 90, height: 90, borderRadius: '50%', background: C.orange, transform: `translate(-50%,-50%) scale(${1 + open * 40})`, opacity: 1 - open }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${C.navy2} 0%, ${C.navy} 60%)`, opacity: open }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark width={760} anim={letter} />
        <div style={{ marginTop: 56, font: `700 76px/1.1 ${DISPLAY}`, color: '#fff', textAlign: 'center', transform: `translateY(${(1 - a) * 40}px)`, opacity: Math.min(1, a * 1.5) }}>{T.out[0]}</div>
        <div style={{ marginTop: 22, padding: '22px 50px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 84px/1 ${DISPLAY}`, transform: `scale(${b}) rotate(-3deg)` }}>{T.out[1].split('HOP!')[0]}<bdi dir="ltr">HOP!</bdi>{T.out[1].split('HOP!')[1]}</div>
        <div style={{ marginTop: 50, font: `700 44px/1 ${UI}`, color: '#A9B3CA', opacity: lerp(f, [30, 38], [0, 1]) }}>hop-livraison.vercel.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const AdoptHop: React.FC<{ music?: boolean; lang?: AdoptLang }> = ({ music = true, lang = 'fr' }) => { T = STR[lang]; return (
  <AbsoluteFill style={{ background: C.navy, direction: T.rtl ? 'rtl' : 'ltr' }}>
    <Sequence durationInFrames={60}><Hook /></Sequence>
    <Sequence from={60} durationInFrames={75}><Fees /></Sequence>
    <Sequence from={135} durationInFrames={90}><Stop /></Sequence>
    <Sequence from={225} durationInFrames={75}><Ticket /></Sequence>
    <Sequence from={300} durationInFrames={60}><Adopt /></Sequence>
    <Sequence from={360} durationInFrames={45}><Stickers /></Sequence>
    <Sequence from={405} durationInFrames={45}><Outro /><HoppyHop x={210} bottom={1890} h={560} at={0.35} /></Sequence>
    <Flashes />
    <Vignette />
    <Grain />
    {music && <Audio src={staticFile('adopt-music.wav')} />}
  </AbsoluteFill>
); };
