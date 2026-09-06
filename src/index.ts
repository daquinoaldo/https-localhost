#!/usr/bin/env node

import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import path from "node:path"

import compression from "compression"
import cors from "cors"
import express from "express"
import type { Express, Request, Response } from "express"

import { getCerts } from "./certs.ts"

export type HttpsLocalhostApp = Omit<Express, "listen"> & {
  getCerts: typeof getCerts
  server?: https.Server
  http?: http.Server
  listen: (port?: number) => Promise<https.Server>
  redirect: (httpPort?: number, httpsPort?: number) => void
  serve: (staticPath?: string, port?: number) => void
}

const createServer = (domain = process.env["HOST"] || "localhost"): HttpsLocalhostApp => {
  const app = express() as unknown as HttpsLocalhostApp

  app.use(cors())
  app.getCerts = getCerts
  app.listen = async function (port = Number(process.env["PORT"]) || 443) {
    app.server = https.createServer(await getCerts(domain), app as unknown as Express).listen(port)
    console.info("Server running on port " + port + ".")
    return app.server
  }

  if (process.env["NODE_ENV"] === "production") {
    app.use(compression({ threshold: 1 }))
    app.set("json spaces", 0)
  }

  app.redirect = function (httpPort = 80, httpsPort = Number(process.env["PORT"]) || 443) {
    app.http = http
      .createServer((req, res) => {
        const reqHost = req.headers.host
          ? req.headers.host.replace(":" + httpPort, "")
          : "localhost"
        res.writeHead(301, {
          Location:
            "https://" + reqHost + (httpsPort !== 443 ? ":" + httpsPort : "") + (req.url || ""),
        })
        res.end()
      })
      .listen(httpPort)
    console.info("http to https redirection active.")
  }

  app.serve = function (staticPath = process.cwd(), port = Number(process.env["PORT"]) || 443) {
    app.use(express.static(staticPath))
    app.use((req: Request, res: Response) => {
      const p404 = staticPath + "/404.html"
      const index = staticPath + "/index.html"
      if (fs.existsSync(p404)) res.status(404).sendFile(path.resolve(p404))
      else if (fs.existsSync(index)) res.status(200).sendFile(path.resolve(index))
      else res.status(404).send(req.path + " not found.")
    })
    console.info("Serving static path: " + staticPath)
    void app.listen(port)
  }

  return app
}

export default createServer
export { createServer }
