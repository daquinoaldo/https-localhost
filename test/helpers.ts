import { execFileSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import type { IncomingMessage, Server } from "node:http"
import https from "node:https"
import path from "node:path"

import { getAppDataPath } from "../src/app-data-path.ts"

export const HTTPS_PORT = 4443
export const HTTP_PORT = 8080

export function currentEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  return env
}

export function getRootCA(): Buffer | undefined {
  try {
    const certDir = getAppDataPath("https-localhost")
    const files = fs.readdirSync(certDir)
    const exe = files.find(file => file.startsWith("mkcert"))
    if (exe === undefined) return undefined
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

export async function closeServer(server: Server | undefined): Promise<void> {
  if (server === undefined || !server.listening) return
  server.closeAllConnections()
  server.closeIdleConnections()
  await new Promise(resolve => server.close(resolve))
}

export async function makeRequest(
  requestPath = "/",
  secure = true,
  port: number | string = HTTPS_PORT,
  headers: Record<string, string> = {},
  method = "GET",
): Promise<{
  data: string
  statusCode?: number
  headers: Record<string, string | string[] | undefined>
}> {
  const rootCA = secure ? getRootCA() : undefined
  const options: https.RequestOptions = {
    host: "localhost",
    port,
    path: requestPath,
    method,
    ca: rootCA !== undefined ? [rootCA] : undefined,
    agent: false,
    headers,
  }
  const protocol = secure ? https : http
  return new Promise((resolve, reject) => {
    protocol
      .request(options, (resp: IncomingMessage) => {
        let data = ""
        resp.on("data", (chunk: Buffer | string) => {
          data += String(chunk)
        })
        resp.on("end", () => {
          resolve({
            data,
            statusCode: resp.statusCode,
            headers: resp.headers,
          })
        })
      })
      .on("error", reject)
      .end()
  })
}
