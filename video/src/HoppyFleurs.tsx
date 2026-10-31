import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { C, DISPLAY } from './theme';
import { Wordmark } from './Reel';

// « Mets Hoppy » sur un thème : Hoppy (image officielle détourée) tient l'objet du thème, décor autour.
type Theme = { bg: string; deco: string[]; title: [string, string]; accent: string; he: string; heColor: string; foot: [string, string]; hand: React.ReactNode };
const THEMES: Record<'fleurs' | 'courses' | 'magasins', Theme> = {
  fleurs: { bg: 'radial-gradient(ellipse 85% 75% at 50% 45%, #FFF6F1 0%, #FFE3EA 60%, #FFD0DC 100%)', deco: ['🌸', '🌷', '🌼', '🌹'],
    title: ['On livre aussi ', 'vos fleurs'], accent: '#E0407A', he: 'מביאים גם פרחים 💐', heColor: '#C2185B',
    foot: ['Anniversaire, Chabbat, ou juste pour dire merci.', 'יום הולדת, שבת, או סתם להגיד תודה.'],
    hand: <div style={{ fontSize: 220, lineHeight: 1, transform: 'rotate(14deg)', filter: 'drop-shadow(0 18px 20px rgba(80,20,40,.3))' }}>💐</div> },
  courses: { bg: 'radial-gradient(ellipse 85% 75% at 50% 45%, #F6FFF8 0%, #DDF6E6 60%, #C6EED5 100%)', deco: ['🥖', '🍎', '🥛', '🧀', '🍅', '🥑', '🥚', '🍋'],
    title: ['On fait ', 'vos courses'], accent: '#12A35A', he: 'עושים לכם את הקניות 🛒', heColor: '#067647',
    foot: ['Supermarché, épicerie, pharmacie…\non y va à votre place.', 'סופר, מכולת, פארם… במקומכם.'],
    hand: <div style={{ position: 'relative', width: 240, height: 240, transform: 'rotate(10deg)', filter: 'drop-shadow(0 18px 20px rgba(20,60,30,.3))' }}>
      <span style={{ position: 'absolute', left: 30, top: -20, fontSize: 110, transform: 'rotate(-25deg)' }}>🥖</span>
      <span style={{ position: 'absolute', left: 105, top: 10, fontSize: 90 }}>🥬</span>
      <span style={{ position: 'absolute', left: 70, top: 40, fontSize: 80 }}>🍎</span>
      <span style={{ position: 'absolute', left: 10, top: 50, fontSize: 200, lineHeight: 1 }}>🧺</span>
    </div> },
  magasins: { bg: 'radial-gradient(ellipse 85% 75% at 50% 45%, #F7F5FF 0%, #E6E0FF 60%, #D6CCFF 100%)', deco: ['🛍️', '👟', '👕', '🎁', '🕶️', '👜', '💄', '🧢'],
    title: ['On va dans\n', 'vos magasins préférés'], accent: '#6D4AFF', he: 'הולכים בשבילכם לחנויות שאתם אוהבים 🛍️', heColor: '#4B2FD1',
    foot: ['Vêtements, chaussures, cadeaux, déco…\non vous les rapporte.', 'בגדים, נעליים, מתנות, עיצוב… ואנחנו מביאים.'],
    hand: <div style={{ fontSize: 230, lineHeight: 1, transform: 'rotate(10deg)', filter: 'drop-shadow(0 18px 20px rgba(40,20,90,.3))' }}>🛍️</div> },
};
export const HoppyFleurs: React.FC<{ theme?: 'fleurs' | 'courses' | 'magasins' }> = ({ theme = 'fleurs' }) => {
  const th = THEMES[theme];
  const two = th.title[0].includes('\n');
  const IMG_H = two ? 740 : 820, K = IMG_H / 1536;
  const left = 540 - (1024 * K) / 2, top = two ? 360 : 300;
  const hand = { x: left + 850 * K, y: top + 545 * K };      // la main au pouce levé de l'image officielle
  return (
    <AbsoluteFill style={{ background: th.bg, overflow: 'hidden' }}>
      {Array.from({ length: 26 }).map((_, k) => (
        <div key={k} style={{ position: 'absolute', left: random(`px${k}`) * 1040, top: random(`py${k}`) * 1060, fontSize: 34 + random(`ps${k}`) * 40,
          transform: `rotate(${random(`pr${k}`) * 360}deg)`, opacity: 0.35 + random(`po${k}`) * 0.4 }}>{th.deco[k % th.deco.length]}</div>
      ))}
      <div style={{ position: 'absolute', top: 70, left: 30, right: 30, textAlign: 'center' }}>
        <div style={{ font: `700 ${two ? 76 : 80}px/1.05 ${DISPLAY}`, color: C.navy, whiteSpace: two ? 'pre-line' : 'nowrap' }}>{th.title[0]}<span style={{ color: th.accent }}>{th.title[1]}</span></div>
        <div style={{ font: `700 ${two ? 48 : 56}px/1.2 Rubik, sans-serif`, color: th.heColor, marginTop: 14 }} dir="rtl">{th.he}</div>
      </div>
      <div style={{ position: 'absolute', left: left + 30, right: 1080 - left - 1024 * K - 30, top: top + IMG_H * 0.9, height: 40, borderRadius: '50%', background: 'rgba(120,40,60,.18)', filter: 'blur(12px)' }} />
      <Img src={staticFile('hoppy-cut.png')} style={{ position: 'absolute', left, top, height: IMG_H }} />
      {/* le bouquet dans sa main */}
      <div style={{ position: 'absolute', left: hand.x - 70, top: hand.y - 150 }}>{th.hand}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: th.foot[0].includes('\n') ? 270 : 230, background: C.navy, borderRadius: '60px 60px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ font: `700 46px/1.15 ${DISPLAY}`, color: '#fff', textAlign: 'center', padding: '0 40px', whiteSpace: 'pre-line' }}>{th.foot[0]}</div>
        <div style={{ font: `700 38px/1.2 Rubik, sans-serif`, color: '#FFB27F' }} dir="rtl">{th.foot[1]}</div>
      </div>
      <div style={{ position: 'absolute', right: 50, bottom: th.foot[0].includes('\n') ? 290 : 250, padding: '12px 22px', borderRadius: 999, background: C.navy }}><Wordmark width={120} /></div>
    </AbsoluteFill>
  );
};
