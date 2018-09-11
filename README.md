# HTTPS server running on localhost
Run an express server on localhost with HTTP2 and SSL for free.

Serve static files or import as module in your project.

[![NPM](https://nodei.co/npm/https-localhost.png)](https://nodei.co/npm/https-localhost/)

[![Build status](https://travis-ci.org/daquinoaldo/https-localhost.svg?branch=master)](https://travis-ci.org/daquinoaldo/https-localhost)
[![Coverage Status](https://coveralls.io/repos/github/daquinoaldo/https-localhost/badge.svg?branch=master)](https://coveralls.io/github/daquinoaldo/https-localhost?branch=master)
[![Dependency Status](https://img.shields.io/david/daquinoaldo/https-localhost.svg)](https://david-dm.org/daquinoaldo/https-localhost)
[![Known Vulnerabilities](https://snyk.io/test/npm/https-localhost/badge.svg)](https://snyk.io/test/npm/https-localhost)
[![GitHub issues](https://img.shields.io/github/issues/daquinoaldo/https-localhost.svg)](https://github.com/daquinoaldo/https-localhost/issues)
[![npm version](https://img.shields.io/npm/v/https-localhost.svg)](https://www.npmjs.com/package/https-localhost?activeTab=versions)


## Install and trust the certificate
Add the [rootCA.pem](rootCA.pem) certificate to your list of trusted certificates.
This step depends on the operating system you're running:

- Mac OS: open Keychain Access, choose System from the left navigation bar, choose "Import items..." from the File app
menu and select the file. Then double-click on the certificate and select always-trust in the Trust panel.

- Linux: Depending on your Linux distribution, you can use `trust`, `update-ca-certificates` or another command to mark
the generated root certificate as trusted.


## Run

### Use standalone
From terminal navigate into the folder and run `sudo npm install -g` to install this tool globally.

Then serve static file with `sudo serve <static-path>`.


### Use as module
Install the dependency with `npm install -s https-localhost`.  
Then just require this module, it will start the server automatically.

For example, put in your index.js file:
```
const app = require("https-localhost")
app.get("/", (req, res) => res.send("Hello World!"))
```

#### Specify the port
You can specify the port number of the SSL port with `sudo PORT=<port-number> serve <static-path>`
or from another module with `process.env.PORT = <port-number>`.

If you specify a port number the http redirect to https will be disabled.
You can activate the http redirect again specifying not only the PORT environment variable but also the HTTP_PORT one.

---

### License
[AGPL-3.0](LICENSE)
