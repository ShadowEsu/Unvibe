# Rollback plan

Trigger rollback for cross-user access, suspected secret transmission, broken deletion, data loss/corruption, signature/notarization failure, persistent auth/sync outage, or severe provider behavior.

1. Founder pauses tester invitations and artifact links. Do not delete evidence or production/staging data.
2. Disable the affected staging deployment or promote the last verified deployment through the hosting platform's normal rollback; never force-push or rewrite migration history.
3. If the client is affected, withdraw the artifact/checksum and notify invited testers with uninstall/offline guidance. There is no auto-update channel to rely on.
4. For an additive migration regression, deploy a forward corrective migration. Do not drop columns/tables or restore over user data without explicit, reviewed authorization.
5. For provider issues, remove/rotate the staging key and fall back to the clearly labeled mock/local-only state; do not silently substitute mock output.
6. Run local and staging verification on the restored version; confirm row counts, auth, deletion, and two-user isolation.
7. Document trigger, decision-maker, timeline, affected builds/users, evidence, containment, fix, and re-release criteria.

Rollback success is verified service/client behavior, not merely a platform status of “ready.”
