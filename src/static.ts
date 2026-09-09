import fs from "node:fs"
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http"
import path from "node:path"

import { lookup } from "mrmime"

const DEFAULT_INDEX = "index.html"
const DEFAULT_404 = "404.html"

function mime(filePath: string): string {
  const type = lookup(filePath)
  return type
    ? type + (type.startsWith("text/") || type === "image/svg+xml" ? "; charset=utf-8" : "")
    : "application/octet-stream"
}

function sanitize(staticPath: string, urlPath: string): string | null {
  const base = path.resolve(staticPath)
  const decoded = decodeURIComponent(urlPath.split("?")[0]?.split("#")[0] ?? "/")
  const resolved = path.resolve(base, "." + path.posix.normalize("/" + decoded))
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return resolved
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === "" && match[2] === "")) return null
  if (match[1] === "") {
    const n = Number(match[2])
    if (n === 0) return null
    return { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(match[1])
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1)
  if (start > end || start >= size) return null
  return { start, end }
}

function serve404(staticPath: string, req: IncomingMessage, res: ServerResponse): void {
  try {
    const content = fs.readFileSync(path.join(staticPath, DEFAULT_404))
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
    if (req.method === "HEAD") return void res.end()
    res.end(content)
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found.")
  }
}

function serveFile(
  target: string,
  req: IncomingMessage,
  res: ServerResponse,
  range: { start: number; end: number } | null,
): void {
  const stat = fs.statSync(target)
  const etag = '"' + stat.size.toString(16) + "-" + stat.mtimeMs.toString(16) + '"'
  res.setHeader("ETag", etag)
  res.setHeader("Last-Modified", stat.mtime.toUTCString())
  res.setHeader("Accept-Ranges", "bytes")

  const ifNoneMatch = req.headers["if-none-match"]
  if (
    ifNoneMatch &&
    ifNoneMatch.split(",").some(tag => tag.trim() === etag || tag.trim() === "W/" + etag)
  ) {
    res.writeHead(304)
    res.end()
    return
  }
  const ifModifiedSince = req.headers["if-modified-since"]
  if (!ifNoneMatch && ifModifiedSince && stat.mtime <= new Date(ifModifiedSince)) {
    res.writeHead(304)
    res.end()
    return
  }

  const size = stat.size
  const status = range ? 206 : 200
  const content = fs.readFileSync(target)
  const body = range ? content.subarray(range.start, range.end + 1) : content
  res.writeHead(status, {
    "Content-Type": mime(target),
    "Content-Length": range ? range.end - range.start + 1 : size,
    ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` } : {}),
  })
  if (req.method === "HEAD") return void res.end()
  res.end(body)
}

export function createStaticHandler(staticPath: string): RequestListener {
  return function handleStatic(req, res) {
    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD, OPTIONS" })
      res.end()
      return
    }
    const filePath = sanitize(staticPath, req.url ?? "/")
    if (filePath === null) {
      res.writeHead(403)
      res.end()
      return
    }
    let target = filePath
    try {
      let stat = fs.statSync(target)
      if (stat.isDirectory()) {
        if (!req.url?.endsWith("/")) {
          res.writeHead(301, { Location: encodeURI(req.url + "/") })
          res.end()
          return
        }
        target = path.join(target, DEFAULT_INDEX)
      }
    } catch {
      serve404(staticPath, req, res)
      return
    }
    let range: { start: number; end: number } | null = null
    const rangeHeader = req.headers.range
    if (rangeHeader) {
      range = parseRange(rangeHeader, fs.statSync(target).size)
      if (range === null) {
        res.writeHead(416, { "Content-Range": "bytes */" + fs.statSync(target).size })
        res.end()
        return
      }
    }
    serveFile(target, req, res, range)
  }
}
