import type { EngineOptions } from './types'

const TRACKING_PARAM_RE = /^(?:utm_|fbclid|gclid|mc_eid|msclkid|oly_)/
const URL_SCHEME_RE = /^[A-Z][\dA-Z+.-]*:/i
const SLASH_CHAR = 47

function stripTrackingParams(url: string): string {
  const queryStart = url.indexOf('?')
  const fragmentStart = url.indexOf('#')
  if (queryStart === -1 || (fragmentStart !== -1 && fragmentStart < queryStart))
    return url

  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart
  const query = url.slice(queryStart + 1, queryEnd)
    .split('&')
    .filter(parameter => !TRACKING_PARAM_RE.test(parameter))
    .join('&')
  return `${url.slice(0, queryStart)}${query ? `?${query}` : ''}${url.slice(queryEnd)}`
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

export function resolveUrl(url: string, origin?: string, clean?: EngineOptions['clean']): string {
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

  const cleansUrls = clean === true || Boolean(clean && clean.urls)
  return cleansUrls && resolved.includes('?') ? stripTrackingParams(resolved) : resolved
}
