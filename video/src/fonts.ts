import { continueRender, delayRender } from 'remotion';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';

// Le rendu attend que les polices (latin + hébreu) soient chargées
const handle = delayRender('Polices');
const sample = 'Aé₪0 הופ';
Promise.all([
  '600 80px Fredoka', '700 80px Fredoka',
  '400 80px Rubik', '500 80px Rubik', '700 80px Rubik', '800 80px Rubik',
].map(f => document.fonts.load(f, sample)))
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
