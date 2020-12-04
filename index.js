#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const http = require("http")
// spdy allows http2, while waiting express to support the http2 module
const https = process.env.NODE_ENV === "production"
  ? require("spdy")
  : require("https")
const express = require("express")
const cors = require("cors")
const getCerts = require(path.resolve(__dirname, "certs.js")).getCerts

/* CONFIGURE THE SERVER */

// SSL certificate
const createServer = (domain = "localhost") => {
  // create a server with express
  const app = express()

  // add CORS headers to all responses
  app.use(cors())

  // add getCerts to app
  app.getCerts = getCerts

  // override the default express listen method to use our server
  app.listen = async function(port = process.env.PORT ||
  /* istanbul ignore next: cannot be tested on Travis */ 443) {
    app.server = https.createServer(await getCerts(domain), app)
      .listen(port)
    console.info("Server running on port " + port + ".")
    return app.server
  }

  // use gzip compression minify
  if (process.env.NODE_ENV === "production") {
    const compression = require("compression")
    const minify = require("express-minify")
    app.use(compression({ threshold: 1 }))
    app.use(minify())
    app.set("json spaces", 0)
  }

  /* SETUP USEFUL FUNCTIONS */

  // redirect http to https, usage `app.redirect()`
  app.redirect = function(
    /* istanbul ignore next: cannot be tested on Travis */ httpPort = 80,
    httpsPort = process.env.PORT || 443) {
    app.http = http.createServer((req, res) => {
      const reqHost = req.headers.host
        ? req.headers.host.replace(":" + httpPort, "")
        : /* istanbul ignore next: cannot be tested */ "localhost"
      res.writeHead(301, {
        Location: "https://" + reqHost +
          (httpsPort !== 443 ? ":" + httpsPort : "") + (req.url ||
        /* istanbul ignore next: cannot be tested */ "")
      })
      res.end()
    }).listen(httpPort)
    console.info("http to https redirection active.")
  }

  // serve static content, usage `app.serve([path])`
  app.serve = function(staticPath = process.cwd(), port = process.env.PORT ||
  /* istanbul ignore next: cannot be tested on Travis */ 443) {
    app.use(express.static(staticPath))
    // redirect 404 to 404.html or to index.html
    app.use((req, res) => {
      const p404 = staticPath + "/404.html"
      const index = staticPath + "/index.html"
      // istanbul ignore else: not interesting
      if (fs.existsSync(p404))
        res.status(404).sendFile(path.resolve(p404))
      else if (fs.existsSync(index))
        res.status(200).sendFile(path.resolve(index))
      else res.status(404).send(req.path + " not found.")
    })
    console.info("Serving static path: " + staticPath)
    app.listen(port)
  }

  return app
}

/* MAIN */

// usage: `serve [<path>]` or `node index.js [<path>]`
// istanbul ignore if: cannot be tested
if (require.main === module) {
  const app = createServer()
  // retrieve the static path from the process argv or use the cwd
  // 1st is node, 2nd is serve or index.js, 3rd (if exists) is the path
  app.serve(process.argv.length === 3 ? process.argv[2] : process.cwd())
  // redirect http to https (only if https port is the default one)
  if (!process.env.PORT) app.redirect()
}

/* istanbul ignore next: cannot be tested */
process.on("uncaughtException", function(err) {
  switch (err.errno) {
    case "EACCES":
      console.error(
        "EACCES: run as administrator to use the default ports 443 and 80. " +
        "You can also change port with: `PORT=4433 serve ~/myproj`.")
      break
    case "EADDRINUSE":
      console.error("EADDRINUSE: another service on your machine is using " +
      "the current port.\nStop it or change port with:" +
      "`PORT=4433 serve ~/myproj`.")
      break
    default:
      console.error("Unexpected error " + err.errno + ":\n\n" + err)
      break
  }
  process.exit(1)
})

// export as module
module.exports = createServer
