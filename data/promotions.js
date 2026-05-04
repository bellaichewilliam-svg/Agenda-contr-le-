// Promotions actives par enseigne
// Exemples basés sur les types courants de promos en Israël :
// - "n=m"         : achetez n, payez m (ex : 3=2 sur les yaourts)
// - "category_pct": -X% sur toute une catégorie (au-dessus d'un montant éventuel)
// - "bundle"      : pack de produits liés à -X% du total
// - "second_pct"  : 2ème article à -X%
// - "threshold"   : -X₪ dès Y₪ de panier
//
// Ces données sont des MOCK pour démo. Le scraper Python (à venir)
// remplacera par les promos réelles publiées dans les flux PromoFull
// (loi de transparence des prix israélienne 2014).

const PROMOTIONS = [
  // ===== Rami Levy =====
  { id: "rl-yogurt-3-2", chain: "rami_levy", type: "n_for_m",
    title: "3 yaourts au prix de 2",
    desc: "Yoplait nature/fruits · Tnuva Pro · Danone Activia · Skyr 0% · Leben",
    products: ["yogurt-nat", "yogurt-fruit", "yogurt-greek", "yogurt-drink", "skyr", "leben"],
    n: 3, m: 2, validUntil: "2026-05-31" },

  { id: "rl-fruits-15", chain: "rami_levy", type: "category_pct",
    title: "−15% sur les fruits",
    desc: "Pommes Pink Lady/Gala · Bananes · Oranges Israël · Avocats Hass · Fraises (min 30₪)",
    category: "Fruits", pct: 15, minTotal: 30,
    validUntil: "2026-05-15" },

  { id: "rl-bbq", chain: "rami_levy", type: "bundle",
    title: "Pack BBQ : −20%",
    desc: "Off Tov poulet/schnitzel · Soglowek bœuf/merguez · Pita Berman/Lafa · Sabra/Achla houmous · Coca-Cola/Goldstar",
    requiredAny: [
      ["chicken-breast", "schnitzel", "ground-beef-17", "merguez", "kebab"],
      ["bread-white", "pita", "lafa"],
      ["humus", "tahini", "matbucha"],
      ["coke-1.5", "coke-6pack", "beer-goldstar"]
    ],
    pct: 20, validUntil: "2026-06-30" },

  { id: "rl-baby-bundle", chain: "rami_levy", type: "bundle",
    title: "Pack Bébé : −25₪",
    desc: "Couches Huggies T3/T4/T5/T6 + Lingettes Huggies (pack 4×80)",
    requiredAny: [["diapers-3", "diapers-4", "diapers-5", "diapers-6"], ["wipes"]],
    fixed: 25, validUntil: "2026-05-31" },

  // ===== Shufersal =====
  { id: "sh-pasta-2nd-50", chain: "shufersal", type: "second_pct",
    title: "2ème paquet de pâtes à −50%",
    desc: "Osem Spaghetti/Penne/Fusilli/Lasagne/Nouilles aux œufs · 500g",
    products: ["pasta-spaghetti", "pasta-penne", "pasta-fusilli", "pasta-lasagna", "pasta-noodles"],
    pct: 50, validUntil: "2026-05-20" },

  { id: "sh-coca-3-25", chain: "shufersal", type: "n_for_price",
    title: "3 Coca-Cola pour 25₪",
    desc: "Coca-Cola classique · Sprite · Fanta orange — bouteilles 1.5L, panaché autorisé",
    products: ["coke-1.5", "sprite", "fanta"],
    n: 3, price: 25, validUntil: "2026-05-25" },

  { id: "sh-cleaning-thresh", chain: "shufersal", type: "threshold",
    title: "−15₪ dès 100₪ de produits d'entretien",
    desc: "Ariel lessive · Sano vaisselle · Sano sols · Vanish détachant · Eau de Javel · Sacs poubelle",
    category: "Entretien", minTotal: 100, fixed: 15,
    validUntil: "2026-05-31" },

  { id: "sh-cheese-2-1", chain: "shufersal", type: "n_for_m",
    title: "1 fromage acheté = 1 offert",
    desc: "Tnuva Emek 28% · Tnuva Light 9% · Feta bulgare · Mozzarella râpée — barquettes 200g",
    products: ["cheese-yellow-28", "cheese-yellow-9", "feta", "mozzarella"],
    n: 2, m: 1, validUntil: "2026-05-15" },

  // ===== Carrefour =====
  { id: "cf-veggies-20", chain: "carrefour", type: "category_pct",
    title: "−20% sur les légumes frais",
    desc: "Tomates · Concombres · Poivrons · Courgettes · Aubergines · Salades — origine Israël (min 25₪)",
    category: "Légumes", pct: 20, minTotal: 25,
    validUntil: "2026-05-18" },

  { id: "cf-frozen-3-2", chain: "carrefour", type: "n_for_m",
    title: "3 surgelés au prix de 2",
    desc: "Maadanot pizza · McCain frites · Sunfrost légumes · Ben & Jerry's glaces — toute la gamme",
    category: "Surgelés", n: 3, m: 2,
    validUntil: "2026-05-31" },

  { id: "cf-coffee-bundle", chain: "carrefour", type: "bundle",
    title: "Pack café : −18%",
    desc: "Elite Turkish/Nescafé Gold + Lait Tnuva 3% + Sucre blanc Sugat",
    requiredAny: [["coffee-turkish", "coffee-instant", "coffee-beans"], ["milk-3", "milk-1"], ["sugar-white", "sugar-brown"]],
    pct: 18, validUntil: "2026-06-15" },

  // ===== Yochananof =====
  { id: "yo-chicken-pct", chain: "yochananof", type: "category_pct",
    title: "−10% sur la volaille",
    desc: "Off Tov blanc/cuisses/ailes · Off Tov entier · Off Tov foies · Schnitzel · Hod Hefer dinde",
    products: ["chicken-breast", "chicken-thigh", "chicken-wings", "chicken-whole", "chicken-liver",
               "schnitzel", "ground-chicken", "turkey-breast", "turkey-ground"],
    pct: 10, validUntil: "2026-05-25" },

  { id: "yo-snacks-2-1", chain: "yochananof", type: "n_for_m",
    title: "Bamba/Bisli : 2ème gratuit",
    desc: "Bamba 80g · Bamba familial 200g · Bisli 70g — Osem 100% cacher",
    products: ["bamba", "bamba-family", "bisli"],
    n: 2, m: 1, validUntil: "2026-05-20" },

  // ===== Victory =====
  { id: "vi-wine-3-100", chain: "victory", type: "n_for_price",
    title: "3 vins pour 100₪",
    desc: "Carmel Selected Cabernet · Yarden Mt. Hermon · Recanati Yasmin Rouge — sélection cachère mevushal",
    products: ["wine-carmel", "wine-rose", "wine-white", "wine-kiddush"],
    n: 3, price: 100, validUntil: "2026-05-31" },

  { id: "vi-thresh-200", chain: "victory", type: "threshold",
    title: "−25₪ dès 200₪ d'achats",
    desc: "Sur tout le panier — cumulable carte de fidélité Victory Plus",
    minTotal: 200, fixed: 25,
    validUntil: "2026-05-31" },

  // ===== Osher Ad =====
  { id: "oa-eggs-2-15", chain: "osher_ad", type: "n_for_price",
    title: "2 boîtes d'œufs pour 30₪",
    desc: "Tnuva Mehadrin œufs L (12 ou 30) ou XL (12) — œufs de poules en cage cacher Mehadrin",
    products: ["eggs-12-l", "eggs-12-xl", "eggs-30"],
    n: 2, price: 30, validUntil: "2026-05-22" },

  { id: "oa-spices", chain: "osher_ad", type: "n_for_m",
    title: "3 épices pour le prix de 2",
    desc: "Pereg : poivre noir/blanc · paprika doux/fort · cumin · curcuma · cannelle · muscade · cardamome · clous girofle · curry · gingembre · hawaij · baharat · origan · thym · romarin · laurier · zaatar",
    products: ["pepper", "pepper-white", "pepper-whole", "paprika-sweet", "paprika-hot",
               "cumin", "turmeric", "cinnamon", "nutmeg", "cardamom", "cloves",
               "curry", "ginger-powder", "hawaij", "baharat", "oregano", "thyme",
               "rosemary", "bay-leaves", "zaatar"],
    n: 3, m: 2, validUntil: "2026-05-30" },

  // ===== Boom =====
  { id: "boom-cleaning-pct", chain: "boom", type: "category_pct",
    title: "−12% sur l'entretien",
    desc: "Sano vaisselle/sols · Ariel lessive · Adoucissant · Eau de Javel · Sacs poubelle · Aluminium",
    category: "Entretien", pct: 12,
    validUntil: "2026-06-01" },

  // ===== Hatzi Hinam =====
  { id: "hh-bakery-thresh", chain: "hatzi_hinam", type: "threshold",
    title: "Hala offerte dès 80₪ de boulangerie",
    desc: "Hala tressée Mehadrin offerte (valeur 9.90₪) — pour Shabbat. Sur achat de pain Berman/Angel/Davidovich, pita, lafa, beigels.",
    category: "Boulangerie", minTotal: 80,
    bonusItem: "challah", bonusValue: 9.90,
    validUntil: "2026-05-31" },

  // ===== Tiv Taam =====
  { id: "tt-fish-15", chain: "tiv_taam", type: "category_pct",
    title: "−15% sur les poissons frais",
    desc: "Saumon Norvège · Daurade Israël · Tilapia · Mulet · Cabillaud · Maquereau — élevé en mer ouverte, sans hormones",
    category: "Poisson", pct: 15,
    validUntil: "2026-05-23" }
];

