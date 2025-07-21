import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const llmsEntries = sqliteTable('llms_entries', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  description: text('description'),
  siteName: text('site_name'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  status: text('status', {
    enum: ['pending', 'crawling', 'completed', 'failed'],
  }).default('pending').notNull(),
  crawlDepth: integer('crawl_depth').default(3).notNull(),
  maxPages: integer('max_pages'),
  excludePatterns: text('exclude_patterns'), // JSON array as string
  artifactsPath: text('artifacts_path'),
  artifactsSize: integer('artifacts_size'),
  pageCount: integer('page_count').default(0).notNull(),
  errorMessage: text('error_message'),
}, table => ({
  nameIdx: uniqueIndex('idx_llms_entries_name').on(table.name),
}))

export const crawledPages = sqliteTable('crawled_pages', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  entryId: integer('entry_id').notNull().references(() => llmsEntries.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title'),
  contentLength: integer('content_length'),
  crawledAt: text('crawled_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  success: integer('success', { mode: 'boolean' }).default(true).notNull(),
  errorMessage: text('error_message'),
}, table => ({
  entryUrlIdx: uniqueIndex('idx_crawled_pages_entry_url').on(table.entryId, table.url),
}))

export const artifacts = sqliteTable('artifacts', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  entryId: integer('entry_id').notNull().references(() => llmsEntries.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['llms.txt', 'llms-full.txt', 'markdown', 'archive'],
  }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  checksum: text('checksum'),
  generatedAt: text('generated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

// Add trigger for updating updated_at timestamp
export const updateTimestampTrigger = sql`
CREATE TRIGGER IF NOT EXISTS update_llms_entries_updated_at 
  AFTER UPDATE ON llms_entries
BEGIN
  UPDATE llms_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`

// Export types inferred from schema
export type LlmsEntry = typeof llmsEntries.$inferSelect & {
  excludePatterns?: string[]
}
export type NewLlmsEntry = typeof llmsEntries.$inferInsert
export type CrawledPage = typeof crawledPages.$inferSelect
export type NewCrawledPage = typeof crawledPages.$inferInsert
export type Artifact = typeof artifacts.$inferSelect
export type NewArtifact = typeof artifacts.$inferInsert
