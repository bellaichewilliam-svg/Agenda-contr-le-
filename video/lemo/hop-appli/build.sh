#!/bin/sh
# Film HOP! « On fait vos courses pour vous » : une commande refait tout.
#   sh build.sh        version FR (voix Kokoro ff_siwis déjà dans vo_fr/)
# Étapes : horloge de la voix → événements → musique, bruitages, mix → image → mux → poster.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-/root/lemo-opuscar}; export LIB
PY="$LIB/.venv/bin/python"; FPS=30; DUR=40.0; export DUR
python3 "$HERE/audio/vo_timeline.py"
cd "$LIB"
node core/render/events.mjs "$HERE" --out "$HERE/out/events.json"
node "$HERE/tools/camspeed.mjs" "$HERE/out/camspeed.json"
"$PY" -I "$HERE/audio/compose.py"
"$PY" -I "$HERE/audio/foley.py" "$HERE/out/events.json" "$HERE/out/camspeed.json" "$HERE/music/harmony.json" "$HERE/out/sfx.wav"
VO_DIR=vo_fr "$PY" -I "$HERE/audio/mix.py" "$HERE/music/score.wav" "$HERE/out/sfx.wav" "$HERE/out/mix_fr.wav" -4
node core/render/video.mjs "$HERE" --fps $FPS --workers 4 --size 1080x1920 --q n=2 --out "$HERE/out/video.mp4"
# ffmpeg 6 ici : mux à la main (mux.sh exige ffmpeg 7)
ffmpeg -v error -y -i "$HERE/out/video.mp4" -i "$HERE/out/mix_fr.wav" -map 0:v -map 1:a -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$HERE/out/hop-appli-fr.mp4"
ffmpeg -v error -y -ss 39.4 -i "$HERE/out/hop-appli-fr.mp4" -frames:v 1 -q:v 2 "$HERE/poster.jpg"
echo "fini : $HERE/out/hop-appli-fr.mp4"
