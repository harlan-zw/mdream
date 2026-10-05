import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = resolve(process.argv[2] || '.preview')
const platforms = process.argv.slice(3)
const targets = platforms.length ? platforms : ['linux-x64-gnu', 'linux-arm64-gnu']
mkdirSync(destination, { recursive: true })
const staging = mkdtempSync(join(tmpdir(), 'mdream-preview-'))
try {
  const packed = join(staging, 'mdream.tgz')
  execFileSync('pnpm', ['--dir', join(root, 'packages/mdream'), 'pack', '--out', packed], { stdio: 'inherit' })
  execFileSync('tar', ['-xzf', packed, '-C', staging])
  const packageDir = join(staging, 'package')
  const manifestPath = join(packageDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  // Preview consumers cannot resolve unpublished beta platform packages.
  // Keep the native loader's local binary fallback self-contained instead.
  delete manifest.optionalDependencies
  delete manifest.devDependencies
  for (const target of targets) {
    const platformDir = join(root, 'crates/node/npm', target)
    const platformManifest = JSON.parse(readFileSync(join(platformDir, 'package.json'), 'utf8'))
    copyFileSync(join(platformDir, platformManifest.main), join(packageDir, 'napi', platformManifest.main))
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', destination], { cwd: packageDir, stdio: 'inherit' })
  for (const packagePath of ['packages/js', ...targets.map(target => `crates/node/npm/${target}`)]) {
    execFileSync('pnpm', ['--dir', join(root, packagePath), 'pack', '--pack-destination', destination], { stdio: 'inherit' })
  }
}
finally {
  rmSync(staging, { recursive: true, force: true })
}
