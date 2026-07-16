# AI provider disclosure inputs — draft

Before enabling a real provider, record and have counsel approve:

- legal provider entity, service/model, region, subprocessor list, and contract/DPA;
- exactly what filtered code/context and account metadata is transmitted;
- retention duration, abuse-monitoring access, training/model-improvement settings, and opt-out applicability for the actual account/tier;
- cross-border transfer mechanism, security commitments, incident notice, and deletion process;
- user-facing statement that filtering reduces risk but cannot guarantee every secret is detected;
- user-facing statement that output may be wrong, incomplete, or insecure and requires human verification;
- fallback behavior and whether any provider switch requires notice/consent.

Current engineering truth: no custom model is trained in this repository; a configured real-provider request transmits locally filtered context for inference; mock mode makes no paid provider call. That does not establish what an external provider may retain or use. Avoid “never trained,” “fully private,” “always protected,” or equivalent claims until the exact provider account and terms support the scoped wording.
