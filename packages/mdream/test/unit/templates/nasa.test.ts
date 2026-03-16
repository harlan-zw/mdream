import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('nasa $name', (engineConfig) => {
  it('noscript iframe break', async () => {
    const html = `
<!doctype html>
<html lang="en-US" prefix="og: https://ogp.me/ns#">
<head>
<title>Missions - NASA</title>
</head>
<body class="archive post-type-archive post-type-archive-mission">
\t<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NLJ258M"
\theight="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
\t<div>hello world</div>
`
    const engine = await resolveEngine(engineConfig.engine)
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toMatchSnapshot()
  })
})
