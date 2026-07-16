# macOS signing and notarization runbook

Owner: Apple Developer credential holder. Never commit certificates, private keys, app-specific passwords, API private keys, or provisioning material.

1. Confirm the final product name and bundle identifier (`com.unvibe.app` is current) before creating Apple records.
2. Install the Developer ID Application certificate in the operator's login keychain and verify with `security find-identity -v -p codesigning`.
3. Store notarization credentials in the keychain using `xcrun notarytool store-credentials`; use a CI secret store for automation.
4. Remove `identity: null` only in an approved release configuration. Keep hardened runtime and review `app/build/entitlements.mac.plist` line by line; do not add broad entitlements to make signing pass.
5. Build from a clean commit with the approved HTTPS backend. Verify nested code: `codesign --verify --deep --strict --verbose=2 Unvibe.app` and inspect `codesign -d --entitlements :- Unvibe.app`.
6. Submit the DMG: `xcrun notarytool submit <dmg> --keychain-profile <profile> --wait`. Save submission ID and log.
7. Staple and assess: `xcrun stapler staple <dmg>`; mount it; then run `spctl --assess --type execute --verbose=4 <mounted>/Unvibe.app` and `xcrun stapler validate <dmg>`.
8. Re-run checksum and the clean-machine QA matrix before distribution.

Pass evidence: commit SHA, certificate common name (not key), notarization submission ID/status, stapler validation, Gatekeeper assessment, final SHA-256, and QA signer. Failure blocks distribution; never bypass Gatekeeper for external testers.
