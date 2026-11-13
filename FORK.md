# T-Bone Web fork

## Lineage

This repository is the browser-first web port of [toddsmith456/T-Bone-](https://github.com/toddsmith456/T-Bone-).

- **Upstream project:** T-Bone
- **This project:** T-Bone Web
- **License:** MIT. The upstream `LICENSE` and copyright notice are preserved.

## Scope

This repository intentionally contains only the web application and its web development/deployment files. Android source, Gradle wrappers, Android release workflows, and Android-only documentation are not copied into this web deliverable.

The Android application remains maintained in the upstream repository. Its Kotlin implementation is a behavioral and feature reference; browser code is implemented separately using browser APIs and web-compatible Nostr libraries.

## Web stack

- React + TypeScript + Vite
- Nostr relay communication in the browser
- NIP-07 browser extension signing
- NIP-46 remote signing, including Amber QR and bunker URI flows
- PWA metadata and static-host SPA fallback
- GitHub Actions for tests, type checking, and production build

## Development

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```

## Upstream synchronization

When upstream changes, compare its Nostr protocol behavior, security fixes, feature set and UX. Port relevant functionality into the browser client without importing Android-only APIs. Preserve the upstream MIT license and copyright notice.

## Feature parity

The web app is a separate implementation. A feature is considered ported only when browser code exists and the web-specific behavior has been tested. Android-only capabilities are not implied by the upstream feature list.
