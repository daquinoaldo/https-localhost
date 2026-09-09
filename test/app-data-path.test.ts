import assert from "node:assert"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, it } from "node:test"

import { getAppDataPath } from "../src/app-data-path.ts"

describe("app-data-path", () => {
  const originalAppData = process.env["APPDATA"]

  afterEach(() => {
    if (originalAppData === undefined) {
      delete process.env["APPDATA"]
    } else {
      process.env["APPDATA"] = originalAppData
    }
  })

  it("returns base directory when no app name is supplied", () => {
    delete process.env["APPDATA"]
    const basePath = getAppDataPath()
    assert.ok(typeof basePath === "string" && basePath.length > 0)
  })

  it("resolves app directory under platform base path", () => {
    delete process.env["APPDATA"]
    const appPath = getAppDataPath("https-localhost")
    const home = os.homedir()

    switch (os.platform()) {
      case "darwin":
        assert.strictEqual(
          appPath,
          path.join(home, "Library", "Application Support", "https-localhost"),
        )
        break
      case "win32":
        assert.strictEqual(appPath, path.join(home, "AppData", "Roaming", "https-localhost"))
        break
      default:
        assert.strictEqual(appPath, path.join(home, ".config", "https-localhost"))
    }
  })

  it("prefers APPDATA environment variable when defined", () => {
    process.env["APPDATA"] = "/tmp/custom-app-data"
    assert.strictEqual(getAppDataPath(), "/tmp/custom-app-data")
    assert.strictEqual(
      getAppDataPath("https-localhost"),
      path.join("/tmp/custom-app-data", "https-localhost"),
    )
  })
})
