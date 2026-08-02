# Research Report: Privacy and Trust Positioning in AI Coding Tools — Training, Retention, Consent, and the Local-First Spectrum

**Date:** 2026-08-02
**Mission:** competitor-research-and-v2
**Researcher:** OpenCode Night Lab (automated)
**Sources:** Public privacy policies, product pages, and product documentation (fetched 2026-08-02)
**Gap filled:** Prior night-lab reports treated secret filtering as a table-stakes feature comparison (2026-07-28 code-explanation-landscape) and examined the change-communication and comprehension loops (2026-08-01, 2026-07-31). None examined **how AI coding products position privacy and trust themselves** — the marketing-level promises about model training, data retention, user consent, and the "local-first vs. enterprise-trust" spectrum. That positioning directly determines whether Unvibe's own privacy architecture (on-device secret filter, backend never reads the repo, preview-before-send, metadata-only logging) is a defensible wedge or merely table stakes.

---

## Research Question

How do today's leading AI coding tools position privacy and trust in their public materials — specifically around model training on user code, data retention, user consent, and local processing? Where does the market place "privacy" as a competitive weapon, and is there an unclaimed trust position Unvibe can own?

---

## Dated Sources

| Source | URL | Date accessed | What it informed |
|---|---|---|---|
| Cursor (Anysphere) Privacy Policy | cursor.com/privacy | 2026-08-02 | No-training-by-default pledge, processor/controller split, enterprise subprocessors, SOC 2 |
| Anthropic Privacy Policy | anthropic.com/legal/privacy | 2026-08-02 | Training on inputs/outputs unless opted out; consumer vs. enterprise split; non-user training policy |
| GitHub Copilot — Plans & pricing FAQ | github.com/features/copilot/plans | 2026-08-02 | Training on Individual-plan data since Apr 2026; no training on Business/Enterprise; retention periods; code-referencing filter |
| GitHub Copilot Business page | github.com/features/copilot/copilot-business | 2026-08-02 | "Committed to your privacy, security, and trust"; trust-center link; no-training claim |
| GitHub Advanced Security (Secret Protection) | github.com/security/advanced-security | 2026-08-02 | Secret scanning as a paid product; "$19 per active committer/month"; "stop leaks before they start" |
| Pieces (on-device memory) docs | docs.pieces.app | 2026-08-02 | Local-first / on-device positioning as the whole product identity |

Note: OpenAI's data-usage and enterprise-privacy pages returned HTTP 403 to this runner and were not usable; Sourcegraph's docs page is JS-rendered and returned only a shell. Their claims are not asserted here. Cursor's detailed product-UI data-use settings page is a separate doc that also did not render; Cursor claims below are limited to the rendered Privacy Policy text and are labelled as such.

---

## Observed Product Behavior

### Cursor (Anysphere) — "we do not train on your inputs" as a consumer default (cursor.com/privacy)
- **No-training default (consumer)**: "We do not use Inputs or Suggestions to train our models, or permit third parties to use them for training, unless: (1) they are flagged for security review … (2) you explicitly report them to us … or (3) you've explicitly agreed." This is the strongest consumer-facing no-training formulation observed across the set.
- **Processor/controller split**: The policy explicitly states it "does not apply where Anysphere acts as a data processor" for commercial customers — enterprise data is governed by customer agreements, with a subprocessor list at trust.cursor.com/subprocessors.
- **Collection scope is broad but product-relevant**: Inputs and Suggestions, account data, payment info, device/log/usage data, cookies, location for security. No genetic/biometric/health/child data (explicit "Information We Do Not Collect" section).
- **Retention**: "only as long as necessary"; settings may influence duration; some temporary interactions may be stored short-term for safety/monitoring.
- **Trust furniture**: SOC 2 Certified badge in the footer; separate Security page; trust.cursor.com subprocessors. Enterprise subprocessor disclosure is a processor-tier feature, not consumer-facing.

