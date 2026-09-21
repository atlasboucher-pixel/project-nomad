# Planet Core v0.1

Offline-first homestead core for the Planet/NOMAD project.

## Included now

- First-run owner setup and password authentication
- Local session cookies (HttpOnly, SameSite=Strict)
- Planet ID generation for people, animals, assets, devices, and locations
- Animal records with species, breed, sex, birth date, tag, lineage, health and notes
- Inventory records with quantity, unit, category, location and minimum-stock level
- Notes / journals
- Sensor registry with latest reading
- Dashboard summary
- JSON persistence under `PLANET_DATA_DIR`
- Backup export endpoint
- LAN-friendly responsive web interface
- No cloud service or internet dependency

## Run directly

```bash
cd planet-core
npm start
```

Open `http://localhost:8787`.

## Run with Docker

```bash
docker build -t planet-core ./planet-core
docker run --rm -p 8787:8787 -v planet-data:/data planet-core
```

## Security

On first launch, create the local owner account. Passwords are stored using Node's scrypt KDF with a random salt. Sessions are random, server-side, and expire after 24 hours. Planet IDs are public identifiers; passwords and session secrets are never encoded into them.

This is the first implementation slice. Mesh replication, cryptographic device signing, granular household roles, QR rendering, breeding workflows, maps linkage, knowledge packs and NOMAD dashboard integration are planned next.
