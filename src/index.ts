#!/usr/bin/env node

import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import path from "node:path"

import cors from "cors"
import express from "express"
import type { Express, Request, Response } from "express"

import { getCerts } from "./certs.ts"

export type HttpsLocalhostApp = Omit<Express, "listen"> & {
  server?: https.Server
  http?: http.Server
  listen: (port?: number) => Promise<https.Server>
  redirect: (httpPort?: number, httpsPort?: number) => void
  serve: (staticPath?: string, port?: number) => void
}

const createServer = ({
  domain = "localhost",
  certPath,
  reinstall,
}: {
  domain?: string
  certPath?: string
  reinstall?: boolean
} = {}): HttpsLocalhostApp => {
  const app = express() as unknown as HttpsLocalhostApp

  app.use(cors())
  app.listen = async function (port = 443) {
    app.server = https
      .createServer(
        await getCerts({
          domain,
          certPath,
          reinstall,
        }),
        app as unknown as Express,
      )
      .listen(port)
    console.info("Server running on port " + port + ".")
    return app.server
  }

  app.redirect = function (httpPort = 80, httpsPort = 443) {
    app.http = http
      .createServer((req, res) => {
        const reqHost = req.headers.host ? req.headers.host.replace(":" + httpPort, "") : domain
        res.writeHead(301, {
          Location:
            "https://" + reqHost + (httpsPort !== 443 ? ":" + httpsPort : "") + (req.url || ""),
        })
        res.end()
      })
      .listen(httpPort)
    console.info("http to https redirection active.")
  }

  app.serve = function (staticPath = process.cwd(), port = 443) {
    const p404 = staticPath + "/404.html"
    const index = staticPath + "/index.html"
    const fallback = fs.existsSync(p404)
      ? { status: 404, content: fs.readFileSync(path.resolve(p404)) }
      : fs.existsSync(index)
        ? { status: 200, content: fs.readFileSync(path.resolve(index)) }
        : undefined

    app.use(express.static(staticPath))
    app.use((_req: Request, res: Response) => {
      if (fallback) {
        res.status(fallback.status).type("html").send(fallback.content)
      } else {
        res.status(404).send("Not found.")
      }
    })
    console.info("Serving static path: " + staticPath)
    void app.listen(port)
  }

  return app
}

export default createServer
export { createServer }
