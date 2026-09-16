# HTTPS server running on localhost

Run a server on localhost with a locally-trusted SSL certificate. Serve static files, proxy an existing server, define your own routes, or import it as a module in your project.

The certificate is provided by [mkcert](https://github.com/FiloSottile/mkcert). It automatically creates and installs a local CA in the system and browser root stores, and uses it to generate certificates that your machine trusts. **These are not valid certificates, they are for development only, and will only work in your machine.**

Certificates support macOS, Linux and Windows. [The full list of supported root stores is available in the original repo](https://github.com/FiloSottile/mkcert/blob/v1.4.4/README.md#supported-root-stores).

## Install and use standalone

```sh
# install
npm i -g https-localhost

# run
serve ~/myproj
```

Usage notes:

- `sudo` may be necessary.
- If a static path is not provided the current directory content will be served.
- CLI flags override environment variables:
  - `-p, --port <port>`: port to listen on (`PORT`)
  - `-H, --host <host>`: domain for the certificate (`HOST`)
  - `--cert-path <path>`: custom certificate directory (`CERT_PATH`)
  - `--reinstall`: force certificate re-generation (`REINSTALL=true`)
  - `--proxy <url>`: proxy all requests to the given http(s) URL (`PROXY_TARGET`)
  - `-h, --help`: display help
- Specifying a port number prevents HTTP to HTTPS redirect.

## Use as module

Install as a dev dependency:

```sh
npm i -D https-localhost
```

Then use it to serve static files or proxy an existing server.

```js
import { createServer } from "https-localhost"
// or, in CommonJS:
// const { createServer } = require("https-localhost")

const app = createServer()
await app.redirect() // enable http -> https
await app.serve(path) // serve static files

// or, instead of serve, proxy an existing server:
await app.proxy("http://localhost:3000")
```

Alternatively, you can use the certificates in your own server:

```js
import https from "node:https"
import { getCerts } from "https-localhost/certs" // or: const { getCerts } = require("https-localhost/certs")

const certs = await getCerts()

https.createServer(certs, (_, res) => res.end("Hello, world!")).listen(443)
```

Uninstalling the npm package removes the generated certificates automatically.

## Troubleshooting

### root required

- **At first run** this tool generates a trusted certificate. The sudo password may be required. If you cannot provide the sudo password generate a `localhost.key` and `localhost.crt` and specify its path with `CERT_PATH=/directory/containing/certificates/ serve ~/myproj`.
- **At each run** the password may be required to run the server on port 443 and 80. To avoid the script ask for password specify a different port number: `PORT=4433 serve ~/myproj`.

### EACCES

Run with sudo to use the default ports 443 and 80. You can also change port with: `PORT=4433 serve ~/myproj`.

### EADDRINUSE

Another service on your machine is using port 443 or port 80. Stop it or change port with `PORT=4433 serve ~/myproj`.

### ERR_SSL_PROTOCOL_ERROR

And in general all the cases when the script runs but the connection is marked as untrusted.

Force a reinstall of the certificate with `REINSTALL=true serve`. `sudo` may be required on linux and MacOS.

If the problem is solved you should be able to use https-localhost as a module too.
