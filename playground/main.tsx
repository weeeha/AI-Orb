import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

import { Orb, useOrbAudio } from "../src"
import type { OrbFinish, OrbState } from "../src"
import "./styles.css"

const FINISHES: OrbFinish[] = ["ink", "pearl", "vessel", "aurora", "plasma"]
const STATES: OrbState[] = ["idle", "listening", "thinking", "speaking"]
const PALETTES = ["ember", "iris", "moss", "porcelain", "discharge"]

/** A voiced source shaped into syllables, so the orb reacts to a real waveform. */
function useSynthesisedSpeech() {
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const speak = () => {
    if (speaking) return
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = ctxRef.current ?? new Ctor()
    ctxRef.current = ctx
    void ctx.resume()
    setSpeaking(true)

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"

    const vib = ctx.createOscillator()
    const vibGain = ctx.createGain()
    vib.frequency.value = 4.6
    vibGain.gain.value = 3.2
    vib.connect(vibGain).connect(osc.frequency)

    const formant = ctx.createBiquadFilter()
    formant.type = "bandpass"
    formant.frequency.value = 780
    formant.Q.value = 3.2

    const tone = ctx.createBiquadFilter()
    tone.type = "lowpass"
    tone.frequency.value = 2400

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.55
    analyserRef.current = analyser

    const out = ctx.createGain()
    out.gain.value = 0.5

    osc.connect(formant).connect(tone).connect(gain)
    gain.connect(analyser)
    gain.connect(out).connect(ctx.destination)

    const syllables: Array<[number, number]> = [
      [0.16, 0.85], [0.13, 0.62], [0.2, 0.95], [0.11, 0.55], [0.17, 0.78],
      [0.26, 0.4],
      [0.14, 0.7], [0.19, 0.92], [0.12, 0.58], [0.22, 0.86], [0.13, 0.64],
      [0.3, 0.3],
      [0.18, 0.8], [0.15, 0.66], [0.24, 0.98], [0.13, 0.52], [0.2, 0.74],
    ]

    let t = now + 0.04
    osc.frequency.setValueAtTime(118, t)

    syllables.forEach(([dur, amp], i) => {
      const pause = amp < 0.45
      const peak = pause ? 0.004 : 0.1 * amp
      gain.gain.linearRampToValueAtTime(peak, t + dur * 0.32)
      gain.gain.linearRampToValueAtTime(peak * 0.72, t + dur * 0.7)
      gain.gain.linearRampToValueAtTime(pause ? 0.0008 : 0.006, t + dur)
      osc.frequency.linearRampToValueAtTime(96 + Math.sin(i * 1.31) * 26 + (pause ? -14 : 0), t + dur)
      formant.frequency.linearRampToValueAtTime(560 + Math.abs(Math.sin(i * 0.9)) * 620, t + dur)
      t += dur
    })

    gain.gain.linearRampToValueAtTime(0.0001, t + 0.22)
    osc.start(now)
    vib.start(now)
    osc.stop(t + 0.4)
    vib.stop(t + 0.4)

    osc.onended = () => {
      setSpeaking(false)
      analyserRef.current = null
    }
  }

  return { speak, speaking, analyserRef }
}

