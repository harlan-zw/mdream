// Asserts every file a platform package declares in `files` actually exists on
// disk. napi renames its build output between minor releases, and a rename that
// nobody notices publishes a package whose `main` points at a missing binary
// (mdream#194). Run this before any publish step.
//
// Usage:
//   node scripts/verify-npm-artifacts.mjs              # every npm/* package
//   node scripts/verify-npm-artifacts.mjs wasm32-wasi  # named packages only
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const npmDir = path.resolve(__dirname, '../crates/node/npm')

const requested = process.argv.slice(2)
const available = (await fs.readdir(npmDir, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

const unknown = requested.filter(name => !available.includes(name))
if (unknown.length > 0) {
  console.error(`No such platform package(s): ${unknown.join(', ')}. Available: ${available.join(', ')}`)
  process.exit(1)
}

const targets = requested.length > 0 ? requested : available
const failures = []

for (const name of targets) {
  const manifestPath = path.join(npmDir, name, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  }
  catch (err) {
    failures.push(`${name}: unreadable package.json (${err.message})`)
    continue
  }

  const declared = manifest.files ?? []
  if (declared.length === 0) {
    failures.push(`${name}: package.json declares no "files"`)
    continue
  }

  const problems = []

  // `main`/`browser` are the entries consumers actually resolve, so an
  // unlisted one is as broken as a missing file.
  for (const field of ['main', 'browser']) {
    const entry = manifest[field]
    if (entry && !declared.includes(entry.replace(/^\.\//, '')))
      problems.push(`${name}: "${field}" is ${entry} but it is not in "files"`)
  }

  for (const file of declared) {
    const filePath = path.join(npmDir, name, file)
    let stat
    try {
      stat = await fs.stat(filePath)
    }
    catch {
      problems.push(`${name}: missing ${file}`)
      continue
    }
    if (stat.size === 0)
      problems.push(`${name}: ${file} is empty`)
  }

  if (problems.length > 0)
    failures.push(...problems)
  else
    console.log(`ok ${manifest.name ?? name} (${declared.length} files)`)
}

if (failures.length > 0) {
  console.error(`\nPlatform package verification failed:`)
  for (const failure of failures)
    console.error(`  - ${failure}`)
  console.error(`\nEither that target was never built, or the napi CLI renamed its build output. For a rename, update crates/node/scripts/move-artifacts.mjs and the affected npm/*/package.json "files" list.`)
  process.exit(1)
}

console.log(`\nVerified ${targets.length} platform package(s).`)
