import type { Artifact, CrawledPage, LlmsEntry } from './schema.ts'
import type { CreateEntryOptions } from './types.ts'

// Repository interface defining the contract
export interface LlmsRepository {
  // Entry operations
  createEntry: (options: CreateEntryOptions) => Promise<LlmsEntry>
  getEntry: (id: number) => Promise<LlmsEntry | undefined>
  getEntryByName: (name: string) => Promise<LlmsEntry | undefined>
  getEntryByUrl: (url: string) => Promise<LlmsEntry | undefined>
  getAllEntries: () => Promise<LlmsEntry[]>
  updateEntryStatus: (id: number, status: LlmsEntry['status'], errorMessage?: string) => Promise<void>
  updateEntryArtifacts: (id: number, artifactsPath: string, artifactsSize: number, pageCount: number) => Promise<void>
  deleteEntry: (id: number) => Promise<void>

  // Crawled pages operations
  addCrawledPage: (entryId: number, url: string, title?: string, contentLength?: number, success?: boolean, errorMessage?: string) => Promise<void>
  getCrawledPages: (entryId: number) => Promise<CrawledPage[]>

  // Artifacts operations
  addArtifact: (entryId: number, type: Artifact['type'], filePath: string, fileSize?: number, checksum?: string) => Promise<void>
  addArtifactWithR2Upload: (entryId: number, type: Artifact['type'], filePath: string, data: Buffer, fileSize?: number, checksum?: string) => Promise<void>
  uploadArtifactToR2: (entryName: string, fileName: string, data: Buffer) => Promise<string | null>
  getArtifacts: (entryId: number) => Promise<Artifact[]>

  // Utility operations
  generateLlmsTxt: () => Promise<string>
  ensureDbDirectory: () => Promise<void>
  close: () => void
}
