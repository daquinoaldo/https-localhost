#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const http = require("http")
// using HTTP/2: spdy will be deprecated soon,
// waiting for HTTP/2 on https module.
const https = require("spdy")
const express = require("express")
const compression = require("compression")

// SSL certificate
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname, "cert/server.key")),
  cert: fs.readFileSync(path.resolve(__dirname, "cert/server.crt"))
}

const port = process.env.PORT || 443

// run express
const app = express()
app.server = https.createServer(certOptions, app).listen(port)

// gzip compression and minify
app.use(compression())
app.set("json spaces", 0)

// redirect http to https
if (port === 443 || process.env.HTTP_PORT)
  app.http = http.createServer((req, res) => {
    res.writeHead(301, { Location: "https://" + req.headers["host"] + req.url })
    res.end()
  }).listen(process.env.HTTP_PORT || 80)

// serve static files, if launched as: "node index.js <static-path>"
if (require.main === module)
  app.use(express.static(process.argv[2] || process.cwd()))

// ready
console.info("Server running on port " + port + ".")

// export as module
module.exports = app
