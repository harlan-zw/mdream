import * as p from '@clack/prompts'
import { addDependency } from 'nypm'

export async function checkPlaywrightInstallation(): Promise<boolean> {
  try {
    // Try to import playwright (full version needed for crawlee)
    await import('playwright')
    return true
  }
  catch {
    return false
  }
}

export async function promptPlaywrightInstall(): Promise<boolean> {
  const shouldInstall = await p.confirm({
    message: 'Playwright is required for the Playwright driver. Install it now?',
    initialValue: true,
  })

  if (p.isCancel(shouldInstall) || !shouldInstall) {
    return false
  }

  const s = p.spinner()
  s.start('Installing Playwright...')

  try {
    // Try to add to workspace root to avoid workspace errors
    await addDependency('playwright', { workspace: true })
    s.stop('Playwright installed successfully!')
    return true
  }
  catch {
    // Fallback: try without workspace flag
    try {
      await addDependency('playwright')
      s.stop('Playwright installed successfully!')
      return true
    }
    catch (fallbackError) {
      s.stop('Failed to install Playwright')
      p.log.error(`Installation failed: ${fallbackError}`)
      return false
    }
  }
}

export async function ensurePlaywrightInstalled(): Promise<boolean> {
  const isInstalled = await checkPlaywrightInstallation()

  if (isInstalled) {
    return true
  }

  p.log.warn('Playwright driver selected but Playwright is not installed.')

  const installed = await promptPlaywrightInstall()
  if (!installed) {
    p.log.error('Cannot proceed with Playwright driver without Playwright installed.')
    return false
  }

  return true
}
