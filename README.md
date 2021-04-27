# HTTPS server running on localhost

| I'm looking for maintainers and contributors! [Learn more](Looking-for-contributor.md). |
|-----------------------------------------------------------------------------------------|

Run an express server on localhost with HTTP2 and SSL. Serve static files or import as module in your project.

https-localhost is a lightweight tool for serving static content on SSL thanks to locally-trusted development certificates.  
It works with MacOS, Linux and Windows, on Chrome and Firefox, and requires you no configuration.

[![NPM](https://nodei.co/npm/https-localhost.png)](https://nodei.co/npm/https-localhost/)

[![Test](https://github.com/daquinoaldo/https-localhost/workflows/Test/badge.svg)](https://github.com/daquinoaldo/https-localhost/actions?query=workflow:Test)
[![Coverage Status](https://coveralls.io/repos/github/daquinoaldo/https-localhost/badge.svg?branch=master)](https://coveralls.io/github/daquinoaldo/https-localhost?branch=master)
[![Dependency Status](https://img.shields.io/david/daquinoaldo/https-localhost.svg)](https://david-dm.org/daquinoaldo/https-localhost)
[![Known Vulnerabilities](https://snyk.io/test/npm/https-localhost/badge.svg)](https://snyk.io/test/npm/https-localhost)
[![GitHub issues](https://img.shields.io/github/issues/daquinoaldo/https-localhost.svg)](https://github.com/daquinoaldo/https-localhost/issues)


## Dependencies
nss/certutils are needed for Firefox and Chrome.
#### MacOS
```bash
brew install nss
```
#### Linux
```bash
sudo apt install libnss3-tools
    -or-
sudo yum install nss-tools
    -or-
sudo pacman -S nss
```


## Install and use standalone
```bash
npm i -g --only=prod https-localhost
```
```bash
serve ~/myproj
```
- `sudo` may be necessary.
- If a static path is not provided the current directory content will be served.
- You can change the **port** setting the `PORT` environmental variable: `PORT=4433 serve ~/myproj`. Specifying port number will also prevent http to https redirect.

### Binaries
If you don't have Node.js installed just use a packaged version! Download it from the [release page](https://github.com/daquinoaldo/https-localhost/releases).
```bash
# Linux
./https-localhost-linux ~/myproj

# MacOS
./https-localhost-macos ~/myproj

# Windows
./https-localhost-win.exe C:\User\me\myproj
```
**Tip 1:** on Windows just drag the folder on the executable to serve it.  
**Tip 2:** on all platform put the executable on the folder you want to serve and double-click it.


## Use as module
Install as a dependency:
```bash
npm i -s https-localhost
```
Then put in your `index.js` file:
```javascript
const app = require("https-localhost")()
// app is an express app, do what you usually do with express
app.listen(port)
```
- If the **port** number is not provided, it will listen on 443.
- To **redirect** the http traffic to https use `app.redirect()`.
- You can serve **static files** with `app.serve(path)`.
- You can create a certificate for additional domains with `require("https-localhost")("mydomain.com")`

**Tip:** consider installing it as a dev dependency: this is not a production tool!  
`npm i --save-dev https-localhost`

#### Use with a web framework different from Express.js
```javascript
const httpsLocalhost = require("https-localhost")()
// const app = ...
// const port = 443
const certs = await httpsLocalhost.getCerts()
const server = https.createServer(certs, app).listen(port)
```

## Production
This tool has a production version that activates **HTTP/2**, **compression** and **minify**.
```bash
NODE_ENV=production serve ~/myproj
``` 
I decide to not activate it by default since it is usually an unwanted behaviour for localhost testing, but sometimes it could be userful, e.g. to test Progressive Web Application or more ingeneral the website performances.

**IMPORTANT**: the fact that there is a production enviornment doesn't mean that this tool is suitable for production. It's intended to be used only for local testing.


## Why and how it works
Serving static content on localhost in a trusted SSL connection is not so simple.  
It requires to manually generate and trust certificates, with complicate commands and many manual steps.

sserve, serves static content using a locally-trusted certificate, generated with the well-knowed [mkcert](https://github.com/FiloSottile/mkcert) tool.

When you install sserve it automatically creates and installs a local CA in the system (and browsers) root store, and generates the certificate for you.  
No configuration is required, just lunch the tool and we take care of everything you need.

### Supported root stores
_The supported root stores are the one supported by mkcert.  
Checkout the updated list [here](https://github.com/FiloSottile/mkcert/blob/master/README.md#supported-root-stores)._

**Here there is a handy copy:**
- macOS system store
- Windows system store
- Linux variants that provide either
    - `update-ca-trust` (Fedora, RHEL, CentOS) or
    - `update-ca-certificates` (Ubuntu, Debian) or
    - `trust` (Arch)
- Firefox (macOS and Linux only)
- Chrome and Chromium
- Java (when `JAVA_HOME` is set)


## Troubleshooting
### Node.js version
https-localhost is compatible with the LTS and latest version of Node.js.  
<sub>If you need compatibility with other Node.js versions let me know, we'll try to rearrange the code.</sub>

### root required
-  **At first run** this tool generate a trusted certificate. The sudo password may be required. If you cannot provide the sudo password generate a `localhost.key` and `localhost.crt` and specify its path with `CERT_PATH=/diractory/containing/certificates/ serve ~/myproj`.
- **At each run** the password may be required to run the server on port 443 and 80. To avoid the script ask for password specify a different port number: `PORT=4433 serve ~/myproj`.

### EACCES
Run with sudo to use the default ports 443 and 80. You can also change port with: `PORT=4433 serve ~/myproj`.

### EADDRINUSE
Another service on your machine is using port 443 or port 80. Stop it or change port with `PORT=4433 serve ~/myproj`.

### Unable to run on Windows
Windows users with spaces or quotes in the name (like Aldo D'Aquino) may experience some problems in running the script. You can try to escape this chars or put the entire path between double quotes, but I suggest you to switch to a better user name (like aldodaquino).

### RangeError
```
RangeError: Invalid typed array length: -4095
```
It is a known bug of `spdy` that is present sometimes with some old Node.js versions.

It should be present only with `NODE_ENV=production`, hence the easiest fix is to avoid using the production env. Anyway, if you need the production env, you can try to update Node.js to the latest release, or to the most stable LTS version.

I've tried to reproduce this error without any success (checkout the [Travis build logs](https://travis-ci.org/daquinoaldo/https-localhost)). If you can help please open an issue and describe as better as you can how to reproduce it, I'll be happy to help you.

### ERR_SSL_PROTOCOL_ERROR
And in general all the cases when the script runs but the connection is marked as untrusted.

Force a reinstall of the certificate with `REINSTALL=true serve`. `sudo` may be required on linux and MacOS.

If the problem is solved you should be able to use https-localhost also as module.


## Contributing
Each contribute is welcome!  
Please, checkout the [contributing guidelines](.github/CONTRIBUTING.md).


## License
Is released under [AGPL-3.0 - GNU Affero General Public License v3.0](LICENSE).

### Briefly:
- modification and redistribution allowed for both private and **commercial use**
- you must **grant patent right to the owner and to all the contributors**
- you must **keep it open source** and distribute under the **same license**
- changes must be documented
- include a limitation of liability and it **does not provide any warranty**

### Warranty
THIS TOOL IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.
THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.
For the full warranty check the [LICENSE](LICENSE).
