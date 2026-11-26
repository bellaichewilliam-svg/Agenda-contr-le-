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
  const css = `.prices .grid3{display:grid;gap:12px}@media(min-width:900px){.prices .grid3{grid-template-columns:repeat(3,1fr);align-items:stretch;gap:14px}}
    .plan{position:relative;margin:0;padding:22px 20px}.plan.best{border:2px solid var(--navy)}.plan .pname{display:inline-block;font-weight:700;font-size:15px;padding:4px 12px;border-radius:999px;background:var(--p-blue);color:var(--navy)}
    .plan:nth-child(1) .pname{background:var(--p-yellow);color:#7A5300}.plan:nth-child(3) .pname{background:var(--p-violet);color:#5B2A86}
    .plan .price{font-weight:800;font-size:42px;line-height:1;margin:16px 0 4px;letter-spacing:-1px}.plan .price small{font-size:16px;font-weight:500;color:var(--muted);letter-spacing:0}
    .plan ul{margin:14px 0 0;padding:0;list-style:none}.plan li{padding:8px 0 8px 28px;position:relative;border-top:1px solid var(--line);font-size:15px}[dir=rtl] .plan li{padding:8px 28px 8px 0}
    .plan li:first-child{border-top:0}.plan li::before{content:"";position:absolute;inset-inline-start:0;top:12px;width:18px;height:18px;border-radius:50%;background:var(--p-green) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2314532D' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 12.5l4 4L18 8'/%3E%3C/svg%3E") center/12px no-repeat}
    .plan .reco{position:absolute;top:-12px;inset-inline-end:16px;background:var(--navy);color:#fff;font-weight:700;font-size:13px;padding:3px 12px;border-radius:999px}
    .prices .pfoot{display:grid;gap:6px;margin-top:12px}.prices .pfoot div{display:flex;gap:8px;align-items:flex-start;color:var(--muted);font-size:15px}`;
  function render(app) {
    const L = document.documentElement.lang === "he" ? "he" : "fr", t = T[L];
    const sec = document.createElement("section");
    sec.className = "prices sec";
    sec.innerHTML = `<div class="sec-h"><h2 class="h3s">${esc(t.t)}</h2><p>${esc(t.s)}</p></div>
      <div class="grid3">${t.plans.map(([n, p, c, f], i) => `<div class="box plan${i === 1 ? " best" : ""}">${i === 1 ? `<span class="reco">${esc(t.reco)}</span>` : ""}
        <span class="pname ${c}">${esc(n)}</span>
        <div class="price"><bdi dir="ltr">${p} ₪</bdi> <small>${esc(t.m)}</small></div>
        <ul>${f.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
      <div class="box soft pfoot">${t.foot.map(x => `<div>${esc(x)}</div>`).join("")}</div>`;
    const slot = app.querySelector("#prix");
    if (slot) slot.appendChild(sec); else app.insertBefore(sec, app.querySelector(".foot") || null);
  }
  function boot() {
    const app = document.getElementById("app");
    if (!app) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const ensure = () => { if (app.querySelector("#fonctions") && !app.querySelector(".prices")) render(app); };
    new MutationObserver(ensure).observe(app, { childList: true });
    ensure();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
