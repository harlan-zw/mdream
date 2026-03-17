import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

// Read version from root package.json (already bumped by bumpp)
const rootPkg = JSON.parse(readFileSync('packages/mdream/package.json', 'utf8'))
const version = rootPkg.version

const cargoFiles = [
  'crates/core/Cargo.toml',
  'crates/node/Cargo.toml',
  'crates/edge/Cargo.toml',
]

for (const file of cargoFiles) {
  const content = readFileSync(file, 'utf8')
  const updated = content.replace(
    /^(version\s*=\s*)"[^"]*"/m,
    `$1"${version}"`,
  )
  writeFileSync(file, updated)
  console.log(`Updated ${file} to ${version}`)
}

// Sync platform package versions
const platformDir = 'crates/node/npm'
const platformFiles = readdirSync(platformDir)
  .map(d => `${platformDir}/${d}/package.json`)
  .filter((f) => {
    try { readFileSync(f); return true }
    catch { return false }
  })

for (const file of platformFiles) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  pkg.version = version
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`Updated ${file} to ${version}`)
}

const allFiles = [...cargoFiles, ...platformFiles]
execSync(`git add ${allFiles.join(' ')}`, { stdio: 'inherit' })
