import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Promo, totalFrames } from './Promo';
import { Reel, REEL_FRAMES } from './Reel';

export const Root: React.FC = () => (
  <>
    <Composition id="HopPromo" component={Promo} durationInFrames={totalFrames} fps={30} width={1080} height={1920} defaultProps={{ lang: 'fr' as const, music: true }} />
    <Composition id="HopPromoHe" component={Promo} durationInFrames={totalFrames} fps={30} width={1080} height={1920} defaultProps={{ lang: 'he' as const, music: true }} />
    <Composition id="HopReel" component={Reel} durationInFrames={REEL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopReelHe" component={Reel} durationInFrames={REEL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
  </>
);
