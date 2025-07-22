import * as Launcher from 'chrome-launcher'
import { resolve } from 'mlly'
import { existsSync } from 'node:fs'
import { computeExecutablePath, install, resolveBuildId, Browser, BrowserPlatform, detectBrowserPlatform } from '@puppeteer/browsers'
import type { InstallOptions } from '@puppeteer/browsers'

interface ChromeConfig {
  useSystem: boolean
  useDownloadFallback: boolean
  downloadFallbackCacheDir?: string
  downloadFallbackVersion?: string
}

export async function resolveChromeExecutable(config: ChromeConfig): Promise<string | undefined> {
  let foundChrome = false

  // If user is using the default chrome binary options
  if (config.useSystem) {
    // We'll try and resolve their local chrome
    try {
      const chromePath = Launcher.getChromePath()
      if (chromePath) {
        // Test that Chrome works
        try {
          const { launch } = await import('puppeteer-core')
          const instance = await launch({ executablePath: chromePath })
          await instance.close()
          return chromePath
        }
        catch {
          // Chrome path found but doesn't work, fall through to other options
        }
      }
    }
    catch {
      // Chrome launcher failed, fall through to other options
    }
  }

  // Try to use puppeteer dependency
  try {
    await resolve('puppeteer', { url: import.meta.url })
    foundChrome = true
  }
  catch {
    // Puppeteer not available as dependency
  }

  // Download fallback logic
  if (config.useDownloadFallback && !foundChrome) {
    const browserOptions = {
      installDeps: process.getuid?.() === 0,
      cacheDir: config.downloadFallbackCacheDir,
      buildId: config.downloadFallbackVersion || await resolveBuildId(Browser.CHROME, detectBrowserPlatform() || BrowserPlatform.LINUX, 'stable'),
      browser: 'chrome',
    } as InstallOptions

    const chromePath = computeExecutablePath(browserOptions)
    if (!existsSync(chromePath)) {
      console.info(`Missing ${browserOptions.browser} binary, downloading v${browserOptions.buildId}...`)
      let lastPercent = 0
      // @ts-expect-error untyped
      await install({
        ...browserOptions,
        downloadProgressCallback: (downloadedBytes: number, toDownloadBytes: number) => {
          const percent = Math.round(downloadedBytes / toDownloadBytes * 100)
          if (percent % 5 === 0 && lastPercent !== percent) {
            console.info(`Downloading ${browserOptions.browser}: ${percent}%`)
            lastPercent = percent
          }
        },
      })
    }
    console.info(`Using downloaded ${browserOptions.browser} v${browserOptions.buildId} located at: ${chromePath}`)
    return chromePath
  }

  if (foundChrome) {
    return undefined // Let puppeteer handle it
  }

  // If we can't find chrome and no puppeteer, throw error
  throw new Error('Failed to find chrome. Please ensure you have a valid chrome installed or puppeteer dependency available.')
}
