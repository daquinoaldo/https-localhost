import http from "node:http"
import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  RequestListener,
  ServerResponse,
} from "node:http"
import https from "node:https"

const HOP_BY_HOP_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

function filterHeaders(headers: IncomingMessage["headers"]): OutgoingHttpHeaders {
  const filtered: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue
    filtered[name] = value
  }
  return filtered
}

export function createProxyHandler(target: string): RequestListener {
  const url = new URL(target)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported proxy protocol: ${url.protocol}. Use http or https.`)
  }
  const transport = url.protocol === "https:" ? https : http
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port)

  return function handleProxy(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }
    const headers = filterHeaders(req.headers)
    headers.host = url.host
    if (req.socket.remoteAddress !== undefined)
      headers["x-forwarded-for"] = req.socket.remoteAddress
    headers["x-forwarded-proto"] =
      (req.socket as { encrypted?: boolean }).encrypted === true ? "https" : "http"
    if (req.headers.host !== undefined) headers["x-forwarded-host"] = req.headers.host

    const upstream = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port,
        path: req.url,
        method: req.method,
        headers,
      },
      upstreamRes => {
        res.writeHead(upstreamRes.statusCode ?? 502, filterHeaders(upstreamRes.headers))
        upstreamRes.on("error", () => {
          res.destroy()
        })
        upstreamRes.pipe(res)
      },
    )
    upstream.on("error", () => {
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Bad gateway.")
    })
    req.on("aborted", () => {
      upstream.destroy()
    })
    req.pipe(upstream)
  }
}