function App() {
  const [finish, setFinish] = useState<OrbFinish>("ink")
  const [palette, setPalette] = useState("ember")
  const [state, setState] = useState<OrbState>("idle")
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  // Holding a level steady is the only way to actually inspect the reaction.
  const [heldOut, setHeldOut] = useState(0)
  const [heldIn, setHeldIn] = useState(0)

  const { speak, speaking, analyserRef } = useSynthesisedSpeech()

  // The agent analyser is created per utterance, so bridge it through a ref.
  const outputLevel = useRef(0)
  useEffect(() => {
    let raf = 0
    const buffer = new Uint8Array(256)
    const tick = () => {
      const analyser = analyserRef.current
      if (analyser) {
        analyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < 160; i++) sum += buffer[i] * buffer[i]
        outputLevel.current = Math.min(1, Math.sqrt(sum / 160) / 96)
      } else {
        outputLevel.current = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analyserRef])

  const inputLevel = useOrbAudio(micStream)

  useEffect(() => {
    if (speaking) setState("speaking")
    else if (micStream) setState("listening")
    else setState((s) => (s === "speaking" ? "idle" : s))
  }, [speaking, micStream])

  const toggleMic = async () => {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop())
      setMicStream(null)
      return
    }
    try {
      setMicStream(await navigator.mediaDevices.getUserMedia({ audio: true }))
    } catch {
      /* declined or unavailable */
    }
  }

  return (
    <main>
      <header>
        <h1>AI-Orb</h1>
        <p>The component, running. Every orb below is the same `&lt;Orb /&gt;`.</p>
      </header>

      <section className="stage">
        <Orb
          finish={finish}
          palette={palette}
          state={state}
          outputLevelRef={() => Math.max(heldOut, outputLevel.current)}
          inputLevelRef={() => Math.max(heldIn, inputLevel.current)}
          className="orb-hero"
        />
        <p className="readout" data-testid="readout">
          {finish} · {palette} · {state}
        </p>
      </section>

      <section className="controls">
        <fieldset>
          <legend>Finish</legend>
          {FINISHES.map((f) => (
            <button key={f} onClick={() => setFinish(f)} aria-pressed={finish === f}>
              {f}
            </button>
          ))}
        </fieldset>

        <fieldset>
          <legend>Palette</legend>
          {PALETTES.map((p) => (
            <button key={p} onClick={() => setPalette(p)} aria-pressed={palette === p}>
              {p}
            </button>
          ))}
        </fieldset>

        <fieldset>
          <legend>State</legend>
          {STATES.map((s) => (
            <button key={s} onClick={() => setState(s)} aria-pressed={state === s}>
              {s}
            </button>
          ))}
        </fieldset>

        <fieldset>
          <legend>Audio</legend>
          <button onClick={speak} disabled={speaking}>
            {speaking ? "speaking…" : "speak a reply"}
          </button>
          <button onClick={toggleMic} aria-pressed={!!micStream}>
            {micStream ? "stop mic" : "use my mic"}
          </button>
        </fieldset>

        <fieldset className="holds">
          <legend>Hold a level</legend>
          <label>
            <span>output {heldOut.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={heldOut}
              data-testid="held-out"
              onChange={(e) => setHeldOut(Number(e.target.value))}
            />
          </label>
          <label>
            <span>input {heldIn.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={heldIn}
              data-testid="held-in"
              onChange={(e) => setHeldIn(Number(e.target.value))}
            />
          </label>
        </fieldset>
      </section>

      <section>
        <h2>All finishes</h2>
        <div className="grid" data-testid="grid">
          {FINISHES.map((f, i) => (
            <figure key={f}>
              <Orb finish={f} state={state} seed={i} className="orb-tile" />
              <figcaption>{f}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>Sizes</h2>
        <p className="hint">
          Grain, striations and thin filaments fade out below ~96px, so an avatar reads as a
          material rather than as dither.
        </p>
        <div className="sizes">
          {[24, 32, 40, 64, 96, 140].map((size) => (
            <Orb
              key={size}
              finish={finish}
              palette={palette}
              seed={size}
              style={{ width: size, height: size }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>In a conversation</h2>
        <p className="hint">The same component at 32px, holding the turn beside the message.</p>
        <div className="thread">
          <div className="msg agent">
            <Orb
              finish={finish}
              palette={palette}
              state={state}
              outputLevelRef={() => Math.max(heldOut, outputLevel.current)}
              inputLevelRef={() => Math.max(heldIn, inputLevel.current)}
              style={{ width: 32, height: 32, flex: "0 0 auto" }}
              label="Assistant"
            />
            <p>Hi there — I&rsquo;m a support technician. How can I help you today?</p>
          </div>
          <div className="msg user">
            <p>My laptop fan is making a grinding noise.</p>
          </div>
          <div className="msg agent">
            <Orb
              finish={finish}
              palette={palette}
              state={state}
              outputLevelRef={() => Math.max(heldOut, outputLevel.current)}
              style={{ width: 32, height: 32, flex: "0 0 auto" }}
              label="Assistant"
            />
            <p>That usually means debris in the fan housing. How old is the machine?</p>
          </div>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
