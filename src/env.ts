import z from "zod"

export const envSchema = z.object({
  PORT: z.coerce.number().min(1).max(65535).default(443),
  HOST: z.string().default("localhost"),
  CERT_PATH: z.string().optional(),
  REINSTALL: z
    .union([z.boolean(), z.string().transform(v => v === "true" || v === "1")])
    .default(false),
})

export type Env = z.infer<typeof envSchema>

export const getEnv = (overrides: Record<string, unknown> = {}): Env => {
  const merged: Record<string, unknown> = { ...process.env }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) merged[key] = value
  }
  return envSchema.parse(merged)
}
