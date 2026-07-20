import fs from 'node:fs'
import process from 'node:process'
import { collectBundleData, renderBundleReport } from './bundle-report.ts'
import { renderPerfReport } from './perf-report.ts'

// Combined size + perf comment for the PR. Bundle data comes from the dist dirs
// (BASE_DIST for the base baseline); perf comes from JSON the workflow produced by
// running bench/perf-ci.mjs against the base and PR bundles (BASE_PERF / PR_PERF).
// Each env var may hold a comma-separated list of JSON files (the timed run and the
// no-opt alloc run); their benches are merged into one set.
const sections: string[] = [renderBundleReport(collectBundleData())]

function readPerf(paths?: string) {
  if (!paths)
    return null
  const benches = paths.split(',').flatMap((path) => {
    if (!path || !fs.existsSync(path))
      return []
    return JSON.parse(fs.readFileSync(path, 'utf8'))?.benches ?? []
  })
  return benches.length ? { benches } : null
}

// guard on benches: a perf run that failed writes `{}`, which must skip the section, not crash
const prPerf = readPerf(process.env.PR_PERF)
if (prPerf?.benches?.length)
  sections.push(renderPerfReport(readPerf(process.env.BASE_PERF), prPerf))

let report = sections.join('\n\n---\n\n')

if (process.env.BASE_LABEL)
  report += `\n\n<sub>Baseline: ${process.env.BASE_LABEL} · gzip is the headline size metric · perf is directional (shared runner, noise-gated)</sub>`

process.stdout.write(`${report}\n`)
