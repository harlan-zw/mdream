import fs from 'node:fs'
import process from 'node:process'
import { collectBundleData, renderBundleReport } from './bundle-report.ts'
import { renderPerfReport } from './perf-report.ts'

// Combined size + perf comment for the PR. Bundle data comes from the dist dirs
// (BASE_DIST for the base baseline); perf comes from JSON the workflow produced by
// running bench/perf-ci.mjs against the base and PR bundles (BASE_PERF / PR_PERF).
const sections: string[] = [renderBundleReport(collectBundleData())]

function readPerf(path?: string) {
  return path && fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : null
}

// guard on benches: a perf run that failed writes `{}`, which must skip the section, not crash
const prPerf = readPerf(process.env.PR_PERF)
if (prPerf?.benches?.length)
  sections.push(renderPerfReport(readPerf(process.env.BASE_PERF), prPerf))

let report = sections.join('\n\n---\n\n')

if (process.env.BASE_LABEL)
  report += `\n\n<sub>Baseline: ${process.env.BASE_LABEL} · gzip is the headline size metric · perf is directional (shared runner, noise-gated)</sub>`

process.stdout.write(`${report}\n`)
