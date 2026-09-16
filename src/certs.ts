import { execFile } from "node:child_process"
import fs from "node:fs"
import https from "node:https"
import path from "node:path"

import { getAppDataPath } from "./app-data-path.ts"

const MKCERT_VERSION = "v1.4.4"
const DEFAULT_CERT_PATH = getAppDataPath("https-localhost")
const DEFAULT_DOMAIN = "localhost"

export type CertificatePair = {
  key: Buffer
  cert: Buffer
}

function getExe(): string {
  switch (process.platform) {
    case "darwin":
      if (process.arch === "arm64") return `mkcert-${MKCERT_VERSION}-darwin-arm64`
      return `mkcert-${MKCERT_VERSION}-darwin-amd64`
    case "linux":
      if (process.arch === "arm64") return `mkcert-${MKCERT_VERSION}-linux-arm64`
      if (process.arch === "arm") return `mkcert-${MKCERT_VERSION}-linux-arm`
      return `mkcert-${MKCERT_VERSION}-linux-amd64`
    case "win32":
      return `mkcert-${MKCERT_VERSION}-windows-amd64.exe`
    default:
      throw new Error(
        "Cannot generate the localhost certificate on your platform " +
          `(${process.platform}-${process.arch}). Please, consider contacting the developer if you can help.`,
      )
  }
}

const MAX_REDIRECTS = 5

// mkcert release binaries are a few MB; a truncated or empty cache (e.g. an
// interrupted download or an error page written by older versions) must be
// re-downloaded instead of failing exec with a cryptic error forever.
const MIN_EXECUTABLE_SIZE = 1024 * 1024

function isValidCachedExecutable(exePath: string): boolean {
  try {
    const stat = fs.statSync(exePath)
    return (
      stat.isFile() &&
      stat.size >= MIN_EXECUTABLE_SIZE &&
      fs.accessSync(exePath, fs.constants.X_OK) === undefined
    )
  } catch {
    return false
  }
}

async function download(url: string, destination: string): Promise<void> {
  console.log("Downloading the mkcert executable...")
  return new Promise((resolve, reject) => {
    function get(currentUrl: string, redirectsLeft: number): void {
      const file = fs.createWriteStream(destination)
      function fail(error: Error): void {
        file.destroy()
        fs.rmSync(destination, { force: true })
        reject(error)
      }
      https
        .get(currentUrl, response => {
          const { statusCode } = response
          const location = response.headers.location
          if (
            statusCode !== undefined &&
            statusCode >= 300 &&
            statusCode < 400 &&
            location !== undefined
          ) {
            response.resume()
            if (redirectsLeft <= 0) {
              fail(new Error(`Too many redirects while downloading ${url}`))
              return
            }
            get(new URL(location, currentUrl).toString(), redirectsLeft - 1)
            return
          }
          if (statusCode !== 200) {
            // Never write an error page into the executable file.
            response.resume()
            fail(new Error(`Failed to download ${currentUrl} (HTTP ${statusCode ?? "unknown"})`))
            return
          }
          response.pipe(file)
          file.on("finish", () => {
            file.close(err => {
              if (err === undefined || err === null) resolve()
              else fail(new Error("Failed to close the certificate file", { cause: err }))
            })
          })
          file.on("error", fail)
        })
        .on("error", fail)
    }
    get(url, MAX_REDIRECTS)
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
  const crtPath = path.join(appDataPath, `${domain}.crt`)
  const keyPath = path.join(appDataPath, `${domain}.key`)
  const args = ["-install", "-cert-file", crtPath, "-key-file", keyPath, domain]

  if (process.platform === "win32") await new Promise(resolve => setTimeout(resolve, 3000))

  return new Promise((resolve, reject) => {
    console.log("Running mkcert to generate certificates...")
    // On Linux the freshly written executable may still be held by the
    // downloader's fd for a moment (ETXTBSY); retry a few times before
    // giving up.
    const attempt = (retriesLeft: number): void => {
      execFile(exePath, args, (error, stdout, stderr) => {
        if (stdout.length > 0) console.log(stdout)
        if (stderr.length > 0) console.error(stderr)
        if (error !== null) {
          if ((error as NodeJS.ErrnoException).code === "ETXTBSY" && retriesLeft > 0) {
            setTimeout(() => attempt(retriesLeft - 1), 250)
            return
          }
          console.error(error)
          reject(new Error(`mkcert failed: ${error.message}`))
          return
        }
        resolve()
      })
    }
    attempt(5)
  })
}

export async function generate({
  appDataPath = DEFAULT_CERT_PATH,
  domain = DEFAULT_DOMAIN,
}: {
  appDataPath?: string
  domain?: string
} = {}): Promise<void> {
  console.info("Generating certificates...")
  console.log(`Certificates path: ${appDataPath}. Never modify nor share this files.`)
  if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true })
  const url = `https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/`
  const exe = getExe()
  const exePath = path.join(appDataPath, exe)
  const cached = isValidCachedExecutable(exePath)
  if (!cached) {
    if (fs.existsSync(exePath)) fs.rmSync(exePath, { force: true })
    await download(url + exe, exePath)
    fs.chmodSync(exePath, "0755")
  }
  await runMkcert({ appDataPath, exe, domain })
  console.log("Certificates generated, installed and trusted. Ready to go!")
}

export async function getCerts({
  domain = DEFAULT_DOMAIN,
  certPath = DEFAULT_CERT_PATH,
  reinstall = false,
}: {
  domain?: string
  certPath?: string
  reinstall?: boolean
} = {}): Promise<CertificatePair> {
  if (reinstall || !fs.existsSync(path.join(certPath, getExe())))
    await generate({ appDataPath: certPath, domain })
  try {
    return {
      key: fs.readFileSync(path.join(certPath, `${domain}.key`)),
      cert: fs.readFileSync(path.join(certPath, `${domain}.crt`)),
    }
  } catch {
    if (certPath !== DEFAULT_CERT_PATH) {
      console.error(
        `Cannot find localhost.key and localhost.crt in the specified path: ${certPath}`,
      )
      throw new Error(`Certificates are missing from the specified path: ${certPath}`)
    }
    await generate({ appDataPath: DEFAULT_CERT_PATH, domain })
    return {
      key: fs.readFileSync(path.join(DEFAULT_CERT_PATH, `${domain}.key`)),
      cert: fs.readFileSync(path.join(DEFAULT_CERT_PATH, `${domain}.crt`)),
    }
  }
}

export function remove(appDataPath: string = DEFAULT_CERT_PATH): void {
  if (fs.existsSync(appDataPath)) {
    fs.readdirSync(appDataPath).forEach(file => fs.unlinkSync(path.join(appDataPath, file)))
    fs.rmdirSync(appDataPath)
  }
}
