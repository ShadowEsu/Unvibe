# Desktop cleanup — September 19, 2026

Source: active checkout `/Users/prestonjaysusanto/Unvibe/Unvibe`, based on f4babe3. The outer checkout is older and was not edited. Marketing is untouched.

The latest user request supersedes older requirements for purple controls and keeping the Island within the menu bar: use neutral chrome, restrained San Francisco color, readable system-font controls, spacious lists, and a camera-safe Island below the menu bar. Keep Newsreader for editorial headings and monospace for code.

Implemented: neutral companion and widget surfaces, reduced sidebar clutter, bottom Ask entry with draft handoff/focus, quieter project-source disclosure, camera-safe Island position, onboarding save/retry handling, Briefings loading/no-project/error handling, and prevention of invalid folder selection silently using a previous repository.

Verification: app typecheck/build; 54 existing tests passed; fresh isolated-profile onboarding completed; Ask draft handoff and focus checked; Briefings no-project state checked; runtime Island y=46 below display safeTop=33; screenshots of companion and widget inspected. Physical testing on another notched Mac and cloud sign-in were not performed.

## Cloud integrations remain incomplete

The backend already selects SupabaseStore when configured. Learning-event sync exists; knowledge objects remain local. The available Supabase connection lists only Regrade-waitlist (lshqzxgzehgmzgeilvmy), whose ownership/purpose has not been confirmed for Unvibe. No remote schema changes were made.

GitHub currently detects GitHub Desktop and reads local git only. No GitHub App installation or PR ingest path exists. Completing this requires the intended GitHub owner/App identity and deployment configuration. A read-only, selected-repository installation plus metadata-only knowledge sync should preserve the current main-process secret filtering and per-repo consent. Do not switch local learning to cloud-only storage or send source bodies implicitly.
