#!/usr/bin/env node

const exec = require("child_process").exec
const fs = require("fs")
const https = require("https")

const MKCERT_VERSION = "v1.3.0"

// get the executable name
function getExe() {
  /* istanbul ignore next: tested on all platform on travis */
  switch (process.platform) {
    case "darwin":
      return "mkcert-" + MKCERT_VERSION + "-darwin-amd64"
    case "linux":
      return "mkcert-" + MKCERT_VERSION + "-linux-amd64"
    case "win32":
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
      /* istanbul ignore if: cannot be tested */
      if (err) reject(err)
      resolve()
    })
  })
}

async function main() {
  console.info("Generating certificates...")
  const path = "cert" + /* istanbul ignore next: cannot be tested */
    (process.platform === "win32" ? "\\" : "/")
  // Check if files already exists
  if (fs.existsSync(path + "localhost.crt") &&
    /* istanbul ignore next: not relevant */
    fs.existsSync(path + "localhost.key")) {
    console.info("Certificates already exists. Skip.")
    return
  }
  const url = "https://github.com/FiloSottile/mkcert/releases/download/" +
    MKCERT_VERSION + "/"
  const exe = getExe()
  // download the executable
  await download(url + exe, path + exe)
  // make binary executable
  fs.chmodSync(path + exe, "0755")
  // execute the binary
  await mkcert(path, exe)
  console.log("Certificates generated, installed and trusted. Ready to go!")
}

// run as script
/* istanbul ignore if: cannot be tested */
if (require.main === module)
  try { main() } catch (err) { console.error("\nExec error: " + err) }

// export as module
module.exports = main
