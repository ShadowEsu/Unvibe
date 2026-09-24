# Public-beta feedback and launch audit — 2026-09-23

This is an anonymized synthesis of direct email replies and launch checks. It excludes contact data and is not an outreach list.

## What people value

- **The quiz is the product proof.** An explanation only claims understanding; `Test me` provides the evidence. Lead product pages and onboarding with the loop: select → explain → test → save.
- **The direct installer is more trustworthy than `curl | bash`.** The Mac `.dmg` should be the primary path, with the command as an alternative for people who prefer it.
- **Privacy and verification need a concrete answer.** Prospective testers want to know exactly what leaves the device, what permissions are required, and how an AI explanation is checked before a learner trusts it.
- **The transparent credits/support disclosure builds trust.** Preserve its precise, itemized language.

## Blocking feedback

Several independent Windows testers reported that the current portable `.exe` can launch without a visible window or tray icon. Once opened, the local-only onboarding path, selected-code action, and Google sign-in can fail silently. A tester offered screenshots and logs.

**Release posture:** the Windows file is available as a public-beta preview, but it is not verified for broad launch messaging until these flows pass on a clean Windows machine.

## Work already applied

- The site now leads with direct Mac and Windows downloads and defaults to the Mac `.dmg`.
- Waitlist language has been changed to an optional community signup. Downloads do not require an email.
- The hero is shorter and wider, and release language states `Released · available now`.
- The feedback form remains linked after install and offers a week of Pro after completion.

## Next engineering work

1. Reproduce the Windows failures on a clean Windows x64 VM: first launch, tray/window visibility, local-only onboarding, `Ctrl+U` selection capture, and Google device flow.
2. Add visible loading, error, and recovery states to all five paths. A button must never leave the user without a result.
3. Add an independent explanation-check strategy: cite the code, separate generation and evaluation where possible, show uncertainty, and make a failed test useful rather than falsely reassuring.
4. Update onboarding and the home narrative so the quiz is presented as the verification step, not an optional afterthought.
5. Do not message a broad historic outreach list. Use only recent, opted-in testers after the Windows fix; exclude unsubscribe/stop requests, minors, and existing cold-outreach recipients.

## Launch-mail draft for approved testers after the Windows fix

**Subject:** Unvibe is ready to test

Hi [First name],

You offered to try Unvibe, so I wanted to send the current public beta directly. It helps you verify and retain AI-generated code: select a change, get an explanation, then use `Test me` to check what stuck.

Download for Mac: https://unvibe.site/beta

The beta starts with 30 free AI explanations. If you try it, the most useful feedback is whether selection capture works reliably, whether the explanation helps you verify the change, and whether the quiz finds a real gap. The feedback form is linked in the app and unlocks a week of Pro.

Thanks,
Preston
