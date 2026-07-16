import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine, streamHtmlToMarkdown } from '../../utils/engines'

function chunkedStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const chunk of stream)
    out += chunk
  return out
}

describe.each(engines)('script/style rawtext closing tags $name', (engineConfig) => {
  it('closes style after an unmatched quote in a CSS comment', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<style>/* it\'s */ a{}</style><p>BODY</p>'

    const result = htmlToMarkdown(html, { engine })
    expect(result).toBe('BODY')
  })

  it('closes script at a matching end tag inside a quoted value', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<script>var s="</script>"<p>BODY</p>'

    const result = htmlToMarkdown(html, { engine })
    expect(result).toBe('"\n\nBODY')
  })

  it('closes style at a matching end tag inside a quoted value', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<style>.a::before{content:"</style><p>BODY</p>'

    const result = htmlToMarkdown(html, { engine })
    expect(result).toBe('BODY')
  })

  it('keeps script tags inside style rawtext', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<style>/* <script>alert("nested")</script> */</style><p>AFTER</p>'

    const result = htmlToMarkdown(html, { engine })
    expect(result).toBe('AFTER')
  })

  it('keeps escaped script end tags inside rawtext', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = [
      '<script>',
      'const multiline = `',
      '<script>alert(\'nested\')<\\/script>',
      '`',
      '</script>',
      '<p>AFTER</p>',
    ].join('\n')

    const result = htmlToMarkdown(html, { engine })
    expect(result).toBe('AFTER')
  })

  it('accepts a slash delimiter on rawtext end tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<script>x</script/><p>BODY</p>'

    const result = htmlToMarkdown(html, { engine })
    expect(result).toBe('BODY')
  })

  it('ignores end tags that only exit double-escaped script data', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const cases = [
      '<script><!--<script></script>--></script><p>BODY</p>',
      '<script><!--<ScRiPt></sCrIpT>--></script><p>BODY</p>',
      '<script><!--<script>--></script><p>BODY</p>',
      '<script><!--<script></scrip>--></script><p>BODY</p>',
      '<script><!--<script></script-->--></script><p>BODY</p>',
    ]

    for (const html of cases)
      expect(htmlToMarkdown(html, { engine })).toBe('BODY')
  })

  it('closes script from escaped data', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<script><!-- </script><p>BODY</p>'

    expect(htmlToMarkdown(html, { engine })).toBe('BODY')
  })

  it('only enters double-escaped data for the script name', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const cases = [
      '<script><!--<scriptx></script>--></script><p>BODY</p>',
      '<script><!--<scrip></script>--></script><p>BODY</p>',
      '<script><!--<script</script>--></script><p>BODY</p>',
      '<script><!--<script><script></script></script>--></script><p>BODY</p>',
    ]

    for (const html of cases)
      expect(htmlToMarkdown(html, { engine })).toBe('-->\n\nBODY')
  })

  it('keeps double-escaped script data open through EOF', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<script><!--<script></script>--><p>BODY</p>'

    expect(htmlToMarkdown(html, { engine })).toBe('')
  })

  it('matches double-escaped script data across every stream split', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<script><!--<script></script>--></script><p>BODY</p>'

    for (let split = 1; split < html.length; split++) {
      const chunks = [html.slice(0, split), html.slice(split)]
      const result = await collect(streamHtmlToMarkdown(chunkedStream(chunks), { engine }))
      expect(result.trim()).toBe('BODY')
    }
  })

  it('closes rawtext when the matching end tag spans stream chunks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const chunks = ['<script>var s = "</scr', 'ipt><p>BODY</p>']
    const result = await collect(streamHtmlToMarkdown(chunkedStream(chunks), { engine }))
    expect(result.trim()).toBe('BODY')
  })
})
