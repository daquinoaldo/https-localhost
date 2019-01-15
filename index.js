#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const http = require("http")
// spdy allows http2, while waiting express to support the http2 module
const https = require("spdy")
const express = require("express")
const compression = require("compression")
const minify = require("express-minify")

/* CONFIGURE THE SERVER */

// SSL certificate
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname, "cert/server.key")),
  cert: fs.readFileSync(path.resolve(__dirname, "cert/server.crt"))
}

// create a server with express
const app = express()

// override the default express listen method to use our server
app.listen = function(port = process.env.PORT || 443) {
  app.server = https.createServer(certOptions, app).listen(port)
  console.info("Server running on port " + port + ".")
  return app.server
}

// use gzip compression minify
app.use(compression())
app.use(minify())
app.set("json spaces", 0)

/* SETUP USEFUL FUNCTIONS */

// redirect http to https, usage `app.redirect()`
app.redirect = function(port = 80) {
  app.http = http.createServer((req, res) => {
    res.writeHead(301, { Location: "https://" + req.headers["host"] + req.url })
    res.end()
  }).listen(port)
  console.info("http to https redirection active.")
}

// serve static content, usage `app.serve([path])`
app.serve = function(path = process.cwd(), port = process.env.PORT || 443) {
  app.use(express.static(path))
  app.listen(port)
  console.info("Serving static path: " + path)
}

/* MAIN (running as script) */

// usage: `serve [<path>]` or `node index.js [<path>]`
/* istanbul ignore if  */
if (require.main === module) {
  // retrieve the static path from the process argv or use the cwd
  // 1st is node, 2nd is serve or index.js, 3rd (if exists) is the path
  app.serve(process.argv.length === 3 ? process.argv[2] : process.cwd())
  // redirect http to https
  app.redirect()
}

// export as module
module.exports = app
