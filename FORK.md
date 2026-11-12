# T-Bone Web fork

## Lineage

This repository is based on the official T-Bone source:

- **Upstream:** [toddsmith456/T-Bone-](https://github.com/toddsmith456/T-Bone-)
- **Web fork:** [NostrDanish/0xT-Bone-](https://github.com/NostrDanish/0xT-Bone-)
- **License:** MIT. The upstream LICENSE file and copyright notice are retained.

## Product scope

The maintained product target in this fork is **T-Bone Web**, a browser-first Nostr client built with React, TypeScript and Vite.

The upstream Android project and its Gradle files remain in the repository as source lineage/reference. They are not part of the web runtime, are not imported by the Vite application, and are not required for web development, CI, build or deployment.

## Web implementation

- React + TypeScript + Vite single-page application
- Nostr relay transport in the browser
- NIP-07 browser-extension authentication
- NIP-46 remote signing for Amber and compatible bunker signers
- PWA manifest and static-host SPA routing fallback
- Node-based CI typecheck and production build

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Upstream synchronization

When upstream changes, review its Nostr protocol behavior, security fixes, UI/UX and feature additions, then port relevant behavior into the web implementation. Do not copy Android-only APIs or assume Kotlin implementations can be used directly in the browser. Preserve the upstream MIT license notice.

## Scope and parity

Web feature parity is tracked separately from Android. A feature is not considered ported merely because it exists in the Android source; it must have a browser implementation and a web-specific test or manual verification path.
