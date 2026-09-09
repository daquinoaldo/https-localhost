import assert from "node:assert"
import { spawn } from "node:child_process"
import path from "node:path"
import { describe, it } from "node:test"

describe("cli", () => {
  const cliPath = path.resolve("src/cli.ts")

  it("CLI flags override environment", async () => {
    const testDir = path.resolve("test")
    const proc = spawn("node", [cliPath, "--port", "4448", testDir], {
      env: { ...process.env, PORT: "4447" },
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

  it("prints help when --help is passed", async () => {
    const proc = spawn("node", [cliPath, "--help"], {
      env: { ...process.env },
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
