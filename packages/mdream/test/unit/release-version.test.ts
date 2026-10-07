import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const syncScript = fileURLToPath(new URL('../../../../scripts/sync-cargo-version.mjs', import.meta.url))

describe('release version synchronization', () => {
  it('loads the matching platform package with version enforcement enabled', () => {
    const root = mkdtempSync(join(tmpdir(), 'mdream-native-version-'))
    const napiDir = fileURLToPath(new URL('../../napi/', import.meta.url))
    const binaryName = readdirSync(napiDir).find(name => name.endsWith('.node'))!
    const packageName = `@mdream/${binaryName.slice(0, -5).replaceAll('.', '-')}`
    const nativePackageDir = join(root, 'node_modules', packageName)
    const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    try {
      mkdirSync(nativePackageDir, { recursive: true })
      copyFileSync(join(napiDir, binaryName), join(nativePackageDir, binaryName))
      writeFileSync(join(nativePackageDir, 'package.json'), JSON.stringify({ name: packageName, version, main: binaryName }))
      copyFileSync(join(napiDir, 'index.mjs'), join(root, 'loader.mjs'))
      writeFileSync(join(root, 'consumer.mjs'), `import { htmlToMarkdown } from ${JSON.stringify(pathToFileURL(join(root, 'loader.mjs')).href)}\nconsole.log(JSON.stringify(htmlToMarkdown('<h1>Native package</h1>')))\n`)
      const stdout = execFileSync(process.execPath, [join(root, 'consumer.mjs')], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NAPI_RS_ENFORCE_VERSION_CHECK: '1' },
      })
      expect(JSON.parse(stdout).markdown).toBe('# Native package')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(['2.0.1', '2.1.0-beta.1'])('updates the native loader version for %s', (version) => {
    const root = mkdtempSync(join(tmpdir(), 'mdream-release-version-'))
    const write = (path: string, content: string) => {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), content)
    }
    write('packages/mdream/package.json', JSON.stringify({ version }))
    write('crates/node/package.json', JSON.stringify({ name: '@mdream/rust-build', version: '0.17.0', private: true }))
    write('crates/node/npm/win32-x64-msvc/package.json', JSON.stringify({ name: '@mdream/rust-win32-x64-msvc', version: '2.0.0' }))
    write('crates/Cargo.toml', '[workspace]\nmembers = ["core"]\nresolver = "2"\n[workspace.package]\nversion = "2.0.0"\n')
    write('crates/core/Cargo.toml', '[package]\nname = "mdream-version-fixture"\nversion.workspace = true\nedition = "2021"\n')
    write('crates/core/src/lib.rs', '')
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: root })
      execFileSync(process.execPath, [syncScript], { cwd: root, stdio: 'pipe' })
      const loaderPackage = JSON.parse(readFileSync(join(root, 'crates/node/package.json'), 'utf8'))
      const platformPackage = JSON.parse(readFileSync(join(root, 'crates/node/npm/win32-x64-msvc/package.json'), 'utf8'))
      expect(loaderPackage.version).toBe(version)
      expect(platformPackage.version).toBe(version)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
