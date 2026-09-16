import http from "node:http"
import type { IncomingMessage, Server } from "node:http"
import https from "node:https"
import type { Duplex } from "node:stream"

import { getCerts } from "./certs.ts"
import { createProxyHandler, createProxyUpgradeHandler } from "./proxy.ts"
import { createRouter } from "./router.ts"
import { createStaticHandler } from "./static.ts"

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  server.closeIdleConnections()
  await new Promise<void>(resolve => {
    server.close(() => resolve())
  })
}

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

  // Listening errors (e.g. EADDRINUSE) must reject the caller's promise:
  // without an error listener Node emits them uncaught and the promise
  // never settles.
  function listenWithEvents(
    server: Server,
    port: number,
    onUpgrade?: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): Promise<Server> {
    server.on("error", error => {
      server.emit("listenError", error)
    })
    if (onUpgrade !== undefined) server.on("upgrade", onUpgrade)
    return new Promise<Server>((resolve, reject) => {
      server.once("listenError", reject)
      server.listen(port, () => {
        server.removeListener("listenError", reject)
        resolve(server)
      })
    })
  }

  const app: HttpsLocalhostApp = {
    async listen(port = 443) {
      if (app.server?.listening === true) {
        console.warn(`Server already listening, closing the previous one.`)
        await closeServer(app.server)
      }
      const certs = await getCerts({ domain, certPath, reinstall })
      const server = https.createServer(certs, router.handleRequest)
      app.server = await listenWithEvents(server, port, router.proxyUpgradeHandler)
      console.info(`Server running on port ${port}.`)
      return app.server
    },
    async proxy(target, port = 443) {
      router.setProxyHandler(createProxyHandler(target))
      router.setProxyUpgradeHandler(createProxyUpgradeHandler(target))
      console.info(`Proxying to ${target}`)
      await app.listen(port)
      return app
    },
    async redirect(httpPort = 80, httpsPort = 443) {
      if (app.http?.listening === true) {
        console.warn(`Redirect server already listening, closing the previous one.`)
        await closeServer(app.http)
      }
      const server = http.createServer((req, res) => {
        const reqHost = req.headers.host ?? domain
        // Strip the http port from the Host without touching an unrelated
        // occurrence (e.g. inside an IPv6 literal) and handle hosts without
        // a port.
        const colonIndex = reqHost.lastIndexOf(":")
        const hasPort = colonIndex > reqHost.lastIndexOf("]")
        const bareHost = hasPort ? reqHost.slice(0, colonIndex) : reqHost
        res.writeHead(301, {
          Location: `https://${bareHost}${httpsPort !== 443 ? `:${httpsPort}` : ""}${req.url ?? ""}`,
        })
        res.end()
      })
      app.http = await listenWithEvents(server, httpPort)
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
