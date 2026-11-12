# T-Bone Web

A standalone browser-first Nostr client based on [T-Bone](https://github.com/toddsmith456/T-Bone-). This fork's product target is the web app: React + TypeScript + Vite, installable as a PWA, with no Android runtime or Gradle dependency in the web build.

**Privacy first:** no analytics, tracking SDKs, or application backend are required. The browser communicates with the Nostr relays configured by the user. For remote signing, the user's private key remains with their signer.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run typecheck
npm run build
npm run preview
```

The production output is `dist/`. Deploy it to any static host that supports SPA fallback/rewrite to `index.html` (the repository includes Vercel and Cloudflare Pages fallback configuration).

## Authentication

- **Amber / remote signer:** NIP-46 `nostrconnect://` QR flow and `bunker://` URI flow. The browser generates a disposable client keypair, validates the connection secret, obtains the user's public key with `get_public_key`, and follows the signer's relay-switch response.
- **Browser extensions:** NIP-07 via `window.nostr`.
- **Local key:** nsec import and browser-generated account are available for testing. These currently use browser-local storage and are not a hardened vault; use Amber or another external signer for valuable identities.

Amber's native Android integration in the original app uses NIP-55 intents. This browser client uses NIP-46, the remote-signing protocol designed for web and cross-device signer connections. The web client does not depend on Android intents or Android APIs.

## Web features

- Following and global feeds, hashtag pages, note threads and pagination
- Compose notes, replies and quote notes; reactions and reposts
- Profiles, follow/unfollow, search and relay management
- Notifications for mentions/replies, reactions, reposts and zap receipts
- Lightning zaps through LNURL-pay, with optional Nostr Wallet Connect (NIP-47)
- Private local toolbox with encrypted notes and checklists
- Theme, typography and appearance settings
- Local data backup/export

The web app is a browser implementation, not a claim that every Android-only T-Bone feature has already been ported. Feature parity should be tracked and tested explicitly as the web client develops.

## Project structure

- `src/` — React web client, UI, Nostr transport, signers and application state
- `public/` — PWA assets and static-host routing fallback
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` — web entry point and build configuration
- `.github/workflows/web.yml` — web typecheck and production-build CI
- `app/`, Gradle files and Android-specific documentation — retained from the upstream source for lineage/reference; they are not imported by the web build or required to run/deploy T-Bone Web

## Upstream and license

- Original project: [toddsmith456/T-Bone-](https://github.com/toddsmith456/T-Bone-)
- Web fork: [NostrDanish/0xT-Bone-](https://github.com/NostrDanish/0xT-Bone-)
- License: MIT — see [LICENSE](LICENSE). Preserve the upstream copyright and license notice in redistributed copies.

## Protocol references

- [NIP-01 — Basic protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-07 — Browser extension](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-19 — Bech32-encoded entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-44 — Encrypted payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-46 — Remote signing](https://github.com/nostr-protocol/nips/blob/master/46.md)
- [NIP-65 — Relay list metadata](https://github.com/nostr-protocol/nips/blob/master/65.md)