### Anthropic — "we may train on your conversations unless you opt out" (anthropic.com/legal/privacy)
- **Training by default for consumers, with opt-out**: "We may use your Inputs and Outputs to train and improve Anthropic AI models, unless you opt out through your account settings." Even after opt-out, flagged or reported content is still used for safety review.
- **Consumer vs. enterprise split**: "This Privacy Policy does not apply to content that we process on behalf of customers of our business offerings, such as our Enterprise accounts."
- **Aggregated/de-identified use**: feedback is disassociated from user ID for training; harmful-content flags are disassociated to train trust-and-safety models; re-identification only to enforce ToS.
- **Explicit non-user training disclosure**: a separate "Non-User Privacy Policy" explains how third-party personal data enters training data; model training is acknowledged as a core use of personal data.
- **Retention/deletion**: per-article retention guidance; individual conversation deletion "removed immediately from your conversation history and automatically deleted from our back-end within 30 days."
- **Transfer**: US servers, SCCs/adequacy decisions for EEA/UK transfers; subprocessors listed.

### GitHub Copilot — "we do not train Business/Enterprise; Individuals may be trained on unless they opt out" (github.com/features/copilot/plans FAQ)
- **Sharp tier-based split, stated directly**: "Does GitHub use Copilot Business or Enterprise data to train GitHub's model? **No.**" In contrast, for Individual (Free/Pro/Pro+) subscribers: "Starting on April 24, GitHub may also use interactions from users with a Copilot Free, Pro, and Pro+ subscription — including inputs, outputs, code snippets, and associated context — to train and improve our AI models unless they have opted out."
- **Retention (Business/Enterprise)**: IDE prompts/suggestions "Not retained"; user engagement data kept 2 years; feedback stored as long as needed. Other access paths (github.com/CLI/mobile) retain prompts/suggestions 28 days because thread history improves responses.
- **Code-referencing/duplication filter**: optional filter suppresses suggestions matching public code ≥65 lexemes (≈150 chars) — a *copyright* filter, explicitly not a secret filter.
- **IP indemnity**: offered at Business/Enterprise tiers only (per plans matrix).
- **Trust messaging**: "Committed to your privacy, security, and trust" with a trust-center link; Gartner MQ recognition; SOC 2 and DPA/DPA support for GDPR.
- **Billing transparency is the monetized trust signal**: AI Credits at $0.01 each, budget caps, per-PR spend caps — trust in cost control, not data handling.

### GitHub Advanced Security / Secret Protection — secret scanning is a paid, separate product
- Positioned as "Stop leaks before they start" and priced per active committer/month ($19 Secret Protection, $30 Code Security).
- Secret scanning is an *adjacent paid product*, not a feature of the AI assistant flow. A developer's code leaves the machine to Copilot's model and secret-scanning is a separate organizational purchase.

### Pieces — "on your device" as the whole product identity (docs.pieces.app)
- "On-device AI that remembers what you do … privately, on your device." A local background service ("PiecesOS — the secure, local background service that powers the entire Pieces experience") is the core architecture.
- Local-first is the *name* of the product category, not a compliance footnote.

---

## User Problem Addressed

Developers and their organizations increasingly ask two questions before adopting an AI coding tool: (1) **"Will my private code be used to train models?"** and (2) **"What exactly leaves my machine, and under what consent?"** The industry answer is converging on a *tiered trust contract*: consumer plans are training-by-default-with-opt-out (Anthropic, GitHub Individual) or no-training-by-default (Cursor), while all meaningful enterprise sales hinge on a processor-tier contract, a no-training guarantee (GitHub Business/Enterprise explicitly, Anthropic/Cursor via customer agreements), subprocessor disclosure, and SOC 2 attestation.

The trust problem is therefore largely solved by **legal contract and price tier** rather than by product architecture. Local processing (Pieces) remains a minority positioning, and proactive secret filtering integrated *into the AI request path* is not marketed by any leader — GitHub sells it separately as Advanced Security.

