const exec = require("child_process").exec

// noinspection FallThroughInSwitchStatementJS
switch (process.platform) {
  case "darwin": // MacOS
    console.log("\n----------------------------------------------\n" +
                  "Please input your sudo password when required.\n" +
                  "----------------------------------------------\n")
    exec("bash cert/generate.sh", (error, stdout, stderr) => {
      console.log(stdout)
      console.error(stderr)
      if (error !== null) console.error(`exec error: ${error}`)
    })
    break
  case "linux":
    console.warn("Cannot generate the localhost certificate on linux yet. " +
      "Coming soon.")
    process.exit(0)
  case "win32":
    console.warn("Cannot generate the localhost certificate on Windows.")
    process.exit(0)
  case "freebsd":
    console.warn("Cannot generate the localhost certificate on freebsd. " +
      "Help wanted.")
    process.exit(0)
  case "sunos":
    console.warn("Cannot generate the localhost certificate on sunos. " +
      "Help wanted.")
    process.exit(0)
  default:
    console.warn("Cannot generate the localhost certificate on your " +
      "platform. Contact the developer.")
    process.exit(0)
}
