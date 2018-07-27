# HTTPS server running on localhost

### Install and trust the certificate
Add the root certificate we just generated to your list of trusted certificates.
This step depends on the operating system you're running:
- Mac OS: open Keychain Access, choose System from the left navigation bar, choose "Import items..." from the File app
menu and select the file. Then double-click on the certificate and select always-trust in the Trust panel.
- Linux: Depending on your Linux distribution, you can use `trust`, `update-ca-certificates` or another command to mark
the generated root certificate as trusted.

### Run
1. Edit [server.js](server.js):
    - serve static files with `app.use(express.static('<path-to-serve>'))`
    - use express as backend, i.e.: `app.get('/', (req, res) => res.send('Hello World!'))`
2. Install dependency with `npm install`
3. Run with `sudo npm start` or `sudo node serve.js` (root required to use port 443)

### License
[AGPL-3.0](LICENSE)

**Thanks to:** [Daksh Shah](https://github.com/dakshshah96)