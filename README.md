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

### Install
```
npm install -g --unsafe-perm=true https-localhost
```
#### Why `unsafe-perm=true`?
Is needed on Ubuntu to correctly run the post-install script that trust the localhost SSl certificate.  
You can skip it on other platforms.

If you don't trust the script, you can install it in the usual way and than follow the [optional instructions](#optional--trust-the-certificate).

### Use standalone
From terminal navigate into the folder and run `sudo npm install -g` to install this tool globally.

Then serve static file with `sudo serve <static-path>`.
If a static path is not provided the current directory content will be served.

**You must use the absolute path.**

You can change the port setting the PORT environmental variable: `sudo PORT=<port-number> serve <static-path>`.


### Use as module
Install the dependency with `npm install -s https-localhost`.  

Put in your index.js file:
```
const app = require("https-localhost")
// app is an express app, do what you usually do with express
app.listen(port)
```
If the port number is not provided, it will listen on 443.

To redirect the http traffic to https use `app.redirect()`.

You can also serve static files with `app.serve(path)`


### [Optional] Trust the certificate
**If you are not on MacOS or Ubuntu, you should follow this instructions.**

After `npm install` will run a script that tries to install and validate automatically the certificate.
However, this script is in beta and provided as-is, so there isn't any guarantee that will work.
For that reason you can also install the certificate manually, as follows.

If you decide to not install it, it's fine, the package still work.
However, visiting localhost there will be a invalid certificate issue.

To trust the certificate just add the [cert/defaultCA.pem](cert/defaultCA.pem) certificate
to your list of trusted certificates.

This step depends on the operating system you're running:
- Mac OS:
    open Keychain Access, choose System from the left navigation bar, choose "Import items..." from the File app
menu and select the file. Then double-click on the certificate and select always-trust in the Trust panel.
- Linux:
    Depending on your Linux distribution, you can use `trust`, `update-ca-certificates`
or another command to mark the generated root certificate as trusted.

#### TL;DR
Looking for something easier? Take a look to [mkcert](https://github.com/FiloSottile/mkcert) (requires Go).

Install it, then move into the https-localhost folder and run:
```
mkcert -install
mkcert -cert-file cert/localhost.crt -key-file cert/localhost.key localhost
```


### License
[AGPL-3.0](LICENSE)
