import assert from "node:assert"
import { spawn } from "node:child_process"
import path from "node:path"
import { describe, it } from "node:test"

import { currentEnv } from "./helpers.ts"

void describe("cli", () => {
  const cliPath = path.resolve("src/cli.ts")

  void it("CLI flags override environment", async () => {
    const fixtureDir = path.resolve("test/fixtures")
    const env = currentEnv()
    env["PORT"] = "4447"
    const proc = spawn("node", [cliPath, "--port", "4448", fixtureDir], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    try {
      await new Promise<void>((resolve, reject) => {
        proc.stdout.on("data", (data: Buffer) => {
          if (data.toString().includes("Server running on port 4448")) resolve()
        })
        proc.stderr.on("data", (data: Buffer) => {
          if (data.toString().includes("Server running on port 4448")) resolve()
        })
        proc.on("error", reject)
        setTimeout(() => reject(new Error("Timeout waiting for server")), 5000)
      })
    } finally {
      proc.kill("SIGTERM")
    }
  })

  void it("exits with an error when --proxy and a path are both passed", async () => {
    const proc = spawn("node", [cliPath, "--proxy", "http://localhost:3000", "some-path"], {
      env: currentEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stderr = ""
    const [code] = await new Promise<[number | null]>((resolve, reject) => {
      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString()
      })
      proc.on("close", code => resolve([code]))
      proc.on("error", reject)
    })

    assert.strictEqual(code, 1)
    assert.ok(stderr.includes("mutually exclusive"))
  })

  void it("prints help when --help is passed", async () => {
    const proc = spawn("node", [cliPath, "--help"], {
      env: currentEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    await new Promise<void>((resolve, reject) => {
      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString()
      })
      proc.on("close", () => resolve())
      proc.on("error", reject)
    })

    assert.ok(stdout.includes("Usage: serve [options] [path]"))
    assert.ok(stdout.includes("-p, --port"))
  })
})
