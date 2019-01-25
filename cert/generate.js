const exec = require("child_process").exec

// noinspection FallThroughInSwitchStatementJS
if (process.platform === "darwin" || process.platform === "linux") {
  console.log("\n----------------------------------------------\n" +
                "Please input your sudo password if required.\n" +
                "----------------------------------------------\n")
  exec("bash cert/generate.sh", (error, stdout, stderr) => {
    console.log(stdout)
    console.error(stderr)
    if (error !== null) console.error(`exec error: ${error}`)
  })
} else {
  console.warn("Cannot generate the localhost certificate on your " +
      "platform. Contact the developer if you can help.")
  process.exit(0)
}
