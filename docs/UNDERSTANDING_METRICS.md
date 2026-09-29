# Understanding metrics

Formulas live in `app/src/core/understandingMetrics.ts`.

Coverage is evidence-weighted and returns null when there is no evidence.

Knowledge risk is directional: 35% missing + 30% concentration + 20% stale + 15% unreviewed. Labels: LOW / MEDIUM / HIGH / CRITICAL.

Understanding Gap is normalized code velocity minus understanding velocity. The number is a product signal, not a scientific measure of whether someone knows the code.

Organization dashboards, member rankings, and live gap charts are not shipped.
