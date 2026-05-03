"""Matche les items récupérés des flux (en hébreu) vers nos produits FR.

Stratégie :
1. Charger nos produits depuis data/products.js (parser JS minimal).
2. Pour chaque produit, on a un dict `match` avec des mots-clés hébreux
   et éventuellement un poids/taille de référence.
3. Pour chaque item d'un flux, on calcule un score = nombre de mots-clés
   trouvés dans son name + bonus si quantité ≈ taille de référence.
4. On garde le meilleur match par (chain, product_id) avec score > seuil.

Pour les produits qui n'ont pas encore de mots-clés hébreux dans
products.js, le matcher les ignore — l'app utilise alors les estimations.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from chains._base import PriceItem

log = logging.getLogger(__name__)

# Mapping minimal pour démarrer. À étendre dans data/products.js via un
# champ `match: { he: ["..."], size: "..." }`.
DEFAULT_HE_KEYWORDS = {
    # produit_id : liste de mots-clés hébreux
    "milk-3":         ["חלב", "3%", "תנובה"],
    "milk-1":         ["חלב", "1%", "תרה"],
    "milk-skim":      ["חלב", "0%", "רזה"],
    "cottage":        ["קוטג", "תנובה"],
    "yogurt-nat":     ["יוגורט", "טבעי"],
    "yogurt-greek":   ["יוגורט", "יווני"],
    "butter":         ["חמאה", "תנובה"],
    "cheese-yellow-28": ["גבינה", "צהובה", "עמק"],
    "feta":           ["פטה", "בולגרית"],
    "mozzarella":     ["מוצרלה", "מגורדת"],
    "eggs-12-l":      ["ביצים", "L"],
    "eggs-12-xl":     ["ביצים", "XL"],
    "eggs-30":        ["ביצים", "L", "30"],
    "chicken-breast": ["חזה", "עוף", "טרי"],
    "chicken-thigh":  ["שוקיים", "עוף"],
    "chicken-whole":  ["עוף", "שלם"],
    "ground-beef-17": ["בקר", "טחון", "17"],
    "salmon-fillet":  ["סלמון", "פילה", "טרי"],
    "bread-white":    ["לחם", "אחיד", "אנג'ל"],
    "bread-whole":    ["לחם", "מלא", "ברמן"],
    "pita":           ["פיתות"],
    "challah":        ["חלה"],
    "tomato":         ["עגבני", "עגבניה"],
    "tomato-cherry":  ["עגבני", "שרי"],
    "cucumber":       ["מלפפון"],
    "potato":         ["תפוח", "אדמה"],
    "sweet-potato":   ["בטטה"],
    "onion":          ["בצל", "יבש"],
    "onion-red":      ["בצל", "סגול"],
    "carrot":         ["גזר"],
    "pepper-red":     ["פלפל", "אדום"],
    "pepper-green":   ["פלפל", "ירוק"],
    "pepper-yellow":  ["פלפל", "צהוב"],
    "pepper-orange":  ["פלפל", "כתום"],
    "zucchini":       ["קישוא"],
    "eggplant":       ["חציל"],
    "lettuce":        ["חסה"],
    "spinach":        ["תרד"],
    "cabbage":        ["כרוב", "לבן"],
    "cauliflower":    ["כרובית"],
    "broccoli":       ["ברוקולי"],
    "garlic":         ["שום"],
    "parsley":        ["פטרוזיליה"],
    "cilantro":       ["כוסברה"],
    "apple-pink":     ["תפוח", "פינק"],
    "apple-golden":   ["תפוח", "גולדן"],
    "banana":         ["בננה"],
    "orange":         ["תפוז"],
    "clementine":     ["קלמנטינה"],
    "lemon":          ["לימון"],
    "avocado":        ["אבוקדו"],
    "watermelon":     ["אבטיח"],
    "melon":          ["מלון"],
    "rice-white":     ["אורז", "לבן", "סוגת"],
    "rice-basmati":   ["אורז", "בסמטי"],
    "pasta-spaghetti": ["ספגטי", "אסם"],
    "pasta-penne":    ["פנה", "אסם"],
    "flour-white":    ["קמח", "לבן"],
    "sugar-white":    ["סוכר", "לבן"],
    "salt":           ["מלח", "שולחן"],
    "oil-sunflower":  ["שמן", "חמניות"],
    "oil-olive":      ["שמן", "זית", "כתית"],
    "tahini":         ["טחינה", "אחווה"],
    "humus":          ["חומוס", "סברה"],
    "honey":          ["דבש"],
    "nutella":        ["נוטלה"],
    "cereal-corn":    ["קורנפלקס", "תלמה"],
    "water-6pack":    ["מים", "מי", "עדן"],
    "coke-1.5":       ["קוקה", "קולה", "1.5"],
    "coffee-turkish": ["קפה", "טורקי", "עלית"],
    "tea-wissotzky":  ["תה", "ויסוצקי"],
    "beer-goldstar":  ["גולדסטאר", "בירה"],
    "frozen-pizza":   ["פיצה", "קפואה"],
    "frozen-fries":   ["צ'יפס", "קפוא", "מקיין"],
    "ice-cream-bens": ["בן", "ג'ריס"],
    "bamba":          ["במבה", "אסם"],
    "bisli":          ["ביסלי", "אסם"],
    "krembo":         ["קרמבו"],
    "diapers-4":      ["חיתולים", "האגיס", "4"],
    "wipes":          ["מגבונים"],
    "toilet-paper-32": ["נייר", "טואלט", "לילי"],
    "shampoo-pantene": ["שמפו", "פנטן"],
    "toothpaste":     ["משחת", "שיניים", "קולגייט"],
    "dish-soap":      ["נוזל", "כלים", "סנו"],
    "laundry-ariel":  ["אבקת", "כביסה", "אריאל"],
    "trash-bags-50":  ["שקיות", "אשפה"],
}

MIN_SCORE = 2  # nombre de mots-clés à trouver pour considérer un match


def load_products(products_js: Path) -> List[dict]:
    """Parse data/products.js de manière naïve : récupère id, name, category."""
    text = products_js.read_text(encoding="utf-8")
    products = []
    pattern = re.compile(
        r'\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)"',
        re.MULTILINE,
    )
    for m in pattern.finditer(text):
        products.append({"id": m.group(1), "name": m.group(2), "category": m.group(3)})
    return products


def _score(item_name: str, keywords: List[str]) -> int:
    """Compte combien de mots-clés sont présents dans le nom (case-insensitive)."""
    name_lower = item_name.lower()
    return sum(1 for kw in keywords if kw.lower() in name_lower)


def _best_match(items: List[PriceItem], keywords: List[str]) -> Optional[PriceItem]:
    best = None
    best_score = MIN_SCORE - 1
    for it in items:
        s = _score(it.name, keywords)
        if s > best_score:
            best_score = s
            best = it
    return best


def match_to_products(
    products: List[dict],
    all_items: Dict[str, List[PriceItem]],
) -> Dict[str, Dict[str, float]]:
    """Renvoie {product_id: {chain: price, ...}, ...}."""
    out: Dict[str, Dict[str, float]] = {}
    for p in products:
        keywords = DEFAULT_HE_KEYWORDS.get(p["id"])
        if not keywords:
            continue
        for chain, items in all_items.items():
            if not items:
                continue
            match = _best_match(items, keywords)
            if match:
                out.setdefault(p["id"], {})[chain] = round(match.price, 2)
    return out
