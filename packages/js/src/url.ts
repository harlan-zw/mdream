import type { Cleaner, ElementNode, EngineOptions } from './types'
import { escapeHtml, isSafeHtmlUrl, trimUrl } from './utils'

const URL_SCHEME_RE = /^[A-Z][\dA-Z+.-]*:/i
const SLASH_CHAR = 47
const documentBase = Symbol('base')
const renderedFragment = Symbol('open fragment')
type OutputOptions = EngineOptions & { [documentBase]?: string }
type FragmentAnchor = ElementNode & { [renderedFragment]?: true }

function documentUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  }
  catch {
    // Invalid bases leave the previous origin in place.
    return undefined
  }
}

export function withDocumentBase(options: EngineOptions, base: string): EngineOptions {
  const parsedBase = documentUrl(base)
  if (parsedBase === undefined)
    return options
  const fragmentBase = base.split('#', 1)[0]!
  const sameDocument = options.origin !== undefined && parsedBase === documentUrl(options.origin)
  return { ...options, origin: base, [documentBase]: sameDocument ? undefined : fragmentBase } as OutputOptions
}

/** Whether the adopted base points fragments at a different document. */
export function hasDocumentBase(options?: EngineOptions): boolean {
  return (options as OutputOptions | undefined)?.[documentBase] !== undefined
}

function pathEnd(value: string, from: number): number {
  const query = value.indexOf('?', from)
  const fragment = value.indexOf('#', from)
  return Math.min(query < 0 ? value.length : query, fragment < 0 ? value.length : fragment)
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

export function resolveOutputUrl(url: string, options?: EngineOptions, origin = options?.origin): string {
  // Read it as the URL parser and `isSafeHtmlUrl` do: padding never makes it relative.
  url = trimUrl(url)
  if (!url)
    return url

  const first = url.charCodeAt(0)
  let resolved = url
  if (first === 35 /* # */) {
    const base = (options as OutputOptions | undefined)?.[documentBase]
    if (base === undefined)
      return url
    resolved = base + url
  }
  else if (first === SLASH_CHAR && url.charCodeAt(1) === SLASH_CHAR) {
    let scheme = 'https'
    if (origin && loadBase(origin))
      scheme = baseRoot.slice(0, baseRoot.indexOf(':'))
    resolved = `${scheme}:${url}`
  }
  else if (origin && (first === SLASH_CHAR || !URL_SCHEME_RE.test(url))) {
    resolved = resolveAgainstBase(origin, url)
  }

  // `clean()` sets `url` when `urls` is on, so its rule stays out of other bundles.
  const rewrite = (options?.clean as Cleaner | undefined)?.url
  return rewrite ? rewrite(resolved) : resolved
}

export function resolveSafeOutputUrl(url: string, options?: EngineOptions, image = false): string | undefined {
  if (!isSafeHtmlUrl(url, image))
    return
  const resolved = resolveOutputUrl(url, options)
  return isSafeHtmlUrl(resolved, image) ? resolved : undefined
}

export function safeAnchorOutput(node: ElementNode, options: EngineOptions | undefined, entering: boolean, protectMarkdown = false): string | undefined {
  if (!entering && (node as FragmentAnchor)[renderedFragment])
    return '</a>'
  const href = node.attributes?.href || ''
  const resolved = resolveSafeOutputUrl(href, options)
  if (resolved === undefined)
    return
  if (!entering)
    return '</a>'
  if (hasDocumentBase(options) && trimUrl(href).charCodeAt(0) === 35 /* # */)
    (node as FragmentAnchor)[renderedFragment] = true
  const escapedHref = escapeHtml(resolved, true, protectMarkdown)
  const title = node.attributes?.title === undefined
    ? ''
    : ` title="${escapeHtml(node.attributes.title, true, protectMarkdown)}"`
  return `<a href="${escapedHref}"${title}>`
}
