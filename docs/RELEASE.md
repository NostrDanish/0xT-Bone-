# Releases

A pushed version tag (`v*`) triggers GitHub Actions to run the privacy check and tests, build the Android **release variant**, and publish one release APK with its SHA-256 checksum. Debug APKs are not built or attached to releases. Debug builds remain available locally for development.

## One-time setup: release signing key

Configure a stable signing key so users can install updates over an existing release. Without it, CI can still build the release variant, but it falls back to the runner's debug signing key; that is not a debug APK, but it is not a stable release identity.

Generate a key and encode it for GitHub Actions:

```bash
keytool -genkeypair -alias tbone-fork -keyalg RSA -keysize 4096 \
  -validity 9125 -keystore fork-release.jks
base64 -w0 fork-release.jks > fork-release.jks.b64   # Linux
# macOS: base64 -i fork-release.jks | tr -d '\n' > fork-release.jks.b64
```

In **GitHub → repository → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | Contents of `fork-release.jks.b64` |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias, such as `tbone-fork` |
| `KEY_PASSWORD` | Key password |

Keep the keystore and passwords backed up in a secure place. Never commit them. Local builds can use the same values in `local.properties` (which is git-ignored).

## Publish a release

1. Bump the app version and add release notes:
   ```bash
   ./scripts/make-release.sh 0.3.52
   ```
2. Edit `CHANGELOG.md`, then commit the version and release notes.
3. Tag and push:
   ```bash
   git tag v0.3.52
   git push origin main --tags
   ```
4. Check the **Release APK** workflow in GitHub Actions. When it succeeds, the GitHub Release contains:
   - `T-Bone-fork-<version>-release.apk`
   - `SHA256SUMS.txt`

Verify the APK after downloading it:

```bash
sha256sum -c SHA256SUMS.txt
```

## What the release workflow does

1. Checks out the tagged commit and runs `scripts/privacy-check.sh`.
2. Sets up JDK 17 and the Android SDK.
3. Builds `:app:assembleRelease` only, then runs the unit tests.
4. Packages the release APK and its checksum, then publishes those files to the GitHub Release.

Only tags matching `v*` trigger this workflow. The privacy check also runs in CI for pull requests. If a release build cannot find a signing key, its notes identify that the release variant was signed with the fallback debug key; configure a repository release key for stable install-over-update signing.
