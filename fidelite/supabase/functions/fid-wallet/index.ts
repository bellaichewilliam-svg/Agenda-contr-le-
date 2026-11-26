// fid-wallet : carte fidélité (projet séparé de HOP!) dans Google Wallet et Apple Wallet.
// Secrets Supabase (Edge Functions → Secrets) :
//   Google : GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_JSON (tout le fichier JSON du compte de service)
//   Apple  : APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_PEM, APPLE_PASS_KEY_PEM (+ APPLE_PASS_KEY_PASSWORD), APPLE_WWDR_PEM
// Routes :
//   GET  /fid-wallet                       → { google, apple } (prêt ou pas)
//   GET  /fid-wallet/logo/<CODE>.png       → logo du commerce (PNG)
//   GET  /fid-wallet/hero/<TOKEN>/<n>.png  → l'image des tampons de la carte (dessinée à la volée, belle dans le Wallet)
//   GET  /fid-wallet?apple=<TOKEN>         → fichier .pkpass (Apple Wallet)
//   POST {action:"google", token}          → { url } « Ajouter à Google Wallet »
//   POST {action:"sync", token, won?}      → met la carte à jour dans les deux Wallet (+ notification si cadeau)
//   POST {action:"message", k, text}       → message du commerce à tous ses clients Wallet (1 / 20 h)
//   POST {action:"daily"}                  → anniversaires + relances (pg_cron chaque matin)
//   /fid-wallet/apple/v1/...               → service web Apple (inscription des iPhone, mises à jour)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import forge from "npm:node-forge@1.3.1";
import { zipSync, strToU8 } from "npm:fflate@0.8.2";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = Deno.env.get("FID_SITE") || "https://carte-fidelite-wallet.vercel.app/";
const FN = Deno.env.get("SUPABASE_URL")! + "/functions/v1/fid-wallet";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
const env = (k: string) => (Deno.env.get(k) || "").trim();

type Card = { token: string; id: string; name: string; stamps: number; rewards_ready: number; lang: string; phone_end: string; wallet_msg?: string };
type Shop = { code: string; name: string; name_he?: string; logo: boolean; logo_v: number; theme: string; color: string; stamps_needed: number; reward?: string; reward_he?: string;
  review_url?: string; phone?: string; whatsapp?: string; instagram?: string; website?: string; address?: string; lat?: number; lon?: number; near_msg?: string; near_msg_he?: string };
async function load(token: string): Promise<{ card: Card; shop: Shop } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token || "")) return null;
  const { data } = await db.rpc("fid_wallet_data", { p_token: token });
  return data && data.card ? data : null;
}
const he = (c: Card) => c.lang === "he";
const sname = (c: Card, s: Shop) => (he(c) && s.name_he) || s.name;
const reward = (c: Card, s: Shop) => (he(c) ? s.reward_he || s.reward : s.reward || s.reward_he) || (he(c) ? "מתנה" : "Un cadeau");
const cardUrl = (c: Card) => SITE + "carte.html?c=" + c.token;
const logoUrl = (s: Shop) => `${FN}/logo/${s.code}.png?v=${s.logo_v}`;
const heroUrl = (c: Card, s: Shop) => `${FN}/hero/${c.token}/${c.stamps}-${c.rewards_ready}-${s.logo_v}-${c.lang}.png`;

