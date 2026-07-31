# Orb design language

A style guide for AI-presence orbs, derived from frame-by-frame review of twelve production and
reference pieces. It defines what `<Orb>` must be able to express before any of it is built.

**Live version:** the interactive guide renders every archetype in real WebGL and reacts to your
microphone — see `demo/index.html`.

**Corpus reviewed** — each scrubbed frame by frame, not glanced at:

| # | Piece | Author | Medium |
|---|---|---|---|
| 1 | ElevenLabs homepage orbs | ElevenLabs | Live WebGL2, shader source read |
| 2 | ElevenLabs UI `orb` | ElevenLabs | Live WebGL2, MIT, R3F, source read |
| 3 | Orb AI Motion | Lalit / theosm™ | 15.0s render |
| 4 | AI Motion Visual | Lalit | 11.0s render |
| 5 | AI sphere for Pryon | Milkinside | 5.8s render |
| 6 | Cirus Intelligence Sphere | Milkinside | 5.0s render |
| 7 | Thinking Reaction for AI sphere | Gleb Kuznetsov | 1.5s render |
| 8 | Colorful AI sphere | Gleb Kuznetsov / Milkinside | 23.6s render |
| 9 | Night mode for AI assistant | Gleb Kuznetsov | 20.0s render |
| 10 | Voice reaction for AI symbol | Gleb Kuznetsov | 31.4s render |
| 11 | Magic OS branding | Milkinside | 10.0s render |
| 12 | Plasma globe | Physical object | Added during review |

---

## 1 · The layer stack

Every orb in the corpus is a subset of the same eight layers. No reference uses all of them; the
*choice of which layers exist* is what produces a recognisable style. The order is also the render
order, so it maps 1:1 onto shader passes.

| # | Layer | What it does | Present in |
|---|---|---|---|
| 0 | **Ground** | Background, contact shadow, environment reflections | 5, 8 |
| 1 | **Medium** | The substance filling the body — fluid, noise field, or void | 1, 3, 4, 8 |
| 2 | **Contents** | Discrete bodies inside — lobes, ribbons, petals, filaments | 6, 9, 10, 11, 12 |
| 3 | **Core** | A single bright emissive point, sometimes with rays | 6, 11, 12 |
| 4 | **Shell** | Refractive boundary — fresnel rim, chromatic edge | 3, 4, 6, 9, 10, 11, 12 |
| 5 | **Specular** | One or two hard highlights that read as glass | 5, 6, 11 |
| 6 | **Surface** | Grain, striations, sparkle — the finest scale | 1, 5, 6, 8 |
| 7 | **Mask** | The circular clip and how soft its edge is | all |

Reading a new reference means asking which layers it switched on.

---

## 2 · Six archetypes

### INK — the medium is the message
One pigmented substance fills a rigid circle and churns. No shell, no contents, no specular; colour
saturates the whole body, motion comes from domain-warped noise over a fluid field.

- **Layers** 01 · 06 · 07 — **Field** light or dark — **Tempo** 8–12s
- **Evidence:** ElevenLabs homepage (1), AI Motion Visual (4)
- **Risk:** with no shell and no highlight, grain carries the realism. Turn grain off and Ink
  collapses into a gradient.

### PEARL — opaque body, colour in a band
A pale near-opaque body carries a narrow saturated band across its equator, with a hard specular
highlight and fine striations combed along the band.

- **Layers** 00 · 02 · 05 · 06 · 07 — **Field** light only — **Tempo** 5–8s
- **Evidence:** Pryon (5), Orb AI Motion (3)
- **Risk:** it borrows the page background as body colour, so it dissolves on dark. It is replaced
  by Aurora, not recoloured.

### VESSEL — a fixed shell with variable contents
A transparent shell of constant size holds discrete inner bodies that drift, merge and separate. The
*ratio* of contents to shell is the primary signal.

- **Layers** 02 · 03 · 04 · 05 · 07 — **Field** light or dark — **Tempo** 6–10s
- **Evidence:** Voice reaction (10), Cirus (6), Magic OS (11)
- **Note:** ElevenLabs UI's shipped orb is structurally this — seven soft ovals composited in polar
  space.

### AURORA — dark field, emissive band
The body goes transparent to a dark ground; colour survives only as a luminous wave, with a thin rim
light holding the silhouette.

- **Layers** 02 · 04 · 06 · 07 — **Field** dark only — **Tempo** 8–14s
- **Evidence:** Night mode (9)

### PLASMA — filaments from a core to the glass *(specialty)*
A hard electrode throws branching filaments through an ionised haze to the inside of the glass. The
only archetype whose interior is made of *lines* rather than fields, and the only reference that is
a physical object.

- **Layers** 02 · 03 · 04 · 06 · 07 — **Field** dark only — **Minimum size** ~96px
- **Evidence:** plasma globe (12)
- **Why it earns a place:** a real plasma globe bends its filaments toward whatever touches the
  glass. That gives input a literal physical reading — the orb reaches toward the person speaking —
  which no other archetype offers.
- **Risk:** filaments are the highest-frequency detail in the taxonomy and alias into noise at small
  sizes. Specialty, not default.

### PRISM — full-spectrum anisotropic flow *(hero only)*
Dense combed strands of the full spectrum sweeping across an emissive sphere that lights its
environment.

