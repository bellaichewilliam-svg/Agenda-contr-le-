// hop-api : l'API HOP! pour les applis de restaurants et de commerces (patron, 18/11/2026).
// Une clé secrète par commerce (créée par le patron, onglet « API » du panneau) ; seule son empreinte est gardée en base.
// Les prix sont ceux de HOP!, calculés ici avec les mêmes fichiers que l'appli (config.js + pricing.js du site) :
// l'appli appelante ne choisit jamais le prix. La course passe par les mêmes contrôles que « Envoyer une course »
// de l'espace commerce (déclencheur orders_zx_shop_sent) : départ = le commerce, client qui paie le livreur.
//
//   GET  /hop-api/v1/ping                       vérifier la clé
//   POST /hop-api/v1/quote                      prix d'une livraison vers une adresse
//   POST /hop-api/v1/deliveries                 créer une course (dry_run: true = tout vérifier sans créer)
//   GET  /hop-api/v1/deliveries/{id}            état d'une course (id = n° HOP!, ex. C261118-AB12)
//   POST /hop-api/v1/deliveries/{id}/cancel     annuler (tant qu'aucun livreur ne l'a prise)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://hop-livraison.vercel.app/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const STATUS: Record<string, string> = { nouvelle: "pending", confirmee: "accepted", recuperee: "picked_up", livree: "delivered", annulee: "cancelled", refusee: "cancelled" };
const MAX_PER_HOUR = 60;

class ApiError extends Error { constructor(public code: string, public http = 400, msg = "") { super(msg || code); } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

// --- Les règles de prix de l'appli, chargées depuis le site (gardées 10 min) ---------------------------------
let rules: { at: number; CONFIG: any; Pricing: any } | null = null;
async function pricingRules() {
  if (rules && Date.now() - rules.at < 600000) return rules;
  const [c, p] = await Promise.all([fetch(SITE + "config.js").then(r => r.text()), fetch(SITE + "pricing.js").then(r => r.text())]);
  const win: any = {};
  const loc = { hostname: "api", pathname: "/", search: "", hash: "", replace() {} };
  new Function("window", "location", c)(win, loc);
  new Function("window", "location", "module", p)(win, loc, undefined);
  if (!win.CONFIG || !win.Pricing) throw new ApiError("pricing_unavailable", 503);
  rules = { at: Date.now(), CONFIG: win.CONFIG, Pricing: win.Pricing };
  return rules;
}

const fold = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9֐-׿]+/g, "");
function cityOf(CONFIG: any, name: string | undefined, fallback: string) {
  if (!name) return CONFIG.cities.find((c: any) => c.id === fallback);
  const f = fold(name);
  return CONFIG.cities.find((c: any) => [c.id, c.fr, c.he, ...(c.aliases || [])].some((x: string) => fold(x) === f)) || null;
}
const phone = (p: unknown) => { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("972")) d = "0" + d.slice(3); return d; };
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

