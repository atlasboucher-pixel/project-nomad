#!/usr/bin/env sh
set -eu
OUT="${1:-planet-backups}"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"
docker run --rm -v planet-data:/data -v "$(cd "$OUT" && pwd)":/backup alpine sh -c "cp /data/planet.json /backup/planet-$STAMP.json"
echo "Backup saved to $OUT/planet-$STAMP.json"
