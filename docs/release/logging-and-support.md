# Logging and support data

Allowed operational fields: timestamp, app/build version, endpoint/operation name, coarse status class, duration, retry count, record count, provider request ID (when approved), and pseudonymous internal user ID when necessary.

Never log source code, selected text, diffs, prompts, explanations, quiz answers, file/repository names, email, bearer/device/session tokens, cookies, Supabase keys, provider keys, request bodies, environment variables, or secret-filter matches. Errors shown to users should be actionable but not expose internal credentials or SQL.

Support attachments must be sanitized by the tester and reviewed before entering an issue tracker. Access to staging logs is least-privilege and time-bounded. Retention and deletion periods are not yet approved; follow the legal retention matrix and remove debug artifacts after the incident window. Runtime performance measurement follows the same metadata-only rule.
