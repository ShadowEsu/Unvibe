# Performance baseline

The product must feel quiet and immediate. Measure on a clean Apple-silicon Mac with a Release/packaged build, three warm repetitions after one cold run, and synthetic code.

| Measure | Instrumentation | Beta target |
| --- | --- | ---: |
| Cold launch to menu-bar ready | Instruments signpost or screen recording | ≤ 2.5 s |
| Shortcut to floating bar visible | 60 fps recording | ≤ 150 ms |
| Local review preparation/secret scan | main-process timing, metadata only | ≤ 100 ms for active file |
| Mock first explanation token | request start to first SSE token | ≤ 500 ms local |
| Real-provider first token | staging request ID timing | Record p50/p95; founder sets gate |
| 1,200-event local dashboard load | UI ready after store open | ≤ 1.0 s |
| 1,200-event remote restore | sync timestamps and page progress | No freeze; complete without cap |
| Idle CPU/memory | Activity Monitor after 5 min | Near-zero CPU; record memory baseline |

Do not log source, prompts, explanations, tokens, file contents, access tokens, or email. Record only duration, count, operation, app version, result class, and coarse device/OS. Current automated timings are build/test timings in `baseline-validation.md`; user-facing runtime targets remain unverified until packaged QA.
