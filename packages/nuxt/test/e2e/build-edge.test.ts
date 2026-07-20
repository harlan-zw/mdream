import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

// Tests that mdream uses the WASM build for edge presets instead of the NAPI binding.
// Cloudflare/Vercel Edge have no node_modules at runtime, so mdream must be bundled
// using the WASM entry (dist/edge.mjs) resolved via the "workerd" export condition.
describe('nuxt-mdream cloudflare-pages build', async () => {
  const fixtureDir = fileURLToPath(new URL('../fixtures/basic', import.meta.url))
  const buildDir = resolve(fixtureDir, '.nuxt/test/cf-edge')

  await setup({
    rootDir: fixtureDir,
    dev: false,
    server: false,
    build: true,
    buildDir,
    nuxtConfig: {
      nitro: {
        preset: 'cloudflare-pages' as any,
        output: {
          dir: resolve(buildDir, 'output'),
          publicDir: resolve(buildDir, 'output/public'),
          serverDir: resolve(buildDir, 'output/_worker.js'),
        },
      },
    },
  })

  function findNitroBundle(): string {
    const nitroDir = resolve(buildDir, 'output/_worker.js/chunks/nitro')
    if (!existsSync(nitroDir)) {
      // Cloudflare output may have different structure
      const workerDir = resolve(buildDir, 'output/_worker.js')
      if (existsSync(workerDir)) {
        const files = readdirSync(workerDir, { recursive: true }) as string[]
        const nitroFile = files.find(f => f.toString().includes('nitro') && f.toString().endsWith('.mjs'))
        if (nitroFile) {
          return readFileSync(resolve(workerDir, nitroFile.toString()), 'utf-8')
        }
      }
      throw new Error(`Nitro output not found in ${buildDir}`)
    }
    return readFileSync(resolve(nitroDir, 'nitro.mjs'), 'utf-8')
  }

  it('bundles WASM build instead of NAPI binding', () => {
    const nitroOutput = findNitroBundle()

    // Should contain wasm-bindgen glue code (WASM build)
    expect(nitroOutput).toContain('__wbindgen')

    // Should NOT contain NAPI native binding loader
    expect(nitroOutput).not.toContain('requireNative')
    expect(nitroOutput).not.toContain('.node\'')

    // Should NOT have mdream as an external import (it should be bundled)
    expect(nitroOutput).not.toContain('from \'mdream\'')
    expect(nitroOutput).not.toMatch(/from\s*["']mdream["']/)
  })

  it('includes WASM binary in output', () => {
    const wasmDir = resolve(buildDir, 'output/_worker.js/wasm')
    expect(existsSync(wasmDir)).toBe(true)
    const wasmFiles = readdirSync(wasmDir).filter(f => f.endsWith('.wasm'))
    expect(wasmFiles.length).toBeGreaterThan(0)
    expect(wasmFiles[0]).toContain('mdream_edge')
  })
})
