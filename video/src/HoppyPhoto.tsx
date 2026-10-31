import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { C, DISPLAY } from './theme';
import { Wordmark } from './Reel';

// Hoppy officiel (image de référence public/hoppy.png, fond #FCFBF9) : présentation en post 4:5 et en story 9:16.
const BG = '#FCFBF9';
export const HoppyPhoto: React.FC<{ story?: boolean }> = ({ story = false }) => {
  const H = story ? 1920 : 1350;
  const imgH = story ? 1300 : 900;
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      {/* halo orange doux derrière Hoppy */}
      <div style={{ position: 'absolute', left: 540 - 420, top: (story ? 380 : 230) + imgH * 0.18, width: 840, height: 840, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,106,19,.16), rgba(255,106,19,0) 68%)' }} />
      <div style={{ position: 'absolute', top: story ? 150 : 70, left: 40, right: 40, textAlign: 'center' }}>
        <div style={{ font: `700 ${story ? 110 : 92}px/1.02 ${DISPLAY}`, color: C.navy }}>Voici <span style={{ color: C.orange }}>Hoppy</span> !</div>
        <div style={{ font: `700 ${story ? 64 : 54}px/1.2 Rubik, sans-serif`, color: C.orangeDeep, marginTop: 12 }} dir="rtl">תכירו את הופי!</div>
      </div>
      <Img src={staticFile('hoppy-cut.png')} style={{ position: 'absolute', left: 540 - (imgH * 1024 / 1536) / 2, top: story ? 360 : 225, height: imgH }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: story ? 330 : 230, background: C.navy, borderRadius: '60px 60px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ font: `700 ${story ? 58 : 50}px/1.15 ${DISPLAY}`, color: '#fff', textAlign: 'center' }}>Il livre tout Netanya… dans sa poche.</div>
        <div style={{ font: `700 ${story ? 46 : 40}px/1.2 Rubik, sans-serif`, color: '#FFB27F' }} dir="rtl">מביא את כל נתניה… בכיס.</div>
        {story && <div style={{ marginTop: 18 }}><Wordmark width={260} /></div>}
      </div>
      {!story && <div style={{ position: 'absolute', right: 50, top: H - 230 - 70, padding: '12px 22px', borderRadius: 999, background: C.navy }}><Wordmark width={120} /></div>}
    </AbsoluteFill>
  );
};