---

## Why It May Work (or Not)

### Why the tiered-trust-contract approach works
1. **Enterprise procurement demands it.** No-training guarantees, DPAs, SOC 2, subprocessor lists, and indemnity are literal checkboxes in enterprise security reviews; the leaders have all built the furniture.
2. **A simple sentence wins.** "We do not use your inputs to train" (Cursor) and "No, GitHub does not use Business/Enterprise data to train" are the clearest trust signals; both are deliberately one line.
3. **Retention transparency reduces fear.** Explicit numbers ("28 days", "2 years", "not retained") convert an abstract privacy risk into a bounded one.

### Why it may not work / where it stops short
1. **Privacy is a contract, not an experience.** Every leader moves the burden to legalese (policies, DPAs, opt-out settings buried in account settings). Nothing in the set shows the *user* a live preview of exactly what will be transmitted at the moment of a request.
2. **The individual tier is the weak link.** Anthropic and GitHub Individual train on user inputs by default with an opt-out toggle — the exact population most likely to paste proprietary or credential-bearing code into a tool. Cursor's no-training default is the exception, not the rule.
3. **Opt-out fatigue and hidden defaults.** Opt-out toggles inside account settings are a known dark-pattern-adjacent pattern; the default favors the vendor.
4. **Secret protection is bolted on, not built in.** Advanced Security's secret scanning is an add-on purchase, and Copilot's own filter is for copyright (code-referencing), not credentials. The tool that would most benefit from secret blocking (the AI that reads your code) does not market it.
5. **"Local-first" is a niche identity.** Pieces owns it, but the biggest vendors cannot make local-first claims because their model quality depends on cloud inference; they retreat to contract-based trust instead.

---

## Limitations (as of August 2026)

- **First-party self-reports only.** All observations are from vendor privacy policies and marketing pages; no independent audit of whether Cursor actually withholds consumer training data, or GitHub's Individual-tier opt-out is honored in practice, exists in the public record.
- **Cursor specifics are policy-only.** Cursor's rendered Privacy Policy is authoritative for its promises, but its product-UI data-use settings page did not render on this runner; in-product consent flows are unverified here.
- **OpenAI and Sourcegraph could not be fetched** (HTTP 403 / JS-rendered shell) and are deliberately absent from the comparison.
- **Policy recency varies.** Cursor's policy is dated 2025-10-06; Anthropic's is dated 2026-07-08; GitHub's FAQ reflects the April 2026 individual-tier training change. Cross-vendor comparison assumes each policy is current at fetch time.
- **No measured adoption data.** No public figures connect these privacy promises to conversion or churn; the "privacy sells" hypothesis here is inference from the presence of trust furniture, not from outcome data.

---

## What Unvibe Can Learn

1. **The trust message that wins is a plain sentence, not a policy.** "We do not train on your code" / "The backend never reads your repo" must be stated in the product in one line — the leaders prove this is the effective register.
2. **Consent at the moment of send is the unclaimed experience.** Every leader locates consent in a policy or a buried toggle; none shows the user the exact payload at the moment it would leave. Unvibe's **preview-before-send** (currently implemented only as a consent screen on suspect-value detection, per `docs/privacy.md`) is the productization the industry has not shipped. This is the single most defensible differentiator.
3. **No-training must be a default, not a tier.** Cursor's consumer no-training default and GitHub's Business no-training are the trust ceiling; Unvibe's "no training on private repos" already matches the strongest formulations and must be stated as an absolute, not a plan feature.
4. **Secret filtering belongs in the AI request path, not in an add-on.** GitHub sells secret scanning separately (Advanced Security); Unvibe's on-device filter *before every remote request* is the architectural version of that paid product, and it should be marketed as such — "the thing GitHub charges you extra for is built into our loop."
5. **Retention numbers are trust furniture.** Unvibe's metadata-only logging (timestamps, level, line count, outcome — no code) is already a *stronger* retention story than Copilot's 28-day prompt retention; the numbers should be published in the product, not only in `docs/privacy.md`.
6. **Enterprise trust furniture is a later problem.** SOC 2, DPA, subprocessors, and IP indemnity are procurement checkboxes; a solo/beta product does not need them yet, but the *architecture* (sandboxed renderers, main-process-only network) already produces the strongest trust property (no renderer network access) that even leaders do not claim per-feature.

