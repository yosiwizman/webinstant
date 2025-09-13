import { z } from 'zod'

// Legacy (admin/businesses) preview batch
export const LegacyGeneratePreviewRequestSchema = z.object({
  overwrite: z.boolean().optional().default(false),
  count: z.number().int().min(1).max(100).optional().default(5),
})
export type LegacyGeneratePreviewRequest = z.infer<typeof LegacyGeneratePreviewRequestSchema>

export const LegacyGeneratePreviewResultSchema = z.object({
  generated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  correlationId: z.string(),
  sampleIds: z.array(z.string()).max(10),
})
export type LegacyGeneratePreviewResult = z.infer<typeof LegacyGeneratePreviewResultSchema>

// Back-compat exports expected by /api/generate-preview (batch 5)
export const GeneratePreviewRequestSchema = LegacyGeneratePreviewRequestSchema
export type GeneratePreviewRequest = LegacyGeneratePreviewRequest
export const GeneratePreviewResultSchema = LegacyGeneratePreviewResultSchema
export type GeneratePreviewResult = LegacyGeneratePreviewResult

// CSV → Preview (contracts-first) — scoped names to avoid conflicts with legacy
export const GeneratePreviewCSVRequestSchema = z.object({
  csvId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(5).optional(),
  overwrite: z.boolean().default(false).optional(),
})
export type GeneratePreviewCSVRequest = z.infer<typeof GeneratePreviewCSVRequestSchema>

export const GeneratePreviewCSVResponseSchema = z.object({
  counts: z.object({
    generated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  correlationId: z.string().min(1),
})
export type GeneratePreviewResponse = z.infer<typeof GeneratePreviewCSVResponseSchema>

export const WebsitePreviewSchema = z.object({
  id: z.string().uuid(),
  source_csv_id: z.string(),
  row_idx: z.number().int().nonnegative(),
  url: z.string().url(),
  html_content: z.string().nullable(),
  summary: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type WebsitePreview = z.infer<typeof WebsitePreviewSchema>

// ==========================
// Draft → SEO Meta & Media
// ==========================

export const GenerateSeoMediaRequestSchema = z.object({
  csvId: z.string().min(1),
  limit: z.number().int().positive().max(20).default(5).optional(),
  overwrite: z.boolean().default(false).optional(), // if false, preserve existing seo/media
})
export type GenerateSeoMediaRequest = z.infer<typeof GenerateSeoMediaRequestSchema>

export const GenerateSeoMediaResponseSchema = z.object({
  counts: z.object({
    updatedSeo: z.number().int().nonnegative(),
    createdMedia: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  correlationId: z.string().min(1),
})
export type GenerateSeoMediaResponse = z.infer<typeof GenerateSeoMediaResponseSchema>

// Extend WebsiteArticle with SEO fields (non-destructive)
export const WebsiteArticleSchema = z.object({
  id: z.string().uuid(),
  preview_id: z.string().uuid(),
  outline_json: z.any().nullable(),
  draft_html: z.string().nullable(),
  model_used: z.string().nullable(),
  quality_score: z.number().nullable(),
  // New SEO fields
  seo_title: z.string().nullable().optional(),
  seo_slug: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type WebsiteArticle = z.infer<typeof WebsiteArticleSchema>

// Website media row
export const WebsiteMediaSchema = z.object({
  id: z.string().uuid(),
  article_id: z.string().uuid(),
  kind: z.string(),
  url: z.string().url(),
  alt: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  created_at: z.string(),
})
export type WebsiteMedia = z.infer<typeof WebsiteMediaSchema>
