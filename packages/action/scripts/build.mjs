import { execSync } from 'node:child_process'
import { copyFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

rmSync('dist', { recursive: true, force: true })
execSync('ncc build src/index.ts -o dist --no-source-map-register --minify', { stdio: 'inherit' })

for (const f of readdirSync('dist')) {
  if (f.endsWith('.js') && f !== 'index.js')
    unlinkSync(`dist/${f}`)
}

const napiDir = resolve('../mdream/napi')
for (const f of readdirSync(napiDir)) {
  if (f.endsWith('.node'))
    copyFileSync(resolve(napiDir, f), resolve('dist', f))
}
