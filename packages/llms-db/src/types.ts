// Re-export Drizzle inferred types
export type {
  Artifact,
  CrawledPage,
  LlmsEntry,
  NewArtifact,
  NewCrawledPage,
  NewLlmsEntry,
} from './schema.ts'

// Additional interfaces for the application
export interface CreateEntryOptions {
  name: string
  url: string
  description?: string
  siteName?: string
  crawlDepth?: number
  maxPages?: number
  excludePatterns?: string[]
}

export interface DatabaseOptions {
  dbPath?: string
  production?: boolean
  authToken?: string
  databaseUrl?: string
}

export interface CrawlResult {
  success: boolean
  url: string
  title?: string
  content_length?: number
  error?: string
}
