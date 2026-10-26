// Fiche automatique d'un commerce, dès son inscription : horaires, photo de couverture, logo, accroche
// et menu (catégories, plats, prix, photos), repris de sa page publique sur la grande appli de livraison
// où il est déjà (même nom, même endroit). Ne remplace jamais ce que le commerce a déjà rempli.
// Appelée par la base (trigger shops_enrich_on_signup, ou admin_shop_enrich) avec la clé x-hop-key.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const API = "https://consumer-api.wolt.com";
const SEARCH = "https://restaurant-api.wolt.com/v1/pages/search";
const HEAD = { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36" };
const DAYS: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

const norm = (s: string) => String(s || "").split("|")[0].toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9א-ת]+/g, "");
const km = (a: number[], b: number[]) => {
  const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r;
  return 6371 * Math.sqrt(x * x + y * y);
};
// « Salade Niçoise : 40,00 ₪ » (traduction automatique) → « Salade Niçoise » ; sans émojis ni espaces en trop
const clean = (s: string) => String(s || "").replace(/\s*[:\-–]\s*\d+([.,]\d+)?\s*₪\s*$/, "")
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200B}-\u{200F}\u{202A}-\u{202E}]/gu, "").replace(/\s+/g, " ").trim();
const both = (fr: string, he: string) => { const a = clean(fr), b = clean(he); return a && b && a !== b ? `${a} · ${b}` : a || b; };

