import type { IncomingMessage, RequestListener, ServerResponse } from "node:http"

import { applyCors } from "./cors.ts"

export function createRouter(): {
  handleRequest: RequestListener
  setProxyHandler: (handler: RequestListener | undefined) => void
  setStaticHandler: (handler: RequestListener | undefined) => void
} {
  let proxyHandler: RequestListener | undefined
  let staticHandler: RequestListener | undefined

  function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (applyCors(req, res)) return
    if (proxyHandler !== undefined) {
      proxyHandler(req, res)
      return
    }
    if (staticHandler !== undefined) {
      staticHandler(req, res)
      return
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found.")
  }

  function setProxyHandler(handler: RequestListener | undefined): void {
    proxyHandler = handler
  }

  function setStaticHandler(handler: RequestListener | undefined): void {
    staticHandler = handler
  }

  return { handleRequest, setProxyHandler, setStaticHandler }
}
