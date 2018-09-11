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

// save sockets for fast close
const sockets = []
let nextSocketId = 0
app.server.on("connection", socket => {
  const socketId = nextSocketId++
  sockets[socketId] = socket
  socket.on("close", () => delete sockets[socketId])
})

// gzip compression and minify
app.use(compression())
app.set("json spaces", 0)

// redirect http to https
if (port === 443 || process.env.HTTP_PORT) {
  app.http = http.createServer((req, res) => {
    res.writeHead(301, { Location: "https://" + req.headers["host"] + req.url })
    res.end()
  }).listen(process.env.HTTP_PORT || 80)

  app.http.on("connection", socket => {
    const socketId = nextSocketId++
    sockets[socketId] = socket
    socket.on("close", () => delete sockets[socketId])
  })
}

// serve static files, if launched as: "node index.js <static-path>"
if (require.main === module) {
  const staticPath = process.argv[2]
  app.use(express.static(staticPath || process.cwd()))
}

// ready
console.info("Server running on port " + port + ".")

// close the app
app.close = () => {
  const promises = [
    new Promise(resolve => app.http.close(resolve)),
    new Promise(resolve => app.server.close(resolve))
  ]
  // destroy all opens
  for (const socketId in sockets)
    sockets[socketId].destroy()
  return Promise.all(promises).then(() => {
    console.info("Server closed.")
  })
}

// export as module
module.exports = app
