# T-Bone for Android

A privacy-focused Nostr client for Android. No Google Play Services, analytics, or tracking. Licensed under MIT.

[Download the latest release](https://github.com/toddsmith456/T-Bone-/releases/latest) · [Changelog](CHANGELOG.md) · [Privacy policy](docs/PRIVACY.md)

## T-Bone Web (desktop & browser)

This repository now also ships **T-Bone Web** — a fully working browser/desktop client that brings the
T-Bone experience to any device with a web browser (installable as a PWA, no Google services involved).

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
```

What's implemented on the web side (all state stays in your browser, nothing is sent to any server
other than the Nostr relays you configure):

- **Login** via a NIP-07 browser extension (Alby, nos2x, …), an `nsec`, a freshly generated device-local key, or **Amber / any NIP-46 remote signer** — scan the on-screen QR with Amber and every signing request is routed to your phone over relays (the browser never sees your key). `bunker://` tokens from Amber/nsec.app/nsecBunker are accepted too
- **Feeds**: following & global timelines, hashtag pages (`/tag/<tag>`), load-more pagination
- **Composing**: new notes, replies (NIP-10 threads), quote-notes (NIP-18), reposts, hashtags, `nostr:` entity links (NIP-19/21/27)
- **Interactions**: likes (NIP-25), reposts, reply counts, thread view with parent chain, deletion (NIP-09 best effort)
- **Zaps (NIP-57)** with LNURL-pay resolution (lud16/lud06 incl. bech32) and automatic in-app payment via **NWC (NIP-47)**; without a wallet the invoice is handed to your system `lightning:` handler
- **Notifications inbox** with filters: mentions/replies, reactions, reposts, zap receipts
- **Profiles**: kind-0 metadata, banner, bio, NIP-05, follow/unfollow publishing kind-3
- **Search**: NIP-50 relay search with local-cache fallback; npub/nprofile jump links
- **Relay management** with live status probes, read/write flags, and NIP-65 relay-list publishing
- **Private Toolbox**: notes & checklists with folders, encrypted with AES-256-GCM + PBKDF2 (210k) via WebCrypto — passphrase-only, local-only
- **Youniversal theming**: dark / light / cream, 7 accent colors, adjustable corner radius, app-wide text scaling, system or Nunito Sans font
- **Backup/export** of all local data as JSON

The Android app lives under `app/` and is unchanged.

## Features

- **Nostr social:** Following and global feeds; profile and hashtag search; relay management; profiles; replies, full threads, quote-notes, reposts, polls, emoji reactions, and sharing.
- **Accounts and identity:** Multiple accounts; Amber, nsecBunker, or a device-local key protected by Android Keystore. Short BIP-39 word fingerprints and configurable avatars make identities easier to recognize.
- **Notifications:** An in-app inbox with filters, recent history, note previews, and inline replies. No push-notification service.
- **Photos and video:** Inline media, image and video viewers, downloads, playback controls, and uploads to configurable Blossom servers.
- **Lightning:** Nostr Wallet Connect (NIP-47), Lightning invoice payments, and zaps (NIP-57), with wallet activity in the toolbox.
- **Privacy and safety:** Optional Tor routing through Orbot; local-only follow and block lists; content filters and screen-time limits; app lock, screenshot blocking, and a duress PIN.
- **Private toolbox:** Notes, checklists, folders, attachments, and calendar events encrypted on-device with AES-256-GCM and Android Keystore. Also includes geohash chat and a voice recorder with voice anonymization.
- **Appearance:** Youniversal offers light, dark, cream, and automatic themes, accent and Material You colors, rounded-by-default adjustable corners, app-wide text scaling, and two fonts (standard sans-serif by default or Nunito Sans).

See the [NIP compatibility guide](docs/nip-compatibility.md) for protocol details.

## Install

Download `T-Bone-fork-<version>-release.apk` from [Releases](https://github.com/toddsmith456/T-Bone-/releases/latest) and install it on Android 8.0 or newer. The app ID is `social.tbone.fork`, so it can be installed alongside the original T-Bone app.

Releases include the release APK and `SHA256SUMS.txt`—not a debug APK. To verify the download, place both files in one folder and run:

```bash
sha256sum -c SHA256SUMS.txt
```

## Build from source

```bash
git clone https://github.com/toddsmith456/T-Bone-.git
cd T-Bone-
./gradlew :app:assembleDebug
```

The debug variant is for local development; it is not published with GitHub releases. Minimum supported Android version: 8.0 (API 26).

## Project links

- [Privacy rules and enforcement](docs/PRIVACY.md)
- [NIP compatibility](docs/nip-compatibility.md)
- [Release process](docs/RELEASE.md)
- [Contributing](CONTRIBUTING.md)
- [Full changelog](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).
