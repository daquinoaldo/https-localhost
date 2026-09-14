import http from "node:http"
import type { Server } from "node:http"
import https from "node:https"

import { getCerts } from "./certs.ts"
import { createProxyHandler } from "./proxy.ts"
import { createRouter } from "./router.ts"
import { createStaticHandler } from "./static.ts"

export type HttpsLocalhostApp = {
  server?: Server
  http?: Server
  listen: (port?: number) => Promise<Server>
  proxy: (target: string, port?: number) => Promise<HttpsLocalhostApp>
  redirect: (httpPort?: number, httpsPort?: number) => Promise<HttpsLocalhostApp>
  serve: (staticPath?: string, port?: number) => Promise<HttpsLocalhostApp>
}

export function createServer({
  domain = "localhost",
  certPath,
  reinstall,
}: {
  domain?: string
  certPath?: string
  reinstall?: boolean
} = {}): HttpsLocalhostApp {
  const router = createRouter()

  const app: HttpsLocalhostApp = {
    async listen(port = 443) {
      const certs = await getCerts({ domain, certPath, reinstall })
      app.server = https.createServer(certs, router.handleRequest)
      await new Promise<void>(resolve => {
        app.server?.listen(port, resolve)
      })
      console.info(`Server running on port ${port}.`)
      return app.server
    },
    async proxy(target, port = 443) {
      router.setProxyHandler(createProxyHandler(target))
      console.info(`Proxying to ${target}`)
      await app.listen(port)
      return app
    },
    async redirect(httpPort = 80, httpsPort = 443) {
      await new Promise<void>(resolve => {
        app.http = http
          .createServer((req, res) => {
            const reqHost = req.headers.host ?? domain
            res.writeHead(301, {
              Location: `https://${reqHost.replace(`:${httpPort}`, "")}${
                httpsPort !== 443 ? `:${httpsPort}` : ""
              }${req.url ?? ""}`,
            })
            res.end()
          })
          .listen(httpPort, resolve)
      })
      console.info("http to https redirection active.")
      return app
    },
    async serve(staticPath = process.cwd(), port = 443) {
      router.setStaticHandler(createStaticHandler(staticPath))
      console.info(`Serving static path: ${staticPath}`)
      await app.listen(port)
      return app
    },
  }

  return app
}

export { createServer as default }
