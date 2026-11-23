import type { Cleaner, ElementNode, EngineOptions } from './types'
import { escapeHtml, isSafeHtmlUrl } from './utils'

const URL_SCHEME_RE = /^[A-Z][\dA-Z+.-]*:/i
const SLASH_CHAR = 47
const documentBase = Symbol('documentBase')
type OutputOptions = EngineOptions & { [documentBase]?: string }

export function withDocumentBase(options: EngineOptions, base: string): EngineOptions {
  return { ...options, origin: base, [documentBase]: base.split('#', 1)[0] } as OutputOptions
}

export function resolveOutputUrl(url: string, options?: EngineOptions): string {
  const base = (options as OutputOptions | undefined)?.[documentBase]
  const reference = trimUrl(url)
  if (base !== undefined && reference.charCodeAt(0) === 35)
    return resolveUrl(base + reference, options?.origin, options?.clean)
  return resolveUrl(reference, options?.origin, options?.clean)
}

export function hasDocumentBase(options?: EngineOptions): boolean {
  return (options as OutputOptions | undefined)?.[documentBase] !== undefined
}

function pathEnd(value: string, from: number): number {
  const query = value.indexOf('?', from)
  const fragment = value.indexOf('#', from)
  if (query === -1)
    return fragment === -1 ? value.length : fragment
  return fragment === -1 ? query : Math.min(query, fragment)
}

function hasDotSegment(path: string): boolean {
  return path.includes('.')
    && (path === '.' || path === '..' || path.startsWith('./') || path.startsWith('../')
      || path.includes('/./') || path.includes('/../') || path.endsWith('/.') || path.endsWith('/..'))
}

function mergeDotSegments(directory: string, rest: string): string {
  let output = directory
  let index = 0
  for (;;) {
    let end = rest.indexOf('/', index)
    const last = end === -1
    if (last)
      end = rest.length
    const segment = rest.slice(index, end)
    if (segment === '..')
      output = output.slice(0, output.lastIndexOf('/', output.length - 2) + 1)
    else if (segment !== '.')
      output += last ? segment : `${segment}/`
    if (last)
      return output
    index = end + 1
  }
}

let baseOrigin: string | undefined
let baseRoot = ''
let basePath = ''
let baseDirectory = ''

function loadBase(origin: string): boolean {
  if (origin !== baseOrigin) {
    baseOrigin = origin
    baseRoot = ''
    const authority = origin.indexOf('://')
    if (authority !== -1) {
      const end = pathEnd(origin, authority + 3)
      const slash = origin.indexOf('/', authority + 3)
      const rootEnd = slash === -1 || slash > end ? end : slash
      baseRoot = origin.slice(0, rootEnd)
      basePath = origin.slice(rootEnd, end)
      baseDirectory = basePath.slice(0, basePath.lastIndexOf('/') + 1) || '/'
    }
  }
  return baseRoot !== ''
}

function resolveAgainstBase(origin: string, url: string): string {
  if (!loadBase(origin)) {
    let prefix = origin
    while (prefix.endsWith('/'))
      prefix = prefix.slice(0, -1)
    const path = url.startsWith('./') ? url.slice(2) : url
    return `${prefix}${path.charCodeAt(0) === SLASH_CHAR ? '' : '/'}${path}`
  }

  const end = pathEnd(url, 0)
  const path = url.slice(0, end)
  const suffix = end === url.length ? '' : url.slice(end)
  if (!path)
    return `${baseRoot}${basePath}${suffix}`

  const dot = hasDotSegment(path)
  if (path.charCodeAt(0) === SLASH_CHAR)
    return `${baseRoot}${dot ? mergeDotSegments('/', path.slice(1)) : path}${suffix}`
  return `${baseRoot}${dot ? mergeDotSegments(baseDirectory, path) : baseDirectory + path}${suffix}`
}

/** `url` without the leading and trailing C0 controls and spaces the URL parser strips. */
export function trimUrl(url: string): string {
  let start = 0
  let end = url.length
  while (start < end && url.charCodeAt(start) <= 32)
    start++
  while (end > start && url.charCodeAt(end - 1) <= 32)
    end--
  return start === 0 && end === url.length ? url : url.slice(start, end)
}

export function resolveUrl(url: string, origin?: string, clean?: EngineOptions['clean']): string {
  // Read it as the URL parser and `isSafeHtmlUrl` do: padding never makes it relative.
  url = trimUrl(url)
  if (!url || url[0] === '#')
    return url

  const isSlash = url.charCodeAt(0) === SLASH_CHAR
  let resolved = url
  if (isSlash && url.charCodeAt(1) === SLASH_CHAR) {
    let scheme = 'https'
    if (origin && loadBase(origin))
      scheme = baseRoot.slice(0, baseRoot.indexOf(':'))
    resolved = `${scheme}:${url}`
  }
  else if (origin && (isSlash || !URL_SCHEME_RE.test(url))) {
    resolved = resolveAgainstBase(origin, url)
  }

  // `clean()` sets `url` when `urls` is on, so its rule stays out of other bundles.
  const rewrite = (clean as Cleaner | undefined)?.url
  return rewrite ? rewrite(resolved) : resolved
}

export function safeAnchorOutput(node: ElementNode, options: EngineOptions | undefined, entering: boolean, protectMarkdown = false): string | undefined {
  const href = node.attributes?.href
  if (!href || !isSafeHtmlUrl(href))
    return
  const resolved = resolveOutputUrl(href, options)
  if (!isSafeHtmlUrl(resolved))
    return
  if (!entering)
    return '</a>'
  const escapedHref = escapeHtml(resolved, true, protectMarkdown)
  const title = node.attributes?.title === undefined
    ? ''
    : ` title="${escapeHtml(node.attributes.title, true, protectMarkdown)}"`
  return `<a href="${escapedHref}"${title}>`
}
