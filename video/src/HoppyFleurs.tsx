import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { C, DISPLAY } from './theme';
import { Wordmark } from './Reel';

// « Mets Hoppy » avec des fleurs : Hoppy (image officielle détourée) tient un bouquet, pétales autour.
const IMG_H = 820, K = IMG_H / 1536;
export const HoppyFleurs: React.FC = () => {
  const left = 540 - (1024 * K) / 2, top = 300;
  const hand = { x: left + 850 * K, y: top + 545 * K };      // la main au pouce levé de l'image officielle
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 85% 75% at 50% 45%, #FFF6F1 0%, #FFE3EA 60%, #FFD0DC 100%)', overflow: 'hidden' }}>
      {Array.from({ length: 26 }).map((_, k) => (
        <div key={k} style={{ position: 'absolute', left: random(`px${k}`) * 1040, top: random(`py${k}`) * 1060, fontSize: 34 + random(`ps${k}`) * 40,
          transform: `rotate(${random(`pr${k}`) * 360}deg)`, opacity: 0.35 + random(`po${k}`) * 0.4 }}>{['🌸', '🌷', '🌼', '🌹'][k % 4]}</div>
      ))}
      <div style={{ position: 'absolute', top: 70, left: 30, right: 30, textAlign: 'center' }}>
        <div style={{ font: `700 80px/1.05 ${DISPLAY}`, color: C.navy, whiteSpace: 'nowrap' }}>On livre aussi <span style={{ color: '#E0407A' }}>vos fleurs</span></div>
        <div style={{ font: `700 56px/1.2 Rubik, sans-serif`, color: '#C2185B', marginTop: 14 }} dir="rtl">מביאים גם פרחים 💐</div>
      </div>
      <div style={{ position: 'absolute', left: left + 30, right: 1080 - left - 1024 * K - 30, top: top + IMG_H * 0.9, height: 40, borderRadius: '50%', background: 'rgba(120,40,60,.18)', filter: 'blur(12px)' }} />
      <Img src={staticFile('hoppy-cut.png')} style={{ position: 'absolute', left, top, height: IMG_H }} />
      {/* le bouquet dans sa main */}
      <div style={{ position: 'absolute', left: hand.x - 70, top: hand.y - 150, fontSize: 220, lineHeight: 1, transform: 'rotate(14deg)', filter: 'drop-shadow(0 18px 20px rgba(80,20,40,.3))' }}>💐</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 230, background: C.navy, borderRadius: '60px 60px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ font: `700 46px/1.15 ${DISPLAY}`, color: '#fff', textAlign: 'center', padding: '0 40px' }}>Anniversaire, Chabbat, ou juste pour dire merci.</div>
        <div style={{ font: `700 38px/1.2 Rubik, sans-serif`, color: '#FFB27F' }} dir="rtl">יום הולדת, שבת, או סתם להגיד תודה.</div>
      </div>
      <div style={{ position: 'absolute', right: 50, bottom: 250, padding: '12px 22px', borderRadius: 999, background: C.navy }}><Wordmark width={120} /></div>
    </AbsoluteFill>
  );
};
