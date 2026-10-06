import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const bin = fileURLToPath(new URL('../../bin/mdream.mjs', import.meta.url))

function run(args: string[], input = '<p>x</p>') {
  const { status, stdout, stderr } = spawnSync(process.execPath, [bin, ...args], { input, encoding: 'utf8' })
  return { status, stdout, stderr }
}

describe('mdream-js CLI', () => {
  it.each([
    [['--clean-urls'], 'Unknown option: --clean-urls. Run mdream-js --help to list the options.\n'],
    [['--cleanUrls=true'], 'Unknown option: --cleanUrls. Run mdream-js --help to list the options.\n'],
    [['--origin'], 'The --origin option needs a value.\n'],
    [['--no-origin'], 'Unknown option: --no-origin. Run mdream-js --help to list the options.\n'],
    [['--preset', 'full'], 'Unknown preset: full. Use --preset minimal.\n'],
  ])('exits 1 on %o with one line on stderr', (args, message) => {
    expect(run(args)).toEqual({ status: 1, stdout: '', stderr: message })
  })

  it('converts with valid flags', () => {
    const html = '<html><head><title>T</title></head><body><nav>Menu</nav><main><a href="/a">A</a></main></body></html>'
    expect(run(['--preset', 'minimal', '--origin', 'https://example.com'], html))
      .toEqual({ status: 0, stdout: '---\ntitle: T\n---\n\n[A](https://example.com/a)', stderr: '' })
  })
})
