import { z } from 'zod'

export const GeneratePreviewRequestSchema = z.object({
  overwrite: z.boolean().optional().default(false),
  count: z.number().int().min(1).max(100).optional().default(5),
})
export type GeneratePreviewRequest = z.infer<typeof GeneratePreviewRequestSchema>

export const GeneratePreviewResultSchema = z.object({
  generated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  correlationId: z.string(),
  sampleIds: z.array(z.string()).max(10),
})
export type GeneratePreviewResult = z.infer<typeof GeneratePreviewResultSchema>
