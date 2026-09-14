import assert from "node:assert"
import http from "node:http"
import https from "node:https"
import { afterEach, describe, it } from "node:test"

import createServer from "../src/index.ts"
import type { HttpsLocalhostApp } from "../src/index.ts"
import { closeServer, getRootCA, HTTPS_PORT, makeRequest } from "./helpers.ts"

void describe("proxy", { timeout: 300000 }, () => {
  let app: HttpsLocalhostApp = createServer()
  let upstream: http.Server | undefined

  afterEach(async () => {
    await closeServer(app.server)
    await closeServer(upstream)
    app = createServer()
    upstream = undefined
  })

  function startUpstream(): Promise<void> {
    return new Promise(resolve => {
      upstream = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain", "x-upstream": "yes" })
        res.end(`UPSTREAM:${req.url ?? "/"}:${req.method ?? "GET"}`)
      })
      upstream.listen(0, () => resolve())
    })
  }

  function upstreamPort(): number {
    const address = upstream?.address()
    assert(address !== null && typeof address === "object")
    return address.port
  }

  async function startProxiedServer(target: string): Promise<void> {
    await app.proxy(target, HTTPS_PORT)
    assert.strictEqual(app.server?.listening, true)
  }

  void it("forwards requests to the target and returns the response", async () => {
    await startUpstream()
    const target = `http://localhost:${upstreamPort()}`

    app = createServer()
    await startProxiedServer(target)

    const res = await makeRequest("/hello?x=1", true, HTTPS_PORT)
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.data, `UPSTREAM:/hello?x=1:GET`)
    assert.strictEqual(res.headers["x-upstream"], "yes")
  })

  void it("returns 502 when the upstream is unreachable", async () => {
    app = createServer()
    await startProxiedServer("http://localhost:1")

    const res = await makeRequest("/any", true, HTTPS_PORT)
    assert.strictEqual(res.statusCode, 502)
  })

  void it("forwards request bodies with the correct method", async () => {
    await startUpstream()
    const target = `http://localhost:${upstreamPort()}`

    app = createServer()
    await startProxiedServer(target)

    const rootCA = getRootCA()
    assert.ok(rootCA !== undefined)
    const body = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        `https://localhost:${HTTPS_PORT}/submit`,
        {
          method: "POST",
          ca: [rootCA],
          agent: false,
          headers: { "content-type": "text/plain" },
        },
        res => {
          let data = ""
          res.on("data", (chunk: Buffer) => {
            data += String(chunk)
          })
          res.on("end", () => resolve(data))
        },
      )
      req.on("error", reject)
      req.end("hello upstream")
    })

    assert.strictEqual(body, "UPSTREAM:/submit:POST")
  })

  void it("throws for unsupported proxy protocols", async () => {
    await assert.rejects(() => app.proxy("ftp://localhost:3000", HTTPS_PORT))
  })
})
