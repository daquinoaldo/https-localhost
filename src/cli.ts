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
    help: { type: "boolean", short: "h" },
  },
})

if (parsedArgs.values.help) {
  console.log(`
Usage: serve [options] [path]

Options:
  -p, --port <port>        Port to listen on (default: 443 or PORT env)
  -H, --host <host>        Host/domain for SSL cert (default: localhost or HOST env)
      --cert-path <path>   Directory to store/find certificates (default: CERT_PATH env)
      --reinstall          Force reinstall of certificates (default: REINSTALL env)
  -h, --help               Display help
`)
  process.exit(0)
}

const staticFolder = parsedArgs.positionals[0] || process.cwd()

const { port, host, "cert-path": certPath, reinstall } = parsedArgs.values

const env = getEnv({
  PORT: port,
  HOST: host,
  CERT_PATH: certPath,
  REINSTALL: reinstall,
})

const app = createServer({
  domain: env.HOST,
  certPath: env.CERT_PATH,
  reinstall: env.REINSTALL,
})
app.serve(staticFolder, env.PORT)
if (env.PORT === 443) app.redirect()

process.on("uncaughtException", err => {
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
      console.error("Unexpected error " + error.code + ":\n\n" + err)
      break
  }
  process.exit(1)
})
