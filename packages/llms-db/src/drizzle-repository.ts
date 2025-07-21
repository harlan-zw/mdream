import type { R2Client } from './r2-storage.ts'
import type { LlmsRepository } from './repository.ts'
import type { Artifact, CrawledPage, LlmsEntry, NewArtifact, NewCrawledPage, NewLlmsEntry } from './schema.ts'
import type { CreateEntryOptions, DatabaseOptions } from './types.ts'
import { mkdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import Database from 'better-sqlite3'
import { desc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { dirname, join } from 'pathe'
import { createR2Client } from './r2-storage.ts'
import { artifacts, crawledPages, llmsEntries } from './schema.ts'

export function createDrizzleLlmsRepository(options: DatabaseOptions = {}): LlmsRepository {
  const isProduction = options.production || process.env.NODE_ENV === 'production'

  let sqlite: Database.Database | undefined
  let libsqlClient: ReturnType<typeof createClient> | undefined
  let db: ReturnType<typeof drizzle> | ReturnType<typeof drizzleLibsql>
  let r2Client: R2Client | undefined

  // Initialize R2 client for production
  if (isProduction) {
    try {
      r2Client = createR2Client()
      console.log('R2 client initialized for production artifact storage')
    }
    catch (error) {
      console.warn('R2 client initialization failed, falling back to local storage:', error)
    }
  }

  if (isProduction) {
    // Use libsql for production
    const url = options.databaseUrl || process.env.TURSO_DATABASE_URL || 'libsql://mdream-production-harlan-zw.aws-ap-northeast-1.turso.io'
    const authToken = options.authToken || process.env.TURSO_AUTH_TOKEN

    if (!authToken) {
      throw new Error('TURSO_AUTH_TOKEN is required for production database')
    }

    libsqlClient = createClient({
      url,
      authToken,
    })

    db = drizzleLibsql(libsqlClient)
  }
  else {
    // Use better-sqlite3 for local development
    const dbPath = options.dbPath || join(process.cwd(), '.mdream', 'llms.db')

    // Ensure directory exists before creating database
    mkdirSync(dirname(dbPath), { recursive: true })

    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')

    db = drizzle(sqlite)
    initializeSchema()
  }

  function initializeSchema() {
    if (!sqlite)
      return // Skip for production libsql

    // Create tables using direct SQL for initial setup (local development only)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS llms_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        description TEXT,
        site_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'crawling', 'completed', 'failed')),
        crawl_depth INTEGER DEFAULT 3 NOT NULL,
        max_pages INTEGER,
        exclude_patterns TEXT,
        artifacts_path TEXT,
        artifacts_size INTEGER,
        page_count INTEGER DEFAULT 0 NOT NULL,
        error_message TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_llms_entries_name ON llms_entries(name);

      CREATE TABLE IF NOT EXISTS crawled_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL REFERENCES llms_entries(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT,
        content_length INTEGER,
        crawled_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        success INTEGER DEFAULT 1 NOT NULL,
        error_message TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_crawled_pages_entry_url ON crawled_pages(entry_id, url);

      CREATE TABLE IF NOT EXISTS artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL REFERENCES llms_entries(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('llms.txt', 'llms-full.txt', 'markdown', 'archive')),
        file_path TEXT NOT NULL,
        file_size INTEGER,
        checksum TEXT,
        generated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS update_llms_entries_updated_at 
        AFTER UPDATE ON llms_entries
      BEGIN
        UPDATE llms_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `)
  }

  function parseEntry(entry: any): LlmsEntry {
    return {
      ...entry,
      excludePatterns: entry.excludePatterns ? JSON.parse(entry.excludePatterns) : undefined,
    } as LlmsEntry
  }

  return {
    async ensureDbDirectory(): Promise<void> {
      if (sqlite) {
        const dbPath = sqlite.name
        await mkdir(dirname(dbPath), { recursive: true })
      }
      // No-op for production libsql
    },

    async createEntry(options: CreateEntryOptions): Promise<LlmsEntry> {
      const entry: NewLlmsEntry = {
        name: options.name,
        url: options.url,
        description: options.description,
        siteName: options.siteName,
        crawlDepth: options.crawlDepth ?? 3,
        maxPages: options.maxPages,
        excludePatterns: options.excludePatterns ? JSON.stringify(options.excludePatterns) : null,
        status: 'pending',
        pageCount: 0,
      }

      const result = await db.insert(llmsEntries).values(entry).returning()
      return parseEntry(result[0])
    },

    async getEntry(id: number): Promise<LlmsEntry | undefined> {
      const result = await db.select().from(llmsEntries).where(eq(llmsEntries.id, id)).limit(1)
      return result[0] ? parseEntry(result[0]) : undefined
    },

    async getEntryByName(name: string): Promise<LlmsEntry | undefined> {
      const result = await db.select().from(llmsEntries).where(eq(llmsEntries.name, name)).limit(1)
      return result[0] ? parseEntry(result[0]) : undefined
    },

    async getEntryByUrl(url: string): Promise<LlmsEntry | undefined> {
      const result = await db.select().from(llmsEntries).where(eq(llmsEntries.url, url)).limit(1)
      return result[0] ? parseEntry(result[0]) : undefined
    },

    async getAllEntries(): Promise<LlmsEntry[]> {
      const result = await db.select().from(llmsEntries).orderBy(desc(llmsEntries.createdAt))
      return result.map(entry => parseEntry(entry))
    },

    async updateEntryStatus(id: number, status: LlmsEntry['status'], errorMessage?: string): Promise<void> {
      await db.update(llmsEntries)
        .set({ status, errorMessage: errorMessage ?? null })
        .where(eq(llmsEntries.id, id))
    },

    async updateEntryArtifacts(id: number, artifactsPath: string, artifactsSize: number, pageCount: number): Promise<void> {
      await db.update(llmsEntries)
        .set({ artifactsPath, artifactsSize, pageCount })
        .where(eq(llmsEntries.id, id))
    },

    async uploadArtifactToR2(entryName: string, fileName: string, data: Buffer): Promise<string | null> {
      if (!r2Client) {
        return null
      }

      try {
        const publicUrl = await r2Client.uploadArtifact(entryName, fileName, data)
        console.log(`Uploaded ${fileName} to R2: ${publicUrl}`)
        return publicUrl
      }
      catch (error) {
        console.error(`Failed to upload ${fileName} to R2:`, error)
        return null
      }
    },

    async deleteEntry(id: number): Promise<void> {
      await db.delete(llmsEntries).where(eq(llmsEntries.id, id))
    },

    async addCrawledPage(
      entryId: number,
      url: string,
      title?: string,
      contentLength?: number,
      success = true,
      errorMessage?: string,
    ): Promise<void> {
      const page: NewCrawledPage = {
        entryId,
        url,
        title: title ?? null,
        contentLength: contentLength ?? null,
        success,
        errorMessage: errorMessage ?? null,
      }

      await db.insert(crawledPages).values(page).onConflictDoUpdate({
        target: [crawledPages.entryId, crawledPages.url],
        set: {
          title: page.title,
          contentLength: page.contentLength,
          success: page.success,
          errorMessage: page.errorMessage,
          crawledAt: new Date().toISOString(),
        },
      })
    },

    async getCrawledPages(entryId: number): Promise<CrawledPage[]> {
      return await db.select().from(crawledPages).where(eq(crawledPages.entryId, entryId)).orderBy(desc(crawledPages.crawledAt))
    },

    async addArtifact(
      entryId: number,
      type: Artifact['type'],
      filePath: string,
      fileSize?: number,
      checksum?: string,
    ): Promise<void> {
      const artifact: NewArtifact = {
        entryId,
        type,
        filePath,
        fileSize: fileSize ?? null,
        checksum: checksum ?? null,
      }

      await db.insert(artifacts).values(artifact)
    },

    async addArtifactWithR2Upload(
      entryId: number,
      type: Artifact['type'],
      filePath: string,
      data: Buffer,
      fileSize?: number,
      checksum?: string,
    ): Promise<void> {
      let finalFilePath = filePath

      // If R2 is available and we're in production, upload to R2
      if (r2Client && isProduction) {
        const entry = await this.getEntry(entryId)
        if (entry) {
          const fileName = filePath.split('/').pop() || 'artifact'
          const r2Url = await this.uploadArtifactToR2(entry.name, fileName, data)
          if (r2Url) {
            finalFilePath = r2Url // Store the R2 URL instead of local path
          }
        }
      }

      const artifact: NewArtifact = {
        entryId,
        type,
        filePath: finalFilePath,
        fileSize: fileSize ?? null,
        checksum: checksum ?? null,
      }

      await db.insert(artifacts).values(artifact)
    },

    async getArtifacts(entryId: number): Promise<Artifact[]> {
      return await db.select().from(artifacts).where(eq(artifacts.entryId, entryId)).orderBy(desc(artifacts.generatedAt))
    },

    async generateLlmsTxt(): Promise<string> {
      const result = await db.select().from(llmsEntries).orderBy(desc(llmsEntries.createdAt))
      const entries = result.map(entry => parseEntry(entry))
      const completedEntries = entries.filter(entry => entry.status === 'completed')

      const lines = ['# Open Source Project Documentation']
      lines.push('')
      lines.push('A curated collection of open-source project documentation converted to LLMs.txt format.')
      lines.push('')

      for (const entry of completedEntries) {
        lines.push(`## ${entry.siteName || entry.name}`)

        if (entry.description) {
          lines.push(`${entry.description}`)
        }

        lines.push(`- URL: ${entry.url}`)
        lines.push(`- Pages: ${entry.pageCount}`)
        lines.push(`- Updated: ${new Date(entry.updatedAt).toISOString().split('T')[0]}`)

        if (entry.artifactsPath) {
          lines.push(`- Download: ${entry.artifactsPath}`)
        }

        lines.push('')
      }

      return lines.join('\n')
    },

    close(): void {
      if (sqlite) {
        sqlite.close()
      }
      if (libsqlClient) {
        libsqlClient.close()
      }
      // R2 client doesn't need explicit closing
    },
  }
}

// Factory function to create repository
export function createRepository(options?: DatabaseOptions): LlmsRepository {
  return createDrizzleLlmsRepository(options)
}
