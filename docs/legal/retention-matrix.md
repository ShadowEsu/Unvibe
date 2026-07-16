# Retention matrix — decisions required

No period below is approved merely by appearing here.

| System/data | Current technical trigger | Period to approve | Verification owner |
| --- | --- | --- | --- |
| Local learning JSON | Successful in-app deletion or manual uninstall cleanup | Until deletion; define uninstall expectation | Engineering/product |
| Local encrypted session | Sign-out revokes/deletes current token; deletion wipes local store | Session max 30 days server-side | Engineering |
| Supabase primary rows | Account endpoint deletes/cascades users/events/skills/tokens/device/consent | Until successful account deletion | Engineering + privacy |
| Expired device codes/tokens | Rejected after 10 min/30 days; no purge job exists | Define purge schedule | Operations/privacy |
| AI request content/provider logs | Provider-controlled | Confirm contract/account settings | Founder/legal |
| Hosting/application logs | Platform-controlled/configured | Define and enforce | Operations/legal |
| Database backups | Not established here | Define rotation and deletion-on-restore process | Operations/legal |
| Waitlist | No automated expiry identified | Define conversion/rejection deletion | Marketing/legal |
| Support records | Manual support process | Define by severity/legal need | Support/legal |

Counsel must align periods with stated purposes, user rights, litigation/security needs, subprocessors, jurisdictions, and actual platform settings. Engineering must test scheduled purge behavior before publishing a number.
