import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const artifactSuffixes = ['.node', '.wasm', '.js', '.cjs', '.mjs', '.d.ts', '.d.cts', '.d.mts']
const loaderNames = ['index.js', 'index.d.ts']

const isArtifact = name => artifactSuffixes.some(suffix => name.endsWith(suffix))
const isWasiGlue = name => name.startsWith('rust.wasi') || name.startsWith('wasi-worker')

async function findArtifacts(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    if (entry.name === 'node_modules')
      return []

    const entryPath = resolve(dir, entry.name)
    if (entry.isDirectory())
      return findArtifacts(entryPath)
    return entry.isFile() && isArtifact(entry.name) ? [entryPath] : []
  }))
  return files.flat()
}

export async function collectNapiArtifacts({ sourceDir, artifactDir, nodeDir }) {
  const downloads = await readdir(sourceDir, { withFileTypes: true })
  const bindingDirs = downloads
    .filter(entry => entry.isDirectory() && entry.name.startsWith('bindings-'))
    .map(entry => resolve(sourceDir, entry.name))

  if (bindingDirs.length === 0)
    throw new Error(`No binding artifacts found in ${sourceDir}`)

  const sources = (await Promise.all(bindingDirs.map(findArtifacts))).flat()
  if (sources.length === 0)
    throw new Error(`Binding downloads in ${sourceDir} contained no napi artifacts`)

  const duplicateNames = sources
    .map(source => basename(source))
    .filter((name, index, names) => names.indexOf(name) !== index)
  if (duplicateNames.length > 0)
    throw new Error(`Duplicate napi artifact names: ${[...new Set(duplicateNames)].join(', ')}`)

  await Promise.all([mkdir(artifactDir, { recursive: true }), mkdir(nodeDir, { recursive: true })])
  await Promise.all([
    ...sources.map(async (source) => {
      const name = basename(source)
      await copyFile(source, resolve(artifactDir, name))
      if (isWasiGlue(name))
        await copyFile(source, resolve(nodeDir, name))
    }),
    ...loaderNames.map(name => copyFile(resolve(sourceDir, 'napi-loader', name), resolve(nodeDir, name))),
  ])

  return sources.map(source => basename(source)).sort()
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const root = resolve(import.meta.dirname, '..')
  const sourceDir = resolve(root, process.argv[2] || 'artifacts')
  const artifactDir = resolve(root, process.argv[3] || 'crates/node/artifacts')
  const nodeDir = resolve(root, process.argv[4] || 'crates/node')
  const files = await collectNapiArtifacts({ sourceDir, artifactDir, nodeDir })
  console.log(`Staged ${files.length} napi artifacts: ${files.join(', ')}`)
}
