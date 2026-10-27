// Vidéo « On fait toutes vos courses » (story 1080×1920, 15 s) : les catégories de l'appli arrivent une à une,
// un doigt touche « Pharmacie », la liste s'écrit toute seule, le scooter part livrer, puis le prix et le lien
// « Ce qu'on livre ». Illustrations : public/items (copie de img/items), comme dans l'appli.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";

const NAVY = "#0F1F3D", ORANGE = "#FF6A13";
const T = {
  fr: { kicker: "🛒 J'achète pour vous", h1a: "On fait", h1b: "toutes vos courses", steps: ["Touchez une catégorie", "Écrivez ce qu'il vous faut", "On achète et on livre"],
    list: "Acamol 500 ×2, crème Avène, 2 bouteilles d'eau", listLabel: "📝 Votre commande", go: "🛵 Le livreur y va !", price: "Achat + livraison dans Netanya",
    cta: "Voir tout ce qu'on livre", url: "hop-livraison.vercel.app/on-livre.html", tag: "Et hop, c'est livré !",
    cats: ["Supérette", "Pharmacie", "Boulangerie", "Restaurants", "Colis à la poste", "Pressing", "Fleurs & cadeaux", "Bébé & enfants", "Animaux"] },
  he: { kicker: "🛒 קונים בשבילכם", h1a: "אנחנו עושים", h1b: "את כל הקניות", steps: ["בוחרים קטגוריה", "כותבים מה צריך", "קונים ומביאים לכם"],
    list: "אקמול 500 ×2, קרם אוון, 2 בקבוקי מים", listLabel: "📝 ההזמנה שלכם", go: "🛵 השליח בדרך!", price: "קנייה + משלוח בתוך נתניה",
    cta: "כל מה שאנחנו מביאים", url: "hop-livraison.vercel.app/on-livre.html", tag: "הופ, וזה אצלך!",
    cats: ["מכולת", "בית מרקחת", "מאפייה", "מסעדות", "חבילה בדואר", "ניקוי יבש", "פרחים ומתנות", "תינוקות וילדים", "חיות מחמד"] }
};
const ART = [["cart", 140], ["pill", 160], ["croissant", 38], ["burger", 25], ["mailbox", 205], ["basket", 35], ["flowers", 330], ["baby", 280], ["dog", 30]];
const TAP = 1; // la case touchée : Pharmacie
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

