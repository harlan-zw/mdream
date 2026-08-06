import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectNapiArtifacts } from '../../../../scripts/stage-napi-artifacts.mjs'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('release artifact staging', () => {
  it('does not declare the unpublished WASI platform package', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))

    expect(manifest.optionalDependencies).not.toHaveProperty('@mdream/rust-wasm32-wasi')
  })

  it('collects napi outputs while excluding bundled node_modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdream-release-'))
    tempDirs.push(root)

    const sourceDir = join(root, 'downloads')
    const artifactDir = join(root, 'node', 'artifacts')
    const nodeDir = join(root, 'node')
    const loaderDir = join(sourceDir, 'napi-loader')
    const nativeDir = join(sourceDir, 'bindings-linux', 'linux-x64-gnu')
    const wasiDir = join(sourceDir, 'bindings-wasi', 'wasm32-wasi')
    const dependencyDir = join(wasiDir, 'node_modules', '@tybys', 'wasm-util')

    await Promise.all([
      mkdir(nativeDir, { recursive: true }),
      mkdir(dependencyDir, { recursive: true }),
      mkdir(loaderDir, { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(nativeDir, 'rust.linux-x64-gnu.node'), 'native'),
      writeFile(join(wasiDir, 'rust.wasm32-wasi.wasm'), 'wasm'),
      writeFile(join(wasiDir, 'rust.wasi.cjs'), 'cjs'),
      writeFile(join(wasiDir, 'rust.wasi.d.cts'), 'types'),
      writeFile(join(wasiDir, 'wasi-worker.mjs'), 'worker'),
      writeFile(join(dependencyDir, 'preview1.js'), 'dependency'),
      writeFile(join(loaderDir, 'index.d.ts'), 'loader types'),
      writeFile(join(loaderDir, 'index.js'), 'loader'),
    ])

    await collectNapiArtifacts({ sourceDir, artifactDir, nodeDir })

    expect((await readdir(artifactDir)).sort()).toEqual([
      'rust.linux-x64-gnu.node',
      'rust.wasi.cjs',
      'rust.wasi.d.cts',
      'rust.wasm32-wasi.wasm',
      'wasi-worker.mjs',
    ])
    expect(await readFile(join(nodeDir, 'rust.wasi.d.cts'), 'utf8')).toBe('types')
    expect(await readFile(join(nodeDir, 'index.js'), 'utf8')).toBe('loader')
    expect(await readFile(join(nodeDir, 'index.d.ts'), 'utf8')).toBe('loader types')
    await expect(readFile(join(artifactDir, 'preview1.js'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
