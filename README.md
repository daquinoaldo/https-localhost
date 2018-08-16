# HTTPS server running on localhost
Run an express server on localhost with HTTP2 and SSL for free.

Serve static files or import as module in your project


### Install and trust the certificate
Add the root certificate we just generated to your list of trusted certificates.
This step depends on the operating system you're running:

- Mac OS: open Keychain Access, choose System from the left navigation bar, choose "Import items..." from the File app
menu and select the file. Then double-click on the certificate and select always-trust in the Trust panel.

- Linux: Depending on your Linux distribution, you can use `trust`, `update-ca-certificates` or another command to mark
the generated root certificate as trusted.


### Run

#### Use standalone
From terminal navigate into the folder and run `sudo npm install -g` to install this tool globally.

Then serve static file with `sudo serve <static-path>`.


#### Use as module
Install the dependency with `npm install -s https-localhost`.  
Then just require this module, it will start the server automatically.

For example, put in your index.js file:
```
const app = require('https-localhost')
app.get('/', (req, res) => res.send('Hello World!'))
```

---

### License
[AGPL-3.0](LICENSE)