export const Courses = ({ lang }) => {
  const f = useCurrentFrame(), { fps, durationInFrames } = useVideoConfig();
  const t = T[lang], he = lang === "he";
  const logoIn = spring({ frame: f, fps, config: { damping: 10 } });
  const head = spring({ frame: f - 12, fps, config: { damping: 14 } });
  // Temps forts (en images, 30 par seconde)
  const gridAt = 34, step = 7, tapAt = 130, listAt = 160, goAt = 250, ctaAt = 330;
  const stepOn = f < listAt ? 0 : f < goAt ? 1 : 2;
  // Le doigt arrive sur la case, appuie, la case s'allume
  const fingerIn = interpolate(f, [tapAt - 30, tapAt], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const press = interpolate(f, [tapAt, tapAt + 5, tapAt + 11], [1, 0.9, 1], clamp);
  const lit = f >= tapAt + 4;
  // La liste s'écrit lettre par lettre
  const sheet = spring({ frame: f - listAt, fps, config: { damping: 15 } });
  const typed = t.list.slice(0, Math.max(0, Math.floor((f - listAt - 12) * 1.1)));
  // Le scooter traverse, puis le prix et le lien montent
  const scootX = interpolate(f, [goAt, goAt + 70], he ? [1200, -480] : [-480, 1200], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const cta = spring({ frame: f - ctaAt, fps, config: { damping: 13 } });
  // À la fin, la grille rapetisse et reste au-dessus du prix (la carte de commande s'efface)
  const shrink = interpolate(f, [ctaAt - 24, ctaAt + 6], [1, 0.66], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sheetOut = interpolate(f, [ctaAt - 30, ctaAt - 14], [1, 0], clamp);
  const out = interpolate(f, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const W = 296;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 85% 0%,#2B4C8C 0%,${NAVY} 55%,#0A1630 100%)`, direction: he ? "rtl" : "ltr",
      color: "#fff", fontFamily: "Rubik", padding: "90px 70px", opacity: out }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, transform: `scale(${logoIn})`, transformOrigin: he ? "right center" : "left center" }}>
          <Img src={staticFile("logo.svg")} style={{ width: 110, height: 110 }} />
          <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 96, lineHeight: 1 }}>{he ? "הופ" : "HOP"}<span style={{ color: ORANGE, display: "inline-block", transform: "rotate(10deg)" }}>!</span></div>
        </div>
        <span style={{ background: ORANGE, borderRadius: 99, padding: "12px 28px", fontFamily: "Fredoka", fontWeight: 700, fontSize: 38, opacity: head, boxShadow: "0 12px 34px rgba(255,106,19,.4)" }}>{t.kicker}</span>
      </div>
      <div style={{ marginTop: 34, opacity: head, transform: `translateY(${(1 - head) * 40}px)`, fontFamily: "Fredoka", fontWeight: 700, fontSize: 104, lineHeight: 1.02 }}>
        {t.h1a}<br /><span style={{ color: ORANGE }}>{t.h1b}</span>
      </div>
      {/* Les 3 étapes : celle en cours s'allume */}
      <div style={{ display: "flex", gap: 12, marginTop: 30, opacity: head }}>
        {t.steps.map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 24, fontWeight: 700, fontSize: 26, lineHeight: 1.15,
            background: i === stepOn ? "#fff" : "rgba(255,255,255,.1)", color: i === stepOn ? NAVY : "#fff", border: "2px solid rgba(255,255,255,.16)", transition: "none" }}>
            <span style={{ flex: "none", width: 44, height: 44, borderRadius: 22, background: ORANGE, color: "#fff", display: "grid", placeItems: "center", fontFamily: "Fredoka" }}>{i + 1}</span>{s}
          </div>))}
      </div>
      {/* La grille des catégories */}
      <div style={{ position: "relative", marginTop: 40, display: "grid", gridTemplateColumns: `repeat(3,${W}px)`, gap: 22, justifyContent: "center", transform: `scale(${shrink})`, transformOrigin: "top center" }}>
        {ART.map(([img, h], i) => {
          const s = spring({ frame: f - gridAt - i * step, fps, config: { damping: 11, mass: 0.6 } });
          const on = i === TAP && lit;
          return (
            <div key={img} style={{ height: 250, background: "#fff", borderRadius: 34, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
              color: NAVY, boxShadow: on ? `0 0 0 8px ${ORANGE}, 0 20px 40px rgba(0,0,0,.35)` : "0 16px 34px rgba(0,0,0,.3)",
              transform: `scale(${s * (i === TAP ? press : 1) * (on ? 1.04 : 1)})`, opacity: Math.min(1, s * 1.4) }}>
              <div style={{ width: 150, height: 150, borderRadius: 30, display: "grid", placeItems: "center",
                background: `radial-gradient(circle at 30% 25%,hsl(${h} 100% 97%),hsl(${h} 85% 84%) 70%)` }}>
                <Img src={staticFile(`items/${img}.webp`)} style={{ width: 120, height: 120, objectFit: "contain", transform: `rotate(${(1 - s) * -20}deg)` }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 30, textAlign: "center", lineHeight: 1.1 }}>{t.cats[i]}</div>
            </div>);
        })}
        <div style={{ position: "absolute", top: 160 + (1 - fingerIn) * 500, [he ? "left" : "right"]: 300 - (1 - fingerIn) * 260, fontSize: 110,
          opacity: fingerIn * (f < listAt + 10 ? 1 : 0), transform: `scale(${press})`, filter: "drop-shadow(0 8px 10px rgba(0,0,0,.4))" }}>👆</div>
        {/* La commande s'écrit */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, margin: "0 10px", background: "#fff", color: NAVY, borderRadius: 36, padding: "30px 34px",
          boxShadow: "0 30px 60px rgba(0,0,0,.45)", transform: `translateY(${(1 - sheet) * 900}px)`, opacity: f >= listAt ? sheetOut : 0 }}>
          <div style={{ fontWeight: 800, fontSize: 34, color: "#667085" }}>{t.listLabel}</div>
          <div style={{ marginTop: 16, minHeight: 170, border: `4px solid ${ORANGE}`, borderRadius: 24, padding: "20px 24px", fontWeight: 700, fontSize: 42, lineHeight: 1.3 }}>
            {typed}<span style={{ opacity: Math.floor(f / 8) % 2 ? 1 : 0, color: ORANGE }}>|</span>
          </div>
          <div style={{ marginTop: 18, background: ORANGE, color: "#fff", borderRadius: 26, padding: "20px 0", textAlign: "center", fontFamily: "Fredoka", fontWeight: 700, fontSize: 46,
            transform: `scale(${f >= goAt - 14 ? interpolate(f, [goAt - 14, goAt - 9, goAt - 4], [1, 0.92, 1], clamp) : 1})` }}>{t.go}</div>
        </div>
      </div>
      <Img src={staticFile("scooter.svg")} style={{ position: "absolute", top: 1560, left: scootX, width: 380, direction: "ltr", transform: he ? "scaleX(-1)" : "none" }} />
      {/* Le prix et le lien */}
      <div style={{ position: "absolute", left: 70, right: 70, bottom: 110, display: "grid", gap: 26, transform: `translateY(${(1 - cta) * 700}px)`, opacity: cta }}>
        <div style={{ background: "#fff", color: NAVY, borderRadius: 40, padding: "30px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.15 }}>{t.price}</div>
          <div style={{ fontFamily: "Fredoka", fontWeight: 700, color: ORANGE, fontSize: 120, lineHeight: 1, whiteSpace: "nowrap" }}>30 ₪</div>
        </div>
        <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 66, lineHeight: 1.1 }}>👉 {t.cta}</div>
        <div style={{ fontWeight: 700, fontSize: 36, opacity: 0.85, direction: "ltr", textAlign: he ? "right" : "left" }}>{t.url}</div>
        <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 48, color: "#FFB27F" }}>{t.tag}</div>
      </div>
    </AbsoluteFill>
  );
};
