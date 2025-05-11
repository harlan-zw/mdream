import { normalizeURL } from 'ufo'

export function getPathWithoutFramework(path: string, replacement = ''): string {
  // remove framework slug from path, i.e vue, typescript, etc
  path = path.replace(/\/(vue|typescript|react|svelte|solid-js|angular|nuxt)/g, `/${replacement}`)
  path = normalizeURL(path).replaceAll('//', '/')
  return path
}

export function getPathFramework(path: string): string {
  // get framework slug from path, i.e vue, typescript, etc
  const match = path.match(/\/(vue|typescript|react|svelte|solid-js|angular|nuxt)/)
  return match ? match[1] : ''
}

export function getPathWithFramework(path: string, framework = ''): string {
  const without = getPathWithoutFramework(path)
  return without.replace('/docs/', `/docs/${framework}/`)
}

export function getLastPathSegment(path: string) {
  // Split the path into segments
  const segments = path.split('/')

  // Return the last 'size' segments joined by '/'
  return segments.slice(-1).join('/')
}

export function getPathSegments(path: string, size: number): string {
  // Split the path into segments
  const segments = path.split('/')

  // Check if the number of segments is less than or equal to the size
  if (segments.length <= size) {
    return path
  }

  // Return the last 'size' segments joined by '/'
  return segments.slice(0, size + 1).join('/')
}

export function getPathSubSection(path: string): string {
  return getPathSegments(path, 3)
}

export function getPathSection(path: string): string {
  return getPathSegments(path, 2)
}
