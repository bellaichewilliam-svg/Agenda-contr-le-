#!/bin/sh
# video-shotcraft (github.com/Vincentwei1021/video-shotcraft, Apache 2.0) : récupère ou met à jour la bibliothèque, puis affiche LIB=<chemin>.
# Trop lourde (≈ 100 Mo) pour vivre dans le dépôt HOP! : on la clone à côté, au premier usage.
set -e
REPO=${SHOTCRAFT_REPO:-https://github.com/Vincentwei1021/video-shotcraft.git}
LIB=${SHOTCRAFT_HOME:-$HOME/video-shotcraft}
if [ -f "$LIB/SKILL.md" ] && [ -d "$LIB/references" ]; then
  git -C "$LIB" pull --quiet --ff-only 2>/dev/null || echo "! mise à jour impossible (hors ligne ?), copie locale utilisée"
else
  command -v git >/dev/null || { echo "✗ git est nécessaire"; exit 1; }
  echo "↓ téléchargement de video-shotcraft dans $LIB"
  git clone --quiet --depth 1 "$REPO" "$LIB"
fi
[ "$1" = "deps" ] && (cd "$LIB" && npm install --silent >/dev/null 2>&1 && echo "✓ paquets Node installés") || true
command -v node >/dev/null || echo "! Node manque"
command -v ffmpeg >/dev/null || echo "! ffmpeg manque"
echo "LIB=$LIB"
