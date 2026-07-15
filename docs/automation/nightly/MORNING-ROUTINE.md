# ☀️ Morning routine

> Read this first thing. It reminds you what happened overnight and what
> needs your attention before the next night's cycle.

---

## Quick status

- [ ] Check `Actions` tab for any night-lab failures
- [ ] Review open PRs from `opencode/nightly-*` branches
- [ ] Any high-risk changes to reject?
- [ ] Any merge conflicts to resolve?
- [ ] Is `NIGHT_LAB_ENABLED` still `true`? (Set to `false` to pause)

---

## Overnight summary location

`docs/automation/nightly/YYYY-MM-DD-summary.md`

If the integration-review mission ran, this file has the full handoff.
Read it first — it's designed to take < 5 minutes.

---

## PR review checklist

For each `[OpenCode Night Lab]` PR:

- [ ] Does the PR template include mission, evidence, tests, risk?
- [ ] Did tests actually pass? (check workflow logs)
- [ ] Are changes scoped to the mission, not broad rewrites?
- [ ] No secrets committed?
- [ ] No `.github/workflows/` modifications?
- [ ] No production deployment or packaging scripts?
- [ ] If macOS-only: labelled "unverified on Linux runner"?
- [ ] If mock AI: labelled "mock AI"?

**Merge order:** follow the integration-review mission's recommendation.

---

## Weekly review (Mondays)

- [ ] Check competitor research in `docs/research/automated/`
- [ ] Check cost in AI provider dashboard
- [ ] Update `NIGHT_LAB_MAX_RISK` if comfortable
- [ ] Review and prune stale `opencode/nightly-*` branches

---

## Emergency stop

```bash
# Fastest way to stop tonight's runs:
# GitHub → Settings → Variables → NIGHT_LAB_ENABLED → false
```

Or delete the `DEEPSEEK_API_KEY` secret.

---

## Tonight's schedule

If everything is green, the next cycle starts at **03:17 LA time**.

| Time (LA) | Mission |
|-----------|---------|
| 03:17 | Repository health |
| 04:17 | Backend & sync |
| 05:17 | Desktop overlay |
| 06:17 | AI & learning engine |
| 07:17 | Competitor research & v2 |
| 08:17 | Product design & accessibility |
| 09:17 | Integration review & summary |
