import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const packageDir = resolve(import.meta.dirname, '../packages/mdream')
const workDir = mkdtempSync(join(tmpdir(), 'mdream-wasm-markdown-'))
const name = 'mdream_markdown'
const binary = `${name}_bg.wasm`
const glue = `${name}_bg.js`
const entry = `${name}.js`
const types = `${name}.d.ts`
const webEntry = `${name}_web.js`
const webTypes = `${name}_web.d.ts`
const destination = join(packageDir, 'wasm-bundler')
const web = join(workDir, 'web')
const bundler = join(workDir, 'bundler')

try {
  for (const [target, outDir] of [['web', web], ['bundler', bundler]] as const) {
    execFileSync(process.execPath, [
      join(import.meta.dirname, 'build-wasm-edge.mjs'),
      '--target',
      target,
      '--out-dir',
      outDir,
      '--out-name',
      name,
      '--markdown-only',
    ], { stdio: 'inherit' })
  }
  if (!readFileSync(join(web, binary)).equals(readFileSync(join(bundler, binary))))
    throw new Error('Browser and edge Markdown WASM binaries differ.')

  const source = readFileSync(join(bundler, entry), 'utf8')
  // A bundler can bypass a re-export-only module when it treats modules
  // as side-effect-free. Make the exports depend on WASM initialization.
  const reexports = /\n__wbg_set_wasm\(wasm\);\nwasm\.__wbindgen_start\(\);\nexport \{([^}]+)\} from "[^"]+";/
  const names = source.match(reexports)?.[1]?.trim()
  if (!names)
    throw new Error('Missing initialization and exports in the Markdown WASM entry.')
  const initialized = source.replace(reexports, `
function initialize() {
  __wbg_set_wasm(wasm);
  wasm.__wbindgen_start();
  return imports;
}
export const { ${names} } = initialize();
`)
  // Keep the shared binary alongside its glue for Nitro's relative imports.
  // This directory is outside the public mdream/wasm/* package exports.
  mkdirSync(destination, { recursive: true })
  copyFileSync(join(web, binary), join(destination, binary))
  for (const file of [glue, types])
    copyFileSync(join(bundler, file), join(destination, file))
  writeFileSync(join(destination, entry), initialized)
  writeFileSync(join(destination, webEntry), readFileSync(join(web, entry), 'utf8').replace(`"./${types}"`, `"./${webTypes}"`))
  copyFileSync(join(web, types), join(destination, webTypes))

  // Remove the old layout if this package was previously built in place.
  for (const file of [binary, glue, entry, types])
    rmSync(join(packageDir, 'wasm', file), { force: true })
}
finally {
  rmSync(workDir, { recursive: true, force: true })
}
