import type { CrawlLogger } from '../../src/logger.ts'
import { describe, expect, it, vi } from 'vitest'
import { createClackLogger, resolveLogger, silentLogger } from '../../src/logger.ts'

describe('resolveLogger', () => {
  it('returns the silent logger when silent is set', () => {
    expect(resolveLogger({ silent: true })).toBe(silentLogger)
  })

  it('returns the clack logger by default', () => {
    const logger = resolveLogger({})
    expect(logger).not.toBe(silentLogger)
    expect(typeof logger.info).toBe('function')
  })

  it('prefers an explicit logger over silent', () => {
    const custom: CrawlLogger = {
      ...silentLogger,
      info: vi.fn(),
    }
    expect(resolveLogger({ silent: true, logger: custom })).toBe(custom)
    expect(resolveLogger({ logger: custom })).toBe(custom)
  })
})

describe('silentLogger', () => {
  it('drops every message without throwing or writing', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      silentLogger.intro('hi')
      silentLogger.note('body', 'title')
      silentLogger.cancel('nope')
      silentLogger.info('info')
      silentLogger.warn('warn')
      silentLogger.error('error')
      silentLogger.success('done')
      const s = silentLogger.spinner()
      s.start('start')
      s.message('msg')
      s.stop('stop')
      expect(write).not.toHaveBeenCalled()
    }
    finally {
      write.mockRestore()
    }
  })
})

describe('createClackLogger', () => {
  it('exposes the full logger surface', () => {
    const logger = createClackLogger()
    for (const key of ['intro', 'note', 'cancel', 'info', 'warn', 'error', 'success', 'spinner'] as const) {
      expect(typeof logger[key]).toBe('function')
    }
  })
})
