# @mdream/llms-db

A CLI tool for managing a database of open-source project documentation converted to llms.txt format.

## Features

- **SQLite Database**: Store metadata about crawled sites with full history
- **Automated Crawling**: Integrates with @mdream/crawl for website processing
- **Artifact Management**: Automatically compress and store crawled files
- **llms.txt Generation**: Generate master llms.txt files from database entries
- **CLI Interface**: Simple command-line interface for managing entries

## Installation

```bash
pnpm install @mdream/llms-db
```

## Usage

### Run crawler on a URL

```bash
mdream-db run https://docs.example.com

# With options
mdream-db run https://docs.example.com --name "Example Docs" --description "Documentation for Example project"

# Force local mode (ignore production env vars)
mdream-db run https://docs.example.com --local
```

### Re-crawl an existing entry

```bash
mdream-db recrawl "Example Docs"
# or by ID
mdream-db recrawl 1
```

### List all entries

```bash
mdream-db list
```

### Generate master llms.txt

```bash
mdream-db generate
# or specify output path
mdream-db generate ./my-llms.txt
```

### Remove an entry

```bash
mdream-db remove "Example Docs"
```

## CLI Options

### `run` command

- `--name <name>`: Custom name for the entry (defaults to domain)
- `--description <desc>`: Description of the site
- `--depth <number>`: Crawl depth (default: 3)
- `--max-pages <number>`: Maximum pages to crawl
- `--exclude <pattern>`: Exclude URL patterns (can be used multiple times)
- `--output <dir>`: Output directory for crawled files
- `--local`: Force local mode (ignore production environment variables)

### `recrawl` command

- Accepts entry name or ID

## Architecture

The package uses a **repository pattern** with multiple storage backends:

- **Repository Interface**: `LlmsRepository` defines the contract for database operations
- **Drizzle Implementation**: `DrizzleLlmsRepository` provides SQLite/LibSQL implementation
- **Storage Implementation**: `LlmsStorageRepository` provides file-based storage using unstorage
- **Type Safety**: Full TypeScript support with schema inference
- **Migrations**: Managed through `drizzle-kit` for schema evolution

## Database Schema

### Drizzle Repository (SQLite/LibSQL)

The tool creates a database with the following tables:

- `llms_entries`: Main entries with metadata
- `crawled_pages`: Individual pages crawled for each entry
- `artifacts`: Generated files (llms.txt, archives, etc.)

### Storage Repository (File-based)

Uses unstorage for file-based key-value storage:

- `entries/`: Main entries stored as JSON files
- `pages/`: Individual pages for each entry
- `artifacts/`: Generated files metadata
- `meta/`: Metadata for lookups and counters

## Programmatic Usage

### Using Drizzle Repository (SQLite/LibSQL)

```typescript
import { createRepository } from '@mdream/llms-db'

// Local SQLite database
const repository = createRepository({ dbPath: './my-database.db' })

// Production LibSQL database (using environment variables)
// Automatically initializes R2 storage if credentials are available
const prodRepository = createRepository({ 
  production: true,
  authToken: process.env.TURSO_AUTH_TOKEN 
})

// Production LibSQL database (with explicit configuration)
const prodRepositoryExplicit = createRepository({
  production: true,
  authToken: 'your_auth_token_here'
})

// Create a new entry
const entry = await repository.createEntry({
  name: 'example-docs',
  url: 'https://docs.example.com',
  description: 'Example documentation'
})

// Update status
await repository.updateEntryStatus(entry.id, 'completed')

// Upload artifact to R2 (production only)
const archiveData = Buffer.from('archive content')
const r2Url = await repository.uploadArtifactToR2('my-project', 'archive.tar.gz', archiveData)

// Add artifact with automatic R2 upload (production only)
const llmsData = Buffer.from('llms.txt content')
await repository.addArtifactWithR2Upload(
  entry.id,
  'llms.txt',
  'llms.txt',
  llmsData,
  llmsData.length
)

// Generate llms.txt
const llmsTxt = await repository.generateLlmsTxt()
console.log(llmsTxt)

repository.close()
```

### Using Storage Repository (File-based)

```typescript
import { createStorageRepository } from '@mdream/llms-db'

const repository = createStorageRepository({ 
  dbPath: './my-storage' 
})

// Same API as drizzle repository
const entry = await repository.createEntry({
  name: 'example-docs',
  url: 'https://docs.example.com',
  description: 'Example documentation'
})

repository.close()
```

