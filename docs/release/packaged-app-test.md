# Packaged app test

## Build an unsigned staging artifact

From `app/`:

```sh
APP_ENV=staging UNVIBE_BACKEND=https://approved-staging.example npm run package:local
npm run verify:package
```

The command refuses production mode, HTTP, localhost, missing icon resources, and missing staging URL. It creates an arm64 unsigned DMG plus SHA-256 file. The backend URL is compiled into the main bundle; the verifier rejects embedded localhost URLs and checks the bundle identifier.

## Manual clean-machine acceptance

1. Transfer the DMG and checksum to a clean Apple-silicon Mac; run `shasum -a 256 -c <file>.sha256`.
2. Mount, drag to Applications, and launch using the documented unsigned-build override only for internal QA.
3. Confirm icon, menu bar item, floating bar, companion app, Accessibility permission prompt, shortcut, movable/pinnable widget, streaming mock review, sign-in, sync, offline state, and account deletion.
4. Inspect Network activity to confirm only the approved staging origin is contacted.
5. Quit/relaunch and uninstall; record residual files under Application Support.

Unsigned artifacts are for internal QA only. They are not a distributable beta release.
