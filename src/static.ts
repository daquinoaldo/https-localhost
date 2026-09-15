import fs from "node:fs"
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http"
import path from "node:path"

import { lookup } from "mrmime"

const DEFAULT_INDEX = "index.html"
const DEFAULT_404 = "404.html"

function mime(filePath: string): string {
  const type = lookup(filePath)
  return type !== undefined
    ? type + (type.startsWith("text/") || type === "image/svg+xml" ? "; charset=utf-8" : "")
    : "application/octet-stream"
}

function sanitize(staticPath: string, urlPath: string): string | null {
  const base = path.resolve(staticPath)
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]?.split("#")[0] ?? "/")
  } catch {
    return null
  }
  const resolved = path.resolve(base, `.${path.posix.normalize(`/${decoded}`)}`)
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) return null
  return resolved
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const firstRange = header.trim().split(",", 1)[0]
  const match = /^bytes=(\d*)-(\d*)$/u.exec(firstRange ?? "")
  if (match === null || (match[1] === "" && match[2] === "")) return null
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
    if (req.method === "HEAD") {
      res.end()
      return
    }
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
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`
  res.setHeader("ETag", etag)
  res.setHeader("Last-Modified", stat.mtime.toUTCString())
  res.setHeader("Accept-Ranges", "bytes")

  const ifNoneMatch = req.headers["if-none-match"]
  if (
    ifNoneMatch?.split(",").some(tag => tag.trim() === etag || tag.trim() === `W/${etag}`) === true
  ) {
    res.writeHead(304)
    res.end()
    return
  }
  const ifModifiedSince = req.headers["if-modified-since"]
  if (ifModifiedSince !== undefined && !Number.isNaN(new Date(ifModifiedSince).getTime())) {
    if (stat.mtime <= new Date(ifModifiedSince)) {
      res.writeHead(304)
      res.end()
      return
    }
  }

  const { size } = stat
  const content = fs.readFileSync(target)
  const body = range === null ? content : content.subarray(range.start, range.end + 1)
  res.writeHead(
    range === null ? 200 : 206,
    Object.assign(
      {
        "Content-Type": mime(target),
        "Content-Length": range === null ? size : range.end - range.start + 1,
      },
      range === null ? {} : { "Content-Range": `bytes ${range.start}-${range.end}/${size}` },
    ),
  )
  if (req.method === "HEAD") {
    res.end()
    return
  }
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
      res.writeHead(405, {
        Allow: "GET, HEAD, OPTIONS",
        "Content-Type": "text/plain; charset=utf-8",
      })
      res.end("Method not allowed.")
      return
    }
    const url = req.url ?? "/"
    if (!url.startsWith("/") || url.startsWith("//")) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Bad request.")
      return
    }
    const [urlPath, query = ""] = url.split("?")
    const filePath = sanitize(staticPath, urlPath ?? "/")
    if (filePath === null) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Forbidden.")
      return
    }
    let target = filePath
    try {
      const stat = fs.statSync(target)
      if (stat.isDirectory()) {
        if (urlPath?.endsWith("/") !== true) {
          const relativeUrlPath = urlPath?.replace(/^\//u, "") ?? ""
          res.writeHead(301, {
            Location: encodeURI(`./${relativeUrlPath}/${query === "" ? "" : `?${query}`}`),
          })
          res.end()
          return
        }
        target = path.join(target, DEFAULT_INDEX)
      }
    } catch {
      serve404(staticPath, req, res)
      return
    }
    try {
      fs.statSync(target)
    } catch {
      serve404(staticPath, req, res)
      return
    }
    let range: { start: number; end: number } | null = null
    const rangeHeader = req.headers.range
    if (rangeHeader !== undefined) {
      range = parseRange(rangeHeader, fs.statSync(target).size)
      if (range === null) {
        res.writeHead(416, {
          "Content-Range": `bytes */${fs.statSync(target).size}`,
          "Content-Type": "text/plain; charset=utf-8",
        })
        res.end("Range not satisfiable.")
        return
      }
    }
    serveFile(target, req, res, range)
  }
}