---

## What Unvibe Should Avoid Copying

1. **Do not copy the legalese-first trust model.** No 8,000-word privacy policy as the primary trust surface; Unvibe's calm, quiet product voice should surface trust as one-line in-context statements, not a wall of policy.
2. **No opt-out-by-default training, ever.** Neither Anthropic's consumer default nor GitHub's Individual default is a model to emulate; Unvibe's no-training position is absolute and must not migrate to "opt-out available in settings."
3. **No per-committer security add-on pricing.** Secret protection as a $19/committer upsell is exactly what Unvibe should *not* do — its filter is free, built-in, and before-send.
4. **No SOC 2 / Gartner badge noise in beta UI.** Trust badges are procurement furniture; on the desktop widget they read as noise and violate the black-and-white, calm design system.
5. **Do not claim local-only.** `docs/privacy.md` is explicit: "Do not describe the product as local-only: filtered selected code is transmitted to the configured backend/model provider for cloud explanations." Unvibe is *local-filtered*, not *local-only* — a materially different and more honest claim than Pieces' on-device identity.

---

## Original Unvibe Interpretation

The industry's trust model is a **contract layered on top of a product that still transmits everything**. Vendors compete on the fine print (training defaults, retention windows, subprocessor lists, indemnity) while the developer experience of consent is a toggle buried in settings. Unvibe's interpretation inverts this: **trust is an experience, not a contract**. The product's quiet loop is engineered so that secrets never leave the machine (on-device filter before every remote request), the backend never reads the repository, the user can preview exactly what will be transmitted, and learning records carry metadata only. Where the leaders say "here is our policy," Unvibe says "here is your payload before it goes anywhere."

The sharpest consequence for the marketing and product roadmap: **"review my AI's change without my secrets leaking"** is not a compliance feature — it is the *reason to trust the comprehension loop at all*. GitHub's own pricing proves users are willing to pay for secret protection; Unvibe's equivalent protection is free and architectural. The trust wedge and the comprehension wedge are the same wedge.

---

## Expected User Benefit

- A developer using Unvibe gets the no-training and metadata-only promises the leaders only make to enterprise contracts — as a consumer default.
- The moment of transmission is visible and consenting (preview-before-send), so "is this safe to run?" stops being a policy-reading exercise.
- The user gets secret-protection-equivalent value (on-device blocking of keys/tokens before any request) that GitHub only sells as a per-committer add-on.
- Honest "local-filtered, not local-only" framing means no user is surprised that cloud inference occurs, preserving trust through accurate expectations.

---

## Technical Difficulty

| Component | Difficulty | Notes |
|---|---|---|
| Publish retention/trust numbers in-product (one-line statements) | Low | Copy + a small settings/privacy surface in the companion app; no machinery |
| "No training on private repos" as absolute marketing line | Low | Copy work; must match the real provider contract (see `docs/privacy.md` caveat: provider retention/training promises depend on provider contract) |
| Full preview-before-send for all contexts (not just suspect values) | Medium | Currently gated on suspect-value detection only; extending to every request requires a consent step in the send path in `app/src/main/` |
| Market secret-filter-before-send as the built-in equivalent of GitHub Advanced Security | Low | Positioning/copy; the filter already exists and is tested |
| Enterprise trust furniture (SOC 2, DPA, subprocessor list) | High / later | Procurement scope; explicitly deferred |
| Local inference to make "local-only" true | Not planned | Would require replacing cloud explanation, contradicting the current architecture |

