const TRAILING_SLASH_RE = /\/$/
const WWW_PREFIX_RE = /^www\./
const SPECIAL_CHARS_RE = /[^\w\s-]/g
const WHITESPACE_RE = /\s+/g

export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  }
  catch {
    return false
  }
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // Remove trailing slash and normalize
    return urlObj.href.replace(TRAILING_SLASH_RE, '')
  }
  catch {
    throw new Error(`Invalid URL: ${url}`)
  }
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(WWW_PREFIX_RE, '')
  }
  catch {
    throw new Error(`Invalid URL: ${url}`)
  }
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(SPECIAL_CHARS_RE, '') // Remove special characters
    .replace(WHITESPACE_RE, '-') // Replace spaces with hyphens
    .toLowerCase()
}
