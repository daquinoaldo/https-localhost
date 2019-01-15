const PORT = 4443

const assert = require("assert")
const fs = require("fs")
const http = require("http")
const https = require("https")
const app = require("../index.js")

// make an http request on the specified path
function makeRequest(path = "/", secure = true, port = PORT) {
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
  it("works as a module", async function() {
    app.get("/test/module", (req, res) => res.send("TEST"))
    await app.listen(PORT)
    await makeRequest("/test/module")
      .then(res => assert(res.data === "TEST"))
    await app.server.close()
  })

  it("works as a module serving static files", async function() {
    app.serve("test", PORT)
    await makeRequest("/static.html")
      .then(res => assert(
        res.data.toString() === fs.readFileSync("test/static.html").toString()))
    await app.server.close()
  })

  it("works on default port", async function() {
    app.serve()
    await makeRequest("/test/static.html", true, 443)
      .then(res => assert(
        res.data.toString() === fs.readFileSync("test/static.html").toString()))
    await app.server.close()
  })

  it("redirect http to https", async function() {
    await app.redirect()
    await makeRequest("/", false, 80)
      .then(res => assert(res.statusCode === 301))
  })
})
