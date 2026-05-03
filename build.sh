#!/bin/bash
# Régénère prixmalin.html en inlinant styles + i18n + produits + promos + app
python3 << 'PYEOF'
with open("styles.css", "r", encoding="utf-8") as f: css = f.read()
with open("data/i18n.js", "r", encoding="utf-8") as f: i18n = f.read()
with open("data/products.js", "r", encoding="utf-8") as f: data = f.read()
with open("data/promotions.js", "r", encoding="utf-8") as f: promos = f.read()
with open("data/stores-locations.js", "r", encoding="utf-8") as f: stores = f.read()
with open("app.js", "r", encoding="utf-8") as f: app = f.read()
with open("index.html", "r", encoding="utf-8") as f: html = f.read()
html = html.replace('<link rel="stylesheet" href="styles.css" />', f'<style>\n{css}\n</style>')
old = '<script src="data/i18n.js"></script>\n  <script src="data/products.js"></script>\n  <script src="data/promotions.js"></script>\n  <script src="data/stores-locations.js"></script>\n  <script src="app.js"></script>'
new = f'<script>\n{i18n}\n</script>\n  <script>\n{data}\n</script>\n  <script>\n{promos}\n</script>\n  <script>\n{stores}\n</script>\n  <script>\n{app}\n</script>'
html = html.replace(old, new)
with open("prixmalin.html", "w", encoding="utf-8") as f: f.write(html)
print(f"Built prixmalin.html ({len(html)} chars)")
PYEOF
