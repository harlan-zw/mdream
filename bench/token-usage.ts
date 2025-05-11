import { readFileSync } from 'node:fs'
// compare token usage of html vs markdown
// html: ./bundle/wiki.html
// markdown: ./bundle/dist/wiki.md
import { tokenizeAndEstimateCost } from 'llm-cost'

async function main() {
  const html = readFileSync('bench/bundle/wiki.html', 'utf-8')
  const htmlResult = await tokenizeAndEstimateCost({
    model: 'gpt-4',
    input: html,
    output: '',
  })

  console.log(htmlResult)

  const markdown = readFileSync('bench/bundle/dist/wiki.md', 'utf-8')
  const markdownResult = await tokenizeAndEstimateCost({
    model: 'gpt-4',
    input: markdown,
    output: '',
  })
  console.log(markdownResult)

  // do diff %
  const diff = (markdownResult.inputTokens - htmlResult.inputTokens) / htmlResult.inputTokens * 100
  console.log(`Diff: ${diff.toFixed(2)}%`)
  // Output: { inputTokens: 4, outputTokens: 7, cost: 0.00054 }
}

main()
