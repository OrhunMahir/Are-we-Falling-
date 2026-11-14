#!/bin/bash
# Packs the game for itch.io: a zip with index.html at its root.  Usage: bash tools/package.sh
set -e
cd "$(dirname "$0")/.."
OUT=arewefalling-itch.zip
[ -f "$OUT" ] && rm "$OUT"
zip -q -r "$OUT" index.html classic.html manual.html css js audio
du -sh "$OUT"
