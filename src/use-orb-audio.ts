import { useEffect, useRef, type MutableRefObject } from "react"

export type OrbAudioSource =
  | HTMLMediaElement
  | MediaStream
  | AnalyserNode
  | null
  | undefined

export interface UseOrbAudioOptions {
  /** Supply your own context to share one across several orbs. */
  audioContext?: AudioContext
  /** Number of low bins averaged. Speech energy lives at the bottom. */
  bins?: number
  /** Divisor applied to the RMS. Lower makes the orb more sensitive. */
  sensitivity?: number
  /** AnalyserNode smoothing. The renderer smooths again over time. */
  smoothing?: number
}

/**
 * Turns an audio source into a level ref the render loop can read.
 *
 * It returns a ref rather than state on purpose: a level updates ~60 times a
 * second, and routing that through React would re-render the tree on every
 * frame of every utterance. The orb reads `.current` inside its own loop.
 *
 * ```tsx
 * const agent = useOrbAudio(audioElement)
 * const mic = useOrbAudio(micStream)
 * <Orb outputLevelRef={agent} inputLevelRef={mic} />
 * ```
 */
export function useOrbAudio(
  source: OrbAudioSource,
  options: UseOrbAudioOptions = {},
): MutableRefObject<number> {
  const level = useRef(0)
  const { audioContext, bins = 160, sensitivity = 96, smoothing = 0.6 } = options

  useEffect(() => {
    if (!source || typeof window === "undefined") {
      level.current = 0
      return
    }

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    const ctx = audioContext ?? new Ctor()
    const ownsContext = !audioContext

    let analyser: AnalyserNode
    let node: AudioNode | null = null
    let raf = 0
    let cancelled = false

    if (source instanceof AnalyserNode) {
      analyser = source
    } else {
      analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = smoothing

      if (typeof MediaStream !== "undefined" && source instanceof MediaStream) {
        node = ctx.createMediaStreamSource(source)
      } else {
        node = ctx.createMediaElementSource(source as HTMLMediaElement)
        // A media element source is taken off the default output when tapped,
        // so route it onward or playback goes silent.
        node.connect(ctx.destination)
      }
      node.connect(analyser)
    }

    const buffer = new Uint8Array(analyser.frequencyBinCount)
    const count = Math.min(buffer.length, bins)

    // Browsers start contexts suspended until a gesture; resume on the first one.
    if (ctx.state === "suspended") {
      const resume = () => void ctx.resume()
      window.addEventListener("pointerdown", resume, { once: true })
      window.addEventListener("keydown", resume, { once: true })
    }

    const sample = () => {
      if (cancelled) return
      analyser.getByteFrequencyData(buffer)
      let sum = 0
      for (let i = 0; i < count; i++) sum += buffer[i] * buffer[i]
      level.current = Math.min(1, Math.sqrt(sum / count) / sensitivity)
      raf = requestAnimationFrame(sample)
    }
    raf = requestAnimationFrame(sample)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      level.current = 0
      try {
        node?.disconnect()
        if (!(source instanceof AnalyserNode)) analyser.disconnect()
      } catch {
        /* already torn down */
      }
      if (ownsContext) void ctx.close()
    }
  }, [source, audioContext, bins, sensitivity, smoothing])

  return level
}
