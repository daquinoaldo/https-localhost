#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('spdy') // using HTTP/2: spdy will be deprecated soon, waiting for HTTP/2 on https module.
const express = require('express')
const compression = require('compression')

// SSL certificate
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname + "/cert/server.key")),
  cert: fs.readFileSync(path.resolve(__dirname + "/cert/server.crt"))
}

// run express on 443
const app = express()
https.createServer(certOptions, app).listen(443)

// gzip compression and minify
app.use(compression())
app.set('json spaces', 0)

// redirect http to https
http.createServer(function (req, res) {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url })
  res.end()
}).listen(80)

// ready
console.info("Server running on port 443.")

// serve static files, launch as: 'node index.js <static-path>'
const staticPath = process.argv[2]
if (staticPath) app.use(express.static(staticPath))

// export as module
module.exports = app