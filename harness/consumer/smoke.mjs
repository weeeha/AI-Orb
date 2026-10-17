import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { preview } from "vite"
import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"

/** The smoke test. It installs nothing and builds nothing; it asks whether the
 *  packed ai-orb survives being used by someone else's app.
 *
 *  Pixel probes run in a reduced-motion context. The component's contract is
 *  that reduced motion renders one still frame, which makes frames repeatable
 *  and lets "state changed the pixels" and "palette changed the hue" be
 *  asserted without ambient animation as a confound. A separate probe proves
 *  the other half: with motion allowed, the same orb does animate. */

const here = fileURLToPath(new URL(".", import.meta.url))
const shots = resolve(here, "screenshots")
mkdirSync(shots, { recursive: true })

// Add flags here only if headless Chromium cannot get WebGL without them, and
// record why in FINDINGS.md.
const LAUNCH_ARGS = JSON.parse(process.env.HARNESS_CHROMIUM_ARGS ?? "[]")

const STATES = ["idle", "listening", "thinking", "speaking"] // types.ts OrbState
const FINISHES = ["ink", "pearl", "vessel", "aurora", "plasma"] // types.ts OrbFinish

const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`)
  if (!ok) failures.push(name)
}
const info = (name, detail) => console.log(`info ${name}  (${detail})`)

const SLOT = '[data-harness="orb-slot"]'
const BLANK = '[data-harness="blank-slot"]'

// ---- pixel helpers -------------------------------------------------------
// Screenshot an element (the compositor's output, so it is what a user sees)
// and decode the PNG on a scratch page.
let decoder
const pixels = async (page, selector, name) => {
  const buf = await page.locator(selector).screenshot({ animations: "allow" })
  if (name) writeFileSync(resolve(shots, `${name}.png`), buf)
  return decoder.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext("2d")
    g.drawImage(bmp, 0, 0)
    const d = g.getImageData(0, 0, bmp.width, bmp.height)
    return { w: bmp.width, h: bmp.height, data: Array.from(d.data) }
  }, buf.toString("base64"))
}

/** Fraction of pixels inside the inscribed circle that differ from the page
 *  background (white) by more than `tol` on any channel. */
const paintedFraction = ({ w, h, data }, tol = 24) => {
  let n = 0, hit = 0
  const r = Math.min(w, h) * 0.45
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x - w / 2) ** 2 + (y - h / 2) ** 2 > r * r) continue
    const i = (y * w + x) * 4
    n++
    if (Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]) > tol) hit++
  }
  return hit / n
}

const meanAbsDiff = (a, b) => {
  let s = 0
  for (let i = 0; i < a.data.length; i += 4) {
    s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
  }
  return s / (a.data.length / 4) / 3
}

/** Hue (degrees) of the mean colour of the clearly saturated pixels. */
const dominantHue = ({ w, h, data }) => {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < w * h * 4; i += 4) {
    const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2])
    if (mx < 60 || (mx - mn) / mx < 0.45) continue
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
  }
  if (!n) return { hue: NaN, n }
  r /= n; g /= n; b /= n
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  hue = (hue * 60 + 360) % 360
  return { hue, n }
}

const server = await preview({ root: here, preview: { port: 0, open: false }, logLevel: "silent" })
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch({ args: LAUNCH_ARGS })

try {
  const still = await browser.newContext({ viewport: { width: 900, height: 900 }, reducedMotion: "reduce" })
  const moving = await browser.newContext({ viewport: { width: 900, height: 900 }, reducedMotion: "no-preference" })
  decoder = await still.newPage()

  const errorsOf = (page) => {
    const list = []
    page.on("pageerror", (e) => list.push(String(e)))
    page.on("console", (m) => m.type() === "error" && list.push(m.text()))
    return list
  }

  const page = await still.newPage()
  const errors = errorsOf(page)
  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForSelector('[data-harness="ready"]', { timeout: 15_000 })
  await page.waitForTimeout(500)

  // 1. load
  check("no page errors on load", errors.length === 0, errors.join(" | "))

  // 2. canvas mounts, inside the orb
  const canvasCount = await page.locator(`${SLOT} canvas`).count()
  const canvasBox = await page.locator(`${SLOT} canvas`).boundingBox()
  check("a canvas mounts in the orb", canvasCount === 1 && canvasBox?.width > 100 && canvasBox?.height > 100, `${canvasCount} canvas, ${canvasBox?.width}x${canvasBox?.height}`)

  // 3. WebGL context. getContext("webgl") on a canvas that already has one
  // returns it; on a canvas with a different context type it returns null.
  // So a fresh probe canvas is no proof; ask the orb's own canvas.
  const gl = await page.evaluate((sel) => {
    const c = document.querySelector(sel)
    const ctx = c.getContext("webgl")
    return { has: !!ctx, lost: ctx ? ctx.isContextLost() : null, renderer: ctx ? ctx.getParameter(ctx.RENDERER) : null }
  }, `${SLOT} canvas`)
  check("the orb's canvas holds a live WebGL context", gl.has && gl.lost === false, `renderer: ${gl.renderer}`)

  // 4. non-blank vs a known-blank baseline of the same size
  const orbPx = await pixels(page, SLOT, "ink-idle")
  const blankPx = await pixels(page, BLANK)
  const fOrb = paintedFraction(orbPx), fBlank = paintedFraction(blankPx)
  check("the canvas is non-blank (baseline: empty slot paints 0)", fBlank === 0 && fOrb > 0.5, `orb ${(fOrb * 100).toFixed(1)}% painted, blank slot ${(fBlank * 100).toFixed(1)}%`)

  // 5. states: every state in types.ts is reachable by a click, no errors
  const frames = {}
  for (const s of STATES) {
    await page.click(`button[data-state="${s}"]`)
    await page.waitForTimeout(250)
    frames[s] = await pixels(page, SLOT, `state-${s}`)
    const pressed = await page.getAttribute(`button[data-state="${s}"]`, "aria-pressed")
    check(`state "${s}" can be set by click`, pressed === "true" && errors.length === 0, errors.join(" | "))
  }
  const diffs = []
  for (let i = 0; i < STATES.length; i++) for (let j = i + 1; j < STATES.length; j++) {
    diffs.push([`${STATES[i]}/${STATES[j]}`, meanAbsDiff(frames[STATES[i]], frames[STATES[j]])])
  }
  const STATE_MIN = 1.0 // mean per-channel difference, 0-255
  info("state pixel diffs", diffs.map(([k, v]) => `${k}=${v.toFixed(2)}`).join(" "))
  check("a state change changes the painted pixels", diffs.some(([, v]) => v > STATE_MIN), `max ${Math.max(...diffs.map(([, v]) => v)).toFixed(2)} > ${STATE_MIN}`)
  // Recorded, not asserted: renderStill() draws with input and output level 0,
  // and listening/speaking differ from idle only through those levels, so the
  // reduced-motion poster cannot tell idle, listening and speaking apart. See
  // FINDINGS.md open item 2. Promote to a check once the component says otherwise.
  const same = diffs.filter(([, v]) => v <= STATE_MIN).map(([k]) => k)
  info("states identical in a still frame", same.join(", ") || "none")
  await page.click('button[data-state="idle"]')

  // 6. finishes render without errors and non-blank
  for (const f of FINISHES) {
    await page.click(`button[data-finish="${f}"]`)
    await page.waitForTimeout(250)
    const fr = paintedFraction(await pixels(page, SLOT, `finish-${f}`), 12)
    check(`finish "${f}" paints and raises no errors`, fr > 0.3 && errors.length === 0, `${(fr * 100).toFixed(1)}% painted ${errors.join(" | ")}`)
  }
  await page.click('button[data-finish="ink"]')
  await page.waitForTimeout(250)

  // 7. rebrand from outside: default ember vs consumer colors prop
  const before = dominantHue(await pixels(page, SLOT, "palette-default"))
  await page.click('button[data-harness="brand"]')
  await page.waitForTimeout(250)
  const brandedPx = await pixels(page, SLOT, "palette-brand")
  const after = dominantHue(brandedPx)
  check("default palette paints warm (ember: hue 0-50)", before.hue >= 0 && before.hue <= 50, `hue ${before.hue.toFixed(0)}, ${before.n} px`)
  check("colors prop repaints to the brand hue (#1f3fff: hue 210-250)", after.hue >= 210 && after.hue <= 250, `hue ${after.hue.toFixed(0)}, ${after.n} px`)
  await page.click('button[data-palette="moss"]')
  await page.waitForTimeout(250)
  const moss = dominantHue(await pixels(page, SLOT, "palette-moss"))
  check("named palette prop repaints (moss: hue 130-170)", moss.hue >= 130 && moss.hue <= 170, `hue ${moss.hue.toFixed(0)}, ${moss.n} px`)

  // 8. accessibility contract
  const a11y = await page.evaluate((sel) => {
    const el = document.querySelector(sel).firstElementChild
    const cv = el.querySelector("canvas")
    return { role: el.getAttribute("role"), label: el.getAttribute("aria-label"), canvasHidden: cv.getAttribute("aria-hidden") }
  }, SLOT)
  await page.click('button[data-state="speaking"]')
  const labelAfter = await page.getAttribute(`${SLOT} [role="img"]`, "aria-label")
  check("role=img with a label that follows state", a11y.role === "img" && a11y.label === "Assistant idle" && labelAfter === "Assistant speaking", `${a11y.role} "${a11y.label}" -> "${labelAfter}"`)
  check("the canvas itself is hidden from assistive tech", a11y.canvasHidden === "true")
  await page.click('button[data-state="idle"]')

  // 9. reduced motion: still frame holds still; motion context moves
  await page.click('button[data-palette="moss"]'); await page.waitForTimeout(300)
  const s1 = await pixels(page, SLOT), _ = await page.waitForTimeout(700), s2 = await pixels(page, SLOT)
  const mpage = await moving.newPage()
  const merrors = errorsOf(mpage)
  await mpage.goto(url, { waitUntil: "networkidle" })
  await mpage.waitForSelector('[data-harness="ready"]')
  await mpage.waitForTimeout(500)
  const m1 = await pixels(mpage, SLOT, "motion-a"), __ = await mpage.waitForTimeout(700), m2 = await pixels(mpage, SLOT, "motion-b")
  const dStill = meanAbsDiff(s1, s2), dMove = meanAbsDiff(m1, m2)
  check("prefers-reduced-motion: frame is static; otherwise it animates", dStill === 0 && dMove > 0.3 && merrors.length === 0, `still diff ${dStill.toFixed(2)}, moving diff ${dMove.toFixed(2)}`)

  // 10. axe
  const axe = await new AxeBuilder({ page }).analyze()
  check("axe: zero violations", axe.violations.length === 0, axe.violations.map((v) => `${v.id}(${v.nodes.length})`).join(", ") || `${axe.passes.length} rules passed`)

  // 11. installed package has no runtime dependencies
  const pkgDir = resolve(here, "node_modules/ai-orb")
  const manifest = JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf8"))
  const deps = Object.keys(manifest.dependencies ?? {})
  check("installed ai-orb declares no runtime dependencies", deps.length === 0 && !existsSync(resolve(pkgDir, "node_modules")), deps.join(", ") || "none; peers: " + Object.keys(manifest.peerDependencies ?? {}).join(", "))

  // 12. the installed file list is exactly the intended one: sources, the
  // one consumer-facing doc, README, manifest. Anything else (internal plans,
  // specs, playground, demo) is a leak. An allowlist, so a new stray file fails.
  const walk = (d, rel = "") => readdirSync(resolve(d, rel), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(d, `${rel}${e.name}/`) : [`${rel}${e.name}`])
  const installed = walk(pkgDir)
  const allowed = (p) => /^src\/[\w-]+\.tsx?$/.test(p) || ["package.json", "README.md", "LICENSE", "docs/style-guide.md"].includes(p)
  const stray = installed.filter((p) => !allowed(p))
  check("installed ai-orb contains only intended files", stray.length === 0 && installed.includes("docs/style-guide.md") && installed.includes("src/shader.ts"), stray.length ? `stray: ${stray.join(", ")}` : `${installed.length} files`)

  // Recorded, not asserted: plain Node ESM resolution of a TS-source main.
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", 'import("ai-orb").then(m=>console.log("loaded:",Object.keys(m).join(","))).catch(e=>{console.log(e.code+": "+e.message.split("\\n")[0]);process.exit(3)})'], { cwd: here, encoding: "utf8" })
  info(`plain node ${process.version} import("ai-orb")`, (r.stdout + r.stderr).trim().slice(0, 200) || `exit ${r.status}`)
} catch (e) {
  check("smoke ran to completion", false, String(e?.stack ?? e))
} finally {
  await browser.close()
  await server.close()
}

if (failures.length) {
  console.log(`\n${failures.length} probe(s) failed`)
  process.exit(1)
}
console.log("\nall probes passed")
