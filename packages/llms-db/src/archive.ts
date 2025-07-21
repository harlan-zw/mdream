import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { join, relative } from 'pathe'

export async function createArchive(sourceDir: string, entryName: string): Promise<string> {
  const archiveDir = join(process.cwd(), '.mdream', 'archives')
  const archivePath = join(archiveDir, `${entryName}.tar.gz`)

  // Ensure archive directory exists
  await mkdir(archiveDir, { recursive: true })

  // Create a simple directory archive using tar-like format
  const writeStream = createWriteStream(archivePath)
  const gzipStream = createGzip({ level: 9 })

  // Simple tar-like format: just concatenate files with headers
  const files = await getAllFiles(sourceDir)
  const archive = new ArchiveBuilder()

  for (const file of files) {
    const relativePath = relative(sourceDir, file)
    const content = await readFile(file)
    archive.addFile(relativePath, content)
  }

  const archiveBuffer = archive.build()

  await pipeline(
    Readable.from([archiveBuffer]),
    gzipStream,
    writeStream,
  )

  return archivePath
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
      }
      else {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files
}

class ArchiveBuilder {
  private files: Array<{ path: string, content: Buffer }> = []

  addFile(path: string, content: Buffer) {
    this.files.push({ path, content })
  }

  build(): Buffer {
    const chunks: Buffer[] = []

    for (const file of this.files) {
      // Simple format: [path_length][path][content_length][content]
      const pathBuffer = Buffer.from(file.path, 'utf8')
      const pathLengthBuffer = Buffer.alloc(4)
      pathLengthBuffer.writeUInt32BE(pathBuffer.length)

      const contentLengthBuffer = Buffer.alloc(4)
      contentLengthBuffer.writeUInt32BE(file.content.length)

      chunks.push(pathLengthBuffer, pathBuffer, contentLengthBuffer, file.content)
    }

    return Buffer.concat(chunks)
  }
}

export function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