// ============================================
// Moteur de promos
// ============================================
//
// analyzePromos(cart, chainId?) -> { applied: [], suggestions: [], totalSaving: number }
// applied      : promos déjà déclenchées par le panier (savings calculés)
// suggestions  : promos presque déclenchées ("ajoute 1 produit pour...")
// totalSaving  : somme des économies déjà actives
//
// Si chainId est fourni, ne considère que les promos de ce magasin.
// Sinon, regroupe par magasin.

function analyzePromos(cart, products, chainId = null) {
  const cartIds = Object.keys(cart).filter(id => !cart[id].done);
  const applied = [];
  const suggestions = [];
  let totalSaving = 0;

  for (const promo of PROMOTIONS) {
    if (chainId && promo.chain !== chainId) continue;
    const result = checkPromo(promo, cart, products);
    if (!result) continue;
    if (result.triggered) {
      applied.push({ ...promo, ...result });
      totalSaving += result.saving || 0;
    } else if (result.almost) {
      suggestions.push({ ...promo, ...result });
    }
  }

  return { applied, suggestions, totalSaving };
}

function checkPromo(promo, cart, products) {
  const productMap = {};
  products.forEach(p => productMap[p.id] = p);

  // Listes d'ids candidats selon le type de promo
  const matchProducts = (ids) => ids.filter(id => cart[id] && !cart[id].done);
  const inCategoryIds = (cat) => products.filter(p => p.category === cat).map(p => p.id);
  const candidatesFor = (promo) => {
    if (promo.products) return promo.products;
    if (promo.category) return inCategoryIds(promo.category);
    return null;
  };

  switch (promo.type) {

    // 3 = 2 / 2 = 1 (achetez n, payez m)
    case "n_for_m": {
      const cands = candidatesFor(promo);
      if (!cands) return null;
      // Total quantité dans panier parmi candidats
      let totalQty = 0;
      const items = [];
      cands.forEach(id => {
        if (cart[id] && !cart[id].done) {
          totalQty += cart[id].qty;
          items.push({ id, qty: cart[id].qty, price: productMap[id]?.prices?.[promo.chain] || 0 });
        }
      });
      if (totalQty >= promo.n) {
        // Combien de "lots" complets de n ?
        const lots = Math.floor(totalQty / promo.n);
        // Economise (n-m) articles les moins chers par lot
        const sortedByPrice = items.flatMap(it => Array(it.qty).fill(it.price)).sort((a, b) => a - b);
        const savedItems = sortedByPrice.slice(0, lots * (promo.n - promo.m));
        const saving = savedItems.reduce((s, p) => s + p, 0);
        return { triggered: true, saving, items };
      } else if (totalQty >= promo.n - 1 && totalQty > 0) {
        // Presque ! Il manque (n - totalQty) produit(s)
        const missing = promo.n - totalQty;
        const cheapestMissing = cands
          .map(id => productMap[id])
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, price: p.prices?.[promo.chain] || 0 }))
          .filter(x => x.price > 0)
          .sort((a, b) => a.price - b.price)[0];
        return {
          almost: true,
          missing,
          suggest: cheapestMissing,
          potentialSaving: cheapestMissing ? cheapestMissing.price : 0
        };
      }
      return null;
    }

    // 2ème article à -X%
    case "second_pct": {
      const cands = candidatesFor(promo);
      if (!cands) return null;
      let totalQty = 0;
      let priceList = [];
      cands.forEach(id => {
        if (cart[id] && !cart[id].done) {
          totalQty += cart[id].qty;
          for (let i = 0; i < cart[id].qty; i++) {
            priceList.push(productMap[id]?.prices?.[promo.chain] || 0);
          }
        }
      });
      if (totalQty >= 2) {
        priceList.sort((a, b) => b - a);
        // Article le moins cher dans chaque paire reçoit -X%
        let saving = 0;
        for (let i = 1; i < priceList.length; i += 2) {
          saving += priceList[i] * (promo.pct / 100);
        }
        return { triggered: true, saving };
      } else if (totalQty === 1) {
        const cheapestMissing = cands
          .map(id => productMap[id])
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, price: p.prices?.[promo.chain] || 0 }))
          .filter(x => x.price > 0)
          .sort((a, b) => a.price - b.price)[0];
        return {
          almost: true,
          missing: 1,
          suggest: cheapestMissing,
          potentialSaving: cheapestMissing ? cheapestMissing.price * (promo.pct / 100) : 0
        };
      }
      return null;
    }

    // n produits pour X₪
    case "n_for_price": {
      const cands = candidatesFor(promo);
      if (!cands) return null;
      const items = [];
      let totalQty = 0;
      cands.forEach(id => {
        if (cart[id] && !cart[id].done) {
          totalQty += cart[id].qty;
          for (let i = 0; i < cart[id].qty; i++) {
            items.push(productMap[id]?.prices?.[promo.chain] || 0);
          }
        }
      });
      if (totalQty >= promo.n) {
        items.sort((a, b) => b - a);
        const lots = Math.floor(totalQty / promo.n);
        const lotItems = items.slice(0, lots * promo.n);
        const normalTotal = lotItems.reduce((s, p) => s + p, 0);
        const promoTotal = lots * promo.price;
        const saving = Math.max(0, normalTotal - promoTotal);
        return { triggered: true, saving };
      } else if (totalQty >= promo.n - 1) {
        const cheapestMissing = cands
          .map(id => productMap[id])
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, price: p.prices?.[promo.chain] || 0 }))
          .filter(x => x.price > 0)
          .sort((a, b) => a.price - b.price)[0];
        return {
          almost: true,
          missing: promo.n - totalQty,
          suggest: cheapestMissing,
          potentialSaving: 0
        };
      }
      return null;
    }

    // -X% sur toute une catégorie / liste
    case "category_pct": {
      const cands = candidatesFor(promo);
      if (!cands) return null;
      let total = 0;
      cands.forEach(id => {
        if (cart[id] && !cart[id].done) {
          const price = productMap[id]?.prices?.[promo.chain] || 0;
          total += price * cart[id].qty;
        }
      });
      if (total === 0) return null;
      if (!promo.minTotal || total >= promo.minTotal) {
        return { triggered: true, saving: total * (promo.pct / 100) };
      } else {
        const missing = promo.minTotal - total;
        return { almost: true, missing, isAmount: true, potentialSaving: promo.minTotal * (promo.pct / 100) };
      }
    }

    // -X₪ dès Y₪ de panier (catégorie ou tout)
    case "threshold": {
      let total = 0;
      const cands = candidatesFor(promo);
      const inScope = cands || Object.keys(cart);
      inScope.forEach(id => {
        if (cart[id] && !cart[id].done) {
          const price = productMap[id]?.prices?.[promo.chain] || 0;
          total += price * cart[id].qty;
        }
      });
      if (total === 0) return null;
      if (total >= promo.minTotal) {
        const saving = promo.fixed || (promo.bonusValue || 0);
        return { triggered: true, saving };
      } else {
        return {
          almost: true,
          missing: promo.minTotal - total,
          isAmount: true,
          potentialSaving: promo.fixed || promo.bonusValue || 0
        };
      }
    }

    // Pack : tous les "axes" doivent avoir au moins 1 produit
    case "bundle": {
      if (!promo.requiredAny) return null;
      const matched = [];
      const missing = [];
      promo.requiredAny.forEach((axis, idx) => {
        const found = axis.find(id => cart[id] && !cart[id].done);
        if (found) matched.push({ axis: idx, id: found, products: axis });
        else missing.push({ axis: idx, products: axis });
      });
      if (matched.length === promo.requiredAny.length) {
        // Tout en place : -X% sur la somme des produits du bundle
        let total = 0;
        matched.forEach(m => {
          const price = productMap[m.id]?.prices?.[promo.chain] || 0;
          total += price * (cart[m.id]?.qty || 1);
        });
        const saving = promo.pct ? total * (promo.pct / 100) : (promo.fixed || 0);
        return { triggered: true, saving };
      } else if (missing.length === 1) {
        // Il manque 1 axe → suggérer le moins cher dans l'axe manquant
        const opts = missing[0].products
          .map(id => productMap[id])
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, price: p.prices?.[promo.chain] || 0 }))
          .filter(x => x.price > 0)
          .sort((a, b) => a.price - b.price);
        return {
          almost: true,
          missing: 1,
          suggest: opts[0],
          potentialSaving: 20  // estimation indicative
        };
      }
      return null;
    }
  }
  return null;
}

if (typeof module !== "undefined") module.exports = { PROMOTIONS, analyzePromos, checkPromo };
