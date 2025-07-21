import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export interface R2Config {
  accessKeyId: string
  secretAccessKey: string
  accountId: string
  bucketName: string
  endpoint: string
  publicUrl: string
}

export function createR2Client(config?: Partial<R2Config>): R2Client {
  const r2Config: R2Config = {
    accessKeyId: config?.accessKeyId || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: config?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '',
    accountId: config?.accountId || process.env.R2_ACCOUNT_ID || '',
    bucketName: config?.bucketName || process.env.R2_BUCKET_NAME || '',
    endpoint: config?.endpoint || process.env.R2_ENDPOINT || '',
    publicUrl: config?.publicUrl || process.env.R2_PUBLIC_URL || '',
  }

  // Validate required config
  if (!r2Config.accessKeyId || !r2Config.secretAccessKey) {
    throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required')
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
  })

  return {
    async uploadArtifact(entryName: string, fileName: string, data: Buffer | Uint8Array): Promise<string> {
      const key = `artifacts/${entryName}/${fileName}`

      await s3Client.send(new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: key,
        Body: data,
        ContentType: getContentType(fileName),
      }))

      return `${r2Config.publicUrl}/${key}`
    },

    async downloadArtifact(entryName: string, fileName: string): Promise<Buffer> {
      const key = `artifacts/${entryName}/${fileName}`

      const response = await s3Client.send(new GetObjectCommand({
        Bucket: r2Config.bucketName,
        Key: key,
      }))

      if (!response.Body) {
        throw new Error(`Artifact not found: ${key}`)
      }

      return Buffer.from(await response.Body.transformToByteArray())
    },

    async deleteArtifact(entryName: string, fileName: string): Promise<void> {
      const key = `artifacts/${entryName}/${fileName}`

      await s3Client.send(new DeleteObjectCommand({
        Bucket: r2Config.bucketName,
        Key: key,
      }))
    },

    async uploadArchive(entryName: string, archiveData: Buffer): Promise<string> {
      const fileName = `${entryName}.tar.gz`
      return await this.uploadArtifact(entryName, fileName, archiveData)
    },

    getPublicUrl(entryName: string, fileName: string): string {
      return `${r2Config.publicUrl}/artifacts/${entryName}/${fileName}`
    },

    getConfig(): R2Config {
      return { ...r2Config }
    },
  }
}

export interface R2Client {
  uploadArtifact: (entryName: string, fileName: string, data: Buffer | Uint8Array) => Promise<string>
  downloadArtifact: (entryName: string, fileName: string) => Promise<Buffer>
  deleteArtifact: (entryName: string, fileName: string) => Promise<void>
  uploadArchive: (entryName: string, archiveData: Buffer) => Promise<string>
  getPublicUrl: (entryName: string, fileName: string) => string
  getConfig: () => R2Config
}

function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'txt':
      return 'text/plain'
    case 'json':
      return 'application/json'
    case 'gz':
    case 'tar':
      return 'application/gzip'
    case 'zip':
      return 'application/zip'
    case 'pdf':
      return 'application/pdf'
    case 'md':
      return 'text/markdown'
    default:
      return 'application/octet-stream'
  }
}