## Storage

### Local Development
- **Database**: `.mdream/llms.db` (SQLite)
- **File Storage**: `.mdream/llms-storage/` (unstorage)
- **Crawled files**: `.mdream/crawls/<entry-name>/`
- **Archives**: `.mdream/archives/<entry-name>.tar.gz`

### Production
- **Database**: LibSQL (Turso) at `libsql://mdream-production-harlan-zw.aws-ap-northeast-1.turso.io`
- **Authentication**: Requires `TURSO_AUTH_TOKEN` environment variable
- **Artifact Storage**: Cloudflare R2 (automatic upload in production mode)
- **R2 Integration**: Archives and llms.txt files are automatically uploaded to R2

## Environment Variables

### Database Configuration
- `NODE_ENV=production`: Automatically use production LibSQL database
- `TURSO_DATABASE_URL`: LibSQL database URL (e.g., `libsql://your-database.turso.io`)
- `TURSO_AUTH_TOKEN`: Required for production database access

### R2 Storage Configuration (Production)
- `R2_ACCESS_KEY_ID`: Your R2 access key ID
- `R2_SECRET_ACCESS_KEY`: Your R2 secret access key
- `R2_ACCOUNT_ID`: Your Cloudflare account ID
- `R2_BUCKET_NAME`: Your R2 bucket name
- `R2_ENDPOINT`: Your R2 endpoint URL
- `R2_PUBLIC_URL`: Your R2 public URL

### Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your configuration:
   ```bash
   # Database Configuration
   TURSO_DATABASE_URL=libsql://your-database.turso.io
   TURSO_AUTH_TOKEN=your_actual_token_here
   
   # R2 Storage Configuration (Production)
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_ACCOUNT_ID=your_account_id
   R2_BUCKET_NAME=your_bucket_name
   R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
   R2_PUBLIC_URL=https://your-public-url.r2.dev
   ```

3. Run commands with native Node.js dotenv support:
   ```bash
   # Database operations
   node --env-file=.env ./dist/cli.mjs
   
   # Drizzle commands
   pnpm db:generate  # Uses --env-file automatically
   pnpm db:migrate   # Uses --env-file automatically
   pnpm db:studio    # Uses --env-file automatically
   ```

### Native dotenv Support

This package uses Node.js native dotenv support (available since Node.js 20.6.0) via the `--env-file` flag instead of the `dotenv` package. This provides better performance and reduces dependencies.

## R2 Storage Integration

The package includes built-in support for Cloudflare R2 object storage for artifact management:

### Automatic R2 Integration (Production)

When running in production mode (`NODE_ENV=production` or `production: true`), the drizzle repository automatically:

1. **Initializes R2 Client**: If R2 environment variables are configured, an R2 client is automatically created
2. **Uploads Artifacts**: When using `addArtifactWithR2Upload()`, artifacts are automatically uploaded to R2
3. **Stores Public URLs**: The database stores the public R2 URL instead of local file paths
4. **Fallback Behavior**: If R2 is not configured, it falls back to local storage without errors

```typescript
// Production repository automatically uses R2 if configured
const repository = createRepository({ production: true })

// This will upload to R2 in production, local storage in development
const archiveData = Buffer.from('archive content')
await repository.addArtifactWithR2Upload(
  entryId,
  'archive',
  'project.tar.gz',
  archiveData,
  archiveData.length
)
```

### Manual R2 Setup

```typescript
import { createR2Client } from '@mdream/llms-db'

const r2Client = createR2Client({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  accountId: process.env.R2_ACCOUNT_ID,
  bucketName: process.env.R2_BUCKET_NAME,
  endpoint: process.env.R2_ENDPOINT,
  publicUrl: process.env.R2_PUBLIC_URL,
})

// Upload an artifact
const publicUrl = await r2Client.uploadArtifact('my-project', 'docs.tar.gz', archiveBuffer)

// Download an artifact
const data = await r2Client.downloadArtifact('my-project', 'docs.tar.gz')

// Get public URL
const url = r2Client.getPublicUrl('my-project', 'docs.tar.gz')
```

### Environment Variables

Add these to your `.env` file:

```bash
# Cloudflare R2 Configuration
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_ACCOUNT_ID=your_account_id
R2_BUCKET_NAME=your_bucket_name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://your-public-url.r2.dev
```
