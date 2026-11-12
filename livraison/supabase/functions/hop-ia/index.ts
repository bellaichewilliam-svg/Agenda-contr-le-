// hop-ia : l'IA Gemini de HOP! (quota gratuit du patron ; clé GEMINI_API_KEY dans les secrets Supabase, jamais dans l'appli).
// Sécurité : la fonction ne traite QUE des demandes déjà écrites dans la table ia_jobs (par la base / le patron),
// reçues par leur id. Un inconnu qui appelle la fonction ne peut donc rien faire avec le quota.
// Jamais de nom, téléphone ou adresse de client envoyés à l'IA : seulement des produits, des textes, des questions générales.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// (12/11 : les 2.5 ne sont plus ouverts aux nouvelles clés ; « lite » d'abord = réponse rapide, les autres en secours si Google est saturé)
const MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.6-flash"];
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function gemini(prompt: string, json: boolean, image = ""): Promise<string> {
  let last = "";
  for (const m of MODELS) {
    const t0 = Date.now();
    // Peu de « réflexion » : réponse en quelques secondes au lieu de 20 s (assez pour ces petites tâches)
    const thinking = { thinkingConfig: { thinkingLevel: "low" } };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: image ? [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: image } }] : [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, ...thinking, ...(json ? { responseMimeType: "application/json" } : {}) },
      }),
    });
    const t = await r.text();
    console.log(`gemini ${m} ${r.status} ${Date.now() - t0} ms`);
    if (r.ok) {
      const d = JSON.parse(t);
      return (d.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    }
    last = `${m} ${r.status}: ${t.slice(0, 300)}`;
    if (r.status === 401 || r.status === 403 || /API key/i.test(t)) break; // clé refusée : inutile d'essayer un autre modèle
  }
  throw new Error(last || "gemini_indisponible");
}

