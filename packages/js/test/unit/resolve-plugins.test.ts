import { describe, expect, it, vi } from 'vitest'
import { resolvePlugins } from '../../src/resolve-plugins'

describe('resolvePlugins', () => {
  it('returns empty plugins for no config', () => {
    const result = resolvePlugins({})
    expect(result.plugins).toEqual([])
    expect(result.frontmatterCallback).toBeUndefined()
    expect(result.callExtractionHandlers).toBeUndefined()
  })

  it('resolves frontmatter: true', () => {
    const result = resolvePlugins({ plugins: { frontmatter: true } })
    expect(result.plugins).toHaveLength(1)
    expect(result.getFrontmatter).toBeDefined()
    expect(result.frontmatterCallback).toBeUndefined()
  })

  it('resolves frontmatter as callback function', () => {
    const cb = vi.fn()
    const result = resolvePlugins({ plugins: { frontmatter: cb } })
    expect(result.plugins).toHaveLength(1)
    expect(result.frontmatterCallback).toBe(cb)
  })

  it('resolves frontmatter as config object with onExtract', () => {
    const cb = vi.fn()
    const result = resolvePlugins({
      plugins: { frontmatter: { metaFields: ['og:title'], onExtract: cb } },
    })
    expect(result.plugins).toHaveLength(1)
    expect(result.frontmatterCallback).toBe(cb)
  })

  it('resolves all builtin plugins', () => {
    const result = resolvePlugins({
      plugins: {
        frontmatter: true,
        isolateMain: true,
        tailwind: true,
        filter: { exclude: ['nav'] },
      },
    })
    expect(result.plugins).toHaveLength(4)
  })

  it('resolves extraction plugin', () => {
    const handlers = { h2: vi.fn() }
    const result = resolvePlugins({
      plugins: { extraction: handlers },
    })
    expect(result.plugins).toHaveLength(1)
    expect(result.callExtractionHandlers).toBeDefined()
  })

  it('appends imperative hooks after declarative plugins', () => {
    const hook = { onNodeEnter: vi.fn() }
    const result = resolvePlugins(
      { plugins: { frontmatter: true } },
      [hook],
    )
    expect(result.plugins).toHaveLength(2)
    expect(result.plugins[1]).toBe(hook)
  })
})
