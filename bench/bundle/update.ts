import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { dirname, resolve } from 'pathe'
import { BUNDLES } from './bundles.ts'

const currentDir = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(currentDir, 'dist')
const newStats: Record<string, { size: number, gz: number }> = {}

for (const spec of BUNDLES) {
  const bundlePath = resolve(distDir, spec.file)
  if (!fs.existsSync(bundlePath))
    throw new Error(`Missing required bundle: ${spec.file}`)

  const contents = fs.readFileSync(bundlePath)
  newStats[spec.id] = {
    size: contents.length,
    gz: zlib.gzipSync(contents).length,
  }
}

fs.writeFileSync(
  resolve(currentDir, 'last.json'),
  `${JSON.stringify(newStats, null, 2)}\n`,
  'utf8',
)

process.stdout.write(`${JSON.stringify(newStats, null, 2)}\n`)
