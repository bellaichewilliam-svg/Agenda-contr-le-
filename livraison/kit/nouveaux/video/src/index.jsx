// Vidéo « Nouveaux partenaires » (story 1080×1920, 15 s) : le logo HOP!, les enseignes qui arrivent une à une
// avec leur logo (et le sceau Casher), le scooter qui passe, puis le prix et le lien de l'appli.
// Les logos et les enseignes viennent de ../generer.js (public/logos, props.json).
import React from "react";
import { registerRoot, Composition, AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import data from "../props.json";

const T = {
  fr: { kicker: "✨ Nouveau sur HOP!", h1a: "On vous livre", h1b: "vos adresses préférées", more: "+ des centaines d'autres enseignes à Netanya",
    cta: "Commandez sur l'appli", price: "Livraison dans Netanya", kosher: "Casher", url: "hop-livraison.vercel.app", tag: "Et hop, c'est livré !" },
  he: { kicker: "✨ חדש בהופ!", h1a: "עכשיו מביאים לכם", h1b: "את המקומות שאתם אוהבים", more: "+ ועוד מאות עסקים בנתניה",
    cta: "מזמינים באפליקציה", price: "משלוח בתוך נתניה", kosher: "כשר", url: "hop-livraison.vercel.app", tag: "הופ, וזה אצלך!" }
};
const NAVY = "#0F1F3D", ORANGE = "#FF6A13";
const FONTS = `
@font-face{font-family:Fredoka;font-weight:700;src:url(${staticFile("fonts/fredoka-latin-700.woff2")}) format("woff2");unicode-range:U+0000-024F,U+20AA,U+2013-2019,U+00B7}
@font-face{font-family:Fredoka;font-weight:700;src:url(${staticFile("fonts/fredoka-hebrew-700.woff2")}) format("woff2");unicode-range:U+0590-05FF}
@font-face{font-family:Rubik;font-weight:700;src:url(${staticFile("fonts/rubik-latin-700.woff2")}) format("woff2");unicode-range:U+0000-024F,U+20AA,U+2013-2019,U+00B7}
@font-face{font-family:Rubik;font-weight:700;src:url(${staticFile("fonts/rubik-hebrew-700.woff2")}) format("woff2");unicode-range:U+0590-05FF}`;

const Star = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ background: "#fff", color: "#1D4ED8", borderRadius: "50%", padding: size * 0.16, boxSizing: "border-box", display: "block" }}>
    <path d="M12 3.2l7.6 13.2H4.4zM12 20.8L4.4 7.6h15.2z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

const Card = ({ p, lang, delay, w, lh, fs }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 12, mass: 0.7 } });
  const t = T[lang];
  return (
    <div style={{ width: w, background: "#fff", borderRadius: 36, padding: "24px 14px 22px", display: "flex", flexDirection: "column", alignItems: "center",
      gap: 10, position: "relative", boxShadow: "0 24px 50px rgba(0,0,0,.35)", transform: `scale(${s}) translateY(${(1 - s) * 80}px)`, opacity: Math.min(1, s * 1.4) }}>
      {p.kosher ? (
        <div style={{ position: "absolute", top: -18, [lang === "he" ? "left" : "right"]: -12, display: "flex", alignItems: "center", gap: 8,
          padding: lang === "he" ? "6px 6px 6px 18px" : "6px 18px 6px 6px", borderRadius: 99, background: "linear-gradient(135deg,#1E3A8A,#1D4ED8 55%,#3B82F6)",
          color: "#fff", fontFamily: "Rubik", fontWeight: 700, fontSize: 26, border: "4px solid #fff", boxShadow: "0 8px 20px rgba(29,78,216,.45)" }}>
          <Star size={34} />{t.kosher}
        </div>
      ) : null}
      <div style={{ width: "100%", height: lh, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {p.logoFile ? <Img src={staticFile("logos/" + p.logoFile)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : null}
      </div>
      <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: fs, color: NAVY, textAlign: "center", lineHeight: 1.05 }}>{p.name[lang]}</div>
      <div style={{ fontFamily: "Rubik", fontWeight: 700, fontSize: Math.round(fs * 0.62), color: "#667085", textAlign: "center", lineHeight: 1.15 }}>{p.label[lang]}</div>
    </div>
  );
};

