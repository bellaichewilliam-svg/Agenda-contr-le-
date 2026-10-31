import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, DISPLAY, UI } from './theme';

// Hoppy (הופי), la mascotte HOP! : un kangourou orange, ventre crème, qui livre la commande dans sa poche
// (le sac HOP! bleu nuit dépasse). Style « jouet en vinyle 3D » : formes rondes, dégradés doux, reflets.
const OR = '#FF7A1F', OR_D = '#E0520A', OR_L = '#FFB37A', CREAM = '#FFE9D2', CREAM_D = '#F3CDA8', NAVY = C.navy, PINK = '#FF9C8A';

type Pose = { wave?: number; thumb?: boolean; jump?: number; eyes?: 'open' | 'happy' | 'wink'; mouth?: 'smile' | 'open' };
export const Hoppy: React.FC<Pose & { size?: number }> = ({ wave = 1, thumb = false, jump = 0, eyes = 'open', mouth = 'open', size = 1000 }) => {
  const up = jump * 120;
  const id = `h${wave}${thumb ? 1 : 0}${jump}${eyes}${mouth}`.replace('.', '');
  const g = (n: string) => `url(#${id}${n})`;
  const armL = wave > 0
    ? { d: `M 352 575 Q 300 ${520 - wave * 40} ${280 - wave * 10} ${445 - wave * 60}`, hx: 280 - wave * 10, hy: 445 - wave * 60 }
    : { d: 'M 352 575 Q 330 640 400 690', hx: 400, hy: 690 };
  return (
    <svg width={size} height={size} viewBox="0 0 1000 1000" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${id}body`} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor={OR_L} /><stop offset="0.45" stopColor={OR} /><stop offset="1" stopColor={OR_D} /></radialGradient>
        <radialGradient id={`${id}cream`} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFF7EE" /><stop offset="0.6" stopColor={CREAM} /><stop offset="1" stopColor={CREAM_D} /></radialGradient>
        <radialGradient id={`${id}navy`} cx="0.35" cy="0.25" r="0.9"><stop offset="0" stopColor="#2B4478" /><stop offset="0.5" stopColor="#16284F" /><stop offset="1" stopColor="#0B1730" /></radialGradient>
        <radialGradient id={`${id}eye`} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#2A3550" /><stop offset="1" stopColor="#0B1020" /></radialGradient>
        <filter id={`${id}soft`}><feGaussianBlur stdDeviation="18" /></filter>
      </defs>
      {/* ombre au sol */}
      <ellipse cx={500} cy={918} rx={250 - jump * 70} ry={36 - jump * 10} fill="rgba(0,0,0,.28)" filter={g('soft')} />
      <g transform={`translate(0 ${-up})`}>
        {/* queue */}
        <path d="M 590 800 C 720 850, 840 880, 925 805 C 950 780, 930 745, 900 758 C 830 795, 740 760, 630 700 Z" fill={g('body')} />
        {/* pieds */}
        {[-1, 1].map(s => (
          <g key={s}>
            <ellipse cx={500 + s * 95} cy={872} rx={120} ry={46} fill={g('body')} />
            <ellipse cx={500 + s * 95 + s * 30} cy={880} rx={62} ry={26} fill={g('cream')} />
          </g>
        ))}
        {/* corps */}
        <ellipse cx={500} cy={680} rx={195} ry={215} fill={g('body')} />
        <ellipse cx={500} cy={725} rx={135} ry={155} fill={g('cream')} />
        {/* le sac HOP! dans la poche */}
        <path d="M 455 618 Q 500 570 545 618" stroke="#0B1730" strokeWidth={14} fill="none" strokeLinecap="round" />
        <rect x={420} y={612} width={160} height={130} rx={24} fill={g('navy')} />
        <rect x={420} y={612} width={160} height={30} rx={20} fill="#2A3F6E" opacity={0.8} />
        <text x={500} y={694} textAnchor="middle" fontFamily="Fredoka, Rubik, sans-serif" fontWeight={700} fontSize={50} fill="#fff" direction="ltr">HOP<tspan fill={OR}>!</tspan></text>
        {/* vapeur : c'est chaud */}
        {[-34, 0, 34].map((x, k) => <path key={k} d={`M ${500 + x} 585 q -12 -20 0 -40 q 12 -20 0 -40`} stroke="#fff" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.75} />)}
        {/* poche : le rebord passe devant le sac */}
        <path d="M 372 705 Q 500 770 628 705 Q 630 800 500 842 Q 370 800 372 705 Z" fill={g('cream')} />
        <path d="M 372 705 Q 500 770 628 705" stroke={CREAM_D} strokeWidth={10} fill="none" strokeLinecap="round" />
        {/* bras */}
        <path d={armL.d} stroke={g('body')} strokeWidth={66} fill="none" strokeLinecap="round" />
        <circle cx={armL.hx} cy={armL.hy} r={40} fill={g('body')} />
        {thumb
          ? <g><path d="M 648 575 Q 720 560 735 470" stroke={g('body')} strokeWidth={66} fill="none" strokeLinecap="round" />
              {/* un cœur tenu en l'air : client content */}
              <path d="M 740 455 C 700 420, 690 370, 725 352 C 745 342, 760 355, 765 368 C 770 355, 785 342, 805 352 C 840 370, 830 420, 790 455 L 765 478 Z" fill="#FF4D6D" stroke="#fff" strokeWidth={8} strokeLinejoin="round" />
              <ellipse cx={738} cy={380} rx={12} ry={8} fill="#fff" opacity={0.6} transform="rotate(-30 738 380)" />
              <circle cx={735} cy={470} r={40} fill={g('body')} /></g>
          : <g><path d="M 648 575 Q 690 640 600 700" stroke={g('body')} strokeWidth={66} fill="none" strokeLinecap="round" /><circle cx={600} cy={700} r={38} fill={g('body')} /></g>}
        {/* oreilles */}
        {[-1, 1].map(s => (
          <g key={s} transform={`rotate(${s * 16} ${500 + s * 95} 250)`}>
            <path d={`M ${500 + s * 95 - 62} 250 C ${500 + s * 95 - 70} 150, ${500 + s * 95 - 30} 60, ${500 + s * 95} 55 C ${500 + s * 95 + 30} 60, ${500 + s * 95 + 70} 150, ${500 + s * 95 + 62} 250 Z`} fill={g('body')} />
            <path d={`M ${500 + s * 95 - 30} 235 C ${500 + s * 95 - 36} 165, ${500 + s * 95 - 14} 100, ${500 + s * 95} 98 C ${500 + s * 95 + 14} 100, ${500 + s * 95 + 36} 165, ${500 + s * 95 + 30} 235 Z`} fill={PINK} opacity={0.75} />
          </g>
        ))}
        {/* tête */}
        <ellipse cx={500} cy={390} rx={200} ry={178} fill={g('body')} />
        <ellipse cx={500} cy={462} rx={108} ry={78} fill={g('cream')} />
        {/* yeux */}
        {[-1, 1].map(s => {
          const x = 500 + s * 82, y = 362;
          const closed = eyes === 'happy' || (eyes === 'wink' && s === 1);
          return closed
            ? <path key={s} d={`M ${x - 30} ${y + 6} Q ${x} ${y - 30} ${x + 30} ${y + 6}`} stroke="#0B1020" strokeWidth={12} fill="none" strokeLinecap="round" />
            : <g key={s}><ellipse cx={x} cy={y} rx={34} ry={42} fill={g('eye')} /><circle cx={x - 10} cy={y - 14} r={12} fill="#fff" /><circle cx={x + 12} cy={y + 12} r={5} fill="#fff" opacity={0.8} /></g>;
        })}
        {/* joues, nez, bouche */}
        <ellipse cx={385} cy={432} rx={34} ry={20} fill={PINK} opacity={0.6} />
        <ellipse cx={615} cy={432} rx={34} ry={20} fill={PINK} opacity={0.6} />
        <ellipse cx={500} cy={425} rx={36} ry={25} fill={g('navy')} />
        <ellipse cx={490} cy={416} rx={12} ry={6} fill="#fff" opacity={0.6} />
        {mouth === 'open'
          ? <g><path d="M 455 468 Q 500 530 545 468 Z" fill="#7A2E2E" /><path d="M 478 505 Q 500 490 522 505 Q 510 522 500 522 Q 490 522 478 505 Z" fill="#FF8A80" /></g>
          : <path d="M 458 470 Q 500 508 542 470" stroke="#7A2E2E" strokeWidth={10} fill="none" strokeLinecap="round" />}
        {/* reflet général (effet vinyle) */}
        <ellipse cx={420} cy={300} rx={70} ry={34} fill="#fff" opacity={0.18} transform="rotate(-20 420 300)" />
      </g>
      {jump > 0 && [0, 1, 2].map(k => <path key={k} d={`M ${330 + k * 170} ${960 - k % 2 * 12} q 0 -30 ${k === 1 ? 0 : (k - 1) * 20} -50`} stroke="#fff" strokeWidth={8} opacity={0.5} fill="none" strokeLinecap="round" />)}
    </svg>
  );
};

// Fiche du personnage : 3 poses
export const MascotSheet: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 80% at 50% 45%, ${C.navy2} 0%, ${C.navy} 75%)`, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center' }}>
      <div style={{ font: `700 110px/1 ${DISPLAY}`, color: '#fff' }}>Hoppy <span style={{ color: OR }}>·</span> <span style={{ fontFamily: 'Rubik', fontWeight: 700 }}>הופי</span></div>
      <div style={{ font: `600 44px/1.3 ${UI}`, color: '#FFB27F', marginTop: 18 }}>La mascotte <span style={{ unicodeBidi: 'isolate' }}>HOP!</span> · il livre tout dans sa poche</div>
    </div>
    <div style={{ position: 'absolute', top: 330, left: 60, right: 60, display: 'flex', justifyContent: 'space-between' }}>
      {[{ p: { wave: 1 }, t: 'Coucou !', h: 'שלום!' }, { p: { wave: 0.6, jump: 1, eyes: 'happy' as const }, t: 'Et hop !', h: 'והופ!' }, { p: { wave: 0, thumb: true, eyes: 'wink' as const, mouth: 'smile' as const }, t: 'Livré !', h: 'נמסר!' }].map((x, k) => (
        <div key={k} style={{ width: 660, textAlign: 'center' }}>
          <Hoppy {...x.p} size={620} />
          <div style={{ font: `700 64px/1 ${DISPLAY}`, color: '#fff', marginTop: -10 }}>{x.t}</div>
          <div style={{ font: `700 46px/1.2 Rubik, sans-serif`, color: '#FFB27F', marginTop: 10 }} dir="rtl">{x.h}</div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

// Visuel principal (publication 1080 × 1350)
export const MascotHero: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 50%, ${C.navy2} 0%, ${C.navy} 75%)`, overflow: 'hidden', alignItems: 'center' }}>
    <div style={{ marginTop: 90, textAlign: 'center' }}>
      <div style={{ font: `700 92px/1.05 ${DISPLAY}`, color: '#fff' }}>Voici <span style={{ color: OR }}>Hoppy</span> !</div>
      <div style={{ font: `700 54px/1.2 Rubik, sans-serif`, color: '#FFB27F', marginTop: 14 }} dir="rtl">תכירו את הופי!</div>
    </div>
    <div style={{ marginTop: 10 }}><Hoppy wave={1} size={900} /></div>
    <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center' }}>
      <div style={{ font: `700 52px/1.2 ${DISPLAY}`, color: '#fff' }}>Il livre tout Netanya… dans sa poche.</div>
      <div style={{ font: `700 40px/1.3 Rubik, sans-serif`, color: '#A9B3CA', marginTop: 8 }} dir="rtl">מביא את כל נתניה… בכיס.</div>
    </div>
  </AbsoluteFill>
);
