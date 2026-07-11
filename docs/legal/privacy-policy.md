# Privacy Policy — DRAFT (requires attorney review)

_Last updated: [DATE]. Operator: [COMPANY] ("we"). Contact: [privacy@DOMAIN]._

Unvibe is a desktop application that helps you understand code. This policy describes what we
process and why. It reflects the product's actual behavior as built.

## What the app processes
- **Selected code you choose to review.** When you activate Unvibe on a selection, that snippet
  (and, in future, limited surrounding context) is sent to our backend to generate an
  explanation. **Before anything leaves your Mac, it is scanned on-device for secrets** (API
  keys, tokens, private keys); detected credentials block or warn before transmission.
- **Repository metadata** (file paths, structure, git diffs) only when you explicitly review
  those scopes. We do **not** read your repository in the background.
- **Learning records**: which snippets you reviewed, comprehension results, concepts, and streaks.
- **Account data**: your email address (for sign-in) and an authentication token.
- **App-context metadata**: the name of the application you were in when you asked (e.g. "VS Code")
  — never its contents beyond the code you selected.

## What we do NOT do
- We do **not** read your repository without an explicit action from you.
- We do **not** train AI models on your private code.
- We do **not** log the contents of your private code in analytics.
- We do **not** perform screen recording or keylogging.

## Third parties
- **AI provider.** Filtered code is sent to our AI provider (initially Anthropic) to generate
  explanations, subject to their terms. Provider transmission is inherent to the product.
- **Supabase** (hosting/database/auth) stores your account and learning records.
- We use no advertising trackers.

## Storage & security
- Learning data is stored locally on your Mac and, when signed in, synced to our backend.
- Your authentication token is **encrypted at rest** using the operating system keychain.
- Backend tables enforce row-level security so one user cannot read another's data.

## Your rights
- Access, export, and deletion of your data. **Deleting your account removes your data locally
  and on our servers and revokes your tokens** (see `account-deletion-policy.md`).
- Depending on your location (GDPR/CCPA/etc.), you may have additional rights. [ADD JURISDICTION-SPECIFIC LANGUAGE.]

## Children
Not directed to children under [16]. See Terms.

## Changes & contact
We will post changes here with a new date. Questions: [privacy@DOMAIN].
