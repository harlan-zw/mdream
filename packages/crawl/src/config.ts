import type { CrawlOptions } from './types.ts'
import { loadConfig } from 'c12'

/** Load `mdream.config.*` from `cwd`. Returns an empty object when no file exists. */
export async function loadMdreamConfig(cwd?: string): Promise<Partial<CrawlOptions>> {
  const { config } = await loadConfig<Partial<CrawlOptions>>({
    name: 'mdream',
    cwd,
  })
  return config || {}
}