- **Layers** 00 · 01 · 06 · 07 — **Field** dark only — **Tempo** 15–25s
- **Evidence:** Colorful AI sphere (8)
- **Excluded from the component.** With every hue already at maximum saturation there is no headroom
  left to signal state.

---

## 3 · Principles

### P1 · Separate the vessel from the volatile
Something must stay constant for change to be readable. Give the orb a stable identity — silhouette,
shell, rim — and let only the interior express state. Voice reaction (10) is the proof: an unchanging
shell with contents that swell and split says more than a whole orb that morphs.

### P2 · Motion belongs to the interior
The boundary should be the calmest part of the composition. Hero renders deform silhouettes freely
because they own the frame; a component sits beside focus rings and text baselines.
**Budget ±2% radius; spend the rest inside.**

### P3 · Saturated colour is a minority
In every reference that reads as premium rather than decorative, strong colour occupies well under
half the area — a band (5), a wave (9), three lobes (10), a rim (3). Colour everywhere is the
signature of a screensaver.

### P4 · Flip the light model with the theme, not just the palette
Pryon (5) and Night mode (9) are one design language in two value structures:

| | Light field | Dark field |
|---|---|---|
| Body | Opaque, pale | Transparent to background |
| Colour | Tinted band on the body | Emissive band, raised chroma |
| Silhouette held by | Contact shadow + body value | Rim light |
| Specular | Hard, top-left | Soft, broad |

Recolouring a light-mode orb for dark mode produces mud. Swap the model.

### P5 · One brightest point
Every convincing reference has exactly one luminance peak — a specular (5), a core burst (11), a
caustic streak (4), a rim segment (3). It separates "material" from "gradient". Two competing peaks
read as a rendering error.

### P6 · Detail at the finest scale
Film grain (1), striations (5), sparkle (6). Beyond taste it is functional: it defeats gradient
banding on 8-bit displays and gives the eye something to resolve at rest. Never ship a perfectly
smooth orb.

### P7 · Breath, not activity
Ambient cycles in the corpus run 5–24s; reactions run 0.8–1.5s (7). Idle motion must be slow enough
to sit beside text a user is reading. **Ambient 6–10s, reactions under 1.5s, never both at once.**

### P8 · State must survive a still frame
Pause any frame of Thinking Reaction (7) or Voice reaction (10) and you can tell roughly what the
system is doing. If two states are distinguishable only by tempo, a user glancing at a paused screen
— or reading a screenshot in a bug report — cannot tell them apart.

### P9 · Never a centred radial gradient
A symmetrical glow centred in a circle is the universal visual signature of a *loading spinner*.
Every reference breaks symmetry: bands sit off-equator, cores sit off-centre, waves lean. Asymmetry
is what makes an orb read as present rather than pending.

### P10 · Hearing and speaking must not look alike
Give the two audio signals different anatomy, not different amplitudes of the same move.
**Output belongs to the body; input belongs to the boundary.**

| Signal | Drives | Never |
|---|---|---|
| `outputLevel` — agent speaking | Interior flow speed, warp amplitude, band width, core brightness, ≤2% radius | The rim alone |
| `inputLevel` — user speaking | A ring travelling outward, rim lift, filament reach | The body fill |

When both signals are just "bigger", the orb stops reporting who holds the turn.

---

## 4 · Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Rainbow by default | Destroys P3 and leaves no headroom to signal state |
| Perfectly smooth gradient | Bands on real displays; reads as unfinished (P6) |
| Constant maximum motion | Nothing left to escalate to; fatigues in peripheral vision |
| Silhouette morphing in UI | Breaks circular clipping, focus rings, and layout (P2) |
| Two bright highlights | Reads as a rendering bug (P5) |
| Dark mode by palette swap | Produces mud; the value structure must invert (P4) |
| One meter for both voices | Input and output collapse into a single wobble; turn-taking becomes unreadable (P10) |
| Level piped through React state | A re-render every animation frame — the loop must read a ref |
| Runtime texture from a CDN | Breaks offline dev, strict CSP, air-gapped installs — the one real flaw in ElevenLabs UI's shipped orb |

---

## 5 · Consequences for the component

1. **`finish` is a first-class prop:** `ink` · `pearl` · `vessel` · `aurora`, plus `plasma` as a
   documented specialty. Prism is excluded.
2. **Dark mode is a light-model switch** (P4), not a palette swap. Each preset declares both fields;
   `pearl` resolves to `aurora` on dark.
3. **Two audio signals, never one** (P10): `outputLevel` drives the body, `inputLevel` drives the
   boundary.
4. **Levels arrive as refs, not props**, so a talking agent never triggers a React render. This is
   the one design decision worth copying verbatim from ElevenLabs UI.
5. **Grain defaults on** (P6), with `grain={0}` available.
6. **Silhouette stays rigid** (P2). The Dribbble wobble is not adopted.
7. **States differ in form, not only tempo** (P8).
8. **No runtime asset fetches.** Noise is generated in-shader; nothing is loaded from a CDN.

**Open question:** whether `vessel`/`plasma` and `ink` can share one fragment shader with a branch,
or need separate programs. They share sphere-bulge, shell, grain and colour-ramp; they differ in
whether the interior is a field, discrete bodies, or lines.
