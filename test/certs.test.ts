import assert from "node:assert"
import fs from "node:fs"
import net from "node:net"
import { afterEach, describe, it } from "node:test"
import tls from "node:tls"

import { generate, getCerts, remove } from "../src/certs.ts"
import { getEnv } from "../src/env.ts"

void describe("certs", { timeout: 300000 }, () => {
  afterEach(() => {
    remove("test/custom-folder")
    remove("test/custom folder")
    delete process.env["CERT_PATH"]
    delete process.env["HOST"]
  })

  void it("can be uninstalled", () => {
    remove()
  })

  void it("uninstall is idempotent (doesn't fail if called twice)", () => {
    remove()
  })

  void it("can be installed", async () => {
    await generate()
  })

  void it("provides the certificate", async () => {
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

  void it("works with environment domain", async () => {
    const appCerts = await getCerts({ domain: "192.168.0.1" })
    const secureContext = tls.createSecureContext({
      cert: appCerts.cert,
    })
    const secureSocket = new tls.TLSSocket(new net.Socket(), {
      secureContext,
    })
    const cert = secureSocket.getCertificate()
    assert(cert !== null && "subjectaltname" in cert)
    const certDomain = cert.subjectaltname?.split(":")[1]

    assert.strictEqual(certDomain, "192.168.0.1")
  })

  void it("crashes if certs do not exist in custom folder", async () => {
    const customCertPath = "test/custom-folder"
    await generate({ appDataPath: customCertPath })
    fs.unlinkSync("test/custom-folder/localhost.crt")
    fs.unlinkSync("test/custom-folder/localhost.key")

    await assert.rejects(getCerts({ certPath: customCertPath }), /Certificates are missing/u)
    remove(customCertPath)
  })
})
