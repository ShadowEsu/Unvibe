# Authentication flow

The desktop starts a device-code flow (`/api/v1/auth/device`, `/approve`, `/token`) in its main
process and stores only the returned opaque token with Electron `safeStorage`. The HTTPS activation
page uses Supabase Auth magic links, then sends the authenticated Supabase access token to the
backend for approval. The backend verifies that access token with its service-role client before
binding the device to that Supabase user.

Before beta, apply the device lifecycle migration, configure Supabase magic-link redirect URLs to
the staging activation URL, and verify expiry/revocation against the staging database. Do not
enable the development email route in staging.
