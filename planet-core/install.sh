#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
echo "Building Planet Core..."
docker compose -f docker-compose.planet.yml up -d --build
echo
echo "Planet Core is starting."
echo "Open http://localhost:8787 on this computer."
echo "From another device on the same LAN, open http://<NOMAD-IP>:8787"
