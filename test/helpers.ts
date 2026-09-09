import { execFileSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import type { IncomingMessage, Server } from "node:http"
import https from "node:https"
import path from "node:path"

import { getAppDataPath } from "../src/app-data-path.ts"

const HTTPS_PORT = 4443
const HTTP_PORT = 8080

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

async function closeServer(server: Server | undefined): Promise<void> {
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

export { closeServer, HTTP_PORT, HTTPS_PORT, makeRequest }
