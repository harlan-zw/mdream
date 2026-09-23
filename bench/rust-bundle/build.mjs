import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '../..')
const manifestPath = resolve(currentDir, 'Cargo.toml')
const releaseDir = resolve(currentDir, 'target/release')
const outputDir = resolve(repoRoot, 'bench/bundle/dist/rust-native')
const extension = process.platform === 'win32' ? '.exe' : ''
const binaries = ['baseline', 'markdown', 'text', 'safe-html', 'runtime-format']

// One cargo invocation per consumer. Building them together would unify
// mdream's features and link every output format into each binary.
for (const binary of binaries) {
  execFileSync('cargo', [
    'build',
    '--release',
    '--manifest-path',
    manifestPath,
    '--package',
    binary,
  ], { cwd: repoRoot, stdio: 'inherit' })
}

rmSync(outputDir, { force: true, recursive: true })
mkdirSync(outputDir, { recursive: true })

for (const binary of binaries) {
  const fileName = `${binary}${extension}`
  const source = resolve(releaseDir, fileName)
  const output = resolve(outputDir, fileName)
  copyFileSync(source, output)
  process.stdout.write(`${binary}: ${statSync(output).size} bytes\n`)
}
