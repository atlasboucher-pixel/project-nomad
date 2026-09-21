# Planet on Project NOMAD

Planet extends Project NOMAD into a local-first homestead and community operating system.

## Architecture decision

NOMAD remains the appliance and knowledge platform. Planet features are developed as an isolated local service first, then linked into the NOMAD Command Center. This keeps upstream NOMAD updates practical and limits regressions.

## Roadmap

1. **Planet Core v0.1** — local owner, authentication, Planet IDs, animals, inventory, notes, sensors, backup.
2. **Homestead intelligence** — breeding, lineage, weights, feed, health, crops, maintenance, food preservation, alerts.
3. **Identity & sync** — QR payloads, device keys, permissions, signed records, conflict-safe peer synchronization.
4. **Knowledge** — Planet library collections, learning records, media, local AI integration and knowledge packs.
5. **Resilience** — emergency, species reference, first aid, DIY and offline operational modes.
6. **Community** — local messaging, social knowledge, barter/marketplace, equipment sharing and family legacy.
7. **Mesh** — LAN discovery, store-and-forward sync, LoRa bridge for compact messages/sensors, portable nodes.

## Non-negotiable design rules

- Core workflows function with zero internet.
- User-owned data stays local by default.
- Planet IDs identify records; secrets never go in QR/public identifiers.
- Large data uses Wi-Fi/LAN; LoRa is reserved for compact telemetry/messages.
- Every critical record type must support export/backup.
- Upstream NOMAD functionality should remain separable and updateable.
