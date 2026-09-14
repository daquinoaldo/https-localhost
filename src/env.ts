import { z } from "zod"

export const envSchema = z.object({
  PORT: z.coerce.number().min(1).max(65535).default(443),
  HOST: z.string().default("localhost"),
  CERT_PATH: z.string().optional(),
  REINSTALL: z
    .union([z.boolean(), z.string().transform(v => v === "true" || v === "1")])
    .default(false),
  PROXY_TARGET: z
    .url()
    .refine(v => v.startsWith("http:") || v.startsWith("https:"), {
      message: "PROXY_TARGET must be an http or https URL",
    })
    .optional(),
})

export type Env = z.infer<typeof envSchema>

export function getEnv(overrides: Record<string, unknown> = {}): Env {
  const merged: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      merged[key] = value
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      merged[key] = value
    }
  }
  return envSchema.parse(merged)
}