---

## Security and Privacy Considerations

- This report proposes no change to the trust boundary. Unvibe's existing rules hold: secrets filtered on-device before any remote request; backend never reads the repo; metadata-only learning records; `docs/privacy.md` warnings about provider-dependent training promises must be honored before any public "we never train on your code" claim is made absolute.
- **Claim integrity**: "no training on private repos" is only true per the selected provider contract and deployment settings. The public marketing line must be contingent on that contract until it is verified (as `docs/privacy.md` requires). Do not overstate before provider verification.
- "Local-filtered, not local-only" keeps Unvibe honest and prevents a regulatory/consumer surprise; Pieces-style "on your device" claims must be avoided.
- Publishing retention numbers (metadata-only, code never stored) strengthens trust and requires no new data flow — but the exact log fields and durations must match the implementation before they appear in UI.

---

## Smallest Validation Experiment

A copy + consent-surface experiment, no new backend:

1. **Preview-before-send for all requests.** Extend the consent screen from suspect-value-only to every outbound context, with a one-line trust statement ("No code stored. No training. Filtered locally. You can see exactly what leaves.") and a "what's included" expander. Measure whether opt-out-to-cloud rates, explanation click-through, and "I understand" confirmations stay stable or improve vs. today.
2. **Publish trust numbers in-product.** Add a small privacy surface (Settings → Privacy) showing: what was filtered this session (count), what was transmitted (code excerpt + diff + project summary), what is stored (metadata only). Measure whether this surface correlates with higher review-queue completion.
3. **Marketing A/B on the secret-protection line.** Compare "Reviews AI-generated code you can understand" vs. "Reviews AI-generated code without your secrets ever leaving your machine." Measure signup conversion on the marketing site.

Hypothesis: the preview-before-send trust moment is the retention differentiator the leaders cannot copy without re-architecting; if engagement and completion hold or improve with full preview, it validates shipping it broadly.

---

## v1, v2, or Later Recommendation

| Pattern | Recommendation | Rationale |
|---|---|---|
| One-line trust statements in-product ("No training. No code stored. Filtered locally.") | **v1** | Copy-level; matches the proven leader register |
| Publish retention/metadata-only numbers in Settings → Privacy | **v1** | Stronger than Copilot's numbers; cheap |
| Secret-filter-before-send marketed as built-in secret protection | **v1** | Existing, tested filter; positioning win vs. GitHub's add-on |
| Full preview-before-send for every request | **v1/v2** | Medium effort in the send path; highest differentiation; requires consent-flow UX in the calm design system |
| "We never train on your code" absolute marketing claim | **blocked on provider verification** | Must wait for provider-contract verification per `docs/privacy.md` |
| SOC 2 / DPA / subprocessors / indemnity | **later** | Procurement furniture; not needed for beta |
| Local inference / "local-only" | **never** | Contradicts the shared-backend architecture |

---

## Key Takeaways

1. **The leaders sell trust as a contract tier, not an experience.** No-training is a business/enterprise guarantee or a consumer default in fine print; consent lives in policies and buried toggles.
2. **Cursor's consumer no-training default is the strongest promise in the set**; GitHub's "No, Business/Enterprise data is not used for training" is the clearest sentence. Unvibe already matches both architecturally and should say so in the same register.
3. **Secret protection is priced separately by the market's leader (GitHub Advanced Security, $19/committer/mo)** — Unvibe's on-device filter before every remote request is the built-in, free, architectural version of a paid product. That is a marketing asset, not just a compliance control.
4. **Preview-before-send at the moment of transmission is unclaimed by every leader.** It is the productized consent the industry has not shipped, and it is the natural home for Unvibe's calm, honest trust voice.
5. **"Local-filtered, not local-only" is the honest claim.** Unvibe must not drift into Pieces-style on-device-only identity; its differentiator is architectural filtering plus metadata-only storage, verified against provider contracts before absolute claims.
