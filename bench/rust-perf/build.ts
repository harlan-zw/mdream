import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The PR harness can build any source tree, including a base without this harness.
const source = resolve(process.argv[2] || '.')
const out = resolve(process.argv[3] || 'bench/bundle/dist/rust-perf')
const harness = fileURLToPath(new URL('.', import.meta.url))
const project = resolve(out, 'harness')
mkdirSync(project, { recursive: true })
cpSync(resolve(harness, 'src'), resolve(project, 'src'), { recursive: true })
let manifest = readFileSync(resolve(harness, 'Cargo.toml'), 'utf8')
manifest = manifest.replace('"../../crates/core"', JSON.stringify(resolve(source, 'crates/core')))
writeFileSync(resolve(project, 'Cargo.toml'), manifest)
cpSync(resolve(harness, 'Cargo.lock'), resolve(project, 'Cargo.lock'))
// Historical backtests span the public options rename in #315. Adapt only the harness.
const types = readFileSync(resolve(source, 'crates/core/src/types.rs'), 'utf8')
if (!types.includes('struct HtmlToMarkdownOptions')) {
  const main = resolve(project, 'src/main.rs')
  writeFileSync(main, readFileSync(main, 'utf8').replaceAll('HtmlToMarkdownOptions', 'HTMLToMarkdownOptions'))
}
execFileSync('cargo', ['update', '-p', 'mdream', '--manifest-path', resolve(project, 'Cargo.toml')], { stdio: 'inherit' })
for (const mode of ['cpu', 'alloc']) {
  execFileSync('cargo', ['build', '--release', '--locked', '--manifest-path', resolve(project, 'Cargo.toml'), ...(mode === 'alloc' ? ['--features', 'alloc'] : [])], { stdio: 'inherit' })
  cpSync(resolve(project, 'target/release/mdream-perf'), resolve(out, mode))
}
writeFileSync(resolve(out, 'build.json'), JSON.stringify({
  revision: process.argv[4] || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  toolchain: execFileSync('rustc', ['-Vv'], { encoding: 'utf8' }).trim(),
  profile: 'release: opt-level=3, lto=true, codegen-units=1; all output formats',
}, null, 2))
