#!/usr/bin/env node

import { execFile } from "node:child_process"
import fs from "node:fs"
import https from "node:https"
import path from "node:path"

import { getAppDataPath } from "./app-data-path.ts"

const MKCERT_VERSION = "v1.4.4"
const DEFAULT_CERT_PATH = getAppDataPath("https-localhost")
const DEFAULT_DOMAIN = "localhost"

type CertificatePair = {
  key: Buffer
  cert: Buffer
}

function checkUpdates(): void {
  try {
    const options = {
      host: "api.github.com",
      path: "/repos/daquinoaldo/https-localhost/releases/latest",
      method: "GET",
      headers: { "User-Agent": "node.js" },
    }
    https
      .request(options, res => {
        let body = ""
        res.on("data", chunk => {
          body += chunk.toString("utf8")
        })
        res.on("end", () => {
          const currentVersion = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"),
          ).version
          const latestVersion = JSON.parse(body).tag_name.replace("v", "")
          if (currentVersion !== latestVersion)
            console.warn("[https-localhost] New update available.")
        })
      })
      .end()
  } catch {
    // Just catch everything, this is not a critic part and can fail.
    // It is important to not affect the script behavior.
  }
}

function getExe(): string {
  switch (process.platform) {
    case "darwin":
      return "mkcert-" + MKCERT_VERSION + "-darwin-amd64"
    case "linux":
      if (process.arch === "arm" || process.arch === "arm64")
        return "mkcert-" + MKCERT_VERSION + "-linux-arm"
      return "mkcert-" + MKCERT_VERSION + "-linux-amd64"
    case "win32":
      return "mkcert-" + MKCERT_VERSION + "-windows-amd64.exe"
    default:
      console.warn(
        "Cannot generate the localhost certificate on your " +
          "platform. Please, consider contacting the developer if you can help.",
      )
      process.exit(0)
  }
}

function download(url: string, destination: string): Promise<void> {
  console.log("Downloading the mkcert executable...")
  const file = fs.createWriteStream(destination)
  return new Promise((resolve, reject) => {
    function get(currentUrl: string): void {
      https
        .get(currentUrl, response => {
          if (response.statusCode === 302 && response.headers.location) {
            get(response.headers.location)
            return
          }
          response.pipe(file)
          file.on("finish", () => {
            file.close(err => {
              if (err) reject(err)
              else resolve()
            })
          })
          file.on("error", reject)
        })
        .on("error", reject)
    }
    get(url)
  })
}

async function runMkcert({
  appDataPath,
  exe,
  domain,
}: {
  appDataPath: string
  exe: string
  domain: string
}): Promise<void> {
  const exePath = path.join(appDataPath, exe)
  const crtPath = path.join(appDataPath, domain + ".crt")
  const keyPath = path.join(appDataPath, domain + ".key")
  const args = ["-install", "-cert-file", crtPath, "-key-file", keyPath, domain]

  if (process.platform === "win32") await new Promise(resolve => setTimeout(resolve, 3000))

  return new Promise((resolve, reject) => {
    console.log("Running mkcert to generate certificates...")
    execFile(exePath, args, (error, stdout, stderr) => {
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)
      if (error) {
        console.error(error)
        reject(error)
        return
      }
      resolve()
    })
  })
}

async function generate({
  appDataPath = DEFAULT_CERT_PATH,
  domain = DEFAULT_DOMAIN,
}: {
  appDataPath?: string
  domain?: string
} = {}): Promise<void> {
  console.info("Generating certificates...")
  console.log("Certificates path: " + appDataPath + ". Never modify nor share this files.")
  if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true })
  const url = "https://github.com/FiloSottile/mkcert/releases/download/" + MKCERT_VERSION + "/"
  const exe = getExe()
  const exePath = path.join(appDataPath, exe)
  if (!fs.existsSync(exePath)) {
    await download(url + exe, exePath)
    fs.chmodSync(exePath, "0755")
  }
  await runMkcert({ appDataPath, exe, domain })
  console.log("Certificates generated, installed and trusted. Ready to go!")
}

async function getCerts({
  domain = DEFAULT_DOMAIN,
  certPath = DEFAULT_CERT_PATH,
  reinstall = false,
}: {
  domain?: string
  certPath?: string
  reinstall?: boolean
} = {}): Promise<CertificatePair> {
  if ((process as NodeJS.Process & { pkg?: boolean }).pkg) checkUpdates()
  if (reinstall || !fs.existsSync(path.join(certPath, getExe())))
    await generate({ appDataPath: certPath, domain })
  try {
    return {
      key: fs.readFileSync(path.join(certPath, domain + ".key")),
      cert: fs.readFileSync(path.join(certPath, domain + ".crt")),
    }
  } catch {
    if (certPath !== DEFAULT_CERT_PATH) {
      console.error(
        "Cannot find localhost.key and localhost.crt in the specified path: " + certPath,
      )
      throw new Error("Certificates are missing from the specified path: " + certPath)
    }
    await generate({ appDataPath: DEFAULT_CERT_PATH, domain })
    return {
      key: fs.readFileSync(path.join(DEFAULT_CERT_PATH, domain + ".key")),
      cert: fs.readFileSync(path.join(DEFAULT_CERT_PATH, domain + ".crt")),
    }
  }
}

function remove(appDataPath = DEFAULT_CERT_PATH): void {
  if (fs.existsSync(appDataPath)) {
    fs.readdirSync(appDataPath).forEach(file => fs.unlinkSync(path.join(appDataPath, file)))
    fs.rmdirSync(appDataPath)
  }
}

if (process.argv[1]?.endsWith("/src/certs.ts") || process.argv[1]?.endsWith("/certs.js")) {
  if (
    process.argv.length === 3 &&
    (process.argv[2] === "-u" || process.argv[2] === "--uninstall")
  ) {
    remove()
    console.info("Certificates removed.")
  } else {
    generate().catch(error => console.error("\nExec error: " + error))
  }
}

export type { CertificatePair }
export { generate, getCerts, remove }