// ================= Dessins (icônes de tampons + image de la carte) =================
const ci = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ICONS: Record<string, string> = {
  cafe: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 11h1.5a2.5 2.5 0 0 1 0 5H16 M8.5 3.5c-1 1 1 2 0 3 M12.5 3.5c-1 1 1 2 0 3",
  pizza: "M12 21 3.5 6.5a14 14 0 0 1 17 0z M5.6 10a11 11 0 0 1 12.8 0 " + ci(10, 12.5, 1) + " " + ci(14, 13.5, 1) + " " + ci(12, 16.5, 1),
  burger: "M4 11a8 6 0 0 1 16 0z M3 14.5h18 M5 17.5h14a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5z M9 8h.01 M13 7h.01",
  sushi: "M4 9a8 3 0 0 0 16 0a8 3 0 0 0-16 0v6a8 3 0 0 0 16 0V9 M9 9a3 1 0 0 0 6 0",
  bakery: "M3 15c2-6 5-9 9-9s7 3 9 9c-2 1-4 1-5-1-1 3-7 3-8 0-1 2-3 2-5 1z M9.5 9l1 5 M14.5 9l-1 5",
  beauty: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  barber: ci(6, 6, 2.8) + " " + ci(6, 18, 2.8) + " M8.3 7.7 20 19 M8.3 16.3 20 5",
  flower: ci(12, 6.5, 3) + " " + ci(17.5, 12, 3) + " " + ci(12, 17.5, 3) + " " + ci(6.5, 12, 3) + " " + ci(12, 12, 1.8),
  shop: "M5 8h14l-1.2 12H6.2z M9 8V6.5a3 3 0 0 1 6 0V8",
  sport: "M6.5 7v10 M17.5 7v10 M3.5 9.5v5 M20.5 9.5v5 M6.5 12h11",
  pet: ci(12, 15.5, 3.6) + " " + ci(6.5, 10.5, 1.8) + " " + ci(9.8, 6.5, 1.8) + " " + ci(14.2, 6.5, 1.8) + " " + ci(17.5, 10.5, 1.8),
  heart: "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z",
  gift: "M4.5 10.5h15V20h-15z M3.5 7.5h17v3h-17z M12 7.5V20 M12 7.5C10 3.5 6 4.5 8 7.5 M12 7.5c2-4 6-3 4 0",
};
function shade(hex: string, k: number) {   // k > 0 éclaircit, k < 0 assombrit
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "") ? parseInt(hex.replace("#", ""), 16) : 0x7a3e1d;
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  const r = ch(m >> 16 & 255), g = ch(m >> 8 & 255), b = ch(m & 255);
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
// L'image des tampons : bande colorée avec petits confettis, pastilles crème (tampon fait = icône), dernière = cadeau doré
function heroSvg(s: Shop, stamps: number, gifts: number, W: number, H: number, rtl = false) {
  const n = s.stamps_needed, cols = n <= 5 ? n : n <= 12 ? Math.ceil(n / 2) : Math.ceil(n / 3), rows = Math.ceil(n / cols);
  const pad = H * 0.12, cell = Math.min((W - pad * 2) / cols, (H - pad * 2) / rows), r = cell * 0.38;
  const gx = (W - cols * cell) / 2, gy = (H - rows * cell) / 2;
  const base = s.color || "#7A3E1D", light = shade(base, 0.25), dark = shade(base, -0.25), cream = "#FFF6EA", gold = "#FFC542";
  const icon = ICONS[s.theme] || ICONS.heart;
  let dots = "";
  for (let i = 0; i < 26; i++) { const x = (i * 197) % W, y = (i * 131) % H, rr = 3 + (i % 4) * 2; dots += `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff" opacity="${0.06 + (i % 3) * 0.03}"/>`; }
  let cells = "";
  for (let i = 0; i < n; i++) {
    const col = rtl ? cols - 1 - (i % cols) : i % cols, cx = gx + col * cell + cell / 2, cy = gy + Math.floor(i / cols) * cell + cell / 2, on = i < stamps, last = i === n - 1;
    const sc = (r * 1.32) / 24, rot = on ? ((i * 37) % 13) - 6 : 0, q = r * 0.42;
    const ic = (stroke: string, op: number, d: string, w: number) => `<g transform="translate(${cx} ${cy}) rotate(${rot}) translate(${-12 * sc} ${-12 * sc}) scale(${sc})" fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;
    const tile = (fill: string, fo: number, stroke = "none", sw = 0) => `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="${q}" fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-width="${sw}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    if (on) cells += `<rect x="${cx - r}" y="${cy - r + r * 0.12}" width="${2 * r}" height="${2 * r}" rx="${q}" fill="${dark}" opacity=".35" transform="rotate(${rot} ${cx} ${cy})"/>` + tile(cream, 1) + ic(base, 1, icon, 2.2);
    else if (last) cells += tile(gold, 0.18, gold, r * 0.09) + ic(gold, 1, ICONS.gift, 2);
    else cells += tile("#ffffff", 0.14) + ic(cream, 0.45, icon, 1.9);
  }
  const glow = gifts > 0 ? `<rect x="${W * 0.02}" y="${H * 0.04}" width="${W * 0.96}" height="${H * 0.92}" rx="${H * 0.12}" fill="none" stroke="${gold}" stroke-width="${H * 0.025}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>${dots}${glow}${cells}</svg>`;
}
let wasmReady: Promise<void> | null = null;
async function png(svg: string, width: number) {
  if (!wasmReady) wasmReady = initWasm(fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm"));
  await wasmReady;
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}
async function logoPng(code: string) {
  const { data } = await db.rpc("fid_logo", { p_code: code });
  const lg = String(data || "");
  if (lg.startsWith("data:image/png;base64,")) return Uint8Array.from(atob(lg.split(",")[1]), c => c.charCodeAt(0));
  if (lg.startsWith("data:image/")) {   // jpeg / webp → PNG par le moteur SVG
    return await png(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512"><image href="${lg}" width="512" height="512"/></svg>`, 512);
  }
  if (lg.startsWith("https://")) { const r = await fetch(lg); if (r.ok) return new Uint8Array(await r.arrayBuffer()); }
  const { data: sh } = await db.rpc("fid_public", { p_code: code });
  const col = (sh && sh.color) || "#7A3E1D", ic = ICONS[(sh && sh.theme) || "heart"] || ICONS.heart;
  return await png(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="120" fill="${col}"/>
    <g transform="translate(96 96) scale(13.3)" fill="none" stroke="#FFF6EA" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${ic}"/></g></svg>`, 512);
}
const pngRes = (b: Uint8Array) => new Response(b, { headers: { ...CORS, "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });

// ================= GOOGLE WALLET =================
const b64url = (s: Uint8Array) => { let bin = ""; for (const x of s) bin += String.fromCharCode(x); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const b64urlStr = (s: string) => b64url(new TextEncoder().encode(s));
// Clés Google : secrets d'environnement, sinon le coffre-fort chiffré Supabase (Vault : fid_google_sa, fid_google_issuer)
let GSA: any = undefined, GISS = "";
async function loadGoogle() {
  if (GSA !== undefined && GISS) return;
  const vault = async (n: string) => { const { data } = await db.rpc("fid_vault", { p_name: n }); return (data as string) || ""; };
  const raw = env("GOOGLE_WALLET_SA_JSON") || await vault("fid_google_sa");
  try { GSA = raw ? JSON.parse(raw) : null; } catch { GSA = null; }
  GISS = env("GOOGLE_WALLET_ISSUER_ID") || (await vault("fid_google_issuer")).trim();
}
function googleSa() { return GSA && GISS ? GSA : null; }
async function rsaSign(pemKey: string, data: string) {
  const der = Uint8Array.from(atob(pemKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data))));
}
async function jwt(sa: any, payload: Record<string, unknown>) {
  const h = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" })), b = b64urlStr(JSON.stringify(payload));
  return `${h}.${b}.${await rsaSign(sa.private_key, h + "." + b)}`;
}
let gTok: { at: number; v: string } | null = null;
async function googleToken(sa: any) {
  if (gTok && Date.now() - gTok.at < 50 * 60000) return gTok.v;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await jwt(sa, { iss: sa.client_email, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("google_auth");
  gTok = { at: Date.now(), v: j.access_token };
  return gTok.v;
}
const gIds = (c: Card, s: Shop) => { const iss = GISS; return { cls: `${iss}.fid_${s.code.toLowerCase()}`, obj: `${iss}.c_${c.id.replace(/-/g, "")}` }; };
const loc = (fr: string, hb: string) => ({ defaultValue: { language: "fr", value: fr || hb }, translatedValues: [{ language: "iw", value: hb || fr }] });
function gClass(c: Card, s: Shop) {
  return { id: gIds(c, s).cls, issuerName: s.name, programName: s.name, localizedProgramName: loc(s.name, s.name_he || s.name),
    programLogo: { sourceUri: { uri: logoUrl(s) } }, hexBackgroundColor: s.color || "#7A3E1D", reviewStatus: "UNDER_REVIEW", countryCode: "IL",
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    ...(s.lat != null && s.lon != null ? { merchantLocations: [{ latitude: s.lat, longitude: s.lon }] } : {}) };
}
function gObject(c: Card, s: Shop) {
  const ids = gIds(c, s), links: { uri: string; description: string; id: string }[] = [{ uri: cardUrl(c), description: he(c) ? "הכרטיס שלי" : "Ma carte", id: "card" }];
  if (s.review_url) links.push({ uri: s.review_url, description: he(c) ? "השאירו ביקורת בגוגל ⭐" : "Laisser un avis Google ⭐", id: "review" });
  if (s.instagram) links.push({ uri: "https://instagram.com/" + s.instagram, description: "Instagram", id: "ig" });
  if (s.website) links.push({ uri: s.website, description: he(c) ? "האתר" : "Site web", id: "web" });
  if (s.phone) links.push({ uri: "tel:" + s.phone, description: he(c) ? "להתקשר" : "Appeler", id: "tel" });
  if (s.address) links.push({ uri: "https://maps.google.com/?q=" + encodeURIComponent(s.address), description: he(c) ? "איך מגיעים" : "Itinéraire", id: "map" });
  return { id: ids.obj, classId: ids.cls, state: "ACTIVE", accountId: c.phone_end, accountName: c.name,
    loyaltyPoints: { label: he(c) ? "חותמות" : "Tampons", balance: { string: `${c.stamps} / ${s.stamps_needed}` } },
    secondaryLoyaltyPoints: { label: he(c) ? "מתנות" : "Cadeaux", balance: { int: c.rewards_ready } },
    heroImage: { sourceUri: { uri: heroUrl(c, s) }, contentDescription: loc(`${c.stamps} / ${s.stamps_needed}`, `${c.stamps} / ${s.stamps_needed}`) },
    barcode: { type: "QR_CODE", value: c.token, alternateText: c.name },
    textModulesData: [{ id: "reward", header: he(c) ? `${s.stamps_needed} חותמות =` : `${s.stamps_needed} tampons =`, body: reward(c, s) },
      ...(c.wallet_msg ? [{ id: "msg", header: he(c) ? "הודעה" : "Message", body: c.wallet_msg }] : [])],
    linksModuleData: { uris: links } };
}
async function googleSaveUrl(c: Card, s: Shop) {
  const sa = googleSa();
  if (!sa) throw new Error("google_not_ready");
  const t = await jwt(sa, { iss: sa.client_email, aud: "google", typ: "savetowallet", origins: [SITE.replace(/\/$/, "")],
    payload: { loyaltyClasses: [gClass(c, s)], loyaltyObjects: [gObject(c, s)] } });
  return "https://pay.google.com/gp/v/save/" + t;
}
async function googleSync(c: Card, s: Shop, message?: string) {
  const sa = googleSa();
  if (!sa) return false;
  const tk = await googleToken(sa), h = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
  const base = "https://walletobjects.googleapis.com/walletobjects/v1/";
  fetch(base + "loyaltyClass/" + gIds(c, s).cls, { method: "PATCH", headers: h, body: JSON.stringify(gClass(c, s)) }).catch(() => {});
  const o = gObject(c, s), url = base + "loyaltyObject/" + o.id;
  const r = await fetch(url, { method: "PATCH", headers: h, body: JSON.stringify({ loyaltyPoints: o.loyaltyPoints, secondaryLoyaltyPoints: o.secondaryLoyaltyPoints,
    heroImage: o.heroImage, textModulesData: o.textModulesData, linksModuleData: o.linksModuleData }) });
  if (r.status === 404) return false;
  if (message) await fetch(url + "/addMessage", { method: "POST", headers: h, body: JSON.stringify({ message: { header: sname(c, s), body: message, id: "m" + Date.now(), messageType: "TEXT_AND_NOTIFY" } }) });
  return r.ok;
}

// ================= APPLE WALLET =================
const appleReady = () => !!(env("APPLE_PASS_TYPE_ID") && env("APPLE_TEAM_ID") && env("APPLE_PASS_CERT_PEM") && env("APPLE_PASS_KEY_PEM") && env("APPLE_WWDR_PEM"));
const pem = (k: string) => env(k).replace(/\\n/g, "\n");
async function authToken(c: Card) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("SUPABASE_SERVICE_ROLE_KEY") + ":fid-apple"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(c.id)));
  return Array.from(s.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
}
const rgb = (h: string) => { const v = parseInt((h || "#7A3E1D").replace("#", ""), 16); return `rgb(${v >> 16 & 255}, ${v >> 8 & 255}, ${v & 255})`; };
async function buildPkpass(c: Card, s: Shop) {
  const near = (he(c) ? s.near_msg_he || s.near_msg : s.near_msg || s.near_msg_he) || (he(c) ? `אתם ליד ${sname(c, s)}! 👋` : `Vous êtes tout près de ${s.name} ! 👋`);
  const back = [{ key: "link", label: he(c) ? "הכרטיס שלי" : "Ma carte", value: cardUrl(c) }];
  if (s.review_url) back.push({ key: "review", label: he(c) ? "ביקורת בגוגל" : "Avis Google", value: s.review_url });
  if (s.phone) back.push({ key: "tel", label: he(c) ? "טלפון" : "Téléphone", value: s.phone });
  if (s.address) back.push({ key: "addr", label: he(c) ? "כתובת" : "Adresse", value: s.address });
  if (s.instagram) back.push({ key: "ig", label: "Instagram", value: "https://instagram.com/" + s.instagram });
  if (s.website) back.push({ key: "web", label: he(c) ? "אתר" : "Site", value: s.website });
  const pass: Record<string, unknown> = {
    formatVersion: 1, passTypeIdentifier: env("APPLE_PASS_TYPE_ID"), teamIdentifier: env("APPLE_TEAM_ID"), serialNumber: c.id,
    organizationName: sname(c, s), description: (he(c) ? "כרטיס מועדון " : "Carte de fidélité ") + sname(c, s), logoText: sname(c, s),
    foregroundColor: "rgb(255, 255, 255)", labelColor: "rgb(255, 236, 210)", backgroundColor: rgb(s.color),
    webServiceURL: FN + "/apple", authenticationToken: await authToken(c),
    barcodes: [{ format: "PKBarcodeFormatQR", message: c.token, messageEncoding: "iso-8859-1", altText: c.name }],
    storeCard: {
      headerFields: [{ key: "stamps", label: he(c) ? "חותמות" : "TAMPONS", value: `${c.stamps}/${s.stamps_needed}`, changeMessage: he(c) ? "חותמת חדשה! %@" : "Nouveau tampon ! %@" }],
      secondaryFields: [{ key: "member", label: he(c) ? "חבר/ה" : "MEMBRE", value: c.name },
        { key: "gifts", label: he(c) ? "מתנות" : "CADEAUX", value: c.rewards_ready, changeMessage: he(c) ? "מתנה מחכה לכם! 🎁" : "Un cadeau vous attend ! 🎁" }],
      auxiliaryFields: [{ key: "reward", label: he(c) ? `${s.stamps_needed} חותמות =` : `${s.stamps_needed} TAMPONS =`, value: reward(c, s) }],
      backFields: [...back, { key: "msg", label: he(c) ? "הודעה" : "Message", value: c.wallet_msg || "", changeMessage: "%@" }],
    },
  };
  if (s.lat != null && s.lon != null) pass.locations = [{ latitude: s.lat, longitude: s.lon, relevantText: near }];
  const files: Record<string, Uint8Array> = { "pass.json": strToU8(JSON.stringify(pass)) };
  const lg = await logoPng(s.code);
  files["icon.png"] = lg; files["icon@2x.png"] = lg; files["logo.png"] = lg; files["logo@2x.png"] = lg;
  files["strip.png"] = await png(heroSvg(s, c.stamps, c.rewards_ready, 1125, 432, he(c)), 375);
  files["strip@2x.png"] = await png(heroSvg(s, c.stamps, c.rewards_ready, 1125, 432, he(c)), 750);
  files["strip@3x.png"] = await png(heroSvg(s, c.stamps, c.rewards_ready, 1125, 432, he(c)), 1125);
  const manifest: Record<string, string> = {};
  for (const [n, b] of Object.entries(files)) { const md = forge.md.sha1.create(); md.update(forge.util.binary.raw.encode(b)); manifest[n] = md.digest().toHex(); }
  const man = JSON.stringify(manifest);
  files["manifest.json"] = strToU8(man);
  const cert = forge.pki.certificateFromPem(pem("APPLE_PASS_CERT_PEM")), wwdr = forge.pki.certificateFromPem(pem("APPLE_WWDR_PEM"));
  const key = env("APPLE_PASS_KEY_PASSWORD") ? forge.pki.decryptRsaPrivateKey(pem("APPLE_PASS_KEY_PEM"), env("APPLE_PASS_KEY_PASSWORD")) : forge.pki.privateKeyFromPem(pem("APPLE_PASS_KEY_PEM"));
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(man, "utf8");
  p7.addCertificate(cert); p7.addCertificate(wwdr);
  p7.addSigner({ key, certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }, { type: forge.pki.oids.signingTime, value: new Date() }] });
  p7.sign({ detached: true });
  files["signature"] = Uint8Array.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), ch => ch.charCodeAt(0));
  return zipSync(files);
}
const pkpass = (b: Uint8Array, c: Card) => new Response(b, { headers: { ...CORS, "Content-Type": "application/vnd.apple.pkpass",
  "Content-Disposition": `attachment; filename="carte-${c.id.slice(0, 8)}.pkpass"`, "Last-Modified": new Date().toUTCString() } });
async function applePush(cardId: string) {
  if (!appleReady()) return 0;
  const { data } = await db.from("fid_apple_devices").select("push_token").eq("card_id", cardId).eq("active", true);
  if (!data || !data.length) return 0;
  let client: unknown;
  // @ts-ignore certificat client (APNs) selon l'environnement d'exécution
  try { client = Deno.createHttpClient({ cert: pem("APPLE_PASS_CERT_PEM"), key: pem("APPLE_PASS_KEY_PEM"), http2: true }); } catch { return 0; }
  let n = 0;
  for (const d of data) {
    try {
      const r = await fetch("https://api.push.apple.com/3/device/" + d.push_token, { method: "POST", client,
        headers: { "apns-topic": env("APPLE_PASS_TYPE_ID"), "apns-push-type": "background", "apns-priority": "5" }, body: "{}" } as RequestInit);
      if (r.ok) n++;
    } catch { /* l'iPhone se mettra à jour plus tard */ }
  }
  return n;
}
async function bySerial(serial: string) {
  if (!/^[0-9a-f-]{36}$/i.test(serial)) return null;
  const { data } = await db.from("fid_cards").select("token").eq("id", serial).maybeSingle();
  return data ? await load(data.token) : null;
}
async function appleService(req: Request, p: string[]) {
  if (p[1] === "log") return new Response(null, { status: 200 });
  const auth = (req.headers.get("Authorization") || "").replace(/^ApplePass\s+/i, "");
  if (p[1] === "passes") {
    const x = await bySerial(p[3]);
    if (!x || auth !== await authToken(x.card)) return new Response(null, { status: 401 });
    return pkpass(await buildPkpass(x.card, x.shop), x.card);
  }
  if (p[1] === "devices" && p[3] === "registrations") {
    const dev = p[2];
    if (p.length >= 6) {
      const x = await bySerial(p[5]);
      if (!x || auth !== await authToken(x.card)) return new Response(null, { status: 401 });
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (!body.pushToken) return new Response(null, { status: 400 });
        const { data: old } = await db.from("fid_apple_devices").select("active").eq("device_id", dev).eq("card_id", x.card.id).maybeSingle();
        await db.from("fid_apple_devices").upsert({ device_id: dev, card_id: x.card.id, push_token: body.pushToken, active: true, updated_at: new Date().toISOString() });
        await db.rpc("fid_wallet_mark", { p_token: x.card.token });
        return new Response(null, { status: old && old.active ? 200 : 201 });
      }
      if (req.method === "DELETE") {
        await db.from("fid_apple_devices").update({ active: false, updated_at: new Date().toISOString() }).eq("device_id", dev).eq("card_id", x.card.id);
        return new Response(null, { status: 200 });
      }
    } else if (req.method === "GET") {
      const since = new URL(req.url).searchParams.get("passesUpdatedSince");
      const { data: regs } = await db.from("fid_apple_devices").select("card_id").eq("device_id", dev).eq("active", true);
      const ids = (regs || []).map(r => r.card_id);
      if (!ids.length) return new Response(null, { status: 204 });
      let q = db.from("fid_cards").select("id, updated_at").in("id", ids);
      if (since) q = q.gt("updated_at", since);
      const { data: cards } = await q;
      if (!cards || !cards.length) return new Response(null, { status: 204 });
      return json({ lastUpdated: cards.map(c => c.updated_at).sort().pop(), serialNumbers: cards.map(c => c.id) });
    }
  }
  return new Response(null, { status: 404 });
}

