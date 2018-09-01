const assert = require('assert')
const childProcess = require('child_process');
const fs = require('fs');
const http = require('http')
const https = require('https')
const app = require('../index.js')

// run an external script located in the scriptPath
function runScript(scriptPath, args = [], background = false) {
  return new Promise((resolve, reject) => {
    const process = childProcess.fork(scriptPath, args)
    process.on('error', err => reject(err))
    process.on('exit', code => {
      if (code === 0) resolve()
      else reject(code)
    })
    if (background) resolve(process)
  })
}

// sleep function, must be used with await
async function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// make an http request on the specified path
function makeRequest(path = "/", secure = false) {
  const agentOptions = {
    host: 'localhost',
    port: '443',
    path: '/',
    rejectUnauthorized: false
  }
  const options = {
    host: "localhost",
    path: path,
    method: "GET",
    headers: { }
  }
  if (secure) options.agent = new https.Agent(agentOptions)
  const protocol = secure ? https : http
  return new Promise((resolve, reject) => {
    protocol.request(options, resp => {
      let data = ""
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => resolve({
        data: data,
        statusCode: resp.statusCode
      }))
    }).on("error", err => reject(err))
      .end()
  })
}

let process

// TESTS
describe("Testing https-localhost", () => {
  it('redirect http to https', async function () {
    await makeRequest()
      .then(res => assert(res.statusCode === 301))
  })
  it('works as a module', async function () {
    app.get("/test", (req, res) => res.send("TEST"))
    await makeRequest("/test", true)
      .then(res => assert(res.data === "TEST"))
  })
  it('serve static file used as standalone tool', async function () {
    await app.close()
    runScript("index.js", ["test"], true)
      .then(proc => process = proc)
      .catch(err => console.error(err))
    await sleep(500)
    await makeRequest("/test.html", true)
      .then(res => assert(res.data.toString() === fs.readFileSync("test/test.html").toString()))
    if (process) process.kill('SIGINT')
  })
})