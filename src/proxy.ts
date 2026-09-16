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

// Headers listed in Connection (RFC 9110 §7.6.1) are hop-by-hop too and
// must not be forwarded.
function connectionListedHeaders(
  connection: IncomingMessage["headers"]["connection"],
): Set<string> {
  const listed = new Set<string>()
  const values =
    connection === undefined ? [] : Array.isArray(connection) ? connection : [connection]
  for (const value of values) {
    for (const token of value.split(",")) {
      const name = token.trim().toLowerCase()
      if (name !== "") listed.add(name)
    }
  }
  return listed
}

// A valid HTTP header name (RFC 9110 §5.1 token). Assigning an arbitrary
// string as a property name (e.g. "__proto__") on a plain object would be a
// prototype-pollution / property-injection hazard, so every header name is
// validated before it is written to the outgoing headers object.
const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]+$/u

function isSafeHeaderName(name: string): boolean {
  return HEADER_NAME.test(name) && !Object.prototype.hasOwnProperty.call(Object.prototype, name)
}

function filterHeaders(
  headers: IncomingMessage["headers"],
  { keepUpgradeHeaders = false }: { keepUpgradeHeaders?: boolean } = {},
): OutgoingHttpHeaders {
  const connectionListed = keepUpgradeHeaders
    ? new Set<string>()
    : connectionListedHeaders(headers.connection)
  const filtered: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    const lowerName = name.toLowerCase()
    if (!isSafeHeaderName(lowerName)) continue
    if (HOP_BY_HOP_HEADERS.has(lowerName) || connectionListed.has(lowerName)) {
      // On the upgrade path Connection and Upgrade must be preserved (see
      // createProxyUpgradeHandler); everything else stays hop-by-hop.
      if (
        keepUpgradeHeaders &&
        (lowerName === "connection" || lowerName === "upgrade") &&
        typeof value === "string"
      ) {
        filtered[lowerName] = value
      }
      continue
    }
    filtered[lowerName] = value
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
      // When one side of the tunnel disconnects (or errors), tear down the
      // other side too; without this, disconnected sockets linger and can
      // crash the process on a socket error with no listener.
      clientSocket.on("error", () => upstreamSocket.destroy())
      clientSocket.on("close", () => upstreamSocket.destroy())
      upstreamSocket.on("error", () => clientSocket.destroy())
      upstreamSocket.on("close", () => clientSocket.destroy())
      clientSocket.pipe(upstreamSocket).pipe(clientSocket)
    })
    upstream.on("error", () => clientSocket.destroy())
    upstream.end()
  }
}
