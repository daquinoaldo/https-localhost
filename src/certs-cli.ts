#!/usr/bin/env node

import { generate, remove } from "./certs.ts"

if (process.argv.length === 3 && (process.argv[2] === "-u" || process.argv[2] === "--uninstall")) {
  remove()
  console.info("Certificates removed.")
} else {
  generate().catch(error => console.error("\nExec error: " + error))
}
