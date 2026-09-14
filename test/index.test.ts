import assert from "node:assert"
import fs from "node:fs"
import { afterEach, describe, it } from "node:test"

import { generate, remove } from "../src/certs.ts"
import createServer from "../src/index.ts"
import type { HttpsLocalhostApp } from "../src/index.ts"
import { closeServer, HTTP_PORT, HTTPS_PORT, makeRequest } from "./helpers.ts"

let app: HttpsLocalhostApp = createServer()

void describe("index (createServer)", { timeout: 300000 }, () => {
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

  void it("handles custom routes", async () => {
    app = createServer()
    app.get("/test/module", (_req, res) => {
      res.setHeader("Content-Type", "text/plain")
      res.end("TEST")
    })
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  void it("can install certs at first run", async () => {
    remove()

    app = createServer()
    app.get("/test/module", (_req, res) => {
      res.setHeader("Content-Type", "text/plain")
      res.end("TEST")
    })
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  void it("can be installed in custom folder", async () => {
    app = createServer({ certPath: "test/custom-folder" })
    app.get("/test/module", (_req, res) => {
      res.setHeader("Content-Type", "text/plain")
      res.end("TEST")
    })
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  void it("crashes if certs are missing in custom folder", async () => {
    const customCertPath = "test/custom-folder"
    await generate({ appDataPath: customCertPath })
    fs.unlinkSync("test/custom-folder/localhost.crt")
    fs.unlinkSync("test/custom-folder/localhost.key")

    app = createServer({ certPath: customCertPath })
    await assert.rejects(app.listen(HTTPS_PORT), /Certificates are missing/u)
    remove(customCertPath)
  })

  void it("supports certPath with spaces", async () => {
    app = createServer({ certPath: "test/custom folder" })
    app.get("/test/module", (_req, res) => {
      res.setHeader("Content-Type", "text/plain")
      res.end("TEST")
    })
    await app.listen(HTTPS_PORT)

    const res = await makeRequest("/test/module")
    assert.strictEqual(res.data, "TEST")
  })

  void it("serves static files from custom path", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const res = await makeRequest("/static.html")
    assert.strictEqual(res.data.toString(), fs.readFileSync("test/fixtures/static.html", "utf8"))
    assert.match(String(res.headers["content-type"]), /^text\/html/u)
  })

  void it("supports conditional requests with etag", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const first = await makeRequest("/static.html")
    const { etag, "last-modified": lastModified } = first.headers
    assert.ok(etag !== undefined, "expected an ETag header")
    assert.ok(lastModified !== undefined, "expected a Last-Modified header")
    assert.strictEqual(first.headers["accept-ranges"], "bytes")

    const cached = await makeRequest("/static.html", true, HTTPS_PORT, {
      "if-none-match": String(etag),
    })
    assert.strictEqual(cached.statusCode, 304)
    assert.strictEqual(cached.data, "")
  })

  void it("supports range requests", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const content = fs.readFileSync("test/fixtures/static.html")
    const res = await makeRequest("/static.html", true, HTTPS_PORT, { range: "bytes=0-3" })
    assert.strictEqual(res.statusCode, 206)
    assert.strictEqual(res.data.toString(), content.subarray(0, 4).toString())
    assert.match(String(res.headers["content-range"]), /^bytes 0-3\//u)

    const suffix = await makeRequest("/static.html", true, HTTPS_PORT, { range: "bytes=-4" })
    assert.strictEqual(suffix.statusCode, 206)
    assert.strictEqual(suffix.data.toString(), content.subarray(-4).toString())

    const invalid = await makeRequest("/static.html", true, HTTPS_PORT, {
      range: "bytes=999999-",
    })
    assert.strictEqual(invalid.statusCode, 416)
  })

  void it("redirects directory requests to a trailing slash and serves its index", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const res = await makeRequest("/sub")
    assert.strictEqual(res.statusCode, 301)
    assert.strictEqual(res.headers["location"], "./sub/")

    const index = await makeRequest("/sub/")
    assert.strictEqual(index.statusCode, 200)
    assert.strictEqual(
      index.data.toString(),
      fs.readFileSync("test/fixtures/sub/index.html", "utf8"),
    )
  })

  void it("keeps the query string when redirecting to a trailing slash", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const res = await makeRequest("/sub?a=1")
    assert.strictEqual(res.statusCode, 301)
    assert.strictEqual(res.headers["location"], "./sub/?a=1")
  })

  void it("rejects protocol-relative and absolute request targets", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    for (const target of ["//evil.com/", "//evil.com", "http://evil.com/", "https://evil.com"]) {
      const res = await makeRequest(target)
      assert.strictEqual(res.statusCode, 400, `expected 400 for ${target}`)
    }
  })

  void it("includes access-control-allow-origin header", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const res = await makeRequest("/static.html")
    assert.strictEqual(res.headers["access-control-allow-origin"], "*")
  })

  void it("doesn't crash on 404", async () => {
    app = createServer()
    app.serve(undefined, HTTPS_PORT)

    const res = await makeRequest("/do-not-exist")
    assert.strictEqual(res.statusCode, 404)
  })

  void it("looks for a 404.html file", async () => {
    app = createServer()
    app.serve("test/fixtures", HTTPS_PORT)

    const res = await makeRequest("/do-not-exist.html")
    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.data.toString(), fs.readFileSync("test/fixtures/404.html", "utf8"))
  })

  void it("doesn't crash if the static path doesn't exist", async () => {
    app = createServer()
    app.serve("does-not-exist", HTTPS_PORT)

    const res = await makeRequest("/")
    assert.strictEqual(res.statusCode, 404)
  })

  void it("redirects http to https with default host", async () => {
    app = createServer()
    app.redirect(HTTP_PORT)

    const res = await makeRequest("/", false, HTTP_PORT)
    assert.strictEqual(res.statusCode, 301)
    assert.strictEqual(res.headers["location"], "https://localhost/")
  })

  void it("redirects http to https with custom ports", async () => {
    app = createServer()
    app.redirect(HTTP_PORT, HTTPS_PORT)

    const res = await makeRequest("/", false, HTTP_PORT)
    assert.strictEqual(res.statusCode, 301)
    assert.strictEqual(res.headers["location"], `https://localhost:${HTTPS_PORT}/`)
  })

  void it("doesn't install an uncaughtException handler when imported", async () => {
    const listenersBefore = process.listenerCount("uncaughtException")
    await import(`../src/index.ts?t=${Date.now()}`)
    assert.strictEqual(process.listenerCount("uncaughtException"), listenersBefore)
  })
})
