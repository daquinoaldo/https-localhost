import type { IncomingMessage, ServerResponse } from "node:http"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
}

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(header, value)
  }
  if (req.method !== "OPTIONS") return false
  res.writeHead(204)
  res.end()
  return true
}

export { applyCors }
