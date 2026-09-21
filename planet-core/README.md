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


## 27-feature milestone

Planet Core now exposes all 27 requested feature workspaces:

1. Homestead Management
2. Education
3. Herbal Medicine & Wild Edibles
4. Memory & Knowledge
5. Social Knowledge Platform
6. Planet ID
7. Offline Mapping
8. Operational Modes
9. Offline Mesh
10. Portability & Sharing
11. Tools & Extensions
12. Financials & Planning
13. Species Identification
14. Record Keeping
15. DIY Knowledge & Skills
16. Knowledge Archive
17. Learning Engine
18. Animal ID & Livestock Intelligence
19. Survival & Emergency
20. Food Production & Preservation
21. Community Marketplace
22. Sensors & Automation
23. Document & Media Vault
24. Local AI & Expert Systems
25. Decentralized Offline Internet
26. Family Legacy
27. Offline App Store & Knowledge Packs

Each workspace has offline CRUD record storage with title, type, status, tags, free-form details and structured JSON data. The core also exposes Planet sync export/import endpoints for peer-transfer workflows.

### Implementation status

This milestone is a **feature-complete MVP framework**, not the final mature implementation of every specialist subsystem. The 27 modules are present and usable for local records; deeper engines such as camera-based species recognition, LoRa radio drivers, cryptographic peer replication, full accounting, and model inference depend on hardware/services and are subsequent subsystem work.
