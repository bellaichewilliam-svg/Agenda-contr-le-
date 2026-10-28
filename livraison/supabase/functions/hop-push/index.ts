// HOP! : notifications « push » (elles arrivent même quand l'application est fermée).
// Appelée par la base (déclencheurs sur les commandes et la messagerie, voir supabase-schema.sql,
// section NOTIFICATIONS PUSH) avec la clé x-hop-key. Les clés VAPID et la clé d'appel sont dans
// la table push_config (lisible seulement avec la clé de service).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false }
});

type Note = { title: string; body: string; url: string; tag: string; actions?: { action: string; title: string }[] };

const money = (n: unknown) => `${Math.round(Number(n) * 100) / 100} ₪`.replace(".", ",");

async function sendTo(ids: string[], note: Note, site: string, ttl = 3600) {
  if (!ids.length) return 0;
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("courier_id", ids);
  let sent = 0;
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(Object.assign({}, note, { url: site + note.url })), { TTL: ttl, urgency: "high" });
      sent++;
    } catch (e) {
      // Abonnement expiré (téléphone changé, notifications coupées) : on l'oublie
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return sent;
}

// Téléphones des clients abonnés : par course, ou par numéro (abonné lors d'une course précédente)
async function sendClient(o: Record<string, unknown>, note: Note, site: string) {
  const ph = String(o.contact_phone || "").replace(/\D/g, "").slice(-9);
  const { data: subs } = await db.from("client_push_subs").select("endpoint, p256dh, auth")
    .or(`order_token.eq.${o.token}${ph ? `,phone.eq.${ph}` : ""}`);
  let sent = 0;
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(Object.assign({}, note, { url: site + note.url })), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("client_push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return sent;
}

async function admins() {
  const { data } = await db.from("couriers").select("id").eq("role", "admin");
  return (data || []).map(c => c.id);
}

// Livreurs en service qui peuvent prendre une course, le patron compris quand il roule : en ligne, avec une position
// de moins de duty_grace_min minutes (3 h : on reste en ligne téléphone dans la poche, ça sonne) ;
// sans ceux qui l'ont refusée il y a moins de 5 min (après, elle peut leur revenir)
async function onDuty(orderId?: string) {
  const { data: st } = await db.from("settings").select("duty_grace_min").eq("id", 1).single();
  const since = new Date(Date.now() - Number((st && st.duty_grace_min) || 60) * 60000).toISOString();
  // (le patron a sa propre sonnerie, « boss_ring » : il n'entend pas en plus celle des livreurs)
  const { data } = await db.from("couriers").select("id").eq("online", true).eq("status", "actif").neq("role", "admin").gt("position_at", since);
  let ids = (data || []).map(c => c.id);
  if (orderId && ids.length) {
    const since5 = new Date(Date.now() - 5 * 60000).toISOString();
    const { data: no } = await db.from("order_declines").select("courier_id").eq("order_id", orderId).gt("created_at", since5);
    const out = new Set((no || []).map(d => d.courier_id));
    ids = ids.filter(id => !out.has(id));
  }
  return ids;
}

Deno.serve(async req => {
  const { data: cfg } = await db.from("push_config").select("*").eq("id", 1).single();
  if (!cfg || !cfg.hook_key || req.headers.get("x-hop-key") !== cfg.hook_key) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails(cfg.vapid_subject || "https://hop-livraison.vercel.app", cfg.vapid_public, cfg.vapid_private);
  const site = String(cfg.site_url || "https://hop-livraison.vercel.app/").replace(/\/?$/, "/");
  const ev = await req.json().catch(() => ({}));
  let sent = 0;

  if (ev.order_id) {
    const { data: o } = await db.from("orders").select("*").eq("id", ev.order_id).single();
    if (!o) return new Response("no order", { status: 404 });
    const route = `${o.pickup_address} → ${o.dropoff_address}`;
    const when = o.urgency === "asap" || o.urgency === "express" ? "Dès que possible" : new Date(o.pickup_at)
      .toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit" });
    if (ev.event === "new") {
      const docs = o.docs_status === "a_verifier" ? "📄 Colis à récupérer : documents à vérifier\n" : "";
      sent += await sendTo(await admins(), { title: `🆕 Nouvelle commande · ${money(o.price)}`,
        body: `${docs}${o.ref} · ${when}\n${route}\n👤 ${o.contact_name}`, url: `patron/?o=${o.id}`, tag: "o-" + o.id }, site);
    } else if (ev.event === "boss_ring") {
      // Le patron d'abord : ça sonne chez lui toutes les 5 s (2 min au plus) tant que la course n'est ni prise ni donnée
      // (« Je ne prends pas de courses » : il entend tout, la course est déjà chez les livreurs, il peut encore la donner)
      if (o.status === "nouvelle" && !o.courier_id) {
        const { data: bt } = await db.from("settings").select("boss_takes").eq("id", 1).single();
        const takes = !bt || bt.boss_takes !== false;
        sent += await sendTo(await admins(), { title: `🔔 Nouvelle course · ${money(o.price)}${o.urgency === "express" ? " · ⚡ EXPRESS" : ""}${takes ? "" : " · chez les livreurs"}`,
          body: `${o.ref} · ${when}\n${route}\n${takes ? "Touchez : je la prends, ou je la donne à un livreur" : "Envoyée aux livreurs : touchez pour la suivre ou la donner vous-même"}`,
          url: `patron/?o=${o.id}`, tag: "o-" + o.id,
          actions: takes ? [{ action: "take", title: "✅ Je la prends" }, { action: "give", title: "🛵 Donner à un livreur" }] : [{ action: "give", title: "🛵 Donner à un livreur" }] }, site, 10);
      }
    } else if (ev.event === "nobody") {
      // Personne ne l'a prise 2 min après les livreurs : le patron la prend ou la donne (même à un livreur hors ligne)
      if (o.status === "nouvelle" && !o.courier_id) {
        sent += await sendTo(await admins(), { title: `⚠️ Personne n'a pris la course · ${money(o.price)}`,
          body: `${o.ref} · ${when}\n${route}\nTouchez : je la prends, ou je la donne à un livreur`, url: `patron/?o=${o.id}`, tag: "o-" + o.id,
          actions: [{ action: "take", title: "✅ Je la prends" }, { action: "give", title: "🛵 Donner à un livreur" }] }, site);
      }
    } else if (ev.event === "late") {
      // Course en retard : personne ne l'a prise, pas récupérée, pas livrée
      sent += await sendTo(await admins(), { title: `⏰ Course en retard · ${o.ref}`,
        body: `${ev.why || ""}\n${route}${o.courier_name ? "\n🛵 " + o.courier_name : ""}`, url: "patron/", tag: "late-" + o.id }, site);
    } else if (ev.event === "assigned" && ev.courier_id) {
      // Le patron donne la course à un livreur
      sent += await sendTo([String(ev.courier_id)], { title: `📦 HOP! vous a donné une course · ${money(o.price)}`,
        body: `${when} · ${route}\nOuvrez HOP! pour voir le départ et l'arrivée.`, url: "livreur/", tag: "o-" + o.id }, site);
    } else if (ev.event === "cancel" && ev.courier_id) {
      // Course annulée (ou refusée par HOP) alors qu'un livreur l'avait : il est prévenu tout de suite
      sent += await sendTo([String(ev.courier_id)], { title: `❌ Course annulée · ${o.ref}`,
        body: `${route}\nNe vous déplacez pas : elle n'est plus à faire.`, url: "livreur/", tag: "o-" + o.id }, site);
    } else if (ev.event === "again") {
      sent += await sendTo(await admins(), { title: `↩️ Course remise en attente · ${o.ref}`,
        body: route, url: "patron/", tag: "o-" + o.id }, site);
    }
    // Les livreurs en service : seulement une course qu'on peut prendre maintenant
    // (une commande HOP! Pro attend d'abord que le commerce l'accepte)
    // (commande Pro ou par téléphone : seulement quand elle devient visible, quelques minutes avant l'heure « prête » ;
    // colis à la poste : 40 min avant le rendez-vous, et seulement quand le patron a vérifié les documents)
    const { data: st } = await db.from("settings").select("pro_lead_min").eq("id", 1).single();
    const delayed = (!!(o.shop_status || o.phone_order) && o.ready_at
      && new Date(o.ready_at).getTime() - Number((st && st.pro_lead_min) || 8) * 60000 > Date.now())
      || (!!o.appt_at && new Date(o.appt_at).getTime() - 40 * 60000 > Date.now());
    const open = o.status === "nouvelle" && !o.courier_id && !delayed && (!o.docs_status || o.docs_status === "ok")
      && (!o.shop_status || o.shop_status === "acceptee" || o.shop_status === "prete");
    // « ring » : la même notification renvoyée toutes les 5 s (2 min au plus) tant que personne n'a pris la course (elle sonne à chaque fois)
    // Le patron d'abord : avant offer_from (settings.boss_first_seconds), rien pour les livreurs ; la sonnerie
    // « ring » prend le relais dès qu'ils peuvent la voir
    let early = false;
    if (open && ev.event !== "ring") {
      const { data: at } = await db.rpc("order_offer_at", { p_id: o.id });
      early = !!at && new Date(at as string).getTime() > Date.now();
    }
    if (open && !early && ["new", "again", "shop_ok", "ready", "docs_ok", "ring"].includes(ev.event)) {
      // Dès que ça sonne : prête ou pas, et dans combien de temps
      const left = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 60000);
      const dur = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
      let ready = "✅ PRÊTE";
      if (o.shop_status || o.phone_order) {
        if (o.shop_status !== "prete") ready = o.ready_at ? (left(o.ready_at) > 0 ? `⏳ prête dans ${dur(left(o.ready_at))}` : "✅ PRÊTE") : "🍳 en préparation";
      } else if (o.appt_at && left(o.appt_at) > 0) ready = `📅 rendez-vous dans ${dur(left(o.appt_at))}`;
      else if (o.urgency === "programmee" && o.pickup_at && left(o.pickup_at) > 0) ready = `📅 à récupérer dans ${dur(left(o.pickup_at))}`;
      sent += await sendTo(await onDuty(o.id), { title: `${ev.event === "ring" ? "🔔" : "🛵"} Nouvelle course · ${money(o.price)} · ${ready}${o.urgency === "express" ? " · ⚡ EXPRESS" : ""}`,
        body: `${when} · ${route}\nTouchez pour accepter ou refuser`, url: "livreur/", tag: "o-" + o.id }, site, ev.event === "ring" ? 10 : 3600);
    }
  } else if (ev.client_order) {
    // Le client (abonné depuis son suivi) : une seule notification par course, remplacée à chaque étape
    const { data: o } = await db.from("orders").select("*").eq("id", ev.client_order).single();
    if (!o) return new Response("no order", { status: 404 });
    const he = o.lang === "he", first = String(o.courier_name || "").split(" ")[0];
    const T: Record<string, [string, string]> = he ? {
      confirmee: [`🛵 ${first || "השליח"} קיבל/ה את המשלוח`, "לגעת כדי לעקוב אחרי השליח"],
      recuperee: ["📦 ההזמנה שלכם בדרך", "לגעת כדי לראות איפה השליח"],
      livree: ["✅ נמסר! תודה שבחרתם בהופ!", "הקבלה והמעקב שלכם: לגעת כאן"]
    } : {
      confirmee: [`🛵 ${first || "Votre livreur"} a accepté votre course`, "Touchez pour suivre votre livreur"],
      recuperee: ["📦 Votre commande est en route", "Touchez pour voir où est votre livreur"],
      livree: ["✅ Livré ! Merci d'avoir choisi HOP!", "Votre reçu et votre suivi : touchez ici"]
    };
    // Course à payer par Bit au livreur : la notification le dit tout de suite (le livreur ne part qu'après le paiement)
    if (o.payment_method === "bit" && o.direct_pay && o.payment_status !== "paye" && !o.shop_sent)
      T.confirmee[1] = he ? `שלחו לו/לה עכשיו ${money(o.price)} בביט: לגעת כאן` : `Envoyez-lui ${money(o.price)} par Bit maintenant : touchez ici`;
    const t = T[String(ev.event)];
    if (t) sent += await sendClient(o, { title: t[0], body: `${t[1]} · ${o.ref}`, url: `suivi.html?t=${o.token}`, tag: "c-" + o.id }, site);
  } else if (ev.courier_id && ev.title) {
    // Message de HOP! à un livreur (ex. « Toujours là ? » quand il n'est plus sur l'appli)
    sent += await sendTo([String(ev.courier_id)], { title: String(ev.title), body: String(ev.body || ""),
      url: "livreur/", tag: String(ev.tag || "hop-info") }, site);
  } else if (ev.thread) {
    // Messagerie : le client, un commerce ou un livreur écrit → le patron ; le patron écrit → le livreur
    const [kind, id] = String(ev.thread).split(":");
    const text = ev.body ? String(ev.body).slice(0, 140) : "📷 Photo";
    const who = ev.author_name || ({ client: "Client", courier: "Livreur", shop: "Commerce" } as Record<string, string>)[ev.author] || "HOP!";
    if (ev.author === "system") {
      if (ev.body === "status:client_paid") {
        const { data: o } = await db.from("orders").select("ref, price, direct_pay, courier_id").eq("id", id).single();
        if (o && o.direct_pay && o.courier_id) {
          // Paiement direct : c'est le livreur qui reçoit l'argent, c'est lui qu'on prévient
          sent += await sendTo([o.courier_id], { title: "💳 Le client dit avoir payé",
            body: `Course ${o.ref} : vérifiez votre Bit / PayBox, puis touchez « Paiement reçu » pour récupérer la commande.`, url: "livreur/", tag: "pay-" + id }, site);
        } else {
          sent += await sendTo(await admins(), { title: "💳 Paiement Bit à vérifier",
            body: `Le client dit avoir payé ${o ? money(o.price) + " · " + o.ref : ""}`, url: "patron/", tag: "pay-" + id }, site);
        }
      } else if (ev.body === "status:refund_missing") {
        // Course rendue après paiement : le client dit ne pas avoir été remboursé
        const { data: o } = await db.from("orders").select("ref, refund_amount, refund_courier_name").eq("id", id).single();
        sent += await sendTo(await admins(), { title: "⚠️ Client pas remboursé",
          body: o ? `Course ${o.ref} : ${money(o.refund_amount)} à rembourser par ${o.refund_courier_name || "le livreur"}` : "", url: "patron/", tag: "refund-" + id }, site);
      }
    } else if (ev.author === "admin") {
      let to: string[] = [];
      if (kind === "c") to = [id];
      if (kind === "o") {
        const { data: o } = await db.from("orders").select("*").eq("id", id).single();
        if (o && o.courier_id) to = [o.courier_id];
        // HOP! écrit au client dans sa course : il est prévenu sur son téléphone
        if (o) sent += await sendClient(o, { title: "💬 HOP!", body: text, url: `suivi.html?t=${o.token}`, tag: "cm-" + id }, site);
      }
      sent += await sendTo(to, { title: "💬 HOP!", body: text, url: "livreur/", tag: "m-" + ev.thread }, site);
    } else {
      const claim = /^⚠️ Commande pas reçue/.test(text);
      sent += await sendTo(await admins(), { title: claim ? "⚠️ Course pas reçue par le client" : `💬 ${who}`, body: text, url: "patron/", tag: "m-" + ev.thread }, site);
      if (kind === "o" && ev.author === "courier") {
        const { data: oc } = await db.from("orders").select("*").eq("id", id).single();
        if (oc && ["confirmee", "recuperee"].includes(oc.status)) sent += await sendClient(oc, { title: `💬 ${who}`, body: text,
          url: `suivi.html?t=${oc.token}`, tag: "cm-" + id }, site);
      }
      if (kind === "o" && ev.author === "client") {
        const { data: o } = await db.from("orders").select("courier_id, status").eq("id", id).single();
        if (o && o.courier_id && ["confirmee", "recuperee"].includes(o.status)) {
          const { data: a } = await db.from("couriers").select("role").eq("id", o.courier_id).single();
          if (a && a.role !== "admin") sent += await sendTo([o.courier_id], { title: `💬 ${who}`, body: text, url: "livreur/", tag: "m-" + ev.thread }, site);
        }
      }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
