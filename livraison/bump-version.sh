#!/bin/bash
# Ajoute ?v=<date-heure> aux fichiers CSS/JS de toutes les pages, pour que les
# téléphones rechargent toujours la dernière version après une mise à jour.
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
for f in *.html; do
  sed -i -E "s#(src|href)=\"([a-z0-9-]+\.(js|css))(\?v=[0-9]+)?\"#\1=\"\2?v=$V\"#g" "$f"
done
echo "Version des fichiers : $V"
