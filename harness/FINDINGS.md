# Consumer harness: findings

Installs `ai-orb` from its own `npm pack` tarball into a stand-alone Vite +
React 19 + TypeScript strict app (`harness/consumer/`), builds it with
`tsc --noEmit && vite build`, and probes it in headless Chromium. Run with
`npm run harness`.

## TL;DR

**2026-10-16: 23 checks pass, 0 fail, on first contact.** The packed package
type-checks under a strict React 19 consumer, builds, renders all five finishes
through WebGL in headless Chromium with no launch flags, repaints from outside
through `colors` and `palette`, keeps its accessibility contract and passes
axe. One packaging defect fixed (`files` shipped the whole `docs/` directory).
Two open items: the entry point is TypeScript source, so plain Node cannot
import it, and the reduced-motion poster cannot tell idle, listening and
speaking apart.

## What surfaced

1. **`files` listed `docs` as a whole directory.** Today `docs/` holds only
   `style-guide.md`, so nothing internal leaked yet, but the next plan or spec
   dropped under `docs/` would have shipped. The brief expected
   `docs/superpowers/` to be present; it is not on `main` or in the main
   checkout, so the leak is latent, not live. The allowlist probe proves the
   fix works (see break-tests).
2. **Listening, speaking and idle are the same still frame.** `renderStill()`
   draws with input and output level 0, and those three states differ only
   through the levels. With reduced motion on, the orb cannot report who holds
   the turn. `types.ts` says each state "must be distinguishable in a still
   frame (P8)". Measured mean per-channel pixel difference: idle/thinking 5.05
   for each pairing with thinking, 0.00 for the other three pairs. Recorded as
   an `info` line, not a check, because fixing it changes the component.
3. **Plain Node cannot import the package.** `import("ai-orb")` under Node
   v26.0.0 fails with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, because
   `main`, `types` and `exports` all point at `./src/index.ts`. Node strips
   types for your own files but refuses to under `node_modules`. Bundlers
   (Vite here) handle it, which is why the build and every browser probe pass.

## What I fixed

- `package.json` `files`: `["src", "docs", "README.md"]` became
  `["src", "docs/style-guide.md", "README.md"]`. README.md links
  `docs/style-guide.md`, so that one doc stays. README.md itself is untouched
  (PR #3 edits it). Packed file count is unchanged at 10 because `docs/` held
  one file.
- Root `harness:*` scripts and `.gitignore` entries added.

Nothing else needed changing: no type error in the kit's `.ts` source under
`strict`, `isolatedModules` and `moduleResolution: Bundler`.

## Open items

1. **Ship a build, or document the bundler requirement.** A `dist/` with ESM,
   `.d.ts` and an `exports` map with `types` would make `import("ai-orb")` work
   in Node, SSR tooling that does not transpile `node_modules`, and any
   non-Vite consumer. The cost is a build step, a `prepack` script and a
   second artifact to test. Not done here by instruction.
2. **Reduced-motion poster for idle/listening/speaking.** Either draw the
   still with a state-specific fixed level, or accept it and soften the P8
   claim. When resolved, promote the `info states identical in a still frame`
   line to a check.
3. **Peer range `react >=18` is only exercised on 19.** The kit's devDeps are
   React 18; the harness is React 19.2.8. An 18 consumer is untested.
4. **Probes not covered:** the dark field and `prefers-color-scheme`,
   `pointerReactive`, `useOrbAudio` with a real stream, context loss and
   restore, and WebKit/Firefox (Chromium only).
5. The rebrand probe uses three identical stops, so it proves hue reaches the
   shader but not that stops 1, 2 and 3 land in the right places.

## Launch flags

None needed. Headless Chromium (Playwright 1.62.1) acquires WebGL by itself
here, reporting `WebKit WebGL` as the renderer (software). `HARNESS_CHROMIUM_ARGS`
(a JSON array) lets a CI machine without a GPU path add
`--use-angle=swiftshader --enable-unsafe-swiftshader`; it was not required.

## Probe design

Pixel probes run in a `reducedMotion: "reduce"` context so frames are
repeatable; a second probe uses a motion context to prove the orb does animate.
Pixels come from an element screenshot (what the compositor shows), decoded on
a scratch page.

| Probe | Fails if |
|---|---|
| no page errors on load | any `pageerror` or console error |
| canvas mounts | no canvas, or under 100 px |
| WebGL context | the orb's own canvas has no live context |
| non-blank | painted fraction under 50%, or the empty baseline slot is not 0% |
| each state by click | button not pressed, or an error is raised |
| a state change changes pixels | no pair of states differs by more than 1.0 |
| finishes paint | a finish paints under 30% of its circle, or errors |
| default palette warm | ember hue outside 0-50 degrees |
| `colors` repaint | hue outside 210-250 for `#1f3fff` |
| `palette` repaint | moss hue outside 130-170 |
| a11y role and label | role is not `img`, or label does not follow state |
| canvas hidden | canvas lacks `aria-hidden` |
| reduced motion | still frame changes over 700 ms, or motion frame does not |
| axe | any violation |
| no runtime dependencies | `dependencies` non-empty or nested `node_modules` |
| intended files only | any installed file outside the allowlist |

## Break-tests

Each break was applied, `npm run harness` run, then reverted.

1. **Drop `src/shader.ts` from `files`.** Build fails before any probe:
   `node_modules/ai-orb/src/renderer.ts(6,8): error TS2307: Cannot find module './shader'`. Harness exits non-zero.
2. **`files` back to the whole `docs` directory with a stray
   `docs/superpowers/plans/x.md`.**
   `FAIL installed ai-orb contains only intended files  (stray: docs/superpowers/plans/x.md)`.
   The first version of this probe checked for `docs/superpowers` only and
   passed against the same break when no such file existed; it was rewritten as
   an allowlist.
3. **Wrong brand color (`#ff3f1f` instead of `#1f3fff`).**
   `FAIL colors prop repaints to the brand hue (#1f3fff: hue 210-250)  (hue 9, 44338 px)`.

## Screenshots

In `harness/consumer/screenshots/` (gitignored, regenerated each run). Read from
the passing run:

- `ink-idle.png`: a full orange sphere, deeper red-orange in the middle and
  pale amber toward the rim, with cloudy marbling. Fills its circle.
- `finish-pearl.png`: a pale, almost white sphere with a soft pink-to-blue
  band across the upper middle and a bright highlight at top left.
- `finish-vessel.png`: three soft blobs, blue, purple and amber, clustered in
  the middle of a near-white circle; the shell edge is barely visible.
- `finish-aurora.png`: a near-black sphere with a cyan-blue horizontal band
  and a lilac rim light.
- `finish-plasma.png`: deep blue gas, a bright white electrode in the middle,
  seven white filaments running to the glass.
- `palette-brand.png`: a flat saturated blue disc with grain. Correct hue, no
  structure, because all three stops are the same.
- `palette-moss.png`: the ink form in teal-green with paler edges.
- `state-thinking.png` looks close to idle by eye; the 5.05 mean difference is
  small texture shift.
