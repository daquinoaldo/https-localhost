import assert from "node:assert"
import { execFileSync } from "node:child_process"
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
    headers: { "accept-encoding": "gzip" },
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

    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
    await closeServer(app.server)
  })

  it("can be installed in custom folder", async () => {
    process.env["CERT_PATH"] = "test/custom-folder"

    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
    await closeServer(app.server)
    delete process.env["CERT_PATH"]
  })

  it("crashes if certs doesn't exists in custom folder", async () => {
    process.env["CERT_PATH"] = "test/custom-folder"
    await certs.generate(process.env["CERT_PATH"])
    fs.unlinkSync("test/custom-folder/localhost.crt")
    fs.unlinkSync("test/custom-folder/localhost.key")

    await assert.rejects(app.listen(HTTPS_PORT), /Certificates are missing/)
    certs.remove(process.env["CERT_PATH"])
    delete process.env["CERT_PATH"]
  })

  it("support path with spaces", async () => {
    process.env["CERT_PATH"] = "test/custom folder"

    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
    await closeServer(app.server)
    certs.remove(process.env["CERT_PATH"])
    delete process.env["CERT_PATH"]
  })

  it("provides the certificate", async () => {
    const appCerts = await app.getCerts()
    const realCerts = await certs.getCerts()
    assert.deepStrictEqual(appCerts, realCerts)
  })

  it("works with environment domain", async () => {
    process.env["HOST"] = "192.168.0.1"

    const appCerts = await app.getCerts()
    const secureContext = tls.createSecureContext({
      cert: appCerts.cert,
    })
    const secureSocket = new tls.TLSSocket(new net.Socket(), {
      secureContext,
    })
    const cert = secureSocket.getCertificate()
    assert(cert && "subjectaltname" in cert)
    const certDomain = cert.subjectaltname?.split(":")[1]

    assert(certDomain === process.env["HOST"])
  })
})

describe("Testing module", () => {
  afterEach(async () => {
    await closeServer(app.server)
    delete process.env["PORT"]
  })

  it("works as express app", async () => {
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    await app.listen(HTTPS_PORT)

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
  })

  it("works with environment port", async () => {
    app.get("/test/module", (_req: import("express").Request, res: import("express").Response) =>
      res.send("TEST"),
    )
    process.env["PORT"] = String(HTTPS_PORT)
    await app.listen()

    await makeRequest("/test/module").then(res => assert(res.data === "TEST"))
  })
})

describe("Testing serve", () => {
  afterEach(async () => {
    await closeServer(app.server)
    delete process.env["PORT"]
  })

  it("serves static files from custom path", async () => {
    app.serve("test", HTTPS_PORT)

    await makeRequest("/static.html").then(res =>
      assert(res.data.toString() === fs.readFileSync("test/static.html").toString()),
    )
  })

  it("serves static files from default env port", async () => {
    process.env["PORT"] = String(HTTPS_PORT)
    app.serve("test")

    await makeRequest("/static.html").then(res =>
      assert(res.data.toString() === fs.readFileSync("test/static.html").toString()),
    )
  })

  it("includes access-control-allow-origin header", async () => {
    process.env["PORT"] = String(HTTPS_PORT)
    app.serve("test")

    await makeRequest("/static.html").then(res =>
      assert(res.headers["access-control-allow-origin"] === "*"),
    )
  })

  it("doesn't crash on 404", async () => {
    process.env["PORT"] = String(HTTPS_PORT)
    app.serve()

    await makeRequest("/do-not-exist").then(res => assert(res.statusCode === 404))
  })

  it("looks for a 404.html file", async () => {
    await app.serve("test", HTTPS_PORT)

    await makeRequest("/do-not-exist.html").then(res => {
      assert(res.statusCode === 404)
      assert(res.data.toString() === fs.readFileSync("test/404.html").toString())
    })
  })

  it("doesn't crash if the static path doesn't exists", async () => {
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
    await app.redirect(HTTP_PORT)

    await makeRequest("/", false, HTTP_PORT).then(res => {
      assert(res.statusCode === 301)
      assert(res.headers["location"] === "https://localhost/")
    })
  })

  it("redirect http to https with custom ports", async () => {
    await app.redirect(HTTP_PORT, HTTPS_PORT)

    await makeRequest("/", false, HTTP_PORT).then(res => {
      assert(res.statusCode === 301)
      assert(res.headers["location"] === "https://localhost:4443/")
    })
  })

  it("redirect http to https with env port", async () => {
    process.env["PORT"] = String(HTTPS_PORT)
    await app.redirect(HTTP_PORT)

    await makeRequest("/", false, HTTP_PORT).then(res => {
      assert(res.statusCode === 301)
      assert(res.headers["location"] === "https://localhost:4443/")
    })
  })
})

// OTHER TESTS
describe("Testing additional features", { timeout: 10000 }, () => {
  it("is ready for production", async () => {
    process.env["NODE_ENV"] = "production"
    app = createServer()
    app.serve("test", HTTPS_PORT)

    await makeRequest("/static.html").then(res =>
      assert(res.headers["content-encoding"] === "gzip"),
    )
    await closeServer(app.server)
    delete process.env["NODE_ENV"]
    app = createServer()
  })
})
