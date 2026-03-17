import { execSync } from 'node:child_process'
import { readdirSync, rmSync, unlinkSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
execSync('ncc build src/index.ts -o dist --no-source-map-register --minify', { stdio: 'inherit' })

for (const f of readdirSync('dist')) {
  if (f.endsWith('.js') && f !== 'index.js')
    unlinkSync(`dist/${f}`)
}
