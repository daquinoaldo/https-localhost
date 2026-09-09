import assert from "node:assert"
import { afterEach, describe, it } from "node:test"

import { envSchema, getEnv } from "../src/env.ts"

describe("env", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("applies defaults when environment is empty", () => {
    delete process.env["PORT"]
    delete process.env["HOST"]
    delete process.env["CERT_PATH"]
    delete process.env["REINSTALL"]

    const env = getEnv()
    assert.strictEqual(env.PORT, 443)
    assert.strictEqual(env.HOST, "localhost")
    assert.strictEqual(env.CERT_PATH, undefined)
    assert.strictEqual(env.REINSTALL, false)
  })

  it("reads values from process.env", () => {
    process.env["PORT"] = "8443"
    process.env["HOST"] = "test.local"
    process.env["CERT_PATH"] = "/custom/path"
    process.env["REINSTALL"] = "true"

    const env = getEnv()
    assert.strictEqual(env.PORT, 8443)
    assert.strictEqual(env.HOST, "test.local")
    assert.strictEqual(env.CERT_PATH, "/custom/path")
    assert.strictEqual(env.REINSTALL, true)
  })

  it("allows explicit overrides to take precedence", () => {
    process.env["PORT"] = "8443"
    const env = getEnv({ PORT: 9443 })
    assert.strictEqual(env.PORT, 9443)
  })

  it("rejects invalid ports", () => {
    assert.throws(() => envSchema.parse({ PORT: "invalid" }))
    assert.throws(() => envSchema.parse({ PORT: 0 }))
    assert.throws(() => envSchema.parse({ PORT: 70000 }))
  })
})
