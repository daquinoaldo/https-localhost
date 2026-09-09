import assert from "node:assert"
import fs from "node:fs"
import net from "node:net"
import { afterEach, describe, it } from "node:test"
import tls from "node:tls"

import { generate, getCerts, remove } from "../src/certs.ts"
import { getEnv } from "../src/env.ts"

describe("certs", { timeout: 300000 }, () => {
  afterEach(() => {
    remove("test/custom-folder")
    remove("test/custom folder")
    delete process.env["CERT_PATH"]
    delete process.env["HOST"]
  })

  it("can be uninstalled", () => {
    remove()
  })

  it("uninstall is idempotent (doesn't fail if called twice)", () => {
    remove()
  })

  it("can be installed", async () => {
    await generate()
  })

  it("provides the certificate", async () => {
    const env = getEnv()
    const appCerts = await getCerts({
      domain: env.HOST,
      certPath: env.CERT_PATH,
      reinstall: env.REINSTALL,
    })
    const realCerts = await getCerts({
      domain: env.HOST,
      certPath: env.CERT_PATH,
      reinstall: env.REINSTALL,
    })
    assert.deepStrictEqual(appCerts, realCerts)
  })

  it("works with environment domain", async () => {
    const appCerts = await getCerts({ domain: "192.168.0.1" })
    const secureContext = tls.createSecureContext({
      cert: appCerts.cert,
    })
    const secureSocket = new tls.TLSSocket(new net.Socket(), {
      secureContext,
    })
    const cert = secureSocket.getCertificate()
    assert(cert && "subjectaltname" in cert)
    const certDomain = cert.subjectaltname?.split(":")[1]

    assert.strictEqual(certDomain, "192.168.0.1")
  })

  it("crashes if certs do not exist in custom folder", async () => {
    const customCertPath = "test/custom-folder"
    await generate({ appDataPath: customCertPath })
    fs.unlinkSync("test/custom-folder/localhost.crt")
    fs.unlinkSync("test/custom-folder/localhost.key")

    await assert.rejects(getCerts({ certPath: customCertPath }), /Certificates are missing/)
    remove(customCertPath)
  })
})
