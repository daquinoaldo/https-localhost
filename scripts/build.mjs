import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true })
fs.rmSync(path.join(root, ".cache", "tsc"), { recursive: true, force: true })

const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc")
for (const project of ["tsconfig.build.esm.json", "tsconfig.build.cjs.json"]) {
  const { status } = spawnSync(process.execPath, [tsc, "--project", project], {
    stdio: "inherit",
    cwd: root,
  })
  if (status !== 0) process.exit(status ?? 1)
}

// The CJS build lives in a "type": "module" package; mark it as CommonJS.
fs.writeFileSync(path.join(root, "dist", "cjs", "package.json"), '{"type":"commonjs"}')
