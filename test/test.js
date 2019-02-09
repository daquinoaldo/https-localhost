const assert = require("assert")
const fs = require("fs")
const http = require("http")
const https = require("https")

const app = require("../index.js")

const HTTPS_PORT = 4443
const HTTP_PORT = 8080

// make an http request on the specified path
function makeRequest(path = "/", secure = true, port = HTTPS_PORT) {
  const options = {
    host: "localhost",
    port: port,
    path: path,
    method: "GET",
    headers: { },
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
        statusCode: resp.statusCode
      }))
    }).on("error", err => reject(err))
      .end()
  })
}

// TESTS
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
    // set the environment port
    process.env.PORT = HTTPS_PORT
    // start the server (serving the test folder)
    app.serve("test", HTTPS_PORT)
    // make the request and check the output
    await makeRequest("/static.html")
      .then(res => assert(
        res.data.toString() === fs.readFileSync("test/static.html").toString()))
  })

  it("serves static files from default path and env port", async function() {
    // start the server (serving the default folder)
    app.serve()
    // make the request and check the output
    await makeRequest("/test/static.html")
      .then(res => assert(
        res.data.toString() === fs.readFileSync("test/static.html").toString()))
  })

  it("redirect http to https", async function() {
    // start the redirection
    await app.redirect(HTTP_PORT)
    // make the request and check the status
    await makeRequest("/", false, HTTP_PORT)
      .then(res => assert(res.statusCode === 301))
  })
})
