import Config from "./Config"

interface Certs {
  key: Buffer,
  cert: Buffer
}

export {
  Certs,
  Config
}