# Waitlist beta email

Paste-ready copy for people already on the waitlist. Do not send until Preston says so. No cold email in this file.

Dry run, never sends:

```
cd marketing
npm run send:beta-invites
```

Send only after checking the recipient count:

```
npm run send:beta-invites -- --send
```

The live templates live in `marketing/src/emails/betaInvite.ts` and `marketing/src/emails/betaDownload.ts`. Both always include the install curl and the counted feedback URL at unvibe.site/feedback.

Facts in this mail, matching the site and the app:

- Current beta is `v0.1.11`
- Mac: `curl -fsSL https://unvibe.site/install.sh | bash`
- Windows: `irm https://unvibe.site/install.ps1 | iex`
- 30 AI explanations
- Feedback form: https://unvibe.site/feedback
- Survey unlocks 1 week of Pro. Waitlist gifts still add on.
- Every 3 verified referrals earns $5, up to 5 rewards ($25)

## Subject

You're on the Unvibe private beta

## Body

Hi {firstName},

Thank you so much for waitlisting, and for your support 💜

You're on the Unvibe private beta. This build is early, so bugs, crashes, and unfinished screens are expected. If something breaks, please tell us what you were doing. That note really helps.

Install (v0.1.11). 30 AI explanations, then it stops.

Apple silicon Mac:
curl -fsSL https://unvibe.site/install.sh | bash

Windows x64 PowerShell:
irm https://unvibe.site/install.ps1 | iex

macOS may warn that Unvibe is unsigned. Windows SmartScreen may say the same. That is expected until we notarize.

The beta includes 30 AI explanations. After you try it, fill the feedback form:
https://unvibe.site/feedback

The form unlocks 1 week of Pro and your referral code. Waitlist gifts still add on. Every 3 verified referrals earns $5, up to 5 rewards ($25). You can take Unvibe credit instead of a wire. We check eligibility first.

Thank you again for being here 💜

AI writes the code. Unvibe helps you understand it.

Best,
Preston Susanto
Founder, Unvibe
https://unvibe.site
