import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export function resolveRelease(tag, packageVersion) {
  const match = /^v(1|2)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(-beta\.(?:0|[1-9]\d*))?$/.exec(tag)
  if (!match || match[0] !== tag || (match[1] === '1' && match[2]))
    throw new Error('Use a v1 stable, v2 stable, or v2 beta release tag.')
  const version = tag.slice(1)
  if (version !== packageVersion)
    throw new Error(`Tag version ${version} does not match package version ${packageVersion}.`)
  const prerelease = Boolean(match[2])
  const maintenance = match[1] === '1'
  return {
    version,
    branch: maintenance ? '1.x' : 'main',
    npmTag: maintenance ? '1.x' : prerelease ? 'beta' : 'latest',
    prerelease,
    latest: !maintenance && !prerelease,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(readFileSync('packages/mdream/package.json', 'utf8'))
  const release = resolveRelease(process.argv[2], pkg.version)
  for (const [key, value] of Object.entries(release))
    console.log(`${key}=${value}`)
}
