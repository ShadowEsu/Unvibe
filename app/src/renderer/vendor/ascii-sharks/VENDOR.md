# ascii-sharks (vendored)

- Source: https://github.com/stackedlol/ascii-sharks
- Commit: `a0074c16a106f0abc665fe9712ca445f8f98ad8e` ("add MIT license", 2026-10-24)
- Licence: MIT, © 2026 drewdi (`LICENSE` here; shipped as `shared/licences/ASCII-SHARKS-MIT.txt`, named in Settings → About → Credits)
- Files: `src/{engine,index,math,renderer,species,world}.ts`, `src/react.tsx`, byte-for-byte (sha256 in the vendoring commit message). No runtime deps.
- Why: Preston (ledger 597, 10 Nov) wants the ASCII-creature look from the "ASCII sharks" reel as Unvibe's start animation.

Rules: these files stay unmodified. Unvibe's ghost species, colour ramp and start choreography live in `shared/asciiGhost/`
and only import from here. Security S-2 reads this folder before any merge or release.
