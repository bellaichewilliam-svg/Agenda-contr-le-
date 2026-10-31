import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, DISPLAY, UI } from './theme';
import { Wordmark } from './Reel';

// Grille Instagram : un panorama 3 × (1080 × 1350) découpé en 3 publications, H | O | P!
// La grille du profil recadre chaque publication en 3:4 au centre (≈ 1012 px de large) : tout reste dedans.
const CX = [325, 995, 1640, 2060];
const S = 0.84;                                   // échelle du logo (hauteur des lettres ≈ 640 px)
const TARGET = [540, 1620, 2700];                 // centre de chaque tuile
const PGROUP = 1770;                              // centre du groupe « P! » dans le dessin du logo
const WORDS = [['Commandez.', 'הזמינו.'], ['On livre.', 'אנחנו מביאים.'], ['Et hop !', 'והופ!']];
export const Grid: React.FC<{ tile: number }> = ({ tile }) => {
  // Correction mesurée sur l'image (centre réel du dessin de chaque lettre) : chaque lettre pile au centre de sa publication
  const CORR = [-8, -12.5, -52];
  const dx = (i: number) => (i < 2 ? TARGET[i] / S - CX[i] + CORR[i] / S : TARGET[2] / S - PGROUP + CORR[2] / S);
  return (
    <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -tile * 1080, top: 0, width: 3240, height: 1350 }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 70% at 50% 45%, ${C.navy2} 0%, ${C.navy} 70%)` }} />
        {/* trajet orange qui relie les 3 publications */}
        <svg width={3240} height={1350} style={{ position: 'absolute', inset: 0 }}>
          <defs><filter id="gl"><feGaussianBlur stdDeviation="14" /></filter></defs>
          {[0, 1].map(k => <path key={k} d="M -40 1235 C 400 1150, 700 1300, 1080 1230 S 1800 1150, 2160 1225 S 2800 1290, 3020 1205"
            stroke={k ? '#FFB27F' : C.orange} strokeWidth={k ? 10 : 34} fill="none" strokeLinecap="round" filter={k ? undefined : 'url(#gl)'} opacity={k ? 1 : 0.6} strokeDasharray={k ? '2 26' : undefined} />)}
          {[[540, 1222], [1620, 1192]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={14} fill="#fff" opacity={0.85} />)}
          {/* points de ville, discrets */}
          {Array.from({ length: 60 }).map((_, k) => <circle key={k} cx={(k * 557) % 3240} cy={120 + ((k * 331) % 260)} r={2 + (k % 3)} fill="#fff" opacity={0.12 + (k % 4) * 0.05} />)}
        </svg>
        <div style={{ position: 'absolute', left: 0, top: 230 }}>
          <Wordmark width={2310 * S} anim={i => ({ x: dx(i < 3 ? i : 2) + (i === 3 ? 0 : 0) })} />
        </div>
        {/* le scooter arrive au bout du trajet, sous le « ! » */}
        <div style={{ position: 'absolute', left: 3020, top: 1205, transform: 'translate(-50%,-50%)', width: 128, height: 128, borderRadius: '50%', background: C.orange, border: '9px solid #fff',
          display: 'grid', placeItems: 'center', fontSize: 64, boxShadow: `0 0 60px ${C.orange}` }}>🛵</div>
        {WORDS.map(([fr, he], k) => (
          <div key={k} style={{ position: 'absolute', left: TARGET[k] - 500, width: 1000, top: 950, textAlign: 'center' }}>
            <div style={{ font: `700 74px/1 ${DISPLAY}`, color: '#fff' }}>{fr}</div>
            <div style={{ font: `700 64px/1.15 ${UI}`, color: '#FFB27F', marginTop: 16 }} dir="rtl">{he}</div>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 540 - 300, width: 600, top: 120, textAlign: 'center', font: `800 30px/1 ${UI}`, letterSpacing: '.4em', color: '#FFB27F' }}>NETANYA</div>
        <div style={{ position: 'absolute', left: 2700 - 400, width: 800, top: 120, textAlign: 'center', font: `700 32px/1 ${UI}`, color: '#A9B3CA' }}>hop-livraison.vercel.app</div>
      </div>
    </AbsoluteFill>
  );
};
