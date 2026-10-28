-- Newsletter signups (footer, /about, homepage) post to /api/waitlist with an explicit consent box
-- (ledger 299). Each entry keeps what was agreed to: the source, the version id of the exact box
-- wording (NEWSLETTER_CONSENT_VERSION in src/lib/newsletterConsent.ts) and when.
-- A newsletter signup for an email already on the list updates these columns on that row.
-- Only newsletter signups write them, so other signups don't depend on this migration; apply it
-- before deploying the newsletter form, or newsletter signups fail with a 500 and store nothing.
alter table public.waitlist_entries
  add column if not exists newsletter_consent_source text,
  add column if not exists newsletter_consent_version text,
  add column if not exists newsletter_consent_at timestamptz;
