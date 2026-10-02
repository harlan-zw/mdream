import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Each export condition must ship types that match what it returns at runtime.
// Type checks fixtures in test/types against the built dist/*.d.mts.
const typesDir = fileURLToPath(new URL('../types/', import.meta.url))

function typecheck(condition: string): string {
  try {
    execFileSync('pnpm', ['exec', 'tsc', '-p', `tsconfig.${condition}.json`], { cwd: typesDir, encoding: 'utf8', stdio: 'pipe' })
    return ''
  }
  catch (error: any) {
    return `${error.stdout}${error.stderr}`
  }
}

describe('export condition types', () => {
  it.each(['node', 'edge', 'browser'])('%s types match the runtime return', (condition) => {
    expect(typecheck(condition)).toBe('')
  })
})
