import os from "node:os"
import path from "node:path"

function getAppDataPath(app?: string): string {
  const home = os.homedir()
  let appDataPath = process.env["APPDATA"]

  if (appDataPath === undefined) {
    switch (os.platform()) {
      case "win32":
        appDataPath = path.join(home, "AppData", "Roaming")
        break
      case "darwin":
        appDataPath = path.join(home, "Library", "Application Support")
        break
      default:
        appDataPath = path.join(home, ".config")
    }
  }

  if (app === undefined) return appDataPath
  return path.join(appDataPath, appDataPath === home ? `.${app}` : app)
}

export { getAppDataPath }
