# Bundled fonts

Every font the renderer windows use ships inside the app, so no window asks Google Fonts or any other CDN for type. The files are copied unmodified from each family's upstream release or repository at a pinned commit. Nothing is subset, converted or renamed. Each family's licence is the `OFL.txt` beside its files (SIL Open Font License 1.1). None of these licences declares a Reserved Font Name. If you subset a file later, check the licence again first, because a modified font with a Reserved Font Name has to be renamed.

`scripts/build.mjs` copies this folder to `dist/renderer/fonts/`, and electron-builder packs `dist/**` into the app, so the `OFL.txt` files and this list ship with the fonts. `shared/fonts.css` declares the faces.

| File | Upstream source | Version | Bytes | sha256 |
| --- | --- | --- | --- | --- |
| `inter/InterVariable.woff2` | `web/InterVariable.woff2` in https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip | release v4.1 (font version 4.001) | 352240 | `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3` |
| `inter/OFL.txt` | `LICENSE.txt` in the same zip | release v4.1 | 4380 | `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a` |
| `jetbrains-mono/JetBrainsMono[wght].ttf` | `fonts/variable/JetBrainsMono[wght].ttf` in https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip (the release has no variable woff2) | release v2.304 (commit `cd5227bd1f61dff3bbd6c814ceaf7ffd95e947d9`) | 303144 | `662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016` |
| `jetbrains-mono/OFL.txt` | `OFL.txt` in the same zip | release v2.304 | 4399 | `30f0c136e3c88e422d0791acd97238870f9054a9729bc34cf2ff0d4ed8cac4ad` |
| `newsreader/Newsreader[opsz,wght].woff2` | https://github.com/productiontype/Newsreader/blob/cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155/fonts/variable/woff2/Newsreader%5Bopsz,wght%5D.woff2 | commit `cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155` (font version 1.003) | 214880 | `1faa3380ac0e87e057b180e03fd94bd708a612afb67d2590677be4508909fae9` |
| `newsreader/Newsreader-Italic[opsz,wght].woff2` | https://github.com/productiontype/Newsreader/blob/cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155/fonts/variable/woff2/Newsreader-Italic%5Bopsz,wght%5D.woff2 | commit `cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155` (font version 1.003) | 239844 | `d184d5e6a967ffea109d9f99fa245eccbff221e27f30bfd7d6fdb2940fcc6265` |
| `newsreader/OFL.txt` | https://github.com/productiontype/Newsreader/blob/cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155/OFL.txt | commit `cfcb4f7a` | 4394 | `fdfad38143ec470553cae82a1e45320bdd1b9ec70415d37bd0171051d8a4ded8` |
| `bricolage-grotesque/BricolageGrotesque[opsz,wdth,wght].woff2` | https://github.com/ateliertriay/bricolage/blob/84745e5b96261ae5f8c6c856e262fe78d1d6efdd/fonts/webfonts/BricolageGrotesque%5Bopsz,wdth,wght%5D.woff2 | commit `84745e5b96261ae5f8c6c856e262fe78d1d6efdd` (font version 1.001) | 204636 | `b51a8ebd169637e47cb7db430431ab3e122d2f09b03ee2a03ea06f4cb46f1a8e` |
| `bricolage-grotesque/OFL.txt` | https://github.com/ateliertriay/bricolage/blob/84745e5b96261ae5f8c6c856e262fe78d1d6efdd/OFL.txt | commit `84745e5b` | 4403 | `4b5a7d8f37f5602621c8a8d7358a6a2e71317e6c231c661e15aef0275d3e07ba` |
| `instrument-serif/InstrumentSerif-Regular.woff2` | https://github.com/Instrument/instrument-serif/blob/65c0ef225f386a3c7e87570a4aa9cc0262c2fd81/fonts/webfonts/InstrumentSerif-Regular.woff2 | commit `65c0ef225f386a3c7e87570a4aa9cc0262c2fd81` (font version 1.000) | 27440 | `ca21b99b0d6b88a0dc34cebfe48104611e5c7f8f92746bed26c37aa470174322` |
| `instrument-serif/InstrumentSerif-Italic.woff2` | https://github.com/Instrument/instrument-serif/blob/65c0ef225f386a3c7e87570a4aa9cc0262c2fd81/fonts/webfonts/InstrumentSerif-Italic.woff2 | commit `65c0ef225f386a3c7e87570a4aa9cc0262c2fd81` (font version 1.000) | 28096 | `4f7aacc18d491dea8778bbc591db87b9455625899ed5f913957e7fd82604c294` |
| `instrument-serif/OFL.txt` | https://github.com/Instrument/instrument-serif/blob/65c0ef225f386a3c7e87570a4aa9cc0262c2fd81/OFL.txt | commit `65c0ef22` | 4405 | `129ed7618959716959f2941fdd5b49e0ad6e6c1d78726761786a00253d865521` |

Zip checksums: `Inter-4.1.zip` sha256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`; `JetBrainsMono-2.304.zip` sha256 `6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf`.

The Inter and Bricolage Grotesque files have an optical-size axis. `fonts.css` pins it at 14, the cut the earlier bundled files used (Bricolage's own default, 96, sets headings about 10% narrower).

`test/rendererNoRemoteOrigins.test.ts` fails if any renderer HTML or CSS points at a remote origin or if any CSP allows a host.
