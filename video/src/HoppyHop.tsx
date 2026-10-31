import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// « Mets Hoppy » : la mascotte officielle (public/hoppy-cut.png, détourée) arrive en sautant, atterrit avec un
// petit écrasement, rebondit doucement sur place, et peut repartir d'un bond (exitAt) — par ex. pour une vidéo
// qui boucle. Temps en secondes : marche à 30 et 60 i/s. À placer dans une <Sequence> (le temps part de 0).
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const HoppyHop: React.FC<{ x: number; bottom: number; h: number; at?: number; exitAt?: number; from?: 'left' | 'right' }> =
  ({ x, bottom, h, at = 0.25, exitAt, from = 'left' }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const w = (h * 1024) / 1536;
  const dir = from === 'left' ? -1 : 1;
  // Entrée : un grand bond en arc, 0,55 s
  const k = interpolate(t, [at, at + 0.55], [0, 1], clamp);
  const arc = Math.sin(Math.PI * k);
  let dx = dir * (1 - k) * 700, dy = -arc * h * 0.55;
  let rot = dir * -(1 - k) * 14;
  // Atterrissage : écrasement puis retour (0,25 s)
  const land = interpolate(t, [at + 0.55, at + 0.62, at + 0.8], [0, 1, 0], clamp);
  let sx = 1 + 0.07 * land, sy = 1 - 0.09 * land;
  // Ensuite : petits rebonds joyeux sur place
  if (t > at + 0.8) { const b = Math.abs(Math.sin((t - at - 0.8) * 4.2)); dy = -b * h * 0.05; }
  // Sortie : il repart d'un bond (de l'autre côté)
  if (exitAt != null && t > exitAt) {
    const e = interpolate(t, [exitAt, exitAt + 0.5], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    dx = -dir * e * 900; dy = -Math.sin(Math.PI * Math.min(1, e * 0.9)) * h * 0.6; rot = -dir * e * 18; sx = 1; sy = 1;
  }
  const visible = t >= at - 0.02 && !(exitAt != null && t > exitAt + 0.5);
  if (!visible) return null;
  const onGround = 1 - Math.min(1, Math.abs(dy) / (h * 0.4));
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: bottom - h, width: w, height: h, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: h * 0.06, height: h * 0.06, borderRadius: '50%', background: 'rgba(0,0,0,.32)', filter: 'blur(10px)', opacity: onGround * (k >= 1 ? 1 : k), transform: `translateX(${dx}px) scaleX(${0.6 + 0.4 * onGround})` }} />
      <Img src={staticFile('hoppy-cut.png')} style={{ width: w, height: h, transformOrigin: '50% 88%', transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})` }} />
    </div>
  );
};
