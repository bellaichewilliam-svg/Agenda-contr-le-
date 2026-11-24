// HOP! — un seul plan-séquence vertical. [t, cible (Vector3 | sujet), dist, az, el, fov, décalage?, {ease}?] et secousses [t, amp, decay].
// az 0 = caméra côté +z, regard vers −z (les cartes se lisent droites) ; el en radians. Champ horizontal ≈ 0,41 × dist (fov 40, 9:16).
import { CREDIT_T, DUR } from './vo.js';
import { T } from './film.js';
const R = { ease: 1 };
export const KEYS = [
  // 1. Gros plan sur le téléphone : la liste s'écrit ; descente qui se pose
  [0.0, 'phone', 1.05, .12, 1.12, 40],
  [2.6, 'phone', .9, .06, 1.02, 40, null, R],
  // 2. Le sac pop ; orbite lente
  [4.0, 'phoneBag', 1.12, .02, .96, 40],
  [7.6, 'phoneBag', 1.14, -.1, .92, 40, null, R],
  // 3. Fouetté qui suit le saut vers le comparateur
  [8.4, 'cmp', 1.3, -.02, 1.05, 40],
  // 4. Presque de dessus : lire trois totaux
  [12.8, 'cmp', 1.24, .03, 1.15, 40, null, R],
  // 5. Poussée sur « Tout ici » ; secousse à l'appui ; les articles sautent dans le sac
  [13.9, 'btn', .82, .05, .92, 40],
  [16.4, 'btn', .86, .14, .88, 40, null, R],
  // 6. Fouetté vers les promos ; glisse latérale pendant que les % montent
  [17.5, 'promo', 1.2, .1, 1.0, 40],
  [21.0, 'promo', 1.16, -.06, 1.04, 40, null, R],
  // 7. La carte micro (Hoppy imprimé) : orbite douce
  [22.1, 'voice', 1.08, -.1, .98, 40],
  [25.8, 'voice', 1.02, .08, 1.02, 40, null, R],
  // 8. On livre tout : les tuiles sautent
  [26.7, 'serv', 1.12, .06, 1.02, 40],
  [30.0, 'serv', 1.08, -.04, 1.06, 40, null, R],
  // 9. Bas, derrière le scooter : il roule sur la carte de suivi
  [31.0, 'track', 1.2, -.05, .95, 40],
  [31.8, 'scoot', .78, .05, .6, 40],
  [35.3, 'scoot', .8, -.08, .66, 40],
  // 10. « Livré », recul rapide sur tout le bureau, puis on se pose sur la carte-titre qui tombe à côté du téléphone
  [36.5, 'track', 1.25, .02, 1.05, 40, null, R],
  [37.7, 'final', 3.4, .02, 1.12, 40],
  [38.7, 'titleC', 1.65, .04, 1.05, 40],
  [DUR, 'titleC', 1.55, .1, 1.08, 40],
];
export const SHAKES = [[T.bagPop, .002, 10], [T.press, .006, 8], [T.delivered, .003, 9], [T.title + .25, .005, 8]];
