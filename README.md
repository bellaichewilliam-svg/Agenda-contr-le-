# 🛒 PrixMalin

Comparateur de prix pour 9 supermarchés israéliens : **Rami Levy, Osher Ad, Boom, Hatzi Hinam, Carrefour, Shufersal, Yochananof, Victory, Tiv Taam**.

- 428 produits suivis (laitiers, viande, fruits, légumes, gâteaux, boissons, hygiène, entretien…)
- Liste de courses à cocher, partageable par lien (WhatsApp / SMS / email)
- Comparaison « magasin unique » et « panier optimisé multi-magasins »
- Prix mis à jour automatiquement via les flux officiels (loi de transparence des prix 2014)

## 🚀 Utilisation

### Page web

Hébergée sur GitHub Pages : https://bellaichewilliam-svg.github.io/Agenda-contr-le-/

### Fichier autonome

`prixmalin.html` est un fichier HTML unique (~100 Ko) qui contient toute l'app. Téléchargez-le, ouvrez-le dans n'importe quel navigateur, ça marche sans internet.

## 🔄 Mise à jour automatique des prix

Un workflow GitHub Actions (`.github/workflows/update-prices.yml`) tourne **chaque jour à 06:00 UTC** (= 09:00 Israël). Il :

1. Télécharge les flux XML officiels de chaque enseigne
2. Les parse et matche les produits aux nôtres via mots-clés hébreux
3. Génère `data/live-prices.json`
4. Régénère `prixmalin.html`
5. Commit le tout si quelque chose a changé

L'app charge `data/live-prices.json` au démarrage et superpose les prix réels sur les estimations.

### État des chaînes (au moment du commit initial)

| Chaîne | Source | Statut |
|---|---|---|
| Shufersal | `prices.shufersal.co.il` | ✅ Implémenté (public) |
| Rami Levy | `publishedprices.co.il` (RamiLevi) | ✅ Implémenté (login) |
| Tiv Taam | `publishedprices.co.il` (TivTaam) | ✅ Implémenté (login) |
| Carrefour | `publishedprices.co.il` (Yenotbitan) | ✅ Implémenté (login) |
| Osher Ad | `publishedprices.co.il` (osherad) | ✅ Implémenté (login) |
| Hatzi Hinam | `publishedprices.co.il` (HaziHinam) | ✅ Implémenté (login) |
| Yochananof | `publishedprices.co.il` (yohananof) | ✅ Implémenté (login) |
| Victory | `matrixcatalog.co.il` (chain 7290696200003) | ✅ Implémenté (public) |
| Boom | ❓ Source non identifiée | ⏳ Stub - à compléter |

⚠️ Les credentials publishedprices.co.il sont publics par la loi mais peuvent évoluer. Si une chaîne renvoie 0 item après un run, vérifier l'identifiant dans `scripts/fetch_prices.py`.

### Lancer le scraper manuellement

Depuis l'onglet **Actions** du repo GitHub :
1. Cliquer sur le workflow "Update prices daily"
2. Cliquer sur "Run workflow"

Ou en local :

```bash
pip install requests
cd scripts
python fetch_prices.py --out ../data --verbose
```

## 🛠️ Architecture

```
.
├── index.html              # Page principale (multi-fichiers)
├── styles.css
├── app.js                  # Logique : panier, comparaison, partage
├── prixmalin.html          # Version single-file autonome
├── build.sh                # Régénère prixmalin.html
├── data/
│   ├── products.js         # 428 produits, prix de base estimés
│   ├── live-prices.json    # Prix réels du dernier scraping (auto-généré)
│   └── raw-prices/         # Dump brut par chaîne (auto-généré)
├── scripts/
│   ├── fetch_prices.py     # Orchestre le scraping
│   ├── match_products.py   # Matche items hébreux → nos produits FR
│   └── chains/
│       ├── _base.py
│       ├── shufersal.py
│       ├── published_prices.py
│       └── matrix.py
└── .github/workflows/
    └── update-prices.yml   # Cron quotidien
```

## 🤝 Comment étendre

### Ajouter un produit

Dans `data/products.js` :

```js
{ id: "mon-produit", name: "Nom français", category: "Catégorie", unit: "1kg",
  prices: P(9.90) },
```

Pour qu'il soit matché aux flux officiels, ajouter aussi dans `scripts/match_products.py` :

```python
"mon-produit": ["mot1_he", "mot2_he"],
```

### Ajouter une chaîne (Boom, etc.)

1. Identifier la source de ses flux (souvent `publishedprices.co.il` avec un username spécifique).
2. L'ajouter dans `STORES` (`data/products.js`) avec un id, une couleur, un tier.
3. L'ajouter dans `CHAINS` (`scripts/fetch_prices.py`) avec la fonction de scraping appropriée.

## 📜 Cadre légal

Loi de transparence des prix israélienne (חוק שקיפות מחירים, 2014) : les chaînes de plus de 5 magasins doivent publier leurs prix en XML public, mis à jour quotidiennement.
