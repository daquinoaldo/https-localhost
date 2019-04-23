const assert = require("assert")
const fs = require("fs")
const path = require("path")
const http = require("http")
const https = require("https")

const sinon = require("sinon")

const app = require("../index.js")()
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
describe("Testing certificates generation", function() {
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

  it("crashes if certs doesn't exists in custom folder", function(done) {
    // inner async function
    (async() => {
      // set a non-existent custom cert path
      process.env.CERT_PATH = path.join("not", "exist")
      // stub the exit function
      sinon.stub(process, "exit")
      // listen
      await app.listen(HTTPS_PORT)
      // should exit 1
      assert(process.exit.isSinonProxy)
      assert(process.exit.called)
      assert(process.exit.calledWith(1))
      // close the server
      app.server.close()
      // restore the exit
      process.exit.restore()
      // restore the CERT_PATH to undefined
      delete process.env.CERT_PATH
      done()
    })()
  })
})

// TESTS MODULE
describe("Testing https-localhost", () => {
  // close the server after each test
  afterEach(() => app.server.close())

  it("works as a module as custom express app", async function() {
    // prepare the server with a mock response
    app.get("/test/module", (req, res) => res.send("TEST"))
    // start the server
    await app.listen(HTTPS_PORT)
    // make the request and check the output
    await makeRequest("/test/module")
      .then(res => assert(res.data === "TEST"))
  })

  it("works with environment port", async function() {
    // prepare the server with a mock response
    app.get("/test/module", (req, res) => res.send("TEST"))
    // set the environment port
    process.env.PORT = HTTPS_PORT
    // start the server
    await app.listen()
    // make the request and check the output
    await makeRequest("/test/module")
      .then(res => assert(res.data === "TEST"))
  })

  it("serves static files from custom path", async function() {
    // start the server (serving the test folder)
    app.serve("test", HTTPS_PORT)
    // make the request and check the output
    await makeRequest("/static.html")
      .then(res => assert(
        res.data.toString() === fs.readFileSync("test/static.html").toString()))
  })

  it("serves static files from default env port", async function() {
    // set the environment port
    process.env.PORT = HTTPS_PORT
    // start the server (serving the default folder)
    app.serve("test")
    // make the request and check the output
    await makeRequest("/static.html")
      .then(res => assert(res.data.toString() ===
          fs.readFileSync("test/static.html").toString()))
  })

  it("doesn't crash on 404", async function() {
    // start the server (serving the default folder)
    app.serve()
    // make the request and check the status code
    await makeRequest("/do-not-exist")
      .then(res => assert(res.statusCode === 404))
  })

  it("looks for a 404.html file", async function() {
    // start the server (serving the default folder)
    await app.serve("test", HTTPS_PORT)
    // make the request and check the result
    await makeRequest("/do-not-exist.html")
      .then(res => {
        assert(res.statusCode === 404)
        assert(res.data.toString() ===
          fs.readFileSync("test/404.html").toString())
      })
  })

  it("doesn't crash if the static path doesn't exists", async function() {
    // start the server (serving a non existing folder)
    app.serve("do-not-exists")
    // make the request and check the status code
    await makeRequest("/")
      .then(res => assert(res.statusCode === 404))
  })

  it("redirect http to https", async function() {
    // start the redirection
    await app.redirect(HTTP_PORT)
    // make the request and check the status
    await makeRequest("/", false, HTTP_PORT)
      .then(res => assert(res.statusCode === 301))
  })

  // IMPORTANT: this test MUST be the latest one, always.
  // It delete the cache og the index module,
  // so the variable app is broken after this test.
  it("is ready for production", async function() {
    // set NODE_ENV to production
    delete require.cache[require.resolve("../index.js")]
    process.env.NODE_ENV = "production"
    const production = require("../index.js")()
    // start the server (serving the test folder)
    production.serve("test", HTTPS_PORT)
    // make the request and check the output
    await makeRequest("/static.html")
      .then(res => assert(res.headers["content-encoding"] === "gzip"))
  })
})
