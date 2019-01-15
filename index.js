#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const http = require("http")
const https = require("spdy")  // spdy allows http2, while waiting express to support the http2 module
const express = require("express")
const compression = require("compression")
const minify = require('express-minify')


/* CONFIGURE THE SERVER */

// SSL certificate
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname, "cert/server.key")),
  cert: fs.readFileSync(path.resolve(__dirname, "cert/server.crt"))
}

// create a server with express
const app = express()

// override the default express listen method to use our server
app.listen = function (port=(process.env.PORT || 443)) {
  app.server = https.createServer(certOptions, app)
  app.server.listen(port)
  console.info("Server running on port " + port + ".")
}

// use gzip compression minify
app.use(compression())
app.use(minify())
app.set("json spaces", 0)


/* SETUP USEFUL FUNCTIONS */

// redirect http to https, usage `app.redirect()`
app.redirect = function () {
  app.http = http.createServer((req, res) => {
    res.writeHead(301, {Location: "https://" + req.headers["host"] + req.url})
    res.end()
  }).listen(80)
  console.info("http to https redirection active.")
}

// serve static content, usage `app.serve([path])`
app.serve = function (path=process.cwd(), port) {
  app.use(express.static(path))
  if (port) app.listen(port)
  else app.listen()
  console.info("Serving static path: " + path)
}

/* MAIN (running as script) */
// usage: `serve [<path>]` or `node index.js [<path>]`
if (require.main === module) {
  // retrieve the static path from the process argv or use the cwd
  // the first is node, the second is serve or index.js, the third (if exists) is the path
  app.serve(process.argv.length === 3 ? process.argv[2] : process.cwd())
  // redirect http to https
  app.redirect()
}

// export as module
module.exports = app
