# AI-Orb

An audio-reactive orb for AI voice interfaces — the visual presence of an agent that is idle,
listening, thinking, or speaking.

Currently at the **design-foundation** stage: the visual language is defined and prototyped, the
component is not yet built.

## What's here

| Path | What it is |
|---|---|
| [`docs/style-guide.md`](docs/style-guide.md) | The orb design language — six archetypes, eight-layer anatomy, ten principles, anti-patterns |
| [`demo/index.html`](demo/index.html) | The same guide as a live page: every archetype rendered in real WebGL, plus a specimen that reacts to your microphone |

Open the demo with any static server:

```bash
python3 -m http.server 8080 --directory demo
```

## The short version

Twelve reference pieces were reviewed frame by frame — including reading the shipped shader source
of both ElevenLabs orbs — and they resolve into **six archetypes** built from the same eight layers:

- **Ink** — one pigmented medium churning in a rigid circle
- **Pearl** — pale opaque body, saturated band at the equator, hard specular
- **Vessel** — a fixed transparent shell with variable contents inside
- **Aurora** — dark field, emissive wave, rim light *(the dark-mode form of Pearl)*
- **Plasma** — filaments from a central electrode to the glass *(specialty)*
- **Prism** — full-spectrum anisotropic flow *(hero only, excluded from the component)*

The two rules that matter most:

**Dark mode is a light-model swap, not a palette swap.** On a light field the body is opaque and
pale with colour in a band; on a dark field the body goes transparent and the band becomes emissive,
with a rim light holding the silhouette. Recolouring one into the other produces mud.

**Hearing and speaking must not look alike.** Output belongs to the body — interior flow, warp
amplitude, core brightness. Input belongs to the boundary — a ring travelling outward, rim lift,
filaments reaching. When both signals are just "bigger", the orb stops reporting who holds the turn.

## Planned API

```tsx
<Orb
  finish="ink"              // ink | pearl | vessel | aurora | plasma
  palette="ember"           // named preset, or colors={[...]}, or inherit
  state="listening"         // idle | listening | thinking | speaking
  inputLevelRef={micRef}    // refs, not props — no re-render per frame
  outputLevelRef={agentRef}
  seed={3}
  grain={0.35}
  className="size-32"
/>
```

Levels arrive as **refs read inside the animation loop**, never as props. Passing a 60 Hz signal
through React state re-renders the tree every frame.

## Constraints

- Zero runtime dependencies — no three.js, no R3F, no OGL
- Nothing fetched at runtime; noise is generated in-shader
- SSR-safe, with a poster frame for `prefers-reduced-motion` and no-WebGL
- One live canvas at a time; static poster for every other instance

## Prior art

- [ElevenLabs UI](https://github.com/elevenlabs/ui) — MIT, ships an orb built on three.js + R3F.
  Excellent ref-based audio API; loads its Perlin texture from a CDN at runtime, which this project
  deliberately avoids.
- [Paper Shaders](https://github.com/paper-design/shaders) — Apache 2.0, zero-dependency canvas
  shaders; proof the no-framework approach scales.
- [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) — MIT, the solver
  behind the ElevenLabs marketing orb.
