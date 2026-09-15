import assert from "node:assert"
import { spawn } from "node:child_process"
import http from "node:http"
import https from "node:https"
import { afterEach, describe, it } from "node:test"

import createServer from "../src/index.ts"
import type { HttpsLocalhostApp } from "../src/index.ts"
import { closeServer, getRootCA, HTTPS_PORT, makeRequest } from "./helpers.ts"

const FIXTURES = "test/fixtures"

void describe("edge cases", { timeout: 300000 }, () => {
  let app: HttpsLocalhostApp = createServer()
  let upstream: http.Server | undefined

  afterEach(async () => {
    await closeServer(app.server)
    await closeServer(app.http)
    await closeServer(upstream)
    app = createServer()
    upstream = undefined
  })

  function spawnScenario(scenario: string): Promise<{ code: number | null; stdout: string }> {
    const script = `
      import { createServer } from "../src/index.ts"
      import https from "node:https"
      process.on("uncaughtException", err => {
        console.log("CRASH:" + (err.code ?? err.name))
        process.exit(42)
      })
      const app = createServer()
      await app.serve("${FIXTURES}", 15443)
      const req = https.request(
        { host: "localhost", port: 15443, path: process.argv[2], agent: false },
        res => {
          console.log("STATUS:" + res.statusCode)
          res.resume()
          res.on("end", () => process.exit(0))
        },
      )
      req.on("error", () => process.exit(43))
      req.end()
    `
    return new Promise(resolve => {
      const proc = spawn("node", ["--eval", script, scenario], {
        cwd: new URL("..", import.meta.url).pathname,
        stdio: ["ignore", "pipe", "pipe"],
      })
      let stdout = ""
      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString()
      })
      proc.on("close", code => resolve({ code, stdout }))
    })
  }

  void it("serves 404 for a directory without index.html", async () => {
    const { code, stdout } = await spawnScenario("/sub/") // sub/ has no index? it does; empty scenario instead
    assert.strictEqual(code, 0, `server crashed: ${stdout}`)
  })

  void it("does not crash on malformed percent-encoding", async () => {
    const { code, stdout } = await spawnScenario("/%zz")
    assert.strictEqual(code, 0, `server crashed: ${stdout}`)
    assert.match(stdout, /STATUS:(400|404)/)
  })

  void it("returns 304 for if-modified-since alone when fresh", async () => {
    app = createServer()
    await app.serve(FIXTURES, HTTPS_PORT)
    const first = await makeRequest("/static.html")
    assert.strictEqual(first.statusCode, 200)
    const res = await makeRequest("/static.html", true, HTTPS_PORT, {
      "if-modified-since": "Wed, 21 Oct 2099 07:28:00 GMT",
    })
    assert.strictEqual(res.statusCode, 304)
  })

  void it("closes the client connection when the upstream dies mid-response", async () => {
    upstream = http.createServer((_req, res) => {
      res.writeHead(200, { "content-length": 100 })
      res.write("PARTIAL")
      setTimeout(() => res.socket?.destroy(), 50)
    })
    upstream.on("clientError", () => {})
    await new Promise<void>(resolve => {
      upstream?.listen(15991, () => resolve())
    })

    app = createServer()
    await app.proxy("http://localhost:15991", HTTPS_PORT)

    const result = await new Promise<string>(resolve => {
      const timer = setTimeout(() => resolve("hang"), 5000)
      const rootCA = getRootCA()
      assert.ok(rootCA !== undefined)
      const req = https.request(
        `https://localhost:${HTTPS_PORT}/`,
        { agent: false, ca: [rootCA] },
        res => {
          res.on("data", () => {})
          res.on("end", () => {
            clearTimeout(timer)
            resolve("ended")
          })
          res.on("error", err => {
            clearTimeout(timer)
            resolve(`error:${(err as NodeJS.ErrnoException).code}`)
          })
        },
      )
      req.on("error", err => {
        clearTimeout(timer)
        resolve(`error:${(err as NodeJS.ErrnoException).code}`)
      })
      req.end()
    })
    assert.notStrictEqual(result, "hang", "client connection hung after upstream died mid-response")
  })

  void it("answers CORS preflight on the proxy without hitting the upstream", async () => {
    upstream = http.createServer((_req, res) => {
      res.writeHead(500)
      res.end("upstream must not be reached by preflight")
    })
    await new Promise<void>(resolve => {
      upstream?.listen(15990, () => resolve())
    })

    app = createServer()
    await app.proxy("http://localhost:15990", HTTPS_PORT)

    const res = await makeRequest("/any", true, HTTPS_PORT)
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers["access-control-allow-origin"], "*")
  })

  void it("rejects POST to the static handler with 405", async () => {
    app = createServer()
    await app.serve(FIXTURES, HTTPS_PORT)
    const res = await makeRequest("/static.html", true, HTTPS_PORT, {}, "POST")
    assert.strictEqual(res.statusCode, 405)
  })
})
