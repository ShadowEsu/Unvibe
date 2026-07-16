# Real AI provider test

Credential owner: founder. Cost owner: founder. This checklist is deliberately not automated because it can make paid requests.

1. First complete the mock-provider staging gate and confirm no source or secret appears in logs.
2. Create a restricted staging provider key with a small spend limit; add it only to staging.
3. Confirm the configured provider/model name and current provider data-use terms. Record them in the AI disclosure review.
4. Use a disposable repository containing synthetic code and synthetic credential-shaped text.
5. Verify selection, active-file, and diff reviews; five explanation levels; token streaming; citations; follow-up; “explain differently”; and “test me.”
6. Confirm the synthetic secret is filtered locally and absent from request metadata and provider logs.
7. Test provider timeout, 401, 429, malformed structured output, stream interruption, and retry. Local learning must remain usable and no result may be mislabeled as real.
8. Record latency to first token, total latency, request count, estimated cost, provider request IDs, and screenshots with source redacted.
9. Remove or rotate the key after the test window.

Pass requires accurate project-grounded output with file/line citations, no secret transmission, honest error states, and founder acceptance of measured cost. This does not approve the provider's legal terms.
