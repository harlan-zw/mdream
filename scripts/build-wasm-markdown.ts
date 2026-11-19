import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const packageDir = resolve(import.meta.dirname, '../packages/mdream')
const workDir = mkdtempSync(join(tmpdir(), 'mdream-wasm-markdown-'))
const name = 'mdream_markdown'
const binary = `${name}_bg.wasm`
const glue = `${name}_bg.js`
const entry = `${name}.js`
const web = join(workDir, 'web')
const bundler = join(workDir, 'bundler')

try {
  for (const [target, outDir] of [['web', web], ['bundler', bundler]] as const) {
    execFileSync(process.execPath, [
      join(import.meta.dirname, 'build-wasm-edge.mjs'),
      '--target',
      target,
      '--out-dir',
      outDir,
      '--out-name',
      name,
      '--markdown-only',
    ], { stdio: 'inherit' })
  }
  if (!readFileSync(join(web, binary)).equals(readFileSync(join(bundler, binary))))
    throw new Error('Browser and edge Markdown WASM binaries differ.')

  // Nitro resolves the WASM imports relative to the binary. Keep the bundler
  // glue beside the binary shared by both targets.
  const source = readFileSync(join(bundler, entry), 'utf8')
  for (const file of [binary, glue]) {
    if (!source.includes(`from "./${file}"`))
      throw new Error(`Missing ${file} import in the Markdown WASM entry.`)
  }
  const rebased = source
    .replaceAll(`from "./${binary}"`, `from "../wasm/${binary}"`)
    .replaceAll(`from "./${glue}"`, `from "../wasm/${glue}"`)
  mkdirSync(join(packageDir, 'wasm'), { recursive: true })
  mkdirSync(join(packageDir, 'wasm-bundler'), { recursive: true })
  for (const file of [binary, entry, `${name}.d.ts`])
    copyFileSync(join(web, file), join(packageDir, 'wasm', file))
  copyFileSync(join(bundler, glue), join(packageDir, 'wasm', glue))
  copyFileSync(join(bundler, `${name}.d.ts`), join(packageDir, 'wasm-bundler', `${name}.d.ts`))
  writeFileSync(join(packageDir, 'wasm-bundler', entry), rebased)
}
finally {
  rmSync(workDir, { recursive: true, force: true })
}
