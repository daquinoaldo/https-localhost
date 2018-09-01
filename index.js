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
app.server = https.createServer(certOptions, app).listen(443)
// save sockets for fast close
const sockets = []
let nextSocketId = 0
app.server.on('connection', socket => {
  const socketId = nextSocketId++
  sockets[socketId] = socket
  socket.on('close', () => delete sockets[socketId])
})

// gzip compression and minify
app.use(compression())
app.set('json spaces', 0)

// redirect http to https
app.http = http.createServer(function (req, res) {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url })
  res.end()
}).listen(80)
// save sockets for fast close
app.server.on('connection', socket => {
  const socketId = nextSocketId++
  sockets[socketId] = socket
  socket.on('close', () => delete sockets[socketId])
})

// ready
if (!process.env.TEST) console.info("Server running on port 443.")

// serve static files, launch as: 'node index.js <static-path>'
if (require.main === module) {  // called directly (not through require)
  const staticPath = process.argv[2]
  app.use(express.static(staticPath || process.cwd()))
}

// close the app
app.close = (callback) => {
  const promises = [
    new Promise(resolve => app.http.close(resolve)),
    new Promise(resolve => app.server.close(resolve))
  ]
  // destroy all opens
  for (const socketId in sockets)
    sockets[socketId].destroy()

  return Promise.all(promises).then(() => {
    if (!process.env.TEST) console.info("Server closed.")
    if (callback) callback()
  })
}

// export as module
module.exports = app