import { execFileSync } from "node:child_process"
import { renameSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

/** Pack the package the way a consumer would receive it, then give the tarball
 *  a fixed name so harness/consumer/package.json can depend on it without
 *  chasing the version number. `npm pack` honours `files`, so this is exactly
 *  what would reach npm: the harness installs the artifact, never the source
 *  tree. --ignore-scripts keeps a future prepack from changing what we test
 *  without us noticing. */
const root = fileURLToPath(new URL("..", import.meta.url))
const dest = resolve(root, "harness/consumer")
const [info] = JSON.parse(
  execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", dest], {
    cwd: root,
    encoding: "utf8",
  }),
)
renameSync(resolve(dest, info.filename), resolve(dest, "ai-orb.tgz"))
console.log(`harness:pack - ${info.filename} -> harness/consumer/ai-orb.tgz (${info.entryCount} files, ${info.size} bytes)`)
for (const f of info.files) console.log(`  ${f.path}`)
