#!/usr/bin/env node

import { parseArgs } from "node:util"

import { getEnv } from "./env.ts"
import createServer from "./index.ts"

const parsedArgs = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    port: { type: "string", short: "p" },
    host: { type: "string", short: "H" },
    "cert-path": { type: "string" },
    reinstall: { type: "boolean" },
    proxy: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
})

if (parsedArgs.values.help === true) {
  console.log(`
Usage: serve [options] [path]

Options:
  -p, --port <port>        Port to listen on (default: 443 or PORT env)
  -H, --host <host>        Host/domain for SSL cert (default: localhost or HOST env)
      --cert-path <path>   Directory to store/find certificates (default: CERT_PATH env)
      --reinstall          Force reinstall of certificates (default: REINSTALL env)
      --proxy <url>        Proxy requests to the given http(s) URL (default: PROXY_TARGET env)
  -h, --help               Display help
`)
  process.exit(0)
}

const staticFolder = parsedArgs.positionals[0] ?? process.cwd()

const { port, host, "cert-path": certPath, reinstall, proxy } = parsedArgs.values

if (proxy !== undefined && parsedArgs.positionals.length > 0) {
  console.error("Error: --proxy and a static path are mutually exclusive.")
  process.exit(1)
}

function friendlyError(err: unknown): void {
  const error = err as NodeJS.ErrnoException
  switch (error.code) {
    case "EACCES":
      console.error(
        "EACCES: run as administrator to use the default ports 443 and 80. " +
          "You can also change port with: `PORT=4433 serve ~/myproj` or `serve -p 4433 ~/myproj`.",
      )
      break
    case "EADDRINUSE":
      console.error(
        "EADDRINUSE: another service on your machine is using " +
          "the current port.\nStop it or change port with: " +
          "`PORT=4433 serve ~/myproj` or `serve -p 4433 ~/myproj`.",
      )
      break
    default:
      console.error(
        `Unexpected error ${error.code}:\n\n${err instanceof Error ? err.message : String(err)}`,
      )
      break
  }
  process.exit(1)
}

let env: ReturnType<typeof getEnv>
try {
  env = getEnv({
    PORT: port,
    HOST: host,
    CERT_PATH: certPath,
    REINSTALL: reinstall,
    PROXY_TARGET: proxy,
  })
} catch (err) {
  const issues =
    err !== null && typeof err === "object" && "issues" in err && Array.isArray(err.issues)
      ? (err.issues as { path: (string | number | symbol)[]; message: string }[])
      : undefined
  const summary =
    issues === undefined
      ? err instanceof Error
        ? err.message
        : String(err)
      : issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("\n")
  console.error(`Invalid arguments or environment:\n${summary}`)
  process.exit(1)
}

process.on("unhandledRejection", friendlyError)
process.on("uncaughtException", friendlyError)

const app = createServer({
  domain: env.HOST,
  certPath: env.CERT_PATH,
  reinstall: env.REINSTALL,
})
if (env.PROXY_TARGET !== undefined) app.proxy(env.PROXY_TARGET, env.PORT)
else app.serve(staticFolder, env.PORT)
if (env.PORT === 443) app.redirect()
