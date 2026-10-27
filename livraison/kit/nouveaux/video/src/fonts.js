// Polices du kit (copiées dans public/fonts par ../generer.js), communes aux vidéos
import { staticFile } from "remotion";
export const FONTS = `
@font-face{font-family:Fredoka;font-weight:700;src:url(${staticFile("fonts/fredoka-latin-700.woff2")}) format("woff2");unicode-range:U+0000-024F,U+20AA,U+2013-2019,U+00B7}
@font-face{font-family:Fredoka;font-weight:700;src:url(${staticFile("fonts/fredoka-hebrew-700.woff2")}) format("woff2");unicode-range:U+0590-05FF}
@font-face{font-family:Rubik;font-weight:700;src:url(${staticFile("fonts/rubik-latin-700.woff2")}) format("woff2");unicode-range:U+0000-024F,U+20AA,U+2013-2019,U+00B7}
@font-face{font-family:Rubik;font-weight:700;src:url(${staticFile("fonts/rubik-hebrew-700.woff2")}) format("woff2");unicode-range:U+0590-05FF}`;
