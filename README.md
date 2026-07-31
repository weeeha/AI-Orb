# AI-Orb

An audio-reactive orb for AI voice interfaces — the visual presence of an agent that is idle,
listening, thinking, or speaking.

Zero runtime dependencies. One WebGL fragment program renders all five finishes; nothing is
fetched at runtime.

## What's here

| Path | What it is |
|---|---|
| [`src/`](src) | The component: `<Orb>`, `useOrbAudio`, and a framework-agnostic `OrbRenderer` |
| [`playground/`](playground) | A Vite app exercising every finish, palette, state, size and the chat-avatar case |
| [`docs/style-guide.md`](docs/style-guide.md) | The orb design language — six archetypes, eight-layer anatomy, eleven principles, anti-patterns |
| [`demo/index.html`](demo/index.html) | The same guide as a live page: every archetype rendered in real WebGL, plus a specimen that reacts to your microphone |

```bash
npm install
npm run dev        # playground at http://localhost:5178
npm run typecheck
```

The static style guide needs no build at all:

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

## API

```tsx
import { Orb, useOrbAudio } from "ai-orb"

function Assistant({ agentAudio }: { agentAudio: HTMLAudioElement }) {
  const output = useOrbAudio(agentAudio)   // returns a ref, not state
  const input = useOrbAudio(micStream)

  return (
    <Orb
      finish="ink"                 // ink | pearl | vessel | aurora | plasma
      palette="ember"              // or colors={[a, b, c]} / bodyColor
      state="listening"            // idle | listening | thinking | speaking
      outputLevelRef={output}      // drives the body
      inputLevelRef={input}        // drives the boundary
      className="size-32"
    />
  )
}
```

Levels are read **inside the animation loop**, never through React state — a talking agent would
otherwise re-render the tree sixty times a second. A ref, a getter, or a plain number all work.

| Prop | Default | Notes |
|---|---|---|
| `finish` | `"ink"` | `pearl` becomes `aurora` on a dark page; it is never recoloured |
| `palette` | per finish | `ember`, `iris`, `moss`, `porcelain`, `spectrum`, `discharge` |
| `colors` / `bodyColor` | — | Any CSS colour; overrides the palette |
| `field` | follows the page | Forces a light model. `aurora`/`plasma` are always dark, `pearl` always light |
| `state` | `"idle"` | `thinking` adds an orbiting sweep with no audio involved |
| `grain` | `0.05` | Fades out automatically below ~96px |
| `seed` | `0` | Decorrelates orbs shown together |
| `speed` | `1` | Ambient only; audio acceleration is separate |
| `pointerReactive` | `true` | `plasma` filaments follow the pointer; ignored elsewhere |

**Behaviour that is automatic:** DPR capped at 2, paused off-screen and on hidden tabs, a single
still frame under `prefers-reduced-motion`, a CSS-gradient fallback with no WebGL, detail reduced at
small sizes, and recovery from WebGL context loss.

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
