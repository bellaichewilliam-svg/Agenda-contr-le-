// HOP! : notifications « push » (elles arrivent même quand l'application est fermée).
// Appelée par la base (déclencheurs sur les commandes et la messagerie, voir supabase-schema.sql,
// section NOTIFICATIONS PUSH) avec la clé x-hop-key. Les clés VAPID et la clé d'appel sont dans
// la table push_config (lisible seulement avec la clé de service).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false }
});

type Note = { title: string; body: string; url: string; tag: string };

const money = (n: unknown) => `${Math.round(Number(n) * 100) / 100} ₪`.replace(".", ",");

async function sendTo(ids: string[], note: Note, site: string) {
  if (!ids.length) return 0;
  const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("courier_id", ids);
  let sent = 0;
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(Object.assign({}, note, { url: site + note.url })), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      // Abonnement expiré (téléphone changé, notifications coupées) : on l'oublie
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }));
  return sent;
}

async function admins() {
  const { data } = await db.from("couriers").select("id").eq("role", "admin");
  return (data || []).map(c => c.id);
}

// Livreurs en service (position récente) qui peuvent prendre une course
async function onDuty() {
  const since = new Date(Date.now() - 60 * 60000).toISOString();
  const { data } = await db.from("couriers").select("id").eq("online", true).eq("status", "actif")
    .neq("role", "admin").gt("position_at", since);
  return (data || []).map(c => c.id);
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
      sent += await sendTo(await admins(), { title: `🆕 Nouvelle commande · ${money(o.price)}`,
        body: `${o.ref} · ${when}\n${route}\n👤 ${o.contact_name}`, url: "patron/", tag: "o-" + o.id }, site);
    } else if (ev.event === "again") {
      sent += await sendTo(await admins(), { title: `↩️ Course remise en attente · ${o.ref}`,
        body: route, url: "patron/", tag: "o-" + o.id }, site);
    }
    // Les livreurs en service : seulement une course qu'on peut prendre maintenant
    // (une commande HOP! Pro attend d'abord que le commerce l'accepte)
    // (commande Pro ou par téléphone : seulement quand elle devient visible, quelques minutes avant l'heure « prête »)
    const { data: st } = await db.from("settings").select("pro_lead_min").eq("id", 1).single();
    const delayed = !!(o.shop_status || o.phone_order) && o.ready_at
      && new Date(o.ready_at).getTime() - Number((st && st.pro_lead_min) || 8) * 60000 > Date.now();
    const open = o.status === "nouvelle" && !o.courier_id && !delayed
      && (!o.shop_status || o.shop_status === "acceptee" || o.shop_status === "prete");
    if (open && ["new", "again", "shop_ok", "ready"].includes(ev.event)) {
      sent += await sendTo(await onDuty(), { title: `🛵 Nouvelle course · ${money(o.price)}`,
        body: `${when} · ${route}`, url: "livreur/", tag: "o-" + o.id }, site);
    }
  } else if (ev.thread) {
    // Messagerie : le client, un commerce ou un livreur écrit → le patron ; le patron écrit → le livreur
    const [kind, id] = String(ev.thread).split(":");
    const text = ev.body ? String(ev.body).slice(0, 140) : "📷 Photo";
    const who = ev.author_name || ({ client: "Client", courier: "Livreur", shop: "Commerce" } as Record<string, string>)[ev.author] || "HOP!";
    if (ev.author === "system") {
      if (ev.body === "status:client_paid") {
        const { data: o } = await db.from("orders").select("ref, price").eq("id", id).single();
        sent += await sendTo(await admins(), { title: "💳 Paiement Bit à vérifier",
          body: `Le client dit avoir payé ${o ? money(o.price) + " · " + o.ref : ""}`, url: "patron/", tag: "pay-" + id }, site);
      }
    } else if (ev.author === "admin") {
      let to: string[] = [];
      if (kind === "c") to = [id];
      if (kind === "o") {
        const { data: o } = await db.from("orders").select("courier_id").eq("id", id).single();
        if (o && o.courier_id) to = [o.courier_id];
      }
      sent += await sendTo(to, { title: "💬 HOP!", body: text, url: "livreur/", tag: "m-" + ev.thread }, site);
    } else {
      sent += await sendTo(await admins(), { title: `💬 ${who}`, body: text, url: "patron/", tag: "m-" + ev.thread }, site);
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
