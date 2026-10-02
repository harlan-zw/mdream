import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const archiveDir = resolve(process.argv[2] || '.preview')
const archives = readdirSync(archiveDir)
function archive(pattern) {
  const filename = archives.find(name => pattern.test(name) && name.endsWith('.tgz'))
  if (!filename)
    throw new Error(`Missing preview archive: ${pattern}`)
  return `file:${join(archiveDir, filename)}`
}
const fixture = mkdtempSync(join(tmpdir(), 'mdream-preview-consumer-'))
try {
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    packageManager: 'pnpm@11.22.0',
    dependencies: {
      'mdream': archive(/^mdream-\d/),
      '@mdream/js': archive(/^mdream-js-/),
    },
  }))
  writeFileSync(join(fixture, 'pnpm-workspace.yaml'), 'blockExoticSubdeps: true\n')
  execFileSync('pnpm', ['install', '--ignore-scripts'], { cwd: fixture, stdio: 'inherit' })
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { strict as assert } from 'node:assert'
    import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'
    import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
    assert.equal(htmlToMarkdown('<h1>Preview</h1>'), '# Preview')
    assert.equal(jsHtmlToMarkdown('<h1>Preview</h1>'), '# Preview')
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue('<h1>Stream</h1>')
      controller.close()
    } })
    let markdown = ''
    for await (const chunk of streamHtmlToMarkdown(stream)) markdown += chunk
    assert.equal(markdown, '# Stream')
  `], { cwd: fixture, stdio: 'inherit' })
}
finally {
  rmSync(fixture, { recursive: true, force: true })
}
