# Install Planet Core

## Requirements

- A Linux computer, Project NOMAD server, Raspberry Pi, or other machine with Docker and Docker Compose.
- Port 8787 available on the local network.

## Install

From the root of this repository:

```sh
docker compose -f docker-compose.planet.yml up -d --build
```

Then open:

```
http://localhost:8787
```

For a phone/tablet/computer on the same network, replace `localhost` with the Planet/NOMAD server's LAN IP address.

On first launch, Planet asks for the local owner name and a password. Planet data is stored in the persistent Docker volume `planet-data`.

## Stop

```sh
docker compose -f docker-compose.planet.yml down
```

Do not add `-v` when stopping a real installation because that would remove the persistent Planet volume.

## Backup

```sh
sh planet-core/backup.sh
```

You can also use the authenticated `/api/backup` endpoint from Planet Core.

## Restore

Stop Planet, preserve the current volume as a safety backup, then restore a known-good `planet.json` into the `planet-data` volume before starting Planet again.

## Network model

Planet Core listens on port 8787 and is intended for a trusted local network. Do not expose port 8787 directly to the public internet. Remote access should later be placed behind an authenticated VPN or hardened reverse proxy.

## Current release boundary

The installable MVP provides all 27 workspaces, authentication, local persistence, CRUD records, backup, sync bundle export/import, livestock/inventory/sensor primitives, and NOMAD dashboard linkage. Hardware-specific LoRa, camera recognition and local model inference require their corresponding hardware/model services.