async function syncAll(c: Card, s: Shop, message?: string) {
  if (message) { await db.from("fid_cards").update({ wallet_msg: message }).eq("id", c.id); c.wallet_msg = message; }
  const [g, a] = await Promise.all([googleSync(c, s, message).catch(() => false), applePush(c.id).catch(() => 0)]);
  return { google: g, apple: a };
}
const DEFAULT = {
  relance: (c: Card, s: Shop) => he(c) ? `מתגעגעים! מחכים לכם ב-${sname(c, s)} 💛` : `Ça fait longtemps ! On vous attend chez ${s.name} 💛`,
  birthday: (c: Card, _s: Shop) => he(c) ? "יום הולדת שמח! 🎂 מתנה מחכה לכם" : "Joyeux anniversaire ! 🎂 Un cadeau vous attend",
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/fid-wallet\/?/, "").split("/").filter(Boolean);
  try {
    await loadGoogle();
    if (path[0] === "apple") return await appleService(req, path.slice(1));
    if (path[0] === "logo" && path[1]) return pngRes(await logoPng(path[1].replace(/\.png$/, "").toUpperCase()));
    if (path[0] === "hero" && path[1]) {
      const x = await load(path[1]);
      if (!x) return new Response(null, { status: 404 });
      return pngRes(await png(heroSvg(x.shop, x.card.stamps, x.card.rewards_ready, 1032, 336, he(x.card)), 1032));
    }
    if (req.method === "GET" && url.searchParams.get("apple")) {
      const x = await load(url.searchParams.get("apple")!);
      if (!x) return json({ error: "unknown_card" }, 404);
      if (!appleReady()) return json({ error: "apple_not_ready" }, 503);
      const b = await buildPkpass(x.card, x.shop);
      await db.rpc("fid_wallet_mark", { p_token: x.card.token });
      return pkpass(b, x.card);
    }
    if (req.method === "GET") return json({ google: !!googleSa(), apple: appleReady() });
    const body = await req.json().catch(() => ({}));
    if (body.action === "google") {
      const x = await load(body.token);
      if (!x) return json({ error: "unknown_card" }, 404);
      const u = await googleSaveUrl(x.card, x.shop);
      await db.rpc("fid_wallet_mark", { p_token: x.card.token });
      return json({ url: u });
    }
    if (body.action === "sync") {
      const x = await load(body.token);
      if (!x) return json({ error: "unknown_card" }, 404);
      const msg = body.won && x.card.rewards_ready > 0 ? (he(x.card) ? `כל הכבוד! ${reward(x.card, x.shop)} מחכה לכם 🎁` : `Bravo ! ${reward(x.card, x.shop)} vous attend 🎁`) : undefined;
      return json(await syncAll(x.card, x.shop, msg));
    }
    if (body.action === "message") {
      const text = String(body.text || "").trim().slice(0, 200);
      if (text.length < 5 || !/^[0-9a-f-]{36}$/i.test(body.k || "")) return json({ error: "bad_request" }, 400);
      const { data, error } = await db.rpc("fid_broadcast_ok", { p_token: body.k });
      if (error) return json({ error: /broadcast_wait/.test(error.message) ? "broadcast_wait" : "unknown_shop" }, 400);
      let n = 0;
      for (const t of (data.tokens || []).slice(0, 3000)) { const x = await load(t); if (x) { const r = await syncAll(x.card, x.shop, text); if (r.google || r.apple) n++; } }
      return json({ sent: n });
    }
    if (body.action === "daily") {
      const { data } = await db.rpc("fid_daily");
      let n = 0;
      for (const d of data || []) {
        const x = await load(d.token);
        if (!x) continue;
        const txt = d.text ? (d.kind === "birthday" ? (he(x.card) ? "יום הולדת שמח! 🎂 " : "Joyeux anniversaire ! 🎂 ") + d.text : d.text) : (DEFAULT as any)[d.kind](x.card, x.shop);
        await syncAll(x.card, x.shop, txt); n++;
      }
      return json({ sent: n });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const m = String((e as Error).message || e);
    return json({ error: /not_ready/.test(m) ? m : "server_error", detail: m.slice(0, 200) }, /not_ready/.test(m) ? 503 : 500);
  }
});
