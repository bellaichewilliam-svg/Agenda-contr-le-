import React from 'react';
import { Composition, Still } from 'remotion';
import './fonts';
import { Promo, totalFrames } from './Promo';
import { Reel, REEL_FRAMES } from './Reel';
import { Fly, FLY_FPS, FLY_FRAMES } from './Fly';
import { Pay, PAY_FRAMES } from './Pay';
import { Route, ROUTE_FRAMES } from './Route';
import { Cycle, CYCLE_FRAMES } from './Cycle';
import { Grid } from './Grid';
import { Grid2 } from './Grid2';
import { MascotHero, MascotSheet } from './Mascot';
import { HoppyPhoto } from './HoppyPhoto';
import { HoppyFleurs } from './HoppyFleurs';
import { AdoptHop, ADOPT_FRAMES } from './Adopt';
import { Tout, TOUT_FRAMES } from './Tout';

export const Root: React.FC = () => (
  <>
    <Composition id="HopPromo" component={Promo} durationInFrames={totalFrames} fps={30} width={1080} height={1920} defaultProps={{ lang: 'fr' as const, music: true }} />
    <Composition id="HopPromoHe" component={Promo} durationInFrames={totalFrames} fps={30} width={1080} height={1920} defaultProps={{ lang: 'he' as const, music: true }} />
    <Composition id="HopReel" component={Reel} durationInFrames={REEL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopReelHe" component={Reel} durationInFrames={REEL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
    <Composition id="HopFly" component={Fly} durationInFrames={FLY_FRAMES} fps={FLY_FPS} width={1440} height={1152} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopFlyHe" component={Fly} durationInFrames={FLY_FRAMES} fps={FLY_FPS} width={1440} height={1152} defaultProps={{ music: true, lang: 'he' as const }} />
    <Composition id="HopPay" component={Pay} durationInFrames={PAY_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopPayHe" component={Pay} durationInFrames={PAY_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
    <Composition id="HopRoute" component={Route} durationInFrames={ROUTE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopRouteHe" component={Route} durationInFrames={ROUTE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
    <Composition id="HopCycle" component={Cycle} durationInFrames={CYCLE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopCycleHe" component={Cycle} durationInFrames={CYCLE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
    <Composition id="HopAdopt" component={AdoptHop} durationInFrames={ADOPT_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopAdoptHe" component={AdoptHop} durationInFrames={ADOPT_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
    <Composition id="HopTout" component={Tout} durationInFrames={TOUT_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'fr' as const }} />
    <Composition id="HopToutHe" component={Tout} durationInFrames={TOUT_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ music: true, lang: 'he' as const }} />
    <Still id="HopGrid1" component={Grid} width={1080} height={1350} defaultProps={{ tile: 0 }} />
    <Still id="HopGrid2" component={Grid} width={1080} height={1350} defaultProps={{ tile: 1 }} />
    <Still id="HopGrid3" component={Grid} width={1080} height={1350} defaultProps={{ tile: 2 }} />
    <Still id="HopGrid4" component={Grid2} width={1080} height={1350} defaultProps={{ tile: 0 }} />
    <Still id="HopGrid5" component={Grid2} width={1080} height={1350} defaultProps={{ tile: 1 }} />
    <Still id="HopGrid6" component={Grid2} width={1080} height={1350} defaultProps={{ tile: 2 }} />
    <Still id="HoppyHero" component={MascotHero} width={1080} height={1350} />
    <Still id="HoppySheet" component={MascotSheet} width={2160} height={1350} />
    <Still id="HoppyPost" component={HoppyPhoto} width={1080} height={1350} defaultProps={{ story: false }} />
    <Still id="HoppyStory" component={HoppyPhoto} width={1080} height={1920} defaultProps={{ story: true }} />
    <Still id="HoppyFleurs" component={HoppyFleurs} width={1080} height={1350} />
  </>
);
