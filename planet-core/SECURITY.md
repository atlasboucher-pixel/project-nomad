# Planet Core Security

Planet is designed local-first.

- Owner passwords are derived with Node.js scrypt and a random salt.
- Authentication sessions use cryptographically random tokens, are HttpOnly and SameSite=Strict, and expire after 24 hours.
- Planet IDs are public identifiers. Passwords and session tokens are never part of a Planet ID.
- The service should remain on a trusted LAN and should not be port-forwarded directly to the public internet.
- Backup and sync exports can contain private homestead/family information. Treat exported files as sensitive.
- The MVP sync format merges records by record ID and update timestamp. Cryptographic peer signing and fine-grained household permissions are future hardening work.
- The natural-health and survival workspaces are record/reference systems; they do not replace professional medical or emergency guidance.
