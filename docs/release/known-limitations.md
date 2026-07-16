# Known limitations

- macOS on Apple silicon is the only packaged target currently prepared. Intel, Windows, and Linux are unsupported.
- VS Code and Cursor are the supported active-app targets. No screen recording, OCR, browser IDE, browser extension, or mobile app is included.
- The app needs Accessibility permission to read the currently selected code through the approved interaction path.
- Local learning works offline; remote explanations and account sync do not. Sync is eventual and has no conflict editor.
- Explanation quality depends on transmitted, locally filtered context and may be incomplete or wrong. Citations and code must be verified.
- The backend/marketing apps remain on Next.js 14.2.35 with explicitly acknowledged advisories pending an approved Next 16 migration.
- Skills are evidence summaries, not proof of mastery. The model is prepared in migration 0007 and must not be exposed as a finished feature until staging is verified.
- Projects are derived from event metadata. Notes, saved explanations as a separate resource, subscriptions, team admin, social features, and complex gamification are not implemented.
- Billing and paid plans are disabled. No “free forever,” unlimited usage, provider privacy, or no-training guarantee should be inferred.
- Signing/notarization, real-provider behavior, staging persistence, deletion, and two-device sync remain unverified until the release checklist contains evidence.
