export default class Config {
  rootDir: string
  port: number
  domain: string
  cors: boolean
  compress: boolean
  minify: boolean
  redirectFromPort?: number
  redirect404To?: string

  constructor(config?: Partial<Config>) {
    this.rootDir = config?.rootDir || process.cwd()
    this.domain = config?.domain || "localhost"
    this.port = config?.port || parseInt(process.env.PORT || "443")
    this.cors = config?.cors || true
    this.compress = config?.compress || process.env.NODE_ENV === "production"
    this.minify = config?.minify || process.env.NODE_ENV === "production"
    this.redirectFromPort = config?.redirectFromPort || this.port === 443 ? 80 : undefined
  }

  getLocation = () => `https://${this.domain}:${this.port}`
}