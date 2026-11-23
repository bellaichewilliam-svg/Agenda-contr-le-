#!/usr/bin/env bash
# (23/11) Mise en ligne plus légère : au moment du déploiement Vercel, les fichiers de l'appli sont « compressés »
# (commentaires et espaces retirés, AUCUN nom changé : le code reste le même). Les fichiers du dépôt ne changent pas.
# Gain mesuré : 661 Ko → 503 Ko téléchargés (−24 %) pour ouvrir l'appli client.
# En cas d'erreur sur un fichier, on garde l'original (jamais de site cassé à cause de cette étape).
set -u
cd "$(dirname "$0")"
for f in *.js styles.css; do
  [ -f "$f" ] || continue
  case "$f" in sw.js) continue ;; esac
  ext="${f##*.}"
  if npx -y esbuild@0.24.0 "$f" --minify-whitespace --minify-syntax --charset=utf8 --loader:."$ext"="$ext" --log-level=error > "$f.min.tmp" 2>/dev/null && [ -s "$f.min.tmp" ]; then
    mv "$f.min.tmp" "$f"
  else
    echo "garde l'original : $f"; [ -f "$f.min.tmp" ] && : > "$f.min.tmp"
  fi
done
echo "fichiers allégés"
