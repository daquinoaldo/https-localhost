const assert = require("assert")

describe("Testing module import", () => {
  it("doesn't install an uncaughtException handler when imported", () => {
    const modulePath = require.resolve("../index.js")
    const listenersBefore = process.listenerCount("uncaughtException")

    delete require.cache[modulePath]
    require(modulePath)

    assert.strictEqual(
      process.listenerCount("uncaughtException"),
      listenersBefore
    )
  })
})
