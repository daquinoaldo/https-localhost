import assert from "node:assert"
import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import type { IncomingMessage, Server } from "node:http"
import https from "node:https"
import net from "node:net"
import path from "node:path"
import { afterEach, describe, it } from "node:test"
import tls from "node:tls"

import appDataPathPkg from "appdata-path"

import * as certs from "../src/certs.ts"
import { getEnv } from "../src/env.ts"
import createServer from "../src/index.ts"
import type { HttpsLocalhostApp } from "../src/index.ts"

const getAppDataPath =
  typeof appDataPathPkg === "function"
    ? appDataPathPkg
    : (appDataPathPkg as unknown as { default: (name?: string) => string }).default

const HTTPS_PORT = 4443
const HTTP_PORT = 8080
let app: HttpsLocalhostApp = createServer()

function getRootCA(): Buffer | undefined {
  try {
    const certDir = getAppDataPath("https-localhost")
    const files = fs.readdirSync(certDir)
    const exe = files.find(file => file.startsWith("mkcert"))
    if (!exe) return undefined
    const caRoot = execFileSync(path.join(certDir, exe), ["-CAROOT"]).toString().trim()
    const rootCAPath = path.join(caRoot, "rootCA.pem")
    if (fs.existsSync(rootCAPath)) {
      return fs.readFileSync(rootCAPath)
    }
  } catch {
    // Ignore error if CA root cannot be found yet
  }
  return undefined
}

async function closeServer(server: Server | undefined) {
  if (!server || !server.listening) return
  server.closeAllConnections()
  server.closeIdleConnections()
  await new Promise(resolve => server.close(resolve))
}

async function makeRequest(
  requestPath = "/",
  secure = true,
  port: number | string = HTTPS_PORT,
): Promise<{
  data: string
  statusCode?: number
  headers: Record<string, string | string[] | undefined>
}> {
  const rootCA = secure ? getRootCA() : undefined
  const options: https.RequestOptions = {
    host: "localhost",
    port: port,
    path: requestPath,
    method: "GET",
    ca: rootCA ? [rootCA] : undefined,
    agent: false,
  }
  const protocol = secure ? https : http
  return new Promise((resolve, reject) => {
    protocol
      .request(options, (resp: IncomingMessage) => {
        let data = ""
        resp.on("data", (chunk: Buffer | string) => {
          data += chunk
        })
        resp.on("end", () =>
          resolve({
            data: data,
            statusCode: resp.statusCode,
            headers: resp.headers,
          }),
        )
      })
      .on("error", (err: Error) => reject(err))
      .end()
  })
}

describe("Testing certs", { timeout: 300000 }, () => {
  afterEach(() => {
    certs.remove("test/custom-folder")
    certs.remove("test/custom folder")
    delete process.env["CERT_PATH"]
    delete process.env["HOST"]
  })

  it("can be uninstalled", () => {
    certs.remove()
  })

  it("uninstall is idempotent (doesn't fail if called twice)", () => {
    certs.remove()
  })

  it("can be installed", async () => {
    await certs.generate()
  })

  it("can be installed at first run", async () => {
    certs.remove()

    app = createServer()
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
    await closeServer(app.server)
  })

  it("can be installed in custom folder", async () => {
    app = createServer({ certPath: "test/custom-folder" })
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
    await closeServer(app.server)
  })

  it("crashes if certs doesn't exists in custom folder", async () => {
    const customCertPath = "test/custom-folder"
    await certs.generate({ appDataPath: customCertPath })
    fs.unlinkSync("test/custom-folder/localhost.crt")
    fs.unlinkSync("test/custom-folder/localhost.key")

    app = createServer({ certPath: customCertPath })
    await assert.rejects(app.listen(HTTPS_PORT), /Certificates are missing/)
    certs.remove(customCertPath)
  })

  it("support path with spaces", async () => {
    app = createServer({ certPath: "test/custom folder" })

    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
    await closeServer(app.server)
    certs.remove("test/custom folder")
  })

  it("provides the certificate", async () => {
    const env = getEnv()
    const appCerts = await certs.getCerts({
      domain: env.HOST,
      certPath: env.CERT_PATH,
      reinstall: env.REINSTALL,
    })
    const realCerts = await certs.getCerts({
      domain: env.HOST,
      certPath: env.CERT_PATH,
      reinstall: env.REINSTALL,
    })
    assert.deepStrictEqual(appCerts, realCerts)
  })

  it("works with environment domain", async () => {
    const appCerts = await certs.getCerts({ domain: "192.168.0.1" })
    const secureContext = tls.createSecureContext({
      cert: appCerts.cert,
    })
    const secureSocket = new tls.TLSSocket(new net.Socket(), {
      secureContext,
    })
    const cert = secureSocket.getCertificate()
    assert(cert && "subjectaltname" in cert)
    const certDomain = cert.subjectaltname?.split(":")[1]

    assert(certDomain === "192.168.0.1")
  })
})

