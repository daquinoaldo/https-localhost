const assert = require("assert")
const fs = require("fs")
const http = require("http")
const https = require("https")

const sinon = require("sinon")

let app = require("../index.js")()
const certs = require("../certs.js")

const HTTPS_PORT = 4443
const HTTP_PORT = 8080

// make an http request on the specified path
function makeRequest(path = "/", secure = true, port = HTTPS_PORT) {
  const options = {
    host: "localhost",
    port: port,
    path: path,
    method: "GET",
    headers: { "accept-encoding": "gzip" },
    rejectUnauthorized: false
  }
  const protocol = secure ? https : http
  return new Promise((resolve, reject) => {
    protocol.request(options, resp => {
      let data = ""
      // eslint-disable-next-line no-return-assign
      resp.on("data", chunk => data += chunk)
      resp.on("end", () => resolve({
        data: data,
        statusCode: resp.statusCode,
        headers: resp.headers
      }))
    }).on("error", err => reject(err))
      .end()
  })
}

// TEST CERTFICATES
describe("Testing certs", function() {
  // timeout 5 min, since requires the mkcert executable download
  this.timeout(300000)

  it("can be uninstalled", () => {
    certs.remove()
  })

  it("uninstall is idempotent (doesn't fail if called twice)", () => {
    certs.remove()
  })

  it("can be installed", function(done) {
    certs.generate().then(done)
  })

  it("can be installed at first run", function(done) {
    // inner async function
    (async() => {
      // remove certs
      certs.remove()
      // prepare the server with a mock response
      app.get("/test/module", (req, res) => res.send("TEST"))
      // start the server
      await app.listen(HTTPS_PORT)
      // make the request and check the output
      await makeRequest("/test/module")
        .then(res => assert(res.data === "TEST"))
      // close the server
      app.server.close()
      done()
    })()
  })

  it("can be installed in custom folder", function(done) {
    // inner async function
    (async() => {
      // set a custom cert path
      process.env.CERT_PATH = "test/custom-folder"
      // prepare the server with a mock response
      app.get("/test/module", (req, res) => res.send("TEST"))
      // start the server
      await app.listen(HTTPS_PORT)
      // make the request and check the output
      await makeRequest("/test/module")
        .then(res => assert(res.data === "TEST"))
      // close the server
      app.server.close()
      // restore the CERT_PATH to undefined
      delete process.env.CERT_PATH
      done()
    })()
  })

  it("crashes if certs doesn't exists in custom folder", function(done) {
    // inner async function
    (async() => {
      // set a custom cert path
      process.env.CERT_PATH = "test/custom-folder"
      // remove the certificates
      fs.unlinkSync("test/custom-folder/localhost.crt")
      fs.unlinkSync("test/custom-folder/localhost.key")
      // stub the exit function
      sinon.stub(process, "exit")
      // listen
      await app.listen(HTTPS_PORT)
      // should exit 1
      assert(process.exit.calledWith(1))
      process.exit.restore()
      // close the server
      app.server.close()
      // delete the custom folder
      certs.remove(process.env.CERT_PATH)
      // restore the CERT_PATH to undefined
      delete process.env.CERT_PATH
      done()
    })()
  })

  it("support path with spaces", function(done) {
    // inner async function
    (async() => {
      // set a custom cert path
      process.env.CERT_PATH = "test/custom folder"
      // prepare the server with a mock response
      app.get("/test/module", (req, res) => res.send("TEST"))
      // start the server
      await app.listen(HTTPS_PORT)
      // make the request and check the output
      await makeRequest("/test/module")
        .then(res => assert(res.data === "TEST"))
      // close the server
      app.server.close()
      // delete the custom folder
      certs.remove(process.env.CERT_PATH)
      // restore the CERT_PATH to undefined
      delete process.env.CERT_PATH
      done()
    })()
  })

  it("provides the certificate", function(done) {
    // inner async function
    (async() => {
      const appCerts = await app.getCerts()
      const realCerts = await certs.getCerts()
      assert.deepStrictEqual(appCerts, realCerts)
      done()
    })()
  })
})

// TESTS MODULE
describe("Testing module", () => {
  // close the server after each test
  afterEach(() => {
    app.server.close()
    delete process.env.PORT
  })

  it("works as express app", function(done) {
    (async() => {
      // prepare the server with a mock response
      app.get("/test/module", (req, res) => res.send("TEST"))
      // start the server
      await app.listen(HTTPS_PORT)
      // make the request and check the output
      await makeRequest("/test/module")
        .then(res => assert(res.data === "TEST"))
      done()
    })()
  })

  it("works with environment port", function(done) {
    (async() => {
      // prepare the server with a mock response
      app.get("/test/module", (req, res) => res.send("TEST"))
      // set the environment port
      process.env.PORT = HTTPS_PORT
      // start the server
      await app.listen()
      // make the request and check the output
      await makeRequest("/test/module")
        .then(res => assert(res.data === "TEST"))
      done()
    })()
  })
})

