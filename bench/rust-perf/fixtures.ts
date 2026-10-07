import { readFileSync } from 'node:fs'

export type OptionCase = 'default' | 'clean' | 'tailwind' | 'tailwind-extraction' | 'tailwind-capped' | 'metadata' | 'fragments'
export type Format = 'markdown' | 'text' | 'html'
export type Workload = {
  id: string
  name: string
  options: OptionCase
  format: Format
  inputBytes: number
  scaling?: { group: string, size: number }
} & ({ operation: 'convert', html: string } | { operation: 'stream', chunks: string[] } | { operation: 'split', markdown: string })

export function conversionOptions(options: OptionCase, format: Format) {
  switch (options) {
    case 'default': return { format }
    case 'clean': return { format, origin: 'https://example.com/docs/page', clean: { urls: true, redundantLinks: true } }
    case 'tailwind': return { format, plugins: { tailwind: true } }
    case 'tailwind-extraction': return { format, plugins: { tailwind: true, extraction: { selectors: ['h2'] } } }
    case 'tailwind-capped': return { format, plugins: { tailwind: true }, maxNodeBytes: 4096 }
    case 'metadata': return { format, plugins: { frontmatter: true, extraction: { selectors: ['h2'] } } }
    case 'fragments': return { format, clean: { fragments: true } }
  }
}

// Precompute transport chunks. Fixture generation never belongs inside a timed conversion.
export function utf8Chunks(source: string, width: number): string[] {
  if (!Number.isInteger(width) || width < 1)
    throw new Error('Chunk width must be a positive integer.')
  const bytes = Buffer.from(source)
  const chunks: string[] = []
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + width, bytes.length)
    while (end < bytes.length && (bytes[end]! & 0xC0) === 0x80) end++
    chunks.push(bytes.subarray(start, end).toString())
    start = end
  }
  return chunks
}

export function workloads(root: string, full = false): Workload[] {
  const cases: Workload[] = []
  function add(id: string, html: string, options: OptionCase = 'default', format: Format = 'markdown') {
    cases.push({ id, name: id.replaceAll('-', ' '), operation: 'convert', html, options, format, inputBytes: Buffer.byteLength(html) })
  }
  const count = 4096
  add('cleaned-links', '<a href="../guide?utm_source=x&amp;q=ok&amp;名=值#章">Guide</a> '.repeat(count), 'clean')
  add('entities', '<p>A &#97;nd B &copy; &#x1F642;</p>'.repeat(count))
  add('literal-ampersands', '<p>A & B &bogus;</p>'.repeat(count))
  add('code-spans', '<p><code>value</code></p>'.repeat(count))
  add('code-backticks', '<p><code>`x`</code></p>'.repeat(count))
  const attributes = '<div data-unused="abc" data-other="def" class="font-bold">Words</div>'.repeat(count)
  for (const options of ['tailwind', 'tailwind-extraction', 'tailwind-capped'] as const)
    add(`attributes-${options}`, attributes, options)
  for (const format of ['markdown', 'text', 'html'] as const) {
    add(`unicode-${format}`, `<p>${'東京日本語🙂éλληνικά'.repeat(12000)}</p>`, 'default', format)
    add(`ascii-${format}`, `<p>${'ordinary words '.repeat(28000)}</p>`, 'default', format)
  }
  for (const page of full ? ['vuejs-docs', 'mdn-array', 'react-learn', 'github-markdown-complete', 'wikipedia-small'] : ['vuejs-docs', 'wikipedia-small']) {
    const html = readFileSync(`${root}/crates/core/tests/fixtures/${page}.html`, 'utf8')
    for (const option of ['default', 'clean', 'tailwind'] as const) add(`${page}-${option}`, html, option)
  }
  for (const scale of [1, 2, 4]) {
    const size = scale * 128 * 1024
    const quote = `<blockquote>${`<span>${'x'.repeat(1024)}</span>`.repeat(size / 1024)}</blockquote>`
    const metadata = `<head><title>Benchmark title</title></head><h2>Intro</h2><blockquote>${'<p>Words in a paragraph.</p>'.repeat(Math.ceil(size / 28))}</blockquote>`
    const breaks = `<p>x${'<br>&#9;'.repeat(scale * 2048)}y</p>`
    for (const [group, html, options] of [['quote', quote, 'default'], ['metadata', metadata, 'metadata'], ['breaks', breaks, 'default']] as const) {
      cases.push({ id: `${group}-${scale}x`, name: `${group} ${scale}x`, operation: 'stream', chunks: utf8Chunks(html, 1024), options, format: 'markdown', inputBytes: Buffer.byteLength(html), scaling: { group, size: scale } })
    }
    // Keep the Markdown identical between versions. HTML conversion is a separate workload.
    const markdown = `## Section\n\n${'Paragraph words.\n\n```ts\nconst x = 1\n```\n\n'.repeat(scale * 1024)}${'x'.repeat(size)}`
    cases.push({ id: `split-${scale}x`, name: `split ${scale}x`, operation: 'split', markdown, options: 'default', format: 'markdown', inputBytes: Buffer.byteLength(markdown), scaling: { group: 'split', size: scale } })
    // Independently vary item count and attribute length.
    for (const axis of ['items', 'attribute'] as const) {
      const html = `<ol start="${' '.repeat(axis === 'attribute' ? scale * 4096 : 4096)}3">${'<li>x'.repeat(axis === 'items' ? scale * 1024 : 1024)}</ol>`
      add(`list-${axis}-${scale}x`, html)
      cases.at(-1)!.scaling = { group: `list-${axis}`, size: scale }
    }
  }
  return cases
}
