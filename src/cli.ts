import HttpsLocalhost from "./HttpsLocalhost"


// TODO: here or in index?
(process as NodeJS.EventEmitter).on("uncaughtException", err => {
  switch (err.code) {
    case "EACCES":
      console.error(
        "EACCES: run as administrator to use the default ports 443 and 80. " +
        "You can also change port with: `PORT=4433 serve ~/myproj`.")
      break
    case "EADDRINUSE":
      console.error("EADDRINUSE: another service on your machine is using " +
        "the current port.\nStop it or change port with:" +
        "`PORT=4433 serve ~/myproj`.")
      break
    default:
      console.error("Unexpected error " + err.code + ":\n\n" + err)
      break
  }
  process.exit(1)
})



if (require.main === module) {
  new HttpsLocalhost().serve()
}