const Nouveaux = ({ lang }) => {
  const f = useCurrentFrame(), { fps, durationInFrames } = useVideoConfig();
  const t = T[lang], he = lang === "he", list = data.partners || [];
  const logoIn = spring({ frame: f, fps, config: { damping: 10 } });
  const head = spring({ frame: f - 14, fps, config: { damping: 14 } });
  const cardsAt = 40, step = 22, cardsEnd = cardsAt + list.length * step;
  // Le scooter traverse l'écran après les enseignes
  const scootX = interpolate(f, [cardsEnd, cardsEnd + 70], he ? [1200, -420] : [-420, 1200], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const ctaAt = cardsEnd + 50, cta = spring({ frame: f - ctaAt, fps, config: { damping: 13 } });
  const out = interpolate(f, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  // 5 enseignes ou plus : 3 par ligne, sinon 2 (cartes plus grandes)
  const three = list.length > 4, w = three ? 296 : 440, lh = three ? 150 : 170, fs = three ? 33 : 42;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 85% 0%,#2B4C8C 0%,${NAVY} 55%,#0A1630 100%)`, direction: he ? "rtl" : "ltr",
      color: "#fff", fontFamily: "Rubik", padding: "90px 70px", opacity: out }}>
      <style>{FONTS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 24, transform: `scale(${logoIn})`, transformOrigin: he ? "right center" : "left center" }}>
        <Img src={staticFile("logo.svg")} style={{ width: 120, height: 120 }} />
        <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 104, lineHeight: 1 }}>{he ? "הופ" : "HOP"}<span style={{ color: ORANGE, display: "inline-block", transform: "rotate(10deg)" }}>!</span></div>
      </div>
      <div style={{ marginTop: 40, opacity: head, transform: `translateY(${(1 - head) * 40}px)` }}>
        <span style={{ display: "inline-block", background: ORANGE, borderRadius: 99, padding: "14px 34px", fontFamily: "Fredoka", fontWeight: 700, fontSize: 44, boxShadow: "0 12px 34px rgba(255,106,19,.4)" }}>{t.kicker}</span>
        <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 86, lineHeight: 1.04, marginTop: 30 }}>{t.h1a}<br /><span style={{ color: "#FFB27F" }}>{t.h1b}</span></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "40px 22px", marginTop: 50 }}>
        {list.map((p, i) => <Card key={p.code} p={p} lang={lang} delay={cardsAt + i * step} w={w} lh={lh} fs={fs} />)}
      </div>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 34, marginTop: 34, opacity: interpolate(f, [cardsEnd, cardsEnd + 15], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{t.more}</div>
      <Img src={staticFile("scooter.svg")} style={{ position: "absolute", bottom: 360, left: scootX, width: 220, direction: "ltr", transform: he ? "scaleX(-1)" : "none" }} />
      <div style={{ position: "absolute", left: 70, right: 70, bottom: 90, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        transform: `translateY(${(1 - cta) * 260}px)`, opacity: cta }}>
        <div style={{ background: "#fff", color: NAVY, borderRadius: 36, padding: "24px 36px", fontWeight: 700, fontSize: 32 }}>
          <div>{t.price}</div><div style={{ fontFamily: "Fredoka", color: ORANGE, fontSize: 92, lineHeight: 1 }}>25 ₪</div>
        </div>
        <div style={{ textAlign: he ? "left" : "right" }}>
          <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 52, lineHeight: 1.1 }}>{t.cta}</div>
          <div style={{ fontWeight: 700, fontSize: 32, opacity: 0.85, direction: "ltr", marginTop: 8 }}>{t.url}</div>
          <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 38, color: "#FFB27F", marginTop: 10 }}>{t.tag}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition id="Nouveaux" component={Nouveaux} durationInFrames={450} fps={30} width={1080} height={1920} defaultProps={{ lang: "fr" }} />
);
registerRoot(Root);
