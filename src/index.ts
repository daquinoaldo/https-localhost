import http from "node:http"
import type { Server } from "node:http"
import https from "node:https"

import { getCerts } from "./certs.ts"
import { createRouter } from "./router.ts"
import type { RouteHandler } from "./router.ts"
import { createStaticHandler } from "./static.ts"

export type HttpsLocalhostApp = {
  server?: Server
  http?: Server
  get: (route: string, handler: RouteHandler) => void
  listen: (port?: number) => Promise<Server>
  redirect: (httpPort?: number, httpsPort?: number) => void
  serve: (staticPath?: string, port?: number) => void
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
    get(route, handler) {
      router.get(route, handler)
    },
    async listen(port = 443) {
      app.server = https
        .createServer(await getCerts({ domain, certPath, reinstall }), router.handleRequest)
        .listen(port)
      console.info(`Server running on port ${port}.`)
      return app.server
    },
    redirect(httpPort = 80, httpsPort = 443) {
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
        .listen(httpPort)
      console.info("http to https redirection active.")
    },
    serve(staticPath = process.cwd(), port = 443) {
      router.setStaticHandler(createStaticHandler(staticPath))
      console.info(`Serving static path: ${staticPath}`)
      void app.listen(port)
    },
  }

  return app
}

export { createServer as default }
