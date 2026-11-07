# Bundled fonts

Every font the renderer windows use ships inside the app, so no window asks Google Fonts or any other CDN for type. The file is copied unmodified from the family's upstream release. Nothing is subset, converted or renamed. The licence is the `OFL.txt` beside the file (SIL Open Font License 1.1). It declares no Reserved Font Name. If you subset the file later, check the licence again first, because a modified font with a Reserved Font Name has to be renamed.

`scripts/build.mjs` copies this folder to `dist/renderer/fonts/`, and electron-builder packs `dist/**` into the app, so `OFL.txt` and this list ship with the font. `shared/fonts.css` declares the face. Every window sets every string in JetBrains Mono (the Spectral look).

| File | Upstream source | Version | Bytes | sha256 |
| --- | --- | --- | --- | --- |
| `jetbrains-mono/JetBrainsMono[wght].ttf` | `fonts/variable/JetBrainsMono[wght].ttf` in https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip (the release has no variable woff2) | release v2.304 (commit `cd5227bd1f61dff3bbd6c814ceaf7ffd95e947d9`) | 303144 | `662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016` |
| `jetbrains-mono/OFL.txt` | `OFL.txt` in the same zip | release v2.304 | 4399 | `30f0c136e3c88e422d0791acd97238870f9054a9729bc34cf2ff0d4ed8cac4ad` |

Zip checksum: `JetBrainsMono-2.304.zip` sha256 `6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf`.

`test/rendererNoRemoteOrigins.test.ts` fails if any renderer HTML or CSS points at a remote origin, if any CSP allows a host or lacks `default-src 'none'`, or if `fonts.css` points at a font file that isn't here.
