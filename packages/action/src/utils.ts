import { relative, sep } from 'node:path'

export function pathToUrl(filePath: string, baseDir: string): string {
  let url = relative(baseDir, filePath)
  url = url.split(sep).join('/')
  if (url.endsWith('.html')) {
    url = url.slice(0, -5)
  }
  if (url.endsWith('/index')) {
    url = url.slice(0, -6)
  }
  if (url === 'index') {
    return '/'
  }
  if (!url.startsWith('/')) {
    url = `/${url}`
  }
  return url
}
