#!/bin/bash
# Régénère prixmalin.html en inlinant styles.css, data/products.js et app.js dans index.html
python3 << 'PYEOF'
with open("styles.css", "r", encoding="utf-8") as f: css = f.read()
with open("data/products.js", "r", encoding="utf-8") as f: data = f.read()
with open("app.js", "r", encoding="utf-8") as f: app = f.read()
with open("index.html", "r", encoding="utf-8") as f: html = f.read()
html = html.replace('<link rel="stylesheet" href="styles.css" />', f'<style>\n{css}\n</style>')
html = html.replace('<script src="data/products.js"></script>\n  <script src="app.js"></script>',
                    f'<script>\n{data}\n</script>\n  <script>\n{app}\n</script>')
with open("prixmalin.html", "w", encoding="utf-8") as f: f.write(html)
print("Built prixmalin.html (%d chars)" % len(html))
PYEOF
