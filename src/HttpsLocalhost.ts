#!/usr/bin/env node

import { certificateFor } from "devcert"
import http from "http"
import http2 from "http2"
import ServeStatic from "serve-static"
import finalhandler from "finalhandler"
import { Config, Certs } from "."
import { NextFunction } from "express-serve-static-core"


// TODO: compression & minify?
// TODO: custom middleware/next function?
// TODO: custom certificate
// TODO: cors
export default class HttpsLocalhost {

  private serverConfig = {
    cacheControl: false,
    fallthrough: false
  }

  protected errorhandler(req: any, res: any, config: Config): NextFunction {
    const p404 = config.rootDir + config.redirect404To
    const h404 = ServeStatic(p404, this.serverConfig)
    const next = finalhandler(req, res)

    return (err?: any) => {
      switch (err?.status) {
        case 404:
          return h404(req, res, next)
        default:
          return next(err)
      }
    }
  }

  public async getCerts(domain = "localhost"): Promise<Certs> {
    // TODO: options
    return certificateFor(domain)
  }

  public redirectHttp(config: Config): http.Server {
    const httpServer = http.createServer((req, res) => {
      const url = new URL(req.headers.host || config.domain)
      res.writeHead(301, { Location: `https://${url.hostname}:${config.port}/${url.pathname}` })
      res.end()
    }).listen(config.redirectFromPort)
    console.info("http to https redirection active.")
    return httpServer
  }

  public async serve(config = new Config()) {
    if (config.redirectFromPort) this.redirectHttp(config)
    const certs = await this.getCerts(config.domain)
    const staticHandler = ServeStatic(process.cwd(), this.serverConfig)
    http2.createSecureServer(certs, (req, res) => staticHandler(req as any, res as any, this.errorhandler(req, res, config)))
      .listen(config.port)
    console.info(`Serving ${config.rootDir} on https://${config.domain}:${config.port}`)
  }
}