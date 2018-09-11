process.env.USE_STATIC = true
process.env.PORT = 4443
process.env.HTTP_PORT = 8080

const assert = require("assert")
const fs = require("fs")
const http = require("http")
const https = require("https")
const app = require("../index.js")

// make an http request on the specified path
function makeRequest(path = "/", secure = false) {
  const agentOptions = {
    host: "localhost",
    port: process.env.PORT || 443,
    path: "/",
    rejectUnauthorized: false
  }
  const options = {
    host: "localhost",
    port: process.env.HTTP_PORT || 80,
    path: path,
    method: "GET",
    headers: { }
  }
  if (secure) options.agent = new https.Agent(agentOptions)
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
  it("redirect http to https", async function() {
    await makeRequest()
      .then(res => assert(res.statusCode === 301))
  })
  it("works as a module", async function() {
    app.get("/test/module", (req, res) => res.send("TEST"))
    await makeRequest("/test/module", true)
      .then(res => assert(res.data === "TEST"))
  })
  it("serve static file used as standalone tool", async function() {
    await makeRequest("/test/static.html", true)
      .then(res => assert(
        res.data.toString() === fs.readFileSync("test/static.html").toString()))
  })
})
