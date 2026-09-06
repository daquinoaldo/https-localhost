#!/usr/bin/env node

import createServer from "./index.ts"

const app = createServer()
app.serve(process.argv.length === 3 ? process.argv[2] : process.cwd())
if (!process.env["PORT"]) app.redirect()

process.on("uncaughtException", err => {
  const error = err as NodeJS.ErrnoException
  switch (error.code) {
    case "EACCES":
      console.error(
        "EACCES: run as administrator to use the default ports 443 and 80. " +
          "You can also change port with: `PORT=4433 serve ~/myproj`.",
      )
      break
    case "EADDRINUSE":
      console.error(
        "EADDRINUSE: another service on your machine is using " +
          "the current port.\nStop it or change port with:" +
          "`PORT=4433 serve ~/myproj`.",
      )
      break
    default:
      console.error("Unexpected error " + error.code + ":\n\n" + err)
      break
  }
  process.exit(1)
})
