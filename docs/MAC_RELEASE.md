# macOS release signing

The local tester DMG is integrity-sealed with an ad-hoc signature and hardened runtime. It is not an Apple-verified public release.

The current verified API origin is `https://unvibe-api-sigma.vercel.app`. Keep the backend host explicit during packaging so an older Vercel project cannot be baked into the app accidentally.

Local tester builds use a separate ad-hoc entitlement that disables library validation because ad-hoc signatures have no Apple Team ID. Public builds do **not** use that entitlement: the release script uses `entitlements.mac.plist` and requires every component to be signed by the same Developer ID identity.

To remove Gatekeeper’s “Apple could not verify” warning, the exact public build must be signed with a **Developer ID Application** certificate, submitted to Apple’s notary service, and have the returned ticket stapled to the DMG.

## One-time Apple setup

1. Join the Apple Developer Program and create a Developer ID Application certificate.
2. Install that certificate and its private key in the login keychain.
3. Create a notarytool profile without putting credentials in the repository:

   ```bash
   xcrun notarytool store-credentials "unvibe-notary" \
     --apple-id "YOUR_APPLE_ID" \
     --team-id "YOUR_TEAM_ID" \
     --password "YOUR_APP_SPECIFIC_PASSWORD"
   ```

## Build the verified public DMG

From `app/`, provide only deployment configuration and opaque Unvibe access—not an AI-provider key:

```bash
APP_ENV=production \
UNVIBE_BACKEND=https://YOUR_APPROVED_API_HOST \
UNVIBE_TRIAL_TOKEN=YOUR_OPAQUE_UNVIBE_TRIAL_TOKEN \
CSC_NAME="Developer ID Application: YOUR LEGAL NAME (TEAMID)" \
APPLE_NOTARY_PROFILE=unvibe-notary \
npm run package:release
```

The script refuses to proceed without a non-local HTTPS backend, installed Developer ID identity, keychain notary profile, hardened runtime resources, successful notarization, stapling, and final Gatekeeper assessment.

The packaging flow uses `app/scripts/create-custom-dmg.mjs` after signing the app bundle. It asks Finder to write the background, icon positions, and window size into the DMG so the purple drag-to-Applications layout is preserved instead of opening as a blank default window.

Never commit Apple credentials, the trial token, or model-provider keys. Provider credentials belong on the hosted backend only.