// Les tâches autorisées (rien d'autre)
async function run(kind: string, input: Record<string, unknown>): Promise<unknown> {
  // Les modèles Gemini ouverts à la clé (Google en retire de temps en temps : on choisit les bons avec ça)
  if (kind === "modeles") {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": KEY } });
    const d = await r.json();
    return { models: (d.models ?? []).filter((m: { supportedGenerationMethods?: string[] }) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m: { name: string }) => m.name) };
  }
  if (kind === "test") return { reply: await gemini("Réponds en une phrase en français puis la même en hébreu : « HOP! est prêt à livrer Netanya ».", false) };
  // 📷 Photo d'une liste de courses (ou d'un produit) : on ne garde que les articles à acheter, jamais un nom, un
  // téléphone ou une adresse qui seraient sur la photo. La photo est effacée de la demande dès qu'elle est lue.
  if (kind === "lire_liste") {
    const img = String(input.image ?? "").replace(/^data:image\/\w+;base64,/, "");
    if (img.length < 400) return { text: "" };
    const he = input.lang === "he";
    const prompt = `Cette photo montre une liste de courses (écrite à la main ou imprimée, en français, en hébreu ou les deux), ou bien un produit à acheter.
Recopie UNIQUEMENT les articles à acheter, avec leur quantité s'il y en a une, séparés par des virgules, en ${he ? "hébreu" : "français"} (ex. ${he ? "« 2 חלב, לחם, 6 ביצים »" : "« 2 lait, pain, 6 œufs »"}). Pour un produit photographié : sa marque et son nom.
N'écris JAMAIS un nom de personne, un numéro de téléphone, une adresse ou un prix, même s'ils sont sur la photo. Aucune phrase, aucun commentaire.
Si la photo ne montre ni liste ni produit, ou si elle est illisible : réponds exactement ?`;
    const text = (await gemini(prompt, false, img)).replace(/\s+/g, " ").trim().slice(0, 380);
    return { text: text.length < 2 || text === "?" ? "" : text };
  }
  if (kind === "traduire_produits") {
    const items = (input.items as { id: string; he: string }[] ?? []).slice(0, 60);
    if (!items.length) return { items: [] };
    const prompt = `Tu traduis des noms de produits de supermarché israélien (hébreu) en français, pour une appli de livraison.
Format exact de chaque nom : « Marque · produit taille » (ex. « Tnuva · Lait 3 % 1 L », « Osem · Bamba 80 g »). Marque en lettres latines si elle est connue.
Pas de prix, pas de « promo », tailles en g / kg / ml / L, « × » pour les lots (ex. « 6 × 1,5 L »).
Réponds en JSON : un tableau [{"id": "...", "fr": "..."}] dans le même ordre.
Produits : ${JSON.stringify(items)}`;
    return { items: JSON.parse(await gemini(prompt, true)) };
  }
  // Commande à la voix (patron, 12/11) : « je veux un Mars et un lait », « un riz tartare chez Nini Sushi, livré à la maison »
  if (kind === "commande_vocale") {
    const text = String(input.text ?? "").slice(0, 400);
    const shops = (input.shops as { code: string; name: string }[] ?? []).slice(0, 200);
    const prompt = `Tu es l'assistant de HOP!, une appli de livraison à Netanya (Israël). Un client a dit à voix haute (français ou hébreu, transcription automatique, peut contenir des fautes) :
« ${text} »
Comprends sa commande. Commerces disponibles sur l'appli (code et nom) : ${JSON.stringify(shops)}
Réponds en JSON, exactement :
{"shop": code du commerce SEULEMENT si le client dit lui-même le nom d'un commerce de la liste (même mal prononcé ou mal écrit, ex. « Nina Sushi » pour « Nini Sushi »). S'il ne dit aucun nom de commerce, null : ne choisis jamais un commerce à sa place,
 "items": [{"name": nom court du produit ou du plat, dans la langue du client, sans quantité ni article (ex. "Mars", "lait", "riz tartare", "חלב"), "qty": nombre}],
 "to": "maison" s'il dit chez moi / à la maison / הביתה, "travail" s'il dit au travail / au bureau / לעבודה, sinon null,
 "lang": "fr" ou "he" (langue du client),
 "reply": une phrase courte et chaleureuse dans la langue du client qui résume ce que tu as compris (ex. « 1 Mars et 1 lait, c'est noté ! »)}
Ne mets jamais d'adresse, de nom de personne ou de numéro de téléphone dans la réponse. Si ce n'est pas une commande, renvoie "items": [] et une "reply" qui invite à dire ce qu'il veut.`;
    const out = JSON.parse(await gemini(prompt, true));
    const codes = new Set(shops.map(x => x.code));
    return {
      shop: typeof out.shop === "string" && codes.has(out.shop) ? out.shop : null,
      items: (Array.isArray(out.items) ? out.items : []).slice(0, 12).map((i: { name?: unknown; qty?: unknown }) => ({ name: String(i.name ?? "").slice(0, 60), qty: Math.max(1, Math.min(20, Number(i.qty) || 1)) })).filter((i: { name: string }) => i.name),
      to: out.to === "maison" || out.to === "travail" ? out.to : null,
      lang: out.lang === "he" ? "he" : "fr",
      reply: String(out.reply ?? "").slice(0, 200),
    };
  }
  // 🎤 Hoppy, l'assistant qui parle (patron, 12/11) : une vraie conversation, à la voix ou par écrit, en français ou en hébreu.
  // Il comprend, pose les questions qu'il faut (quelle marque, adresse, étage, code, nom, téléphone…), propose des
  // produits proches (un Bounty avec un Mars), puis lance la commande dans l'appli. Le client ne cherche plus rien.
  if (kind === "assistant") return await assistant(input);
  // 💬 Le chat client (patron, 12/11) : Hoppy répond au nom du service client, passe la main à l'équipe quand il faut
  if (kind === "chat") return await chatReply(input);
  throw new Error("tache_inconnue");
}

// Recherche des vrais produits des commerces (même recherche que l'appli), plusieurs demandes en parallèle
const STOP = new Set(("je j veux voudrais voulais aimerais besoin donne donnez moi me m un une des du de d la le les l et avec svp stp plait plaît s il te vous " +
  "chez pour a à au aux en sur livrer livre livré livrez apporte apportez amener prendre commander commande acheter cherche trouve " +
  "maison travail bureau aussi encore oui non merci bonjour salut paquet paquets bouteille bouteilles " +
  "אני רוצה רציתי צריך צריכה תביא תביאו לי בבקשה של עם את גם הביתה לעבודה תודה כן לא שלום").split(/\s+/));
