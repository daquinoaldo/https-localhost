import assert from "node:assert"
import { describe, it } from "node:test"

describe("Testing module import", () => {
  it("doesn't install an uncaughtException handler when imported", async () => {
    const listenersBefore = process.listenerCount("uncaughtException")

    await import(`../src/index.ts?t=${Date.now()}`)

    assert.strictEqual(process.listenerCount("uncaughtException"), listenersBefore)
  })
})
