import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

// Read version from root package.json (already bumped by bumpp)
const rootPkg = JSON.parse(readFileSync('packages/mdream/package.json', 'utf8'))
const version = rootPkg.version

// Crate versions are inherited from [workspace.package] in crates/Cargo.toml
const cargoFiles = ['crates/Cargo.toml', 'crates/Cargo.lock']

const workspaceManifest = readFileSync('crates/Cargo.toml', 'utf8')
const updatedManifest = workspaceManifest.replace(
  /^(version\s*=\s*)"[^"]*"/m,
  `$1"${version}"`,
)
writeFileSync('crates/Cargo.toml', updatedManifest)
console.log(`Updated crates/Cargo.toml to ${version}`)

// Keep Cargo.lock in sync so --locked builds don't fail after the bump
execSync('cargo update --workspace --offline', { cwd: 'crates', stdio: 'inherit' })

// Sync platform package versions
const platformDir = 'crates/node/npm'
const platformFiles = readdirSync(platformDir)
  .map(d => `${platformDir}/${d}/package.json`)
  .filter((f) => {
    try {
      readFileSync(f)
      return true
    }
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
