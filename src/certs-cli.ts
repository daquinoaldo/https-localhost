#!/usr/bin/env node

import { parseArgs } from "node:util"

import { generate, remove } from "./certs.ts"

const parsedArgs = parseArgs({
  args: process.argv.slice(2),
  options: {
    uninstall: { type: "boolean", short: "u" },
  },
})

async function runCertsCli(): Promise<void> {
  if (parsedArgs.values.uninstall === true) {
    remove()
    console.info("Certificates removed.")
    return
  }
  try {
    await generate()
  } catch (error: unknown) {
    console.error(`\nExec error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

void runCertsCli()
