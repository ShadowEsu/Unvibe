/**
 * Email-only sign-in (POST /api/v1/auth/signin and /signup) signs in as any existing account with
 * nothing but its address, so it exists for local development only. No setting turns it on in a
 * production build or on any Vercel deployment (preview included): real users sign in with the
 * verified device flow.
 */
export function devEmailAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && !env.VERCEL;
}

export function devEmailAuthDisabledResponse(): Response {
  return Response.json({ error: 'Cloud sign-in is not configured for this build. Use local-only mode or configure verified authentication.' }, { status: 501 });
}
