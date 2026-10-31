/* ============================================================================
   Badges des livreurs HOP! : écran « Badge débloqué »
   - Médaille or en 3D (une vraie pièce : face, tranche, dos), éclairée selon son inclinaison.
   - Elle s'incline vers le doigt / la souris avec un ressort « critique » : rapide, sans rebond.
   - Entrée en rotation qui ralentit, éclat, puis pluie de particules d'or (canvas).
   Badge.show({ n, name }) ; Badge.MILESTONES ; Badge.reached(count) ; Badge.medal(n, locked)
============================================================================ */
(function () {
  const MILESTONES = [
    { n: 1, tier: "Premier départ", title: "Première course livrée", sub: "Bienvenue dans l'équipe HOP! 🛵" },
    { n: 10, tier: "Rodé", title: "10 courses livrées", sub: "Vous avez pris le rythme." },
    { n: 25, tier: "Fiable", title: "25 courses livrées", sub: "Les clients commencent à vous connaître." },
    { n: 50, tier: "Pilier", title: "50 courses livrées", sub: "Un vrai pilier de HOP!" },
    { n: 100, tier: "Centurion", title: "100 courses livrées", sub: "Cent fois, la commande est arrivée à bon port." },
    { n: 250, tier: "Expert", title: "250 courses livrées", sub: "Netanya n'a plus de secret pour vous." },
    { n: 500, tier: "Légende", title: "500 courses livrées", sub: "Une légende de la route HOP!" },
    { n: 1000, tier: "Mythe", title: "1 000 courses livrées", sub: "Mille livraisons. Chapeau bas." },
  ];
  const reached = count => MILESTONES.filter(m => count >= m.n);
  const fmt = n => String(n);
  const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Petite médaille (liste « Mes badges ») : même dessin, sans 3D
  const medal = (n, locked) => `<span class="bdg-mini${locked ? " locked" : ""}"><span class="bdg-mini-in"><b${n >= 1000 ? ' style="font-size:13px"' : ""}>${fmt(n)}</b></span></span>`;

  // Faces de la pièce
  const face = (m, back) => back
    ? `<div class="bdg-face bdg-back"><div class="bdg-rim"></div><div class="bdg-disc"><span class="bdg-hop">HOP!</span><small>LIVREUR</small></div></div>`
    : `<div class="bdg-face bdg-front"><div class="bdg-rim"></div><div class="bdg-disc">
        <span class="bdg-stars">★ ★ ★</span><b class="bdg-num${m.n >= 1000 ? " long" : ""}">${fmt(m.n)}</b><span class="bdg-unit">${m.n === 1 ? "COURSE" : "COURSES"}</span><span class="bdg-hop sm">HOP!</span>
      </div><div class="bdg-shine"></div></div>`;
  const EDGE = 16;   // nombre de tranches qui font l'épaisseur

  function show(opts) {
    const m = MILESTONES.find(x => x.n === opts.n) || MILESTONES[0];
    const name = String(opts.name || "").trim().split(" ")[0];
    const root = document.createElement("div");
    root.className = "bdg" + (reduce() ? " bdg-still" : "");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Badge débloqué : " + m.title);
    root.innerHTML = `<canvas class="bdg-fx"></canvas>
      <div class="bdg-glow"></div>
      <div class="bdg-wrap">
        <p class="bdg-kicker">BADGE DÉBLOQUÉ</p>
        <div class="bdg-stage"><div class="bdg-flash"></div><div class="bdg-floor"></div>
          <div class="bdg-coin">${face(m, true)}${Array.from({ length: EDGE }, (_, i) => `<div class="bdg-edge" style="--z:${(i - (EDGE - 1) / 2) * 1.1}px"></div>`).join("")}${face(m)}</div>
        </div>
        <p class="bdg-tier">${m.tier}</p>
        <h2 class="bdg-title">${m.title}</h2>
        <p class="bdg-sub">${name ? `Bravo ${name.replace(/[<>&"]/g, "")} ! ` : ""}${m.sub}</p>
        <div class="bdg-btns">
          <button type="button" class="bdg-btn bdg-go" data-bdg="close">Continuer</button>
          <button type="button" class="bdg-btn bdg-share" data-bdg="share">Partager</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const coin = root.querySelector(".bdg-coin"), stage = root.querySelector(".bdg-stage");
    const cv = root.querySelector(".bdg-fx"), ctx = cv.getContext("2d");
    const t0 = performance.now(), still = reduce();
    const ENTER = still ? 0 : 900;   // ms : fin de la rotation d'entrée (le « clac »)

    // --- Inclinaison : ressort amorti critique (ζ = 1) → suit vite, ne rebondit jamais
    const W = 13;                  // pulsation propre (rad/s) : plus grand = plus vif
    const MAX = { x: 20, y: 26 };  // inclinaison maximale (degrés)
    const st = { rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0, touched: 0 };
    const aim = (cx, cy) => {
      const r = stage.getBoundingClientRect();
      const px = Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / (innerWidth / 2)));
      const py = Math.max(-1, Math.min(1, (cy - (r.top + r.height / 2)) / (innerHeight / 2)));
      st.ty = px * MAX.y;          // la face se tourne vers le pointeur
      st.tx = -py * MAX.x;
      st.touched = performance.now();
    };
    const onMove = e => aim(e.clientX, e.clientY);
    const onTouch = e => { const t = e.touches[0]; if (t) aim(t.clientX, t.clientY); };
    const onTilt = e => {
      if (e.gamma == null || performance.now() - st.touched < 1500) return;
      st.ty = Math.max(-1, Math.min(1, e.gamma / 30)) * MAX.y;
      st.tx = -Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)) * MAX.x;
    };
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("touchmove", onTouch, { passive: true });
    addEventListener("deviceorientation", onTilt, { passive: true });

    // --- Particules d'or : éclats (paillettes qui tournent) + étincelles, gravité et frottement de l'air
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size(); addEventListener("resize", size);
    const GOLD = ["#FFE7A3", "#FFD25A", "#F5B014", "#E39B0B", "#FFF6D8"];
    let parts = [];
    const burst = () => {
      const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (let i = 0; i < 150; i++) {
        const a = Math.random() * Math.PI * 2, sp = 380 + Math.random() * 900;
        const spark = i % 3 === 0;
        parts.push({ x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260,
          w: spark ? 2 + Math.random() * 2.5 : 5 + Math.random() * 7, h: 3 + Math.random() * 5, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 14,
          flip: Math.random() * 6.3, vf: 6 + Math.random() * 10, c: GOLD[i % GOLD.length], spark, life: 1.6 + Math.random() * 1.4, age: 0 });
      }
    };
    const drizzle = dt => {   // fine pluie d'or après l'éclat
      if (Math.random() < dt * 22) parts.push({ x: Math.random() * innerWidth, y: -10, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80,
        w: 3 + Math.random() * 4, h: 2 + Math.random() * 3, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 4, flip: Math.random() * 6.3, vf: 3 + Math.random() * 5,
        c: GOLD[(Math.random() * GOLD.length) | 0], spark: false, life: 6, age: 0, slow: true });
    };
    const drawParts = (dt, t) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.age < p.life && p.y < innerHeight + 40);
      for (const p of parts) {
        p.age += dt;
        const drag = p.slow ? 0.6 : 2.6;              // frottement de l'air (s⁻¹)
        p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
        p.vy += (p.slow ? 30 : 900) * dt;             // gravité (px/s²)
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.flip += p.vf * dt;
        const fade = Math.min(1, (p.life - p.age) / 0.6);
        ctx.globalAlpha = Math.max(0, fade);
        if (p.spark) {
          const tw = 0.6 + 0.4 * Math.sin(t / 60 + p.rot * 10);
          ctx.fillStyle = "#FFF3C4"; ctx.shadowColor = "#FFC93C"; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.w * tw, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const sx = Math.cos(p.flip);                // la paillette se retourne : elle s'affine puis brille
          ctx.fillStyle = Math.abs(sx) < 0.35 ? "#FFF6D8" : p.c;
          ctx.fillRect(-p.w / 2 * Math.abs(sx), -p.h / 2, p.w * Math.abs(sx), p.h);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    };

    // --- Boucle
    const outExpo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
    let last = t0, raf = 0, burstDone = false, alive = true;
    const frame = now => {
      if (!alive) return;
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const t = now - t0;
      // Entrée : la pièce arrive en tournant et ralentit (sortie exponentielle : aucun dépassement)
      const k = ENTER ? Math.min(1, t / ENTER) : 1, e = outExpo(k);
      const spin = (1 - e) * -720, scale = 0.35 + 0.65 * e, lift = (1 - e) * -120;
      // Inclinaison vers le pointeur ; sans pointeur, léger balancement
      if (now - st.touched > 2500 && k >= 1) { st.ty = Math.sin(t / 1400) * 9; st.tx = Math.cos(t / 1900) * 5; }
      const ax = W * W * (st.tx - st.rx) - 2 * W * st.vx, ay = W * W * (st.ty - st.ry) - 2 * W * st.vy;
      st.vx += ax * dt; st.vy += ay * dt; st.rx += st.vx * dt; st.ry += st.vy * dt;
      const rx = st.rx * e, ry = st.ry * e + spin;
      coin.style.transform = `translateY(${lift}px) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      // Lumière : le reflet glisse sur la face selon l'angle ; l'ombre au sol part à l'opposé
      root.style.setProperty("--gx", (50 + st.ry * 2.2).toFixed(1) + "%");
      root.style.setProperty("--gy", (40 - st.rx * 2.2).toFixed(1) + "%");
      root.style.setProperty("--sx", (-st.ry * 0.9).toFixed(1) + "px");
      root.style.setProperty("--ang", (115 + st.ry * 2.5).toFixed(1) + "deg");
      if (!burstDone && t >= ENTER) {
        burstDone = true; root.classList.add("bdg-hit");
        if (!still) burst();
        try { navigator.vibrate && navigator.vibrate([18, 40, 26]); } catch (_) { /* rien */ }
      }
      if (!still && burstDone && t < ENTER + 5000) drizzle(dt);
      if (!still) drawParts(dt, t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    requestAnimationFrame(() => root.classList.add("in"));

    const close = () => {
      if (!alive) return;
      root.classList.add("out");
      removeEventListener("pointermove", onMove); removeEventListener("touchmove", onTouch);
      removeEventListener("deviceorientation", onTilt); removeEventListener("resize", size);
      setTimeout(() => { alive = false; cancelAnimationFrame(raf); root.remove(); opts.onClose && opts.onClose(); }, 260);
    };
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-bdg]");
      if (!b) return;
      if (b.dataset.bdg === "close") return close();
      const url = location.origin + location.pathname.replace(/[^/]*$/, "") + "coursier.html";
      const text = `🏅 Badge HOP! débloqué : ${m.title} ! Livreur à Netanya ? Rejoignez l'équipe : ${url}`;
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
    const onKey = e => { if (e.key === "Escape") { removeEventListener("keydown", onKey); close(); } };
    addEventListener("keydown", onKey);
    return { close };
  }

  window.Badge = { MILESTONES, reached, show, medal, fmt };
})();
