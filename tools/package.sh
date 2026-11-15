#!/bin/bash
# Packs the game for itch.io: a zip with index.html at its root.  Usage: bash tools/package.sh
set -e
cd "$(dirname "$0")/.."
OUT=${1:-arewefalling-v1.0.2-itch.zip}   # never overwrite the jam submission (arewefalling-itch.zip)
[ -f "$OUT" ] && rm "$OUT"
zip -q -r "$OUT" index.html classic.html manual.html cabin.html css js audio -x "audio/extra/*" "audio/raw/*" "audio/raw2/*"   # the game only plays the files directly in audio/
du -sh "$OUT"
