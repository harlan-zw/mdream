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

  it('closes rawtext when the matching end tag spans stream chunks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const chunks = ['<script>var s = "</scr', 'ipt><p>BODY</p>']
    const result = await collect(streamHtmlToMarkdown(chunkedStream(chunks), { engine }))
    expect(result.trim()).toBe('BODY')
  })
})
