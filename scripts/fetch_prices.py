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
from chains._base import PriceItem
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


FUNCS = {
    "shufersal_fn": shufersal_fn,
    "pp_fn": pp_fn,
    "matrix_fn": matrix_fn,
    "stub_fn": stub_fn,
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

    (out_dir / "live-prices.json").write_text(
        json.dumps({
            "version": 1,
            "chains": list(all_items.keys()),
            "prices": live,
            "summary": summary,
        }, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
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
