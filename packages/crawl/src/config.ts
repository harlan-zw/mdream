import type { MdreamCrawlConfig } from './types.js'
import { loadConfig } from 'c12'

export async function loadMdreamConfig(cwd?: string): Promise<MdreamCrawlConfig> {
  const { config } = await loadConfig<MdreamCrawlConfig>({
    name: 'mdream',
    cwd,
  })
  return config || {}
}