async function json(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { ...HEAD, ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
// Image → data:image/…;base64 (taille réduite par le serveur d'images ; au-delà de 350 Ko, on laisse tomber)
async function imageData(url: string | null | undefined, w: number) {
  if (!url) return null;
  try {
    const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}w=${w}`, { headers: HEAD, signal: AbortSignal.timeout(15000) });
    const type = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 350000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch { return null; }
}
// Horaires « 07:30–21:30 », « 08:00–14:00, 17:00–23:00 », « Closed » → [{ d, h: "07:30-21:30" }]
function hoursOf(schedule: { day: string; formatted_times: string }[] | undefined) {
  if (!Array.isArray(schedule) || !schedule.length) return null;
  const out = schedule.filter(x => x.day in DAYS).map(x => {
    const ranges = String(x.formatted_times || "").split(/,\s*/).map(r => r.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/)).filter(Boolean)
      .map(m => { const a = `${m![1].padStart(2, "0")}:${m![2]}`; let b = `${m![3].padStart(2, "0")}:${m![4]}`; if (b <= a) b = "24:00"; return `${a}-${b}`; });
    return { d: DAYS[x.day], h: ranges.join(",") };
  }).sort((p, q) => p.d - q.d);
  return out.some(x => x.h) ? out : null;
}

// La fiche publique du commerce : même nom, à moins de 400 m (ou la même adresse à moins de 80 m)
async function findVenue(shop: any) {
  const q = String(shop.name || "").split(" · ")[0].trim();
  const page = await json(SEARCH, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, target: null, lat: shop.lat, lon: shop.lon }) });
  const venues = (page.sections || []).flatMap((s: any) => s.items || []).map((i: any) => i.venue).filter((v: any) => v && v.slug && Array.isArray(v.location));
  const me = [Number(shop.lat), Number(shop.lon)], n = norm(q);
  const scored = venues.map((v: any) => {
    const d = km(me, [v.location[1], v.location[0]]), vn = norm(v.name);
    const same = !!n && !!vn && (vn.includes(n) || n.includes(vn));
    return { v, d, ok: (same && d < 0.4) || d < 0.08 && norm(v.address) === norm(shop.address) };
  }).filter((x: any) => x.ok).sort((a: any, b: any) => a.d - b.d);
  return scored.length ? scored[0].v : null;
}

async function enrich(shopId: string) {
  const { data: shop } = await db.from("shops").select("*").eq("id", shopId).maybeSingle();
  if (!shop || shop.demo || shop.lat == null) return { ok: false, why: "shop" };
  const venue = await findVenue(shop);
  if (!venue) return { ok: false, why: "not_found" };
  const slug = venue.slug;
  const [info, he, fr] = await Promise.all([
    json(`${API}/order-xp/web/v1/pages/venue/slug/${slug}/static`).then(x => x.venue).catch(() => null),
    json(`${API}/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment?language=he`).catch(() => null),
    json(`${API}/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment?language=fr`).catch(() => null),
  ]);
  const done: string[] = [];

  // Fiche : seulement les cases vides
  const patch: Record<string, unknown> = {};
  const hours = info && hoursOf(info.opening_times_schedule);
  if (!shop.hours && hours) { patch.hours = hours; done.push("horaires"); }
  if (!shop.cover && info) { const c = await imageData(info.image_url || venue.image?.url, 900); if (c) { patch.cover = c; done.push("photo"); } }
  if (!shop.logo && info && info.brand_logo_image_url) { const l = await imageData(info.brand_logo_image_url, 300); if (l) { patch.logo = l; done.push("logo"); } }

  // Menu : seulement si le catalogue est vide
  const { count } = await db.from("shop_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  const menu = he || fr;
  let nProducts = 0;
  if (!count && menu && Array.isArray(menu.items)) {
    const frItem = new Map<string, any>((fr?.items || []).map((i: any) => [i.id, i]));
    const frCat = new Map<string, any>((fr?.categories || []).map((c: any) => [c.id, c]));
    const items = new Map<string, any>(menu.items.map((i: any) => [i.id, i]));
    const cats = (menu.categories || []).map((c: any) => ({
      c, list: (c.item_ids || []).map((id: string) => items.get(id)).filter((i: any) => i && i.name && Number(i.price) > 0),
    })).filter((x: any) => x.list.length);
    // Accroche : les 3 plus grosses catégories (« Salades · Sandwichs · Pâtes »)
    if (!shop.tagline && cats.length) {
      const top = cats.slice().sort((a: any, b: any) => b.list.length - a.list.length).slice(0, 3);
      patch.tagline = top.map((x: any) => clean(frCat.get(x.c.id)?.name || x.c.name)).filter(Boolean).join(" · ") || null;
      patch.tagline_he = top.map((x: any) => clean(x.c.name)).filter(Boolean).join(" · ") || null;
    }
    let pos = 0;
    for (const [ci, x] of cats.slice(0, 25).entries()) {
      const { data: cat } = await db.from("shop_categories")
        .insert({ shop_id: shop.id, name: both(frCat.get(x.c.id)?.name || "", x.c.name).slice(0, 80) || "Menu", position: ci })
        .select("id").single();
      if (!cat) continue;
      const rows = await Promise.all(x.list.slice(0, 40).map(async (i: any) => {
        const f = frItem.get(i.id) || {};
        return {
          shop_id: shop.id, category_id: cat.id, position: pos++,
          name: both(f.name || "", i.name).slice(0, 120),
          description: (clean(f.description || i.description || "") || null)?.slice(0, 300) ?? null,
          price: Math.round(Number(i.price)) / 100,
          photo: await imageData(i.images?.[0]?.url, 360),
          available: !i.disabled_info,
        };
      }));
      const { error } = await db.from("shop_products").insert(rows);
      if (!error) nProducts += rows.length;
    }
    if (nProducts) done.push(`${nProducts} produits`);
  }

  // Case par case, et seulement si elle est toujours vide (le commerce a pu la remplir entre-temps à l'inscription)
  for (const [k, v] of Object.entries(patch)) await db.from("shops").update({ [k]: v }).eq("id", shop.id).is(k, null);
  // Une ligne pour le patron dans la note interne de la fiche
  if (done.length) {
    const line = `🤖 Fiche remplie automatiquement à l'inscription : ${done.join(", ")} (à vérifier avec le commerce).`;
    await db.from("shops").update({ admin_note: shop.admin_note ? `${line}\n${shop.admin_note}` : line }).eq("id", shop.id);
  }
  return { ok: true, slug, done };
}

Deno.serve(async req => {
  const { data: cfg } = await db.from("push_config").select("hook_key").eq("id", 1).maybeSingle();
  if (!cfg || !cfg.hook_key || req.headers.get("x-hop-key") !== cfg.hook_key) return new Response("forbidden", { status: 403 });
  let body: any = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  if (!body.shop_id) return new Response("shop_id", { status: 400 });
  try {
    const r = await enrich(String(body.shop_id));
    return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, why: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
