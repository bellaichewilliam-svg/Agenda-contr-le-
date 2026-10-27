// Fiche automatique d'un commerce, dès son inscription : horaires, photo de couverture, logo, accroche
// et menu (catégories, plats, prix, photos), repris de sa page publique sur la grande appli de livraison
// où il est déjà (même nom, même endroit). Ne remplace jamais ce que le commerce a déjà rempli.
// Appelée par l'appli juste après l'inscription (clé du commerce), par le patron (bouton « 🤖 Remplir sa fiche »),
// ou par la base (clé x-hop-key).
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
async function imageData(url: string | null | undefined, w: number, key = "w", accept?: string) {
  if (!url) return null;
  try {
    const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}${key}=${w}`, { headers: accept ? { ...HEAD, Accept: accept } : HEAD, signal: AbortSignal.timeout(15000) });
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

// Boutique en ligne Shopify du commerce (son propre site) : ses rayons et, dans chacun, ses produits phares
// (l'ordre du rayon sur son site), avec prix et photo ; logo et couverture si donnés. Seulement si la fiche
// n'a encore aucun produit (on ne double jamais un catalogue).
async function shopifyImg(src: string | null | undefined, w: number) {
  if (!src) return null;
  const u = String(src).replace(/^\/\//, "https://").replace(/^http:/, "https:");
  for (const ww of [w, Math.round(w * 0.66)]) {
    // (le serveur d'images Shopify renvoie du webp quand on le demande : 10 fois plus léger que le png)
    const d = await imageData(u, ww, "width", "image/webp,image/*");
    if (d && d.length <= 290000) return d;
  }
  return null;
}
// Nom de produit : sans la signature du site (« … | Le Marché Français »), 80 caractères au plus, coupé au mot
const shortName = (title: string, shopName: string) => {
  const brand = String(shopName || "").split(" · ")[0].trim();
  let n = clean(title);
  if (brand) n = n.replace(new RegExp(`\\s*[|—–-]\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "").trim();
  return n.length <= 80 ? n : n.slice(0, 79).replace(/\s+\S*$/, "").replace(/[\s,;:–—-]+$/, "") + "…";
};
async function fromShopify(id: string, site: string, per: number, logo?: string, cover?: string, fill = false) {
  const base = new URL(site).origin;
  if (!/^https:\/\//.test(base)) throw new Error("bad_site");
  const { data: shop } = await db.from("shops").select("*").eq("id", id).single();
  if (!shop) throw new Error("no_shop");
  const { count } = await db.from("shop_products").select("id", { count: "exact", head: true }).eq("shop_id", id);
  if (count && !fill) return { ok: false, why: "already_has_products", count };
  // Compléter (fill) : seulement les rayons encore vides, sans reprendre un produit déjà là
  const { data: had } = await db.from("shop_categories").select("id, name, shop_products(count)").eq("shop_id", id);
  const hadCat = new Map<string, { id: string; n: number }>((had || []).map((c: any) => [c.name, { id: c.id, n: c.shop_products?.[0]?.count || 0 }]));
  const { data: hadProd } = await db.from("shop_products").select("name").eq("shop_id", id);
  const hadName = new Set((hadProd || []).map((p: any) => p.name));
  const patch: Record<string, string> = {};
  const lg = !shop.logo && await shopifyImg(logo, 320), cv = !shop.cover && await shopifyImg(cover, 1000);
  if (lg) patch.logo = lg;
  if (cv) patch.cover = cv;
  if (Object.keys(patch).length) await db.from("shops").update(patch).eq("id", id);
  const cols = ((await json(`${base}/collections.json?limit=250`)).collections || [])
    .filter((c: any) => c.products_count > 0 && !["frontpage", "all"].includes(c.handle));
  const seen = new Set<number>();
  let nCat = 0, nProd = 0;
  for (const [i, c] of cols.entries()) {
    const cname = clean(c.title).slice(0, 60), old = hadCat.get(cname);
    const prods = ((await json(`${base}/collections/${encodeURIComponent(c.handle)}/products.json?limit=${per * 3}`)).products || [])
      .filter((p: any) => !seen.has(p.id) && !hadName.has(shortName(p.title, shop.name)) && p.variants?.length && Number(p.variants[0].price) > 0 && p.variants.some((v: any) => v.available))
      .slice(0, per);
    prods.forEach((p: any) => seen.add(p.id));
    if (old && old.n) continue;
    if (!prods.length) continue;
    const { data: cat, error } = old ? { data: { id: old.id }, error: null }
      : await db.from("shop_categories").insert({ shop_id: id, name: cname, position: i }).select("id").single();
    if (error || !cat) continue;
    nCat++;
    const rows = await Promise.all(prods.map(async (p: any, j: number) => ({
      shop_id: id, category_id: cat.id, position: j, name: shortName(p.title, shop.name),
      description: (d => (d.length > 220 ? d.slice(0, 219).replace(/\s+\S*$/, "") + "…" : d) || null)(clean(String(p.body_html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'"))),
      price: Math.round(Number(p.variants[0].price) * 100) / 100,
      photo: await shopifyImg(p.images?.[0]?.src, 360),
      available: true,
    })));
    const { error: e2 } = await db.from("shop_products").insert(rows);
    if (!e2) nProd += rows.length; else console.error("shopify insert", cname, e2.message);
  }
  const line = `🛍️ Catalogue repris de son site ${base} : ${nCat} rayons, ${nProd} produits phares (prix du site, à vérifier avec le commerce).`;
  await db.from("shops").update({ admin_note: shop.admin_note ? `${line}\n${shop.admin_note}` : line }).eq("id", id);
  return { ok: true, nCat, nProd, logo: !!lg, cover: !!cv };
}

// Photos trop lourdes (catalogue repris avant le passage au webp) : on remplace chaque photo, le logo et la
// couverture par leur version légère, sans toucher aux produits, prix ni rayons
async function shopifyRephoto(id: string, site: string, logo?: string, cover?: string) {
  const base = new URL(site).origin;
  if (!/^https:\/\//.test(base)) throw new Error("bad_site");
  const { data: shop } = await db.from("shops").select("name, logo, cover").eq("id", id).single();
  if (!shop) throw new Error("no_shop");
  const HEAVY = 60000, patch: Record<string, string> = {};
  const lg = (shop.logo || "").length > HEAVY && await shopifyImg(logo, 320), cv = (shop.cover || "").length > HEAVY && await shopifyImg(cover, 1000);
  if (lg && lg.length < (shop.logo || "").length) patch.logo = lg;
  if (cv && cv.length < (shop.cover || "").length) patch.cover = cv;
  if (Object.keys(patch).length) await db.from("shops").update(patch).eq("id", id);
  const src = new Map<string, string>();
  const cols = ((await json(`${base}/collections.json?limit=250`)).collections || []).filter((c: any) => c.products_count > 0);
  for (const c of cols)
    for (const p of (await json(`${base}/collections/${encodeURIComponent(c.handle)}/products.json?limit=250`)).products || [])
      if (p.images?.[0]?.src) src.set(shortName(p.title, shop.name), p.images[0].src);
  const { data: prods } = await db.from("shop_products").select("id, name, photo").eq("shop_id", id);
  const todo = (prods || []).filter((p: any) => (p.photo || "").length > HEAVY && src.has(p.name));
  let n = 0;
  for (let i = 0; i < todo.length; i += 8)
    await Promise.all(todo.slice(i, i + 8).map(async (p: any) => {
      const d = await shopifyImg(src.get(p.name), 360);
      if (d && d.length < p.photo.length && !(await db.from("shop_products").update({ photo: d }).eq("id", p.id)).error) n++;
    }));
  return { ok: true, photos: n, of: todo.length, logo: !!patch.logo, cover: !!patch.cover };
}

// Qui peut lancer la fiche : le commerce lui-même (sa clé secrète, juste après l'inscription), le patron
// (connecté, rôle admin) pour n'importe quel commerce, ou la base (clé x-hop-key)
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-hop-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
async function shopIdFor(req: Request, body: any): Promise<string | null> {
  if (body.token && /^[0-9a-f-]{36}$/i.test(String(body.token))) {
    const { data } = await db.from("shops").select("id").eq("token", String(body.token)).maybeSingle();
    return data ? data.id : null;
  }
  if (!body.shop_id) return null;
  const { data: cfg } = await db.from("push_config").select("hook_key").eq("id", 1).maybeSingle();
  if (cfg && cfg.hook_key && req.headers.get("x-hop-key") === cfg.hook_key) return String(body.shop_id);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: null };
  if (!u || !u.user) return null;
  const { data: me } = await db.from("couriers").select("role").eq("id", u.user.id).maybeSingle();
  return me && me.role === "admin" ? String(body.shop_id) : null;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const id = await shopIdFor(req, body);
  if (!id) return reply({ ok: false, why: "forbidden" }, 403);
  try {
    if (body.shopify && body.rephoto) return reply(await shopifyRephoto(id, String(body.shopify), body.logo, body.cover));
    if (body.shopify) return reply(await fromShopify(id, String(body.shopify), Math.min(15, Math.max(1, Number(body.per) || 8)), body.logo, body.cover, !!body.fill));
    return reply(await enrich(id));
  }
  catch (e) { return reply({ ok: false, why: String(e) }, 500); }
});
