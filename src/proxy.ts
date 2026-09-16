import http from "node:http"
import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  RequestListener,
  ServerResponse,
} from "node:http"
import https from "node:https"
import type { Duplex } from "node:stream"

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

function filterHeaders(
  headers: IncomingMessage["headers"],
  { keepUpgradeHeaders = false }: { keepUpgradeHeaders?: boolean } = {},
): OutgoingHttpHeaders {
  const filtered: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    const lowerName = name.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(lowerName)) {
      // On the upgrade path Connection and Upgrade must be preserved (see
      // createProxyUpgradeHandler); everything else stays hop-by-hop.
      if (keepUpgradeHeaders && (lowerName === "connection" || lowerName === "upgrade")) {
        filtered[name] = value
      }
      continue
    }
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
    if (req.socket.remoteAddress !== undefined) {
      const forwardedFor = req.headers["x-forwarded-for"]
      headers["x-forwarded-for"] =
        forwardedFor === undefined
          ? req.socket.remoteAddress
          : `${forwardedFor}, ${req.socket.remoteAddress}`
    }
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

export function createProxyUpgradeHandler(
  target: string,
): (req: IncomingMessage, socket: Duplex, head: Buffer) => void {
  const url = new URL(target)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported proxy protocol: ${url.protocol}. Use http or https.`)
  }
  const transport = url.protocol === "https:" ? https : http
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port)
  return function handleUpgrade(req, clientSocket, head): void {
    // An upgrade request is itself a protocol upgrade: the Connection and
    // Upgrade headers must be forwarded verbatim or the upstream will never
    // see the upgrade request (RFC 9110 §7.8.1 and RFC 6455 §4.2.1).
    const headers = filterHeaders(req.headers, { keepUpgradeHeaders: true })
    headers.host = url.host
    const upstream = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port,
      path: req.url,
      method: req.method,
      headers,
    })
    // If the upstream answers without upgrading (e.g. 4xx/5xx), relay the
    // status line and close both sockets: nobody else would consume the
    // response and the client would hang forever otherwise.
    upstream.on("response", upstreamRes => {
      const statusLine = `HTTP/1.1 ${upstreamRes.statusCode ?? 502} ${upstreamRes.statusMessage ?? "Bad Gateway"}\r\n`
      clientSocket.write(statusLine)
      for (const [name, value] of Object.entries(filterHeaders(upstreamRes.headers))) {
        if (value === undefined) continue
        const values = Array.isArray(value) ? value : [value]
        for (const item of values) clientSocket.write(`${name}: ${item}\r\n`)
      }
      clientSocket.write("\r\n")
      clientSocket.end()
      upstream.destroy()
    })
    upstream.on("upgrade", (upstreamRes, upstreamSocket, upstreamHead) => {
      clientSocket.write(
        `HTTP/1.1 ${upstreamRes.statusCode ?? 101} ${upstreamRes.statusMessage ?? "Switching Protocols"}\r\n`,
      )
      for (const [name, value] of Object.entries(upstreamRes.headers)) {
        if (value === undefined) continue
        const values = Array.isArray(value) ? value : [value]
        for (const item of values) clientSocket.write(`${name}: ${item}\r\n`)
      }
      clientSocket.write("\r\n")
      if (upstreamHead.length > 0) clientSocket.write(upstreamHead)
      if (head.length > 0) upstreamSocket.write(head)
      clientSocket.pipe(upstreamSocket).pipe(clientSocket)
    })
    upstream.on("error", () => clientSocket.destroy())
    upstream.end()
  }
}
