import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { TransitionPresentation, TransitionSeries, springTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { iris } from '@remotion/transitions/iris';
import timeline from './timeline.json';
import { Lang, STRINGS, Strings } from './strings';
import { Hook } from './scenes/Hook';
import { Items } from './scenes/Items';
import { Order } from './scenes/Order';
import { Track } from './scenes/Track';
import { Price } from './scenes/Price';
import { Shop } from './scenes/Shop';
import { Rider } from './scenes/Rider';
import { Cta } from './scenes/Cta';

const SCENES: Record<string, React.FC<{ s: Strings }>> = { hook: Hook, items: Items, order: Order, track: Track, price: Price, shop: Shop, rider: Rider, cta: Cta };

export const totalFrames = timeline.scenes.reduce((n, sc) => n + sc.frames, 0) - (timeline.scenes.length - 1) * timeline.transition;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transitionFor = (i: number, rtl: boolean): TransitionPresentation<any> => {
  const side = (a: 'from-left' | 'from-right') => (rtl ? (a === 'from-left' ? 'from-right' : 'from-left') : a);
  switch (i) {
    case 0: return slide({ direction: 'from-bottom' });
    case 1: return wipe({ direction: side('from-left') });
    case 2: return slide({ direction: side('from-right') });
    case 3: return iris({ width: 1080, height: 1920 });
    case 4: return slide({ direction: side('from-left') });
    case 5: return wipe({ direction: 'from-top-left' });
    default: return iris({ width: 1080, height: 1920 });
  }
};

export const Promo: React.FC<{ lang: Lang; music: boolean }> = ({ lang, music }) => {
  const s = STRINGS[lang];
  const timing = springTiming({ config: { damping: 200 }, durationInFrames: timeline.transition });
  return (
    <AbsoluteFill style={{ background: '#0F1F3D' }}>
      <TransitionSeries>
        {timeline.scenes.flatMap((sc, i) => {
          const Scene = SCENES[sc.id];
          const seq = (
            <TransitionSeries.Sequence key={sc.id} durationInFrames={sc.frames}>
              <Scene s={s} />
            </TransitionSeries.Sequence>
          );
          return i === 0 ? [seq] : [<TransitionSeries.Transition key={`t${i}`} presentation={transitionFor(i - 1, s.dir === 'rtl')} timing={timing} />, seq];
        })}
      </TransitionSeries>
      {music && <Audio src={staticFile('hop-music.wav')} />}
    </AbsoluteFill>
  );
};
