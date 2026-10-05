import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { filterPlugin } from '../../src/plugins/filter'
import { tailwindPlugin } from '../../src/plugins/tailwind'

const LIMIT = 512

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

describe('element depth limit', () => {
  it('leaves content at the limit unchanged', () => {
    const html = `${'<div>'.repeat(LIMIT)}deep${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('deep')
  })

  it('keeps converting when nesting exceeds the materialized limit', () => {
    const html = `<p>before</p>${'<div>'.repeat(100_000)}inside${'</div>'.repeat(100_000)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('before\n\ninside\n\nafter')
  })

  it('does not count self-closing elements at the limit', () => {
    const html = `${'<div>'.repeat(LIMIT)}<br>kept${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toContain('kept')
  })

  it('applies implied-end recovery before checking the limit', () => {
    const output = htmlToMarkdown('<p>item'.repeat(1_000))
    expect(output.match(/item/g)).toHaveLength(1_000)
  })

  it('keeps later siblings after implied ends in overflow', () => {
    const html = `${'<div>'.repeat(LIMIT)}<p>one<p>two</p>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('one two\n\nafter')
  })

  it('recovers implied ends across the overflow boundary', () => {
    const html = `<p>A${'<span>'.repeat(LIMIT - 1)}<em>B<div>C`
    expect(htmlToMarkdown(html)).toBe('AB\n\nC')
  })

  it('recovers links and list items across the overflow boundary', () => {
    const link = `<a href="x">A${'<span>'.repeat(LIMIT - 1)}<em>B</a>C`
    expect(htmlToMarkdown(link)).toBe('[AB](x)C')

    const list = `<ul><li>A${'<span>'.repeat(LIMIT - 2)}<em>B<li>C</ul>`
    expect(htmlToMarkdown(list)).toBe('- AB\n- C')
  })

  it('ignores mismatched built-in closes inside overflow', () => {
    const html = `${'<div>'.repeat(LIMIT)}<span><em>inside</table></span>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('inside\n\nafter')
  })

  it('keeps consuming streamed chunks after reaching the limit', async () => {
    const chunks = ['<p>before</p>']
    for (let i = 0; i < 10_000; i++)
      chunks.push('<div>')
    chunks.push('inside')
    for (let i = 0; i < 10_000; i++)
      chunks.push('</div>')
    chunks.push('<p>after</p>')
    expect((await streamConvert(chunks)).trimEnd()).toBe('before\n\ninside\n\nafter')
  })

  it('does not leak content hidden at the limit', () => {
    const html = `${'<div>'.repeat(LIMIT - 1)}<template><strong>hidden</strong></template><p>visible</p>${'</div>'.repeat(LIMIT - 1)}`
    expect(htmlToMarkdown(html)).toBe('visible')
  })

  it('does not emit or pop a parent for a skipped CDATA override', () => {
    const html = `${'<div>'.repeat(LIMIT)}<![CDATA[hidden]]><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html, {
      tagOverrides: {
        '#cdata-section': { enter: '[', exit: ']', isInline: true, spacing: [0, 0] },
      },
    })).toBe('visible')
  })

  it('keeps raw text hidden beyond the materialized limit', () => {
    const html = `${'<div>'.repeat(LIMIT)}<script></div><p>hidden</p></script><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('visible')
  })

  it('keeps visible table and image content in overflow', () => {
    const html = `${'<div>'.repeat(LIMIT)}<table><tr><td>cell</td></tr></table><span><img src="x" alt="image"></span>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('cell![image](x)\n\nafter')
  })

  it('matches case-insensitive built-in closes in overflow', () => {
    const html = `${'<div>'.repeat(LIMIT)}<SCRIPT>hidden</SCRIPT><p>visible</p>${'</div>'.repeat(LIMIT)}`
    expect(htmlToMarkdown(html)).toBe('visible')
  })

  it('recovers a streamed raw text close split across chunks', async () => {
    expect(await streamConvert([
      `${'<div>'.repeat(LIMIT)}<script>hidden</scr`,
      `ipt><p>visible</p>${'</div>'.repeat(LIMIT)}<p>tail</p>`,
    ])).toBe('visible\n\ntail')
  })

  it('keeps depth context above 255 matching tags', () => {
    const html = `${'<blockquote>'.repeat(300)}${'</blockquote>'.repeat(255)}x > y${'</blockquote>'.repeat(45)}`
    expect(htmlToMarkdown(html)).toContain('\\>')
  })

  it('preserves structural ancestors across the overflow boundary', () => {
    const html = `<blockquote><blockquote>ALPHA${'<div>'.repeat(LIMIT)}<head><p>X</p>${'</div>'.repeat(LIMIT)}OMEGA</blockquote></blockquote>ZED`
    expect(htmlToMarkdown(html)).toBe('> > ALPHA\n> >\n> > X\n> >\n> > OMEGA\n\nZED')
  })

  it('keeps template content inert inside the flattened subtree', () => {
    const html = `${'<div>'.repeat(LIMIT)}${'<span>'.repeat(LIMIT)}<template><b>hidden</template>${'</span>'.repeat(LIMIT)}${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('after')
  })

  it('keeps filtered content hidden in overflow', () => {
    const html = `${'<div>'.repeat(LIMIT)}<div style="display:none"></span><img src="x" alt="secret"></div>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html, { plugins: [filterPlugin()] })).toBe('after')
  })

  it('scans a hidden raw overflow root as raw text', () => {
    const html = `${'<div>'.repeat(LIMIT)}<script hidden>let x = "<script>"</script>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html, { plugins: [filterPlugin()] })).toBe('after')
    expect(htmlToMarkdown(html, { plugins: [tailwindPlugin()] })).toBe('after')
  })

  it('keeps visible overflow content with output-neutral plugins', () => {
    const html = `${'<div>'.repeat(LIMIT)}<span>visible</span>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html, { plugins: [filterPlugin()] })).toBe('visible\n\nafter')
    expect(htmlToMarkdown(html, { plugins: [tailwindPlugin()] })).toBe('visible\n\nafter')
  })

  it('keeps self-closing content inert inside overflow templates', () => {
    const html = `${'<div>'.repeat(LIMIT)}<template><script></template></script><img src="x" alt="secret"><hr></template>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html)).toBe('after')
  })

  it('keeps excluded raw aliases inert in overflow', () => {
    const html = `${'<div>'.repeat(LIMIT)}<x-raw>secret</y-raw>still secret</x-raw>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html, {
      tagOverrides: { 'x-raw': 'script', 'y-raw': 'script' },
    })).toBe('after')
  })

  it('starts opaque overflow only for plugin-hidden subtrees', () => {
    const html = `${'<div>'.repeat(LIMIT)}<span class="secret hidden"><img src="x" alt="secret"></span>${'</div>'.repeat(LIMIT)}<p>after</p>`
    expect(htmlToMarkdown(html, {
      plugins: [filterPlugin({ exclude: ['.secret'] })],
    })).toBe('after')
    expect(htmlToMarkdown(html, {
      plugins: [tailwindPlugin()],
    })).toBe('after')
  })
})
