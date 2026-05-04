#!/usr/bin/env python3
"""Récupère les prix officiels des 9 enseignes israéliennes et produit
data/live-prices.json + data/raw-prices/{chain}.json.

Lancé par le workflow GitHub Actions (cron quotidien à 06:00 UTC).
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import traceback
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

from chains import published_prices, shufersal, matrix
from chains._base import PriceItem, PromoItem
from match_products import match_to_products, load_products

log = logging.getLogger("fetch_prices")

# Configuration des 9 enseignes : (id_app, fonction, kwargs)
CHAINS = [
    ("shufersal",   "shufersal_fn",  {}),
    ("rami_levy",   "pp_fn",         {"user": "RamiLevi"}),
    ("tiv_taam",    "pp_fn",         {"user": "TivTaam"}),
    ("carrefour",   "pp_fn",         {"user": "Yenotbitan"}),
    ("osher_ad",    "pp_fn",         {"user": "osherad"}),
    ("hatzi_hinam", "pp_fn",         {"user": "HaziHinam"}),
    ("yochananof",  "pp_fn",         {"user": "yohananof"}),
    ("victory",     "matrix_fn",     {"chain_id": "7290696200003"}),
    # Boom : pas de source publique confirmée. Stub pour qu'on l'ajoute
    # quand l'URL sera identifiée.
    ("boom",        "stub_fn",       {}),
]


def stub_fn(chain: str, **kw):
    log.warning("%s : aucun scraper configuré (TODO)", chain)
    return iter([])


def shufersal_fn(chain: str, **kw):
    return shufersal.fetch_items(max_files=kw.get("max_files", 1))


def pp_fn(chain: str, user: str, password: str = "", **kw):
    return published_prices.fetch_items(chain, user, password, max_files=kw.get("max_files", 1))


def matrix_fn(chain: str, chain_id: str, **kw):
    return matrix.fetch_items(chain, chain_id, max_files=kw.get("max_files", 1))


# Variantes pour les promotions
def shufersal_promos_fn(chain: str, **kw):
    return shufersal.fetch_promos(max_files=kw.get("max_files", 1))


def pp_promos_fn(chain: str, user: str, password: str = "", **kw):
    return published_prices.fetch_promos(chain, user, password, max_files=kw.get("max_files", 1))


def stub_promos_fn(chain: str, **kw):
    return iter([])


FUNCS = {
    "shufersal_fn": shufersal_fn,
    "pp_fn": pp_fn,
    "matrix_fn": matrix_fn,
    "stub_fn": stub_fn,
}

PROMO_FUNCS = {
    "shufersal_fn": shufersal_promos_fn,
    "pp_fn": pp_promos_fn,
    "matrix_fn": stub_promos_fn,
    "stub_fn": stub_promos_fn,
}


def run(out_dir: Path, max_files: int = 1) -> Dict:
    raw_dir = out_dir / "raw-prices"
    raw_dir.mkdir(parents=True, exist_ok=True)

    summary = {"chains": {}, "products_matched": 0}
    all_items: Dict[str, List[PriceItem]] = defaultdict(list)

    for chain_id, fn_name, kwargs in CHAINS:
        log.info("=" * 60)
        log.info("Chaîne : %s (%s)", chain_id, fn_name)
        try:
            fn = FUNCS[fn_name]
            items = list(fn(chain_id, max_files=max_files, **kwargs))
            all_items[chain_id] = items
            # dump brut
            (raw_dir / f"{chain_id}.json").write_text(
                json.dumps([it.to_dict() for it in items[:5000]], ensure_ascii=False, indent=1),
                encoding="utf-8",
            )
            summary["chains"][chain_id] = {"items": len(items), "status": "ok" if items else "empty"}
        except Exception as e:
            log.error("%s : exception : %s\n%s", chain_id, e, traceback.format_exc())
            summary["chains"][chain_id] = {"items": 0, "status": f"error: {e}"}

    # Matching avec nos produits
    products = load_products(Path(__file__).parent.parent / "data" / "products.js")
    live = match_to_products(products, all_items)
    summary["products_matched"] = sum(1 for prices in live.values() if prices)
    summary["products_total"] = len(products)

    from datetime import datetime, timezone
    generated_at = datetime.now(timezone.utc).isoformat()

    (out_dir / "live-prices.json").write_text(
        json.dumps({
            "version": 1,
            "generated_at": generated_at,
            "chains": list(all_items.keys()),
            "prices": live,
            "summary": summary,
        }, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    # ===== PROMOS =====
    log.info("=" * 60)
    log.info("FETCH PROMOS")
    log.info("=" * 60)
    all_promos: Dict[str, List[PromoItem]] = defaultdict(list)
    promo_summary = {"chains": {}, "total": 0}
    for chain_id, fn_name, kwargs in CHAINS:
        try:
            fn = PROMO_FUNCS.get(fn_name)
            if not fn:
                continue
            promos = list(fn(chain_id, max_files=max_files, **kwargs))
            all_promos[chain_id] = promos
            (raw_dir / f"{chain_id}-promos.json").write_text(
                json.dumps([p.to_dict() for p in promos[:5000]], ensure_ascii=False, indent=1),
                encoding="utf-8",
            )
            promo_summary["chains"][chain_id] = len(promos)
            promo_summary["total"] += len(promos)
        except Exception as e:
            log.error("%s promos : exception : %s", chain_id, e)
            promo_summary["chains"][chain_id] = 0

    # Map chain promos -> app product ids via barcode matching
    promo_match = {}
    if any(all_promos.values()):
        # Build barcode -> product_id map from items
        item_to_product = {}
        from match_products import match_to_products as _mtp
        # On utilise les items déjà matchés pour faire le lien barcode -> notre id
        for chain, items in all_items.items():
            for it in items:
                if it.item_code:
                    # On cherche si cet item est connu dans `live` (matché)
                    for our_id, prices in live.items():
                        if chain in prices:
                            item_to_product.setdefault(it.item_code, our_id)
        # Pour chaque promo, chercher au moins un de ses items dans notre catalogue
        for chain, promos in all_promos.items():
            for p in promos:
                matched_products = []
                for code in p.item_codes:
                    if code in item_to_product:
                        matched_products.append(item_to_product[code])
                if matched_products:
                    promo_match[p.promo_id] = {
                        "chain": chain,
                        "title": p.description,
                        "type": p.discount_type,
                        "discount_rate": p.discount_rate,
                        "discounted_price": p.discounted_price,
                        "min_qty": p.min_qty,
                        "products": list(set(matched_products)),
                        "valid_from": p.valid_from,
                        "valid_until": p.valid_until,
                    }

    (out_dir / "live-promotions.json").write_text(
        json.dumps({
            "version": 1,
            "generated_at": generated_at,
            "chains": list(all_promos.keys()),
            "promos": promo_match,
            "summary": promo_summary,
        }, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    summary["promos"] = promo_summary
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data", help="Dossier de sortie")
    parser.add_argument("--max-files", type=int, default=1, help="Nombre de fichiers PriceFull par chaîne")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    out_dir = Path(args.out)
    summary = run(out_dir, max_files=args.max_files)

    print("\n=== RÉSUMÉ ===")
    for chain, info in summary["chains"].items():
        print(f"  {chain:12s} : {info['status']:20s} ({info['items']} items)")
    print(f"\nProduits matchés : {summary['products_matched']} / {summary['products_total']}")


if __name__ == "__main__":
    main()
