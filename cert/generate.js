#!/usr/bin/env node

const exec = require("child_process").exec
const fs = require("fs")
const https = require("https")

const MKCERT_VERSION = "v1.3.0"

// get the executable name
function getExe() {
  switch (process.platform) {
    case "darwin":
      return "mkcert-" + MKCERT_VERSION + "-darwin-amd64"
    case "linux":
      return "mkcert-" + MKCERT_VERSION + "-linux-amd64"
    case "windows":
      return "mkcert-" + MKCERT_VERSION + "-windows-amd64.exe"
    default:
      console.warn("Cannot generate the localhost certificate on your " +
        "platform. Please, consider contacting the developer if you can help.")
      process.exit(0)
  }
}

// download a binary file
function download(url, path) {
  console.log("Downloading the mkcert executable...")
  const file = fs.createWriteStream(path)
  return new Promise(resolve => {
    function get(url, file) {
      https.get(url, (response) => {
        if (response.statusCode === 302) get(response.headers.location, file)
        else response.pipe(file).on("finish", resolve)
      })
    }
    get(url, file)
  })
}

// execute the binary executable to generate the certificates
function mkcert(path, exe) {
  return new Promise((resolve, reject) => {
    console.log("Running mkcert to generate certificates...")
    exec(path + exe + " -install -cert-file " + path + "localhost.crt " +
    "-key-file " + path + "localhost.key localhost", (err, stdout, stderr) => {
      console.log(stdout)
      console.error(stderr)
      if (err) reject(err)
      else resolve()
    })
  })
}

async function main() {
  const url = "https://github.com/FiloSottile/mkcert/releases/download/" +
    MKCERT_VERSION + "/"
  const exe = getExe()
  const path = "cert/"
  // download the executable
  await download(url + exe, path + exe)
  // make binary executable
  fs.chmodSync(path + exe, "0755")
  // execute the binary
  await mkcert(path, exe)
  console.log("Certificates generated, installed and trusted. Ready to go!")
}

// run as script
if (require.main === module)
  try { main() } catch (err) { console.error("\nExec error: " + err) }

// export as module
module.exports = main
