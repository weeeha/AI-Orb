import { useEffect, useState } from "react"
import { Orb, orbPalettes } from "ai-orb"
import type { OrbFinish, OrbState } from "ai-orb"

/** The states and finishes below are typed against the package's own exported
 *  unions, so if types.ts drops or renames one the build fails here. */
const STATES: OrbState[] = ["idle", "listening", "thinking", "speaking"]
const FINISHES: OrbFinish[] = ["ink", "pearl", "vessel", "aurora", "plasma"]

/** Pure blue on all three stops: the "rebrand from outside" input. The default
 *  palette for `ink` is ember (orange/red), so a hue near 230 can only come
 *  from the consumer's props reaching the shader. */
const BRAND: [string, string, string] = ["#1f3fff", "#1f3fff", "#1f3fff"]

export function App() {
  const [state, setState] = useState<OrbState>("idle")
  const [finish, setFinish] = useState<OrbFinish>("ink")
  const [palette, setPalette] = useState<string | undefined>(undefined)
  const [branded, setBranded] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => setReady(true), [])

  return (
    <main data-harness={ready ? "ready" : "pending"}>
      <h1>ai-orb consumer harness</h1>

      <div className="stage">
        <div className="slot" data-harness="orb-slot">
          <Orb
            className="orb"
            style={{ width: 240, height: 240 }}
            finish={finish}
            palette={palette}
            colors={branded ? BRAND : undefined}
            state={state}
          />
        </div>
        <div className="slot" data-harness="blank-slot" aria-hidden="true" />
      </div>

      <section aria-labelledby="h-state">
        <h2 id="h-state">State</h2>
        {STATES.map((s) => (
          <button key={s} type="button" data-state={s} aria-pressed={state === s} onClick={() => setState(s)}>
            {s}
          </button>
        ))}
      </section>

      <section aria-labelledby="h-finish">
        <h2 id="h-finish">Finish</h2>
        {FINISHES.map((f) => (
          <button key={f} type="button" data-finish={f} aria-pressed={finish === f} onClick={() => setFinish(f)}>
            {f}
          </button>
        ))}
      </section>

      <section aria-labelledby="h-palette">
        <h2 id="h-palette">Palette and rebrand</h2>
        {Object.keys(orbPalettes).map((p) => (
          <button key={p} type="button" data-palette={p} aria-pressed={palette === p} onClick={() => { setBranded(false); setPalette(p) }}>
            {p}
          </button>
        ))}
        <button type="button" data-harness="brand" aria-pressed={branded} onClick={() => setBranded((b) => !b)}>
          brand colors
        </button>
      </section>
    </main>
  )
}
