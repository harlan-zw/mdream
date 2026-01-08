import type { LlmsRepository } from './repository.ts'
import type { Artifact, CrawledPage, LlmsEntry } from './schema.ts'
import type { CreateEntryOptions, DatabaseOptions } from './types.ts'
import { mkdir } from 'node:fs/promises'
import { join } from 'pathe'
import { createStorage, prefixStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

// Internal storage type matching schema structure
type StoredLlmsEntry = Omit<LlmsEntry, 'excludePatterns'> & {
  excludePatterns: string | null
}

export function createLlmsStorageRepository(options: DatabaseOptions = {}): LlmsRepository {
  const storagePath = options.dbPath || join(process.cwd(), '.mdream', 'llms-storage')

  const storage = createStorage({
    driver: fsDriver({
      base: storagePath,
      ignore: ['*.tmp', '*.log'],
    }),
  })

  // Create namespaced storage instances
  const entriesStorage = prefixStorage(storage, 'entries')
  const pagesStorage = prefixStorage(storage, 'pages')
  const artifactsStorage = prefixStorage(storage, 'artifacts')
  const metaStorage = prefixStorage(storage, 'meta')

  // Helper functions
  async function generateNextId(): Promise<number> {
    const currentId = (await metaStorage.getItem('nextId') as number) || 0
    const nextId = currentId + 1
    await metaStorage.setItem('nextId', nextId)
    return nextId
  }

  async function generateNextPageId(): Promise<number> {
    const currentId = (await metaStorage.getItem('nextPageId') as number) || 0
    const nextId = currentId + 1
    await metaStorage.setItem('nextPageId', nextId)
    return nextId
  }

  async function generateNextArtifactId(): Promise<number> {
    const currentId = (await metaStorage.getItem('nextArtifactId') as number) || 0
    const nextId = currentId + 1
    await metaStorage.setItem('nextArtifactId', nextId)
    return nextId
  }

  function parseStoredEntry(entry: StoredLlmsEntry): LlmsEntry {
    return {
      ...entry,
      excludePatterns: entry.excludePatterns ? JSON.parse(entry.excludePatterns) : undefined,
    }
  }

  // Return the repository implementation
  return {
    async ensureDbDirectory(): Promise<void> {
      await mkdir(storagePath, { recursive: true })
    },

    async createEntry(options: CreateEntryOptions): Promise<LlmsEntry> {
      const id = await generateNextId()
      const now = new Date().toISOString()

      const storedEntry: StoredLlmsEntry = {
        id,
        name: options.name,
        url: options.url,
        description: options.description || null,
        siteName: options.siteName || null,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
        crawlDepth: options.crawlDepth ?? 3,
        maxPages: options.maxPages || null,
        excludePatterns: options.excludePatterns ? JSON.stringify(options.excludePatterns) : null,
        artifactsPath: null,
        artifactsSize: null,
        pageCount: 0,
        errorMessage: null,
      }

      await entriesStorage.setItem(id.toString(), storedEntry)
      await metaStorage.setItem(`name:${options.name}`, id)
      await metaStorage.setItem(`url:${options.url}`, id)

      return parseStoredEntry(storedEntry)
    },

    async getEntry(id: number): Promise<LlmsEntry | undefined> {
      const entry = await entriesStorage.getItem(id.toString()) as StoredLlmsEntry | null
      return entry ? parseStoredEntry(entry) : undefined
    },

    async getEntryByName(name: string): Promise<LlmsEntry | undefined> {
      const id = await metaStorage.getItem(`name:${name}`)
      if (!id)
        return undefined
      const entry = await entriesStorage.getItem((id as number).toString()) as StoredLlmsEntry | null
      return entry ? parseStoredEntry(entry) : undefined
    },

    async getEntryByUrl(url: string): Promise<LlmsEntry | undefined> {
      const id = await metaStorage.getItem(`url:${url}`)
      if (!id)
        return undefined
      const entry = await entriesStorage.getItem((id as number).toString()) as StoredLlmsEntry | null
      return entry ? parseStoredEntry(entry) : undefined
    },

    async getAllEntries(): Promise<LlmsEntry[]> {
      const keys = await entriesStorage.getKeys()
      const entries = await Promise.all(
        keys.map(key => entriesStorage.getItem(key)),
      )

      return entries
        .filter((entry): entry is StoredLlmsEntry => entry !== null)
        .map(entry => parseStoredEntry(entry))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },

    async updateEntryStatus(id: number, status: LlmsEntry['status'], errorMessage?: string): Promise<void> {
      const entry = await entriesStorage.getItem(id.toString()) as StoredLlmsEntry | null
      if (!entry)
        return

      const updatedEntry: StoredLlmsEntry = {
        ...entry,
        status,
        errorMessage: errorMessage || null,
        updatedAt: new Date().toISOString(),
      }

      await entriesStorage.setItem(id.toString(), updatedEntry)
    },

    async updateEntryArtifacts(id: number, artifactsPath: string, artifactsSize: number, pageCount: number): Promise<void> {
      const entry = await entriesStorage.getItem(id.toString()) as StoredLlmsEntry | null
      if (!entry)
        return

      const updatedEntry: StoredLlmsEntry = {
        ...entry,
        artifactsPath,
        artifactsSize,
        pageCount,
        updatedAt: new Date().toISOString(),
      }

      await entriesStorage.setItem(id.toString(), updatedEntry)
    },

    async deleteEntry(id: number): Promise<void> {
      const entry = await entriesStorage.getItem(id.toString()) as StoredLlmsEntry | null
      if (!entry)
        return

      // Remove from main storage
      await entriesStorage.removeItem(id.toString())

      // Remove metadata
      await metaStorage.removeItem(`name:${entry.name}`)
      await metaStorage.removeItem(`url:${entry.url}`)

      // Remove related pages
      const pageKeys = await pagesStorage.getKeys()
      const entryPageKeys = pageKeys.filter(key => key.startsWith(`${id}:`))
      await Promise.all(entryPageKeys.map(key => pagesStorage.removeItem(key)))

      // Remove related artifacts
      const artifactKeys = await artifactsStorage.getKeys()
      const entryArtifactKeys = artifactKeys.filter(key => key.startsWith(`${id}:`))
      await Promise.all(entryArtifactKeys.map(key => artifactsStorage.removeItem(key)))
    },

    async addCrawledPage(
      entryId: number,
      url: string,
      title?: string,
      contentLength?: number,
      success = true,
      errorMessage?: string,
    ): Promise<void> {
      const pageId = await generateNextPageId()
      const now = new Date().toISOString()

      const page: CrawledPage = {
        id: pageId,
        entryId,
        url,
        title: title || null,
        contentLength: contentLength || null,
        crawledAt: now,
        success,
        errorMessage: errorMessage || null,
      }

      // Use compound key: entryId:pageId
      await pagesStorage.setItem(`${entryId}:${pageId}`, page)

      // Also create a URL-based key for deduplication
      await pagesStorage.setItem(`url:${entryId}:${url}`, pageId)
    },

    async getCrawledPages(entryId: number): Promise<CrawledPage[]> {
      const keys = await pagesStorage.getKeys()
      const entryPageKeys = keys.filter(key =>
        key.startsWith(`${entryId}:`) && !key.startsWith(`url:`),
      )

      const pages = await Promise.all(
        entryPageKeys.map(key => pagesStorage.getItem(key)),
      )

      return pages
        .filter((page): page is CrawledPage => page !== null)
        .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime())
    },

    async addArtifact(
      entryId: number,
      type: Artifact['type'],
      filePath: string,
      fileSize?: number,
      checksum?: string,
    ): Promise<void> {
      const artifactId = await generateNextArtifactId()
      const now = new Date().toISOString()

      const artifact: Artifact = {
        id: artifactId,
        entryId,
        type,
        filePath,
        fileSize: fileSize || null,
        checksum: checksum || null,
        generatedAt: now,
      }

      await artifactsStorage.setItem(`${entryId}:${artifactId}`, artifact)
    },

    async addArtifactWithR2Upload(
      entryId: number,
      type: Artifact['type'],
      filePath: string,
      data: Buffer,
      fileSize?: number,
      checksum?: string,
    ): Promise<void> {
      // For storage repository, we don't support R2 uploads
      // Just add the artifact with the local path
      await this.addArtifact(entryId, type, filePath, fileSize, checksum)
    },

    async uploadArtifactToR2(_entryName: string, _fileName: string, _data: Buffer): Promise<string | null> {
      // Storage repository doesn't support R2 uploads
      console.warn('R2 upload not supported in storage repository')
      return null
    },

    async getArtifacts(entryId: number): Promise<Artifact[]> {
      const keys = await artifactsStorage.getKeys()
      const entryArtifactKeys = keys.filter(key => key.startsWith(`${entryId}:`))

      const artifacts = await Promise.all(
        entryArtifactKeys.map(key => artifactsStorage.getItem(key)),
      )

      return artifacts
        .filter((artifact): artifact is Artifact => artifact !== null)
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    },

    async generateLlmsTxt(): Promise<string> {
      const keys = await entriesStorage.getKeys()
      const entries = await Promise.all(
        keys.map(key => entriesStorage.getItem(key)),
      )

      const allEntries = entries
        .filter((entry): entry is StoredLlmsEntry => entry !== null)
        .map(entry => parseStoredEntry(entry))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const completedEntries = allEntries.filter(entry => entry.status === 'completed')

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
      // unstorage doesn't require explicit cleanup
    },
  }
}

export function createStorageRepository(options?: DatabaseOptions): LlmsRepository {
  return createLlmsStorageRepository(options)
}
