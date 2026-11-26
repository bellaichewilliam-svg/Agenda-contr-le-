// Les formules (validées par le patron le 26/11/2026) : Essentiel 79 ₪, Pro 129 ₪, Plusieurs boutiques 199 ₪ par mois,
// sans engagement, 1er mois offert, mise en place offerte, chevalet de comptoir en option 49 ₪. Prix hors TVA.
// Ajouté sous l'accueil (index.html) ; se remet tout seul si la page est redessinée (changement de langue).
(() => {
  const T = {
    fr: { t: "Les formules", tag: "formules", s: "Sans engagement · 1er mois offert · prix hors TVA", m: "/ mois", reco: "Recommandé", go: "Commencer : 1er mois offert",
      plans: [
        ["Essentiel", 79, "t-sun", ["Votre carte à votre nom, vos couleurs, votre logo", "Les tampons et le cadeau", "Le QR code au comptoir + l'affiche à imprimer", "Notifications « tampon » et « cadeau prêt »", "Les statistiques"]],
        ["Pro", 129, "t-orange", ["Tout l'Essentiel, plus :", "Relance automatique des clients absents", "Cadeau d'anniversaire envoyé tout seul", "Message à tous vos clients", "Rappel quand le client passe devant", "Parrainage et lien avis Google"]],
        ["Plusieurs boutiques", 199, "t-lilac", ["La formule Pro", "Pour 2 à 3 adresses", "Une carte par boutique, chacune à ses couleurs"]]],
      foot: ["Mise en place offerte : on crée votre carte avec vous, en 2 minutes.", "Chevalet de comptoir avec votre QR code : 49 ₪ (en option)."] },
    he: { t: "המסלולים", tag: "המסלולים", s: "בלי התחייבות · חודש ראשון חינם · המחירים לפני מע״מ", m: "לחודש", reco: "מומלץ", go: "להתחיל: חודש ראשון חינם",
      plans: [
        ["בסיסי", 79, "t-sun", ["כרטיס על שמכם, בצבעים ועם הלוגו שלכם", "חותמות ומתנה", "קוד QR לדלפק + שלט להדפסה", "התראות «חותמת» ו«מתנה מוכנה»", "סטטיסטיקות"]],
        ["פרו", 129, "t-orange", ["כל מה שבבסיסי, ועוד:", "תזכורת אוטומטית ללקוחות שלא חוזרים", "מתנת יום הולדת שנשלחת לבד", "הודעה לכל הלקוחות", "תזכורת כשהלקוח עובר ליד", "חבר מביא חבר וקישור לביקורות בגוגל"]],
        ["כמה סניפים", 199, "t-lilac", ["מסלול פרו", "ל-2 עד 3 כתובות", "כרטיס לכל סניף, כל אחד בצבעים שלו"]]],
      foot: ["ההקמה עלינו: יוצרים איתכם את הכרטיס תוך 2 דקות.", "מעמד לדלפק עם קוד ה-QR שלכם: 49 ₪ (אופציונלי)."] }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = `.prices{margin-top:34px}.prices .grid3{display:grid;gap:16px}@media(min-width:900px){.prices .grid3{grid-template-columns:repeat(3,1fr);align-items:start}}
    .plan{position:relative}.plan.best{transform:rotate(-1deg)}.plan .pname{display:inline-block;font-weight:700;font-size:20px;padding:2px 14px;border:2.5px solid var(--ink);border-radius:999px;box-shadow:2px 2px 0 var(--ink)}
    .plan .price{font-weight:700;font-size:46px;line-height:1;margin:14px 0 4px}.plan .price small{font-size:17px;font-weight:600;color:var(--muted)}
    .plan ul{margin:12px 0 0;padding:0;list-style:none}.plan li{padding:7px 0 7px 30px;position:relative;border-top:2px dashed #EFE3D6;font-size:16px}[dir=rtl] .plan li{padding:7px 30px 7px 0}
    .plan li:first-child{border-top:0}.plan li::before{content:"";position:absolute;inset-inline-start:2px;top:11px;width:18px;height:18px;border-radius:50%;background:var(--green);border:2px solid var(--ink)}
    .plan .reco{position:absolute;top:-14px;inset-inline-end:16px;background:var(--ink);color:#fff;font-weight:700;font-size:14px;padding:4px 12px;border-radius:999px;box-shadow:2px 2px 0 var(--orange)}`;
  function render(app) {
    const L = document.documentElement.lang === "he" ? "he" : "fr", t = T[L];
    const sec = document.createElement("section");
    sec.className = "prices";
    sec.innerHTML = `<h2 class="h1" style="font-size:30px">${L === "he" ? `<span class="tag t-green">${esc(t.tag)}</span>` : `Les <span class="tag t-green">${esc(t.tag)}</span>`}</h2>
      <p class="sub">${esc(t.s)}</p>
      <div class="grid3">${t.plans.map(([n, p, c, f], i) => `<div class="box plan${i === 1 ? " best" : ""}">${i === 1 ? `<span class="reco">${esc(t.reco)}</span>` : ""}
        <span class="pname ${c}">${esc(n)}</span>
        <div class="price"><bdi dir="ltr">${p} ₪</bdi> <small>${esc(t.m)}</small></div>
        <ul>${f.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
      <div class="box soft">${t.foot.map(x => `<div style="margin:4px 0">${esc(x)}</div>`).join("")}</div>
      <a class="btn orange big" href="pro.html">${esc(t.go)}</a>`;
    const foot = app.querySelector(".foot");
    app.insertBefore(sec, foot || null);
  }
  function boot() {
    const app = document.getElementById("app");
    if (!app) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const ensure = () => { if (app.querySelector(".grid2") && !app.querySelector(".prices")) render(app); };
    new MutationObserver(ensure).observe(app, { childList: true });
    ensure();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
