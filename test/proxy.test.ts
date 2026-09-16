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

  void it("drops Connection-listed hop-by-hop headers", async () => {
    let seen: Record<string, string | string[] | undefined> = {}
    upstream = http.createServer((req, res) => {
      seen = req.headers
      res.writeHead(200, { "x-resp-listed": "nope" })
      res.end("ok")
    })
    await new Promise<void>(resolve => {
      upstream?.listen(0, () => resolve())
    })

    app = createServer()
    await app.proxy(`http://localhost:${(upstream.address() as { port: number }).port}`, HTTPS_PORT)

    const rootCA = getRootCA()
    assert.ok(rootCA !== undefined)
    const res = await new Promise<{ headers: Record<string, string | string[] | undefined> }>(
      (resolve, reject) => {
        const req = https.request(
          `https://localhost:${HTTPS_PORT}/`,
          {
            agent: false,
            ca: [rootCA],
            headers: { connection: "x-secret, keep-alive", "x-secret": "leak" },
          },
          upstreamRes => {
            const headers = upstreamRes.headers
            upstreamRes.resume()
            upstreamRes.on("end", () => resolve({ headers }))
          },
        )
        req.on("error", reject)
        req.end()
      },
    )

    assert.strictEqual(seen["x-secret"], undefined, "x-secret must not reach the upstream")
    assert.strictEqual(res.headers["x-resp-listed"], "nope")
  })

  void it("relays a non-101 response to a WebSocket upgrade instead of hanging", async () => {
    upstream = http.createServer((_req, res) => {
      res.writeHead(400)
      res.end("no upgrades here")
    })
    await new Promise<void>(resolve => {
      upstream?.listen(0, () => resolve())
    })

    app = createServer()
    await app.proxy(`http://localhost:${(upstream.address() as { port: number }).port}`, HTTPS_PORT)

    const rootCA = getRootCA()
    assert.ok(rootCA !== undefined)
    const result = await new Promise<string>(resolve => {
      const timer = setTimeout(() => resolve("hang"), 5000)
      const req = https.request(`https://localhost:${HTTPS_PORT}/ws`, {
        agent: false,
        ca: [rootCA],
        headers: { connection: "Upgrade", upgrade: "websocket" },
      })
      req.end()
      req.on("upgrade", () => {
        clearTimeout(timer)
        resolve("upgraded")
      })
      req.on("response", res => {
        res.resume()
        res.on("end", () => {
          // The Node client keeps the socket half-open after a response to an
          // upgrade request; destroy it or the test process never exits.
          req.destroy()
          clearTimeout(timer)
          resolve(`response:${res.statusCode}`)
        })
      })
      req.on("error", err => {
        clearTimeout(timer)
        resolve(`error:${(err as NodeJS.ErrnoException).code}`)
      })
    })
    assert.notStrictEqual(result, "hang", "upgrade request hung on non-101 upstream")
    assert.strictEqual(result, "response:400")
  })

  void it("proxies WebSocket upgrades with the upgrade headers intact", async () => {
    let sawUpgradeHeader = false
    upstream = http.createServer()
    upstream.on("upgrade", (req, socket) => {
      sawUpgradeHeader = req.headers.upgrade === "websocket"
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
      )
      socket.on("data", () => socket.end("hello-from-upstream"))
      socket.on("close", () => socket.destroy())
    })
    await new Promise<void>(resolve => {
      upstream?.listen(0, () => resolve())
    })

    app = createServer()
    await app.proxy(`http://localhost:${(upstream.address() as { port: number }).port}`, HTTPS_PORT)

    const rootCA = getRootCA()
    assert.ok(rootCA !== undefined)
    const result = await new Promise<{ data: string; got101: boolean }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("upgrade timed out")), 5000)
      const req = https.request(`https://localhost:${HTTPS_PORT}/ws`, {
        agent: false,
        ca: [rootCA],
        headers: { connection: "Upgrade", upgrade: "websocket" },
      })
      req.end()
      req.on("upgrade", (res, socket, head) => {
        let data = head.toString()
        socket.on("data", (chunk: Buffer) => {
          data += chunk.toString()
          socket.destroy()
        })
        socket.on("close", () => {
          clearTimeout(timer)
          resolve({ data, got101: res.statusCode === 101 })
        })
        socket.on("error", err => {
          clearTimeout(timer)
          reject(err)
        })
        // Ask the "server" to send something back: write a frame.
        socket.write("ping")
      })
      req.on("error", err => {
        clearTimeout(timer)
        reject(err)
      })
    })

    assert.ok(result.got101, "expected 101 Switching Protocols")
    assert.ok(sawUpgradeHeader, "upstream must receive the Upgrade header")
    assert.notStrictEqual(result.data, "", "some data must flow after the upgrade")
  })
})
