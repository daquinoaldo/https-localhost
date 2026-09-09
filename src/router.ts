import type { IncomingMessage, RequestListener, ServerResponse } from "node:http"

import { applyCors } from "./cors.ts"

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void

export function createRouter(): {
  handleRequest: RequestListener
  get: (route: string, handler: RouteHandler) => void
  setStaticHandler: (handler: RequestListener | undefined) => void
} {
  const routes: Array<{ route: string; handler: RouteHandler }> = []

  let staticHandler: RequestListener | undefined

  function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (applyCors(req, res)) return
    const route = routes.find(candidate => candidate.route === req.url?.split("?")[0])
    if (route && req.method === "GET") {
      route.handler(req, res)
      return
    }
    if (staticHandler) {
      staticHandler(req, res)
      return
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found.")
  }

  function get(route: string, handler: RouteHandler): void {
    routes.push({ route, handler })
  }

  function setStaticHandler(handler: RequestListener | undefined): void {
    staticHandler = handler
  }

  return { handleRequest, get, setStaticHandler }
}