describe("Testing module", () => {
  afterEach(async () => {
    await closeServer(app.server)
    delete process.env["PORT"]
  })

  it("works as express app", async () => {
    app = createServer()
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
  })

  it("works with environment port", async () => {
    app = createServer()
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
  })
})

describe("Testing serve", () => {
  afterEach(async () => {
    await closeServer(app.server)
    delete process.env["PORT"]
  })

  it("serves static files from custom path", async () => {
    app = createServer()
    app.serve("test", HTTPS_PORT)

    await makeRequest("/static.html").then(res =>
      assert(res.data.toString() === fs.readFileSync("test/static.html").toString()),
    )
  })

  it("serves static files from default env port", async () => {
    app = createServer()
    app.serve("test", HTTPS_PORT)

    await makeRequest("/static.html").then(res =>
      assert(res.data.toString() === fs.readFileSync("test/static.html").toString()),
    )
  })

  it("includes access-control-allow-origin header", async () => {
    app = createServer()
    app.serve("test", HTTPS_PORT)

    await makeRequest("/static.html").then(res =>
      assert(res.headers["access-control-allow-origin"] === "*"),
    )
  })

  it("doesn't crash on 404", async () => {
    app = createServer()
    app.serve(undefined, HTTPS_PORT)

    await makeRequest("/do-not-exist").then(res => assert(res.statusCode === 404))
  })

  it("looks for a 404.html file", async () => {
    app = createServer()
    await app.serve("test", HTTPS_PORT)

    await makeRequest("/do-not-exist.html").then(res => {
      assert(res.statusCode === 404)
      assert(res.data.toString() === fs.readFileSync("test/404.html").toString())
    })
  })

  it("doesn't crash if the static path doesn't exists", async () => {
    app = createServer()
    app.serve("does-not-exist", HTTPS_PORT)

    await makeRequest("/").then(res => assert(res.statusCode === 404))
  })
})

describe("Testing redirect", () => {
  afterEach(async () => {
    await closeServer(app.http)
    app.http = undefined
    delete process.env["PORT"]
  })

  it("redirect http to https", async () => {
    app = createServer()
    await app.redirect(HTTP_PORT)

    await makeRequest("/", false, HTTP_PORT).then(res => {
      assert(res.statusCode === 301)
      assert(res.headers["location"] === "https://localhost/")
    })
  })

  it("redirect http to https with custom ports", async () => {
    app = createServer()
    await app.redirect(HTTP_PORT, HTTPS_PORT)

    await makeRequest("/", false, HTTP_PORT).then(res => {
      assert(res.statusCode === 301)
      assert(res.headers["location"] === "https://localhost:4443/")
    })
  })

  it("redirect http to https with env port", async () => {
    app = createServer()
    await app.redirect(HTTP_PORT, HTTPS_PORT)

    await makeRequest("/", false, HTTP_PORT).then(res => {
      assert(res.statusCode === 301)
      assert(res.headers["location"] === "https://localhost:4443/")
    })
  })
})

describe("Testing CLI and config", () => {
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
})
