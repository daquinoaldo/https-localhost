const path = require('path');
const fs = require('fs')
const https = require('https')
const express = require('express')

const certOptions = {
  key: fs.readFileSync(path.resolve('cert/server.key')),
  cert: fs.readFileSync(path.resolve('cert/server.crt'))
}

const app = express()
https.createServer(certOptions, app).listen(443)

app.use(express.static('<path-to-serve>'))