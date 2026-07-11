# Dependency license report

Generated 2026-07-11 from the installed `node_modules` of `app/` and `web/` (direct + transitive).
Regenerate with the license-scan commands in the repo history, or a tool like `license-checker`.

## Summary by license type
| License | Count | Restrictive? |
|---|---|---|
| MIT | ~93 | No |
| ISC | 6 | No |
| Apache-2.0 | 5 | No (permissive; patent grant) |
| BSD-3-Clause | 4 | No |
| BSD-2-Clause | 3 | No |
| CC-BY-4.0 | 1 | No (attribution only; build-time data) |
| 0BSD | 1 | No |
| MIT OR CC0-1.0 | 1 | No |

## Notable non-MIT/ISC dependencies
| Package | License | Notes |
|---|---|---|
| typescript | Apache-2.0 | Dev/build only |
| @swc/counter, @swc/helpers | Apache-2.0 | Transitive (Next.js) |
| sumchecker | Apache-2.0 | Transitive (electron download) |
| caniuse-lite | CC-BY-4.0 | Build-time browser data; **attribution required** if redistributed |
| extract-zip, http-cache-semantics, webidl-conversions | BSD-2-Clause | Transitive |
| global-agent, roarr, source-map-js, sprintf-js | BSD-3-Clause | Transitive |
| tslib | 0BSD | Transitive |
| type-fest | MIT OR CC0-1.0 | Transitive |

## Findings
- **No copyleft licenses** (no GPL / AGPL / LGPL / MPL / EPL / SSPL) were found in the dependency tree.
- All licenses are permissive and compatible with a proprietary, closed-source distribution.
- **Action item:** if the app ever redistributes `caniuse-lite` data verbatim, include CC-BY-4.0
  attribution. Bundled build output does not typically trigger this, but confirm before release.
- **Action item:** ship a `THIRD-PARTY-NOTICES` file with the packaged app (aggregate the license
  texts). Recommended generator: `npx license-checker --production --files ./THIRD-PARTY`.

This report is informational and not a legal opinion. Have counsel confirm before launch.
