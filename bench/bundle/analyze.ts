import process from 'node:process'
import { collectBundleData, renderBundleReport } from './bundle-report.ts'

let report = renderBundleReport(collectBundleData())

if (process.env.BASE_LABEL)
  report += `\n\n<sub>Baseline: ${process.env.BASE_LABEL} · gzip is the headline metric</sub>`

process.stdout.write(`${report}\n`)