// TEST SCRIPT
describe("Testing serve", () => {
  // close the server after each test
  afterEach(() => {
    app.server.close()
    delete process.env.PORT
  })

  it("serves static files from custom path", function(done) {
    (async() => {
      // start the server (serving the test folder)port 443 or port 80
      app.serve("test", HTTPS_PORT)
      // make the request and check the output
      await makeRequest("/static.html")
        .then(res => assert(res.data.toString() ===
          fs.readFileSync("test/static.html").toString()))
      done()
    })()
  })

  it("serves static files from default env port", function(done) {
    (async() => {
      // set the environment port
      process.env.PORT = HTTPS_PORT
      // start the server (serving the default folder)
      app.serve("test")
      // make the request and check the output
      await makeRequest("/static.html")
        .then(res => assert(res.data.toString() ===
            fs.readFileSync("test/static.html").toString()))
      done()
    })()
  })

  it("includes access-control-allow-origin header", function(done) {
    (async() => {
      // set the environment port
      process.env.PORT = HTTPS_PORT
      // start the server (serving the default folder)
      app.serve("test")
      // make the request and check the output
      await makeRequest("/static.html")
        .then(res => assert(res.headers["access-control-allow-origin"] ===
          "*"))
      done()
    })()
  })

  it("doesn't crash on 404", function(done) {
    (async() => {
      // set the environment port
      process.env.PORT = HTTPS_PORT
      // start the server (serving the default folder)
      app.serve()
      // make the request and check the status code
      await makeRequest("/do-not-exist")
        .then(res => assert(res.statusCode === 404))
      done()
    })()
  })

  it("looks for a 404.html file", function(done) {
    (async() => {
      // start the server (serving the default folder)
      await app.serve("test", HTTPS_PORT)
      // make the request and check the result
      await makeRequest("/do-not-exist.html")
        .then(res => {
          assert(res.statusCode === 404)
          assert(res.data.toString() ===
            fs.readFileSync("test/404.html").toString())
        })
      done()
    })()
  })

  it("doesn't crash if the static path doesn't exists", function(done) {
    (async() => {
      // start the server (serving a non existing folder)
      app.serve("does-not-exist", HTTPS_PORT)
      // make the request and check the status code
      await makeRequest("/")
        .then(res => assert(res.statusCode === 404))
      done()
    })()
  })
})

// TEST REDIRECT
describe("Testing redirect", () => {
  // close the server after each test
  afterEach(() => {
    app.http.close()
    delete process.env.PORT
  })

  it("redirect http to https", function(done) {
    (async() => {
      // start the redirection
      await app.redirect(HTTP_PORT)
      // make the request and check the status
      await makeRequest("/", false, HTTP_PORT)
        .then(res => {
          assert(res.statusCode === 301)
          assert(res.headers.location === "https://localhost/")
        })
      done()
    })()
  })

  it("redirect http to https with custom ports", function(done) {
    (async() => {
      // start the redirection
      await app.redirect(HTTP_PORT, HTTPS_PORT)
      // make the request and check the status
      await makeRequest("/", false, HTTP_PORT)
        .then(res => {
          assert(res.statusCode === 301)
          assert(res.headers.location === "https://localhost:4443/")
        })
      done()
    })()
  })

  it("redirect http to https with env port", function(done) {
    (async() => {
      // set the environment port
      process.env.PORT = HTTPS_PORT
      // start the redirection
      await app.redirect(HTTP_PORT)
      // make the request and check the status
      await makeRequest("/", false, HTTP_PORT)
        .then(res => {
          assert(res.statusCode === 301)
          assert(res.headers.location === "https://localhost:4443/")
        })
      done()
    })()
  })
})

// OTHER TESTS
describe("Testing additional features", function() {
  // timeout 10 secs, since sometimes 3 secs are not sufficient
  this.timeout(10000)

  it("is ready for production", function(done) {
    (async() => {
      // set NODE_ENV to production
      delete require.cache[require.resolve("../index.js")]
      process.env.NODE_ENV = "production"
      app = require("../index.js")()
      // start the server (serving the test folder)
      app.serve("test", HTTPS_PORT)
      // make the request and check the output
      await makeRequest("/static.html")
        .then(res => assert(res.headers["content-encoding"] === "gzip"))
      // reset NODE_ENV and app
      delete require.cache[require.resolve("../index.js")]
      delete process.env.NODE_ENV
      app = require("../index.js")()
      done()
    })()
  })
})
