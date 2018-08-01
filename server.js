const path = require('path');
const fs = require('fs')
const http = require('http');
const https = process.env.HTTP2 ? require('spdy') : require('https')
const express = require('express')
const compression = require('compression');

const certOptions = {
  key: fs.readFileSync(path.resolve('cert/server.key')),
  cert: fs.readFileSync(path.resolve('cert/server.crt'))
}

const app = express()
app.use(compression());
https.createServer(certOptions, app).listen(443);

// redirect http to https
http.createServer(function (req, res) {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(80);