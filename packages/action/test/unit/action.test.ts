import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pathToUrl } from '../../src/utils'

describe('pathToUrl', () => {
  it('strips .html extension', () => {
    expect(pathToUrl('/site/about.html', '/site')).toBe('/about')
  })

  it('converts index.html at root to /', () => {
    expect(pathToUrl('/site/index.html', '/site')).toBe('/')
  })

  it('converts nested index.html to directory path', () => {
    expect(pathToUrl('/site/blog/index.html', '/site')).toBe('/blog')
  })

  it('handles deeply nested paths', () => {
    expect(pathToUrl('/site/docs/guide/intro.html', '/site')).toBe('/docs/guide/intro')
  })

  it('handles non-html files', () => {
    expect(pathToUrl('/site/feed.xml', '/site')).toBe('/feed.xml')
  })

  it('handles baseDir with trailing structure', () => {
    const base = join('/project', 'dist')
    expect(pathToUrl(join('/project', 'dist', 'page.html'), base)).toBe('/page')
  })

  it('handles nested index without .html', () => {
    // path already stripped of .html but ends with /index
    expect(pathToUrl('/site/blog/index', '/site')).toBe('/blog')
  })

  it('prepends slash when missing', () => {
    expect(pathToUrl('/site/contact.html', '/site')).toBe('/contact')
  })

  it('handles same directory (baseDir equals file dir)', () => {
    expect(pathToUrl('/out/index.html', '/out')).toBe('/')
  })
})
