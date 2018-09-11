#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const http = require("http")
// spdy will be deprecated soon, waiting for HTTP/2 support on https module.
const https = require("spdy")
const express = require("express")
const compression = require("compression")

// SSL certificate
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname, "cert/server.key")),
  cert: fs.readFileSync(path.resolve(__dirname, "cert/server.crt"))
}

const port = process.env.PORT ||
/* istanbul ignore next: impossible to test */ 443

// run express
const app = express()
app.server = https.createServer(certOptions, app).listen(port)

// gzip compression and minify
app.use(compression())
app.set("json spaces", 0)

// redirect http to https
/* istanbul ignore else: useless to test */
if (port === 443 || process.env.HTTP_PORT)
  app.http = http.createServer((req, res) => {
    res.writeHead(301, { Location: "https://" + req.headers["host"] + req.url })
    res.end()
  }).listen(process.env.HTTP_PORT ||
  /* istanbul ignore next: impossible to test */ 80)

// serve static files, if launched as: "node index.js <static-path>"
/* istanbul ignore else: useless to test */
if (require.main === module || process.env.USE_STATIC) {
  let staticPath = process.cwd()
  /* istanbul ignore if: impossible to test */
  if (process.argv.join().includes("serve"))
    staticPath = process.argv.join().replace("sudo", "")
      .replace("serve", "").replace(" ", "")
  app.use(express.static(staticPath))
}

// ready
console.info("Server running on port " + port + ".")

// export as module
module.exports = app