async function geocode(street: string, city: any): Promise<{ lat: number; lon: number } | null> {
  try {
    const q = encodeURIComponent(`${street}, ${city.fr}, Israel`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${q}`,
      { headers: { "User-Agent": "HOP-Livraison-API/1.0", "Accept-Language": "he,fr" } });
    const a = await r.json();
    return a && a[0] ? { lat: Number(a[0].lat), lon: Number(a[0].lon) } : null;
  } catch { return null; }
}

// --- La clé : « Authorization: Bearer hop_live_… » ou « X-API-Key: hop_live_… » --------------------------------
async function auth(req: Request) {
  const raw = (req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")).trim();
  if (!/^hop_live_[0-9a-f]{48}$/.test(raw)) throw new ApiError("invalid_key", 401);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const { data: key } = await db.from("api_keys").select("*").eq("key_hash", hash).maybeSingle();
  if (!key || !key.active) throw new ApiError("invalid_key", 401);
  const { data: shop } = await db.from("shops").select("id, name, token, city, address, lat, lon, phone, status, demo").eq("id", key.shop_id).maybeSingle();
  if (!shop || shop.status === "suspendu" || shop.demo) throw new ApiError("shop_unavailable", 403);
  db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});
  return { key, shop };
}

async function quote(shop: any, body: any) {
  const { CONFIG, Pricing } = await pricingRules();
  const a = body.address || body;
  const city = cityOf(CONFIG, a.city, shop.city || CONFIG.homeCity);
  if (!city) throw new ApiError("city_not_served", 422);
  const street = str(a.street);
  if (!street) throw new ApiError("missing_fields", 422, "address.street");
  let to = a.lat != null && a.lon != null ? { lat: Number(a.lat), lon: Number(a.lon) } : await geocode(street, city);
  if (to && !(Math.abs(to.lat - 32) < 2 && Math.abs(to.lon - 35) < 2)) to = null;
  const from = shop.lat != null ? { lat: Number(shop.lat), lon: Number(shop.lon) } : null;
  const q = Pricing.computeQuote({ fromCity: shop.city || CONFIG.homeCity, toCity: city.id, fromPoint: from, toPoint: to,
    service: "colis", size: "petit", urgency: "asap", roundTrip: false, extraStops: 0 }, CONFIG);
  return { price: Number(q.total), currency: "ILS", city: city.id, point: to, exact_address: !!(a.lat != null && a.lon != null) };
}

const newRef = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return "C" + ymd + "-" + Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
};
const trackUrl = (token: string) => SITE + "app/suivi.html?t=" + token;

async function create(key: any, shop: any, body: any) {
  const c = body.customer || {}, a = body.address || {};
  const missing = [["customer.name", str(c.name)], ["customer.phone", c.phone], ["address.street", str(a.street)],
    ["address.floor", str(a.floor, 20)], ["address.apartment", str(a.apartment, 20)]].filter(([, v]) => !String(v ?? "").trim()).map(([k]) => k);
  if (missing.length) throw new ApiError("missing_fields", 422, missing.join(", "));
  const tel = phone(c.phone);
  if (!/^0[2-9]\d{7,8}$/.test(tel)) throw new ApiError("invalid_phone", 422);
  const pay = body.payment_method === "bit" ? "bit" : body.payment_method == null || body.payment_method === "cash" ? "cash" : "";
  if (!pay) throw new ApiError("invalid_payment_method", 422, "cash | bit");
  const ready = Math.max(0, Math.min(180, Math.round(Number(body.ready_in_minutes) || 0)));
  const q = await quote(shop, body);
  const order: Record<string, unknown> = {
    token: crypto.randomUUID(), ref: newRef(), status: "nouvelle", payment_status: "en_attente", device_id: "api:" + key.id,
    service: "colis", urgency: "asap", size: "petit", lang: body.language === "fr" ? "fr" : "he",
    shop_sent: true, send_key: shop.token, shop_id: shop.id,
    from_city: shop.city, to_city: q.city, pickup_at: new Date(Date.now() + ready * 60000).toISOString(),
    pickup_address: shop.address, pickup_lat: shop.lat, pickup_lon: shop.lon, pickup_contact: shop.name, pickup_phone: shop.phone,
    dropoff_address: str(a.street), dropoff_lat: q.point ? q.point.lat : null, dropoff_lon: q.point ? q.point.lon : null, dropoff_exact: q.exact_address,
    dropoff_floor: str(a.floor, 20), dropoff_apt: str(a.apartment, 20), dropoff_code: str(a.door_code, 30) || null,
    dropoff_note: str(body.note, 500) || null, dropoff_contact: str(c.name, 80), dropoff_phone: tel,
    contact_name: shop.name, contact_phone: shop.phone,
    price: q.price, discount: 0, payment_method: pay, payer: "destinataire", distance_km: null,
  };
  if (body.dry_run) return { dry_run: true, price: q.price, currency: "ILS", city: q.city, would_create: true };
  const since = new Date(Date.now() - 3600000).toISOString();
  const { count } = await db.from("api_deliveries").select("order_id", { count: "exact", head: true }).eq("key_id", key.id).gte("created_at", since);
  if ((count || 0) >= MAX_PER_HOUR) throw new ApiError("rate_limited", 429);
  const { data: saved, error } = await db.from("orders").insert(order).select("id, ref, token, price, status").single();
  if (error) throw new ApiError(/send_fields/.test(error.message) ? "missing_fields" : /shop_invalid/.test(error.message) ? "shop_unavailable" : "create_failed", 422, error.message);
  await db.from("api_deliveries").insert({ order_id: saved.id, key_id: key.id, external_id: str(body.external_id, 100) || null });
  return { id: saved.ref, status: STATUS[saved.status] || saved.status, price: Number(saved.price), currency: "ILS",
    payment: { payer: "customer", method: pay, note: "The customer pays the courier on delivery" }, tracking_url: trackUrl(saved.token) };
}

async function findMine(key: any, ref: string) {
  const { data: o } = await db.from("orders").select("id, ref, token, status, price, payment_method, courier_name, eta_at, pickup_at, delivered_at, created_at").eq("ref", ref).maybeSingle();
  if (!o) throw new ApiError("not_found", 404);
  const { data: d } = await db.from("api_deliveries").select("key_id, external_id").eq("order_id", o.id).maybeSingle();
  if (!d || d.key_id !== key.id) throw new ApiError("not_found", 404);
  return { o, d };
}
const view = (o: any, d: any) => ({
  id: o.ref, external_id: d.external_id, status: STATUS[o.status] || o.status, price: Number(o.price), currency: "ILS",
  courier_name: o.courier_name ? String(o.courier_name).split(" ")[0] : null, courier_eta: o.eta_at || null,
  ready_at: o.pickup_at, delivered_at: o.delivered_at || null, created_at: o.created_at, tracking_url: trackUrl(o.token),
});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const path = new URL(req.url).pathname.replace(/^.*?\/hop-api/, "").replace(/\/+$/, "") || "/";
    const { key, shop } = await auth(req);
    const body = req.method === "POST" ? await req.json().catch(() => { throw new ApiError("invalid_json"); }) : {};
    if (req.method === "GET" && path === "/v1/ping") return json({ ok: true, shop: shop.name, key: "…" + key.key_hint });
    if (req.method === "POST" && path === "/v1/quote") { const q = await quote(shop, body); return json({ price: q.price, currency: q.currency, city: q.city }); }
    if (req.method === "POST" && path === "/v1/deliveries") return json(await create(key, shop, body), body.dry_run ? 200 : 201);
    let m = path.match(/^\/v1\/deliveries\/([A-Z0-9-]{6,20})$/);
    if (req.method === "GET" && m) { const { o, d } = await findMine(key, m[1]); return json(view(o, d)); }
    m = path.match(/^\/v1\/deliveries\/([A-Z0-9-]{6,20})\/cancel$/);
    if (req.method === "POST" && m) {
      const { o, d } = await findMine(key, m[1]);
      if (o.status !== "nouvelle") throw new ApiError("cannot_cancel", 409, "A courier already took this delivery: call HOP!");
      await db.from("orders").update({ status: "annulee", admin_note: "Annulée par l'appli du commerce (API)" }).eq("id", o.id).eq("status", "nouvelle");
      return json(view({ ...o, status: "annulee" }, d));
    }
    throw new ApiError("not_found", 404);
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError("server_error", 500);
    if (!(e instanceof ApiError)) console.error(e);
    return json({ error: err.code, message: err.message !== err.code ? err.message : undefined }, err.http);
  }
});
