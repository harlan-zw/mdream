import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const bin = fileURLToPath(new URL('../../bin/mdream.mjs', import.meta.url))

function run(args: string[], input = '<p>x</p>') {
  const { status, stdout, stderr } = spawnSync(process.execPath, [bin, ...args], { input, encoding: 'utf8' })
  return { status, stdout, stderr }
}

describe('mdream CLI', () => {
  it.each([
    [['--bogus'], 'Unknown option: --bogus. Run mdream --help to list the options.\n'],
    [['--clean-urls=true'], 'Unknown option: --clean-urls. Run mdream --help to list the options.\n'],
    [['index.html'], 'Unknown argument: index.html. Pipe the HTML to mdream on stdin.\n'],
    [['--origin'], 'The --origin option needs a value.\n'],
    [['--origin', '--text'], 'The --origin option needs a value.\n'],
    [['--preset=full'], 'Unknown preset: full. Use --preset minimal.\n'],
    [['--format', 'pdf'], 'Unknown format: pdf. Use markdown, text, or html.\n'],
  ])('exits 1 on %o with one line on stderr', (args, message) => {
    expect(run(args)).toEqual({ status: 1, stdout: '', stderr: message })
  })

  it('converts with valid flags in both value forms', () => {
    const html = '<html><head><title>T</title></head><body><nav>Menu</nav><main><a href="/a">A</a></main></body></html>'
    expect(run(['--preset', 'minimal', '--origin=https://example.com'], html))
      .toEqual({ status: 0, stdout: '---\ntitle: T\n---\n\n[A](https://example.com/a)', stderr: '' })
  })
})
