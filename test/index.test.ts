import assert from "node:assert"
import fs from "node:fs"
import { afterEach, describe, it } from "node:test"

import { generate, remove } from "../src/certs.ts"
import createServer from "../src/index.ts"
import type { HttpsLocalhostApp } from "../src/index.ts"
import { closeServer, HTTP_PORT, HTTPS_PORT, makeRequest } from "./helpers.ts"

let app: HttpsLocalhostApp = createServer()

describe("index (createServer)", { timeout: 300000 }, () => {
  afterEach(async () => {
    await closeServer(app.server)
    await closeServer(app.http)
    app.http = undefined
    remove("test/custom-folder")
    remove("test/custom folder")
    delete process.env["CERT_PATH"]
    delete process.env["HOST"]
    delete process.env["PORT"]
  })

  it("works as express app", async () => {
    app = createServer()
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  it("can install certs at first run", async () => {
    remove()

    app = createServer()
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  it("can be installed in custom folder", async () => {
    app = createServer({ certPath: "test/custom-folder" })
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  it("crashes if certs are missing in custom folder", async () => {
    const customCertPath = "test/custom-folder"
    await generate({ appDataPath: customCertPath })
    fs.unlinkSync("test/custom-folder/localhost.crt")
    fs.unlinkSync("test/custom-folder/localhost.key")

    app = createServer({ certPath: customCertPath })
    await assert.rejects(app.listen(HTTPS_PORT), /Certificates are missing/)
    remove(customCertPath)
  })

  it("supports certPath with spaces", async () => {
    app = createServer({ certPath: "test/custom folder" })
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  it("serves static files from custom path", async () => {
    app = createServer()
    app.serve("test", HTTPS_PORT)

    const res = await makeRequest("/static.html")
    assert.strictEqual(res.data.toString(), fs.readFileSync("test/static.html", "utf8"))
  })

  it("includes access-control-allow-origin header", async () => {
    app = createServer()
    app.serve("test", HTTPS_PORT)

    const res = await makeRequest("/static.html")
    assert.strictEqual(res.headers["access-control-allow-origin"], "*")
  })

  it("doesn't crash on 404", async () => {
    app = createServer()
    app.serve(undefined, HTTPS_PORT)

    const res = await makeRequest("/do-not-exist")
    assert.strictEqual(res.statusCode, 404)
  })

  it("looks for a 404.html file", async () => {
    app = createServer()
    app.serve("test", HTTPS_PORT)

    const res = await makeRequest("/do-not-exist.html")
    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.data.toString(), fs.readFileSync("test/404.html", "utf8"))
  })

  it("doesn't crash if the static path doesn't exist", async () => {
    app = createServer()
    app.serve("does-not-exist", HTTPS_PORT)

    const res = await makeRequest("/")
    assert.strictEqual(res.statusCode, 404)
  })

  it("redirects http to https with default host", async () => {
    app = createServer()
    app.redirect(HTTP_PORT)

    const res = await makeRequest("/", false, HTTP_PORT)
    assert.strictEqual(res.statusCode, 301)
    assert.strictEqual(res.headers["location"], "https://localhost/")
  })

  it("redirects http to https with custom ports", async () => {
    app = createServer()
    app.redirect(HTTP_PORT, HTTPS_PORT)

    const res = await makeRequest("/", false, HTTP_PORT)
    assert.strictEqual(res.statusCode, 301)
    assert.strictEqual(res.headers["location"], `https://localhost:${HTTPS_PORT}/`)
  })

  it("doesn't install an uncaughtException handler when imported", async () => {
    const listenersBefore = process.listenerCount("uncaughtException")
    await import(`../src/index.ts?t=${Date.now()}`)
    assert.strictEqual(process.listenerCount("uncaughtException"), listenersBefore)
  })
})
