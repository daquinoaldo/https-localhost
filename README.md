# HTTPS server running on localhost

Run a server on localhost with a locally-trusted SSL certificate. Serve static files, proxies an existing server, or you can import as module in your project.

The certificate is provided by [mkcert](https://github.com/FiloSottile/mkcert). It automatically creates and installs a local CA in the system and browsers root store, and use it to generate certificates that your machine trust. **This are not valid certificates, are for development only, and will only work in your machine.**

Certificates support macOS, Linux and Windows. [The full list of supported root stores is available in the original repo](https://github.com/FiloSottile/mkcert/blob/v1.4.4/README.md#supported-root-stores).

## Install and use standalone

```sh
# install
npm i -g --only=prod https-localhost

# run
serve ~/myproj
```

How it works:

- `sudo` may be necessary.
- If a static path is not provided the current directory content will be served.
- CLI flags override environment variables:
  - `-p, --port <port>`: port to listen on (`PORT`)
  - `-H, --host <host>`: domain for the certificate (`HOST`)
  - `--cert-path <path>`: custom certificate directory (`CERT_PATH`)
  - `--reinstall`: force certificate re-generation (`REINSTALL=true`)
- Specifying a port number prevents HTTP to HTTPS redirect.

If you don't have Node.js installed just use a packaged version! Download it from the [release page](https://github.com/daquinoaldo/https-localhost/releases).

## Use as module

Install as a dependency:

```sh
npm i -D https-localhost
```

Then put in your `index.js` file:

```js
const app = require("https-localhost")()

app.listen()
app.redirect()
app.serve(path)

// or get the certificates and use them in your own server
const { getCerts } = require("https-localhost/certs")
const certs = await getCerts()
```

## Troubleshooting

### root required

- **At first run** this tool generate a trusted certificate. The sudo password may be required. If you cannot provide the sudo password generate a `localhost.key` and `localhost.crt` and specify its path with `CERT_PATH=/diractory/containing/certificates/ serve ~/myproj`.
- **At each run** the password may be required to run the server on port 443 and 80. To avoid the script ask for password specify a different port number: `PORT=4433 serve ~/myproj`.

### EACCES

Run with sudo to use the default ports 443 and 80. You can also change port with: `PORT=4433 serve ~/myproj`.

### EADDRINUSE

Another service on your machine is using port 443 or port 80. Stop it or change port with `PORT=4433 serve ~/myproj`.

### ERR_SSL_PROTOCOL_ERROR

And in general all the cases when the script runs but the connection is marked as untrusted.

Force a reinstall of the certificate with `REINSTALL=true serve`. `sudo` may be required on linux and MacOS.

If the problem is solved you should be able to use https-localhost also as module.