function chunks(text: string): string[] {
  return String(text || "").toLowerCase().split(/\s*(?:,|;|\n|\+|\s(?:et|puis|avec|and|ou)\s|\sוגם\s|\sו(?=[א-ת]{2}))\s*/)
    .map(c => c.replace(/[«»"!?.:]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w.replace(/^[ld]['’]/, "")) && !/^\d+$/.test(w)).join(" ").trim())
    .filter(c => c.length >= 2).slice(0, 5);
}
async function findProducts(queries: string[]): Promise<string[]> {
  const uniq = [...new Set(queries.map(q => q.trim()).filter(q => q.length >= 2))].slice(0, 6);
  const res = await Promise.all(uniq.map(q => db.rpc("products_search_v3", { p_q: q }).then(r => (r.data as { id: string; name: string; price: number; code: string; shop: string }[] | null) ?? [], () => [])));
  const out: string[] = [], seen = new Set<string>();
  res.forEach((list, k) => list.slice(0, 7).forEach(p => {
    const ref = `p:${p.code}:${p.id}`;
    if (seen.has(ref)) return; seen.add(ref);
    out.push(`${ref} | ${String(p.name).slice(0, 90)} | ${p.price} ₪ | ${String(p.shop).slice(0, 40)} | (cherché : ${uniq[k]})`);
  }));
  return out.slice(0, 40);
}

type Hist = { r: string; t: string };
async function assistant(input: Record<string, unknown>) {
  const he = input.lang === "he";
  const hist = ((input.history as Hist[]) ?? []).slice(-14).map(h => `${h.r === "c" ? "CLIENT" : "HOPPY"} : ${String(h.t).slice(0, 300)}`).join("\n");
  const text = String(input.text ?? "").slice(0, 400);
  const ctx = JSON.stringify(input.ctx ?? {}).slice(0, 3000);
  const rayons = String(input.rayons ?? "").slice(0, 26000);
  const shops = JSON.stringify(((input.shops as unknown[]) ?? []).slice(0, 80)).slice(0, 5000);
  let found = await findProducts(chunks(text));
  const ask = (extra: string) => `Tu es Hoppy (הופי), le kangourou de HOP!, appli de livraison à Netanya (Israël). Tu parles au client à voix haute :
phrases TRÈS courtes (1 ou 2), chaleureuses, simples, dans la langue du client (${he ? "hébreu" : "français"} par défaut ; s'il parle l'autre langue, réponds dans la sienne).
En français, toujours « vous » (jamais « tu »). En hébreu : seulement des lettres hébraïques, sans faute.
Ton but : le client ne cherche rien et ne touche à rien. Tu mènes la commande jusqu'au bout, une question à la fois.

CE QUE HOP! LIVRE :
- « Courses HOP! » (rayons ci-dessous : pharmacie, tabac, boulangerie, supérette, bébé, animaux, maison…) : le livreur l'achète au magasin le plus proche, au prix du magasin. ref = "r:<rayon>:<id>|<n° option>" (option : le numéro dans la liste des options, sinon 0 ; sans options : "r:<rayon>:<id>").
- Les commerces sur HOP! (restaurants, HOP! chez Carrefour, Victory…) : produits trouvés ci-dessous, ref = "p:<CODE>:<id>". Un plat de restaurant vient de ce restaurant.
- Récupérer un colis (poste, point relais) : service "poste" (le client collera le SMS de la poste dans l'appli). Envoyer / déposer un objet, des clés, des documents : service "colis".
- Livraison : 25 ₪ en ville, 30 ₪ vers une zone industrielle ou un quartier à part (dis « dès 25 ₪ »). Jamais de durée chiffrée : dis « au plus vite ». Ne cite jamais d'autre appli ni de « partenaire ».
- Tabac / alcool : 18 ans et plus, pièce d'identité montrée au livreur. « Cigarettes » = le rayon tabac (Marlboro, Winston…), jamais des biscuits « cigares ». Prix du tabac : seulement « environ X ₪ le paquet ».

COMMENT FAIRE :
1. Comprends ce qu'il veut. Produit vague (« des cigarettes », « du lait », « une pizza ») : demande lequel avec 3 à 6 choix précis tirés des listes (marque + variante, ex. « Marlboro Gold »). Ne devine pas.
2. Dès qu'un produit est choisi, mets-le dans "basket" (avec sa ref exacte). Puis propose UNE fois 1 à 3 produits qui vont avec, du MÊME magasin ou rayon, qui existent dans les listes : supérette / makolet / tabac → une boisson, de l'eau, un snack (cigarettes → briquet, Coca) ; Carrefour → un produit proche (Mars → Bounty, Snickers) ; restaurant → une boisson, un dessert ou un supplément de CE restaurant (s'ils ne sont pas dans les produits trouvés, mets "search": ["boisson", "dessert", "supplément", "תוספת"]).
   Taille, cuisson, supplément d'un plat : si le client les dit, écris-les dans "name" (ex. « Margherita grande + olives ») ; sinon l'appli ouvrira la fiche du plat et il choisira à la voix.
3. Adresse de livraison (CONTEXTE.addr) : "to" vrai → elle est déjà choisie, ne redemande rien. Sinon, si "home" est vrai, demande « Je livre à la maison ? » (oui → "saved": "maison" ; « au travail » → "saved": "travail"). Sinon mets "collect": "address" : l'appli pose elle-même les questions (rue, numéro, étage, appartement, code) sans toi.
4. Nom et téléphone (CONTEXTE.contact) : s'il en manque un, mets "collect": "contact" (l'appli les demande elle-même).
   Tu ne connais JAMAIS l'adresse, le nom ni le téléphone du client et tu ne les écris jamais : dis seulement « à la maison », « à votre adresse ».
5. Quand tout y est (panier + adresse + contact) : résume en une phrase (les articles) et demande « Je lance la commande ? ». S'il dit oui (« vas-y », « כן », « יאללה ») : "go": true.
6. Il pose une question (prix, horaires, comment ça marche, où est ma commande) : réponds simplement, puis reviens à la commande.
7. Commerce fermé maintenant (son code est dans CONTEXTE.closed) : dis-le gentiment et que la commande sera programmée pour l'ouverture, puis continue normalement.
8. Mars, Bounty, Snickers, lait, eau… : préfère les produits de « HOP! chez Carrefour » (code HOPCARREFOUR) quand ils sont dans les produits trouvés.
9. Produit ou marque qu'on n'a pas dans les listes (ex. des cigarettes « Kent Nanotek », une boisson rare) : propose d'abord 2 ou 3 produits proches qu'on a (même genre, même prix), et dis que s'il tient au sien, le livreur le cherche quand même au magasin. S'il garde le sien : "ref": null dans "basket".
10. Autre adresse que d'habitude (« cette fois pas à la maison », « livre chez ma mère », « au bureau ») : s'il ne la dit pas, mets "collect": "address" (même si une adresse est déjà choisie) ; l'appli la demande et l'enregistre.
11. Restaurant, magasin ou endroit qui n'est PAS dans « COMMERCES SUR HOP! » : ce n'est pas grave ! Dis-le gentiment : on va chercher sa commande prête, ou on l'achète pour lui. Mets son nom (et sa rue s'il la dit) dans "from", "service": "retrait" s'il a déjà commandé et que c'est prêt / à payer sur place, "achat" s'il faut l'acheter ; ce qu'il veut dans "basket" (ref null).
12. Il peut mélanger plusieurs magasins dans une seule commande (un Big Mac + des cigarettes Winston ; une pizza + du lait) : mets TOUT dans "basket" avec les bonnes refs ; l'appli fait une seule commande, un seul livreur passe partout.
13. « Où est ma commande ? », « elle arrive quand ? » : regarde CONTEXTE.orders. S'il y en a une, dis son état (sans durée chiffrée) et mets "action": "suivi" (l'appli ouvre le suivi en direct). Sinon dis qu'il n'y a pas de commande en cours.
14. « Comme la dernière fois », « la même chose », « כמו בפעם הקודמת » : regarde CONTEXTE.last. S'il existe, dis ce que c'était et demande « Je la refais ? » ; à son oui : "action": "refaire". Sinon dis que c'est sa première commande.
15. Il veut être livré plus tard (« pour demain matin », « ce soir à 8 h », « למחר ») : garde le panier, dis qu'il choisit le jour et l'heure à l'écran, et mets "action": "heure".
16. Il veut VOIR ce qu'on a, sans choisir un produit (« qu'est-ce que tu as à grignoter ? », « qu'est-ce qu'il y a à boire ? », « montre-moi les pizzas », « quels restaurants ? », « les promos », « מה יש לנשנש? ») : dis en une phrase 3 ou 4 exemples qu'on a vraiment, et mets "open" pour que l'appli ouvre la bonne page (il choisira à la voix dessus) : {"type": "rayon", "rayon": "<id du rayon>", "cat": "<id de la rubrique>"} (les rubriques sont sur la ligne « ## rayon | rubriques »), ou {"type": "shop", "code": "<CODE>"}, {"type": "restos"}, {"type": "promos"}, {"type": "search", "q": "mots"}.
17. CONTEXTE.deja = ce qui est déjà dans sa commande à l'écran : ne le remets pas dans "basket", mais compte-le dans ton résumé.
18. Beaucoup de clients sont âgés ou ne lisent pas : n'écris jamais « touchez » ou « regardez l'écran » sans dire aussi quoi DIRE (« dites oui », « dites continuer »). Tout doit pouvoir se faire en parlant.
19. INTERDIT de dire « partenaire » (ni « pizzeria partenaire », « restaurant partenaire », « שותף ») : dis « sur HOP! », « sur l'appli ».
20. Il demande un type de restaurant (pizzeria, sushi, burger…) : ne cite QUE les commerces de « COMMERCES SUR HOP! » qui en font vraiment (regarde leur nom et leur "kind" ; un sushi n'est pas une pizzeria). S'il n'y en a qu'un, ou s'il n'en veut pas (« pas celle-là », « une autre pizzeria »), dis clairement : on livre depuis N'IMPORTE QUELLE pizzeria (ou restaurant) de Netanya ! Il passe sa commande chez elle (téléphone ou son site), il nous dit son nom, et HOP! va la chercher et la livre. Demande alors « Quelle pizzeria ? », puis règle 11 ("from" + "service": "retrait"). N'insiste jamais sur un commerce qu'il a refusé.
Si un produit n'est pas dans les listes, mets-le quand même dans "basket" avec "ref": null (le livreur le trouve), ou mets des mots à chercher dans "search".
${String(input.regles ?? "").slice(0, 4000)}

CONTEXTE (ce que l'appli sait déjà) : ${ctx}
COMMERCES SUR HOP! : ${shops}
RAYONS « Courses HOP! » (ref | nom | prix indicatif ₪ | options numérotées) :
${rayons}
PRODUITS TROUVÉS DANS LES COMMERCES (ref | nom | prix | commerce) :
${found.join("\n") || "(rien)"}${extra}

CONVERSATION :
${hist}
CLIENT : ${text}

Réponds en JSON exactement :
{"say": ce que tu dis (court, à voix haute),
 "choices": [jusqu'à 6 réponses possibles courtes à toucher, ex. "Marlboro Gold", "Oui", "Pas de code"],
 "basket": [{"ref": "...", "name": "nom court", "qty": 1}] (TOUT le panier à jour, vide s'il n'y a rien),
 "shop": code du commerce si le panier est chez un seul commerce, sinon null,
 "service": "courses" | "restaurant" | "retrait" | "achat" | "poste" | "colis" | null,
 "from": nom du commerce hors liste (+ sa rue s'il la dit) ou null,
 "saved": "maison" | "travail" | null,
 "collect": "address" | "contact" | null,
 "colis": {"what": ce qu'il faut récupérer ou envoyer, en quelques mots} ou null,
 "action": "suivi" | "refaire" | "heure" | null,
 "open": {"type": "rayon" | "shop" | "restos" | "promos" | "search", "rayon": "", "cat": "", "code": "", "q": ""} ou null,
 "search": [mots à chercher dans les commerces si tu n'as pas trouvé], 
 "go": false}`;
  let out = JSON.parse(await gemini(ask(""), true));
  // Il manquait des produits : on cherche ce qu'il demande et on refait une seule fois
  if (Array.isArray(out.search) && out.search.length && !out.go) {
    const more = await findProducts(out.search.map(String));
    if (more.length) { found = [...found, ...more].slice(0, 60); out = JSON.parse(await gemini(ask("\n(Nouvelle recherche faite : utilise ces produits.)"), true)); }
  }
  const s = (v: unknown, n = 80) => String(v ?? "").slice(0, n);
  return {
    say: s(out.say, 400),
    choices: (Array.isArray(out.choices) ? out.choices : []).slice(0, 6).map((c: unknown) => s(c, 40)).filter(Boolean),
    basket: (Array.isArray(out.basket) ? out.basket : []).slice(0, 24).map((b: { ref?: unknown; name?: unknown; qty?: unknown }) => ({ ref: b.ref ? s(b.ref, 90) : null, name: s(b.name, 80), qty: Math.max(1, Math.min(20, Number(b.qty) || 1)) })).filter((b: { name: string }) => b.name),
    shop: out.shop ? s(out.shop, 40) : null,
    service: ["courses", "restaurant", "retrait", "achat", "poste", "colis"].includes(out.service) ? out.service : null,
    from: out.from ? s(out.from, 80) : null,
    saved: out.saved === "maison" || out.saved === "travail" ? out.saved : null,
    collect: out.collect === "address" || out.collect === "contact" ? out.collect : null,
    colis: out.colis && typeof out.colis === "object" ? { what: s(out.colis.what, 120) } : null,
    action: ["suivi", "refaire", "heure"].includes(out.action) ? out.action : null,
    open: out.open && typeof out.open === "object" && ["rayon", "shop", "restos", "promos", "search"].includes(out.open.type)
      ? { type: out.open.type, rayon: s(out.open.rayon, 20), cat: s(out.open.cat, 20), code: s(out.open.code, 40), q: s(out.open.q, 60) } : null,
    go: out.go === true,
  };
}

// 💬 Chat client : une réponse courte au dernier message, ou le relais à l'équipe, ou le silence (message pour le livreur)
async function chatReply(input: Record<string, unknown>) {
  const thread = String(input.thread ?? "");
  if (!/^[ou]:[0-9a-f-]{36}$/.test(thread)) return { mode: "silence" };
  const he = input.lang === "he";
  const hist = ((input.history as Hist[]) ?? []).slice(-12);
  const roles: Record<string, string> = { c: "CLIENT", h: "HOP!", l: "LIVREUR", s: "ÉTAPE" };
  const conv = hist.map(h => `${roles[h.r] ?? "?"} : ${String(h.t).slice(0, 400)}`).join("\n");
  const last = [...hist].reverse().find(h => h.r === "c");
  const found = last ? await findProducts(chunks(String(last.t))) : [];
  const prompt = `Tu réponds dans le chat de HOP!, appli de livraison à Netanya (Israël), au nom du service client.
Réponds au DERNIER message du CLIENT : 1 à 3 phrases courtes, chaleureuses, simples, dans sa langue (${he ? "hébreu" : "français"} ; s'il écrit dans l'autre langue, réponds dans la sienne). En français : « vous ». En hébreu : sans faute.
Ce que tu sais :
- HOP! livre tout dans Netanya : repas de n'importe quel restaurant, courses (makolet, supermarché, pharmacie, tabac 18+), colis, objets à récupérer ou envoyer, poste. Livraison dès 25 ₪ en ville, 30 ₪ vers une zone industrielle ou un quartier à part ; le prix exact s'affiche avant de commander. Paiement : Bit, ou au livreur. Jamais de durée chiffrée : « au plus vite ».
- Pour commander : dans l'appli, touchez le micro orange de l'accueil et dites ce qu'il vous faut (Hoppy fait tout à la voix), ou choisissez une rubrique.
- États d'une course : nouvelle = on cherche un livreur ; confirmee = un livreur l'a acceptée ; recuperee = en route vers vous ; livree = livrée ; annulee = annulée. Ne promets jamais d'heure.
${String(input.regles ?? "").slice(0, 4000)}
Ne dis JAMAIS « partenaire » et ne cite aucune autre appli. N'invente rien : si tu ne sais pas, passe la main.
Tu ne fais JAMAIS toi-même : rembourser, annuler une course déjà payée ou acceptée, offrir un geste commercial, trancher une réclamation (article manquant ou abîmé, retard important, livreur introuvable, mauvais montant, problème de paiement). Dans ces cas, ou s'il demande à parler à quelqu'un : dis que tu transmets tout de suite à l'équipe qui lui répond ici même, et mets "mode": "relai".
Message destiné au LIVREUR pendant une course (« je descends », « code 1234 », « laissez devant la porte », « je suis en bas »), simple « merci », « ok », emoji : "mode": "silence" (pas de réponse).
S'il demande si tu es un robot ou une personne : réponds honnêtement que c'est l'assistant automatique de HOP!, et qu'une personne de l'équipe peut prendre le relais à tout moment.
Tu ne connais ni son nom, ni son téléphone, ni son adresse : ne les demande pas ici, l'appli les a.
CONTEXTE : ${JSON.stringify(input.ctx ?? {}).slice(0, 1500)}
PRODUITS QU'ON A (si sa question porte sur un produit ; ref | nom | prix | magasin) :
${found.slice(0, 12).join("\n") || "(rien)"}
CONVERSATION :
${conv}
Réponds en JSON exactement : {"reply": "ta réponse", "mode": "auto" | "relai" | "silence"}`;
  const out = JSON.parse(await gemini(prompt, true));
  const mode = ["auto", "relai", "silence"].includes(out.mode) ? out.mode : "auto";
  const reply = String(out.reply ?? "").trim().slice(0, 900);
  if (mode === "silence" || !reply) return { mode: "silence" };
  // (une personne de HOP! a répondu entre-temps : Hoppy se tait)
  const { data: lastHuman } = await db.from("chat_messages").select("id").eq("thread", thread).eq("author", "admin").is("ai", null)
    .gte("created_at", new Date(Date.now() - 30 * 60000).toISOString()).limit(1);
  if (lastHuman && lastHuman.length) return { mode: "silence" };
  await db.from("chat_messages").insert({ thread, author: "admin", author_name: "HOP!", body: reply, ai: mode });
  return { mode, reply };
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Appelée par la base (pg_net) et, pour la commande à la voix, directement par l'appli (plus rapide) : le premier
// qui prend la demande la traite (prise atomique), l'autre reçoit « introuvable » et lit le résultat dans la base.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  let id = "";
  try { id = String((await req.json()).id ?? ""); } catch { /* corps vide */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "id" }, 400);
  const { data: job } = await db.from("ia_jobs").update({ status: "en_cours" }).eq("id", id).eq("status", "attente").select("*").maybeSingle();
  if (!job) return reply({ error: "introuvable" }, 404);
  try {
    if (!KEY) throw new Error("cle_absente");
    const output = await run(job.kind, job.input ?? {});
    // (la photo d'une liste n'est jamais gardée : la demande ne conserve que la langue)
    const wipe = job.kind === "lire_liste" ? { input: { lang: (job.input ?? {}).lang ?? "fr" } } : {};
    await db.from("ia_jobs").update({ status: "fait", output, done_at: new Date().toISOString(), ...wipe }).eq("id", id);
    return reply({ ok: true, output });
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 500);
    await db.from("ia_jobs").update({ status: "erreur", error: msg, done_at: new Date().toISOString(), ...(job.kind === "lire_liste" ? { input: {} } : {}) }).eq("id", id);
    if (job.kind === "chat" && /^[ou]:[0-9a-f-]{36}$/.test(String(job.input?.thread ?? ""))) {
      const he = job.input?.lang === "he";
      await db.from("chat_messages").insert({ thread: job.input.thread, author: "admin", author_name: "HOP!", ai: "relai",
        body: he ? "תודה על ההודעה! צוות HOP! עונה לכם כאן בהקדם 🙂" : "Merci pour votre message ! L'équipe HOP! vous répond ici au plus vite 🙂" });
    }
    return reply({ error: msg }, 500);
  }
});
