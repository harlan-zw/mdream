import type { MdreamOptions as JsOptions } from '@mdream/js'
import type { MdreamOptions as RustOptions } from '../../src'
import { htmlToMarkdown as jsHtmlToMarkdown, streamHtmlToMarkdown as jsStreamHtmlToMarkdown } from '@mdream/js'
import { clean } from '@mdream/js/clean'
import { htmlToSafeHtml } from '@mdream/js/html'
import { frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from '@mdream/js/plugins'
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import { htmlToText } from '@mdream/js/text'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src'

// The Rust engine is the source of truth for output. Each case is the minimal
// repro of one divergence the parity sweep found in plugins or cleanup.

type Format = 'markdown' | 'text' | 'html'

interface Config {
  rust: RustOptions
  js: () => JsOptions
}

const CONFIGS = {
  frontmatter: { rust: { frontmatter: true }, js: () => ({ plugins: [frontmatterPlugin()] }) },
  isolateMain: { rust: { isolateMain: true }, js: () => ({ plugins: [isolateMainPlugin()] }) },
  tailwind: { rust: { tailwind: true }, js: () => ({ plugins: [tailwindPlugin()] }) },
  clean: { rust: { clean: true }, js: () => ({ clean: clean() }) },
  minimal: { rust: { minimal: true }, js: () => withMinimalPreset() },
} satisfies Record<string, Config>

const JS: Record<Format, (html: string, options: JsOptions) => string> = {
  markdown: jsHtmlToMarkdown,
  text: htmlToText,
  html: htmlToSafeHtml,
}

const CASES: { group: string, config: keyof typeof CONFIGS, formats?: Format[], html: string[] }[] = [
  { group: 'fm-empty-block', config: 'frontmatter', html: ['<head></head><p>x</p>', '<head>', '<head>e'] },
  { group: 'fm-empty-block', config: 'minimal', html: ['<head>', '<head>e'] },
  { group: 'fm-meta-order', config: 'frontmatter', html: [
    '<head><meta name="description" content="D"><meta property="og:title" content="O"></head>',
    '<head><meta name="description"content=" "><meta property="og:title"content=O>',
  ] },
  { group: 'tailwind-class-resolution', config: 'tailwind', formats: ['markdown', 'text', 'html'], html: [
    '<p class="hidden md:block">k</p>',
    '<h2 class="font- font-bold">t',
    '<h class="font- font-bold">l',
    '<p class="md:hidden">v</p>',
    '<p class="block md:hidden">v</p>',
    '<p class="absolute md:static">v</p>',
  ] },
  // HTML output is left out: Rust leaks the closers of <main>'s ancestors (group iso-leak-closers).
  { group: 'iso-main-depth-limit', config: 'isolateMain', formats: ['markdown', 'text'], html: [
    '<div><div><div><div><div><main>Basic<h1>T</h1></main></div></div></div></div></div>',
    '<d><d><v><d><v><main><h1>n</d>i h l',
  ] },
  { group: 'clean-escaped-bracket', config: 'clean', html: [
    '<p>[x](#y)</p>',
    '![]()]',
    '<p><code>[x](#)</code> and <code>![](y)</code></p>',
    '<pre><code>[x](#y)\n[](z)</code></pre>',
  ] },
  { group: 'clean-leftover-ws', config: 'clean', html: [
    '<p>A</p><p><img src=""></p><p>B</p>',
    'e<a href>',
    '<h3><a href>',
    '<li><a href>',
    'e<a href="/x"></a>',
  ] },
  { group: 'clean-fragment-nested-link', config: 'clean', html: [
    '<a href="#a"><div><a href="#b">x</a></div></a>',
    '<a href=#"><blockquote>é<a href=#">x',
    '<a href=#"><blockquote><a href="#b">x',
  ] },
  { group: 'clean-redundant-link-title', config: 'clean', html: [
    '<a href="https://example.com" title="e">https://example.com</a>',
  ] },
  { group: 'clean-url-angle-brackets', config: 'clean', html: [
    '<a href="http://t)">x</a>',
    '<a href="//)ae">e',
  ] },
  { group: 'clean-url-angle-brackets', config: 'minimal', html: ['<h2><a href=http://)>:'] },
  { group: 'clean-heading-anchor', config: 'clean', html: [
    '<h2>Q<a href="#q">#</a></h2>',
    '<h3>Composition API<a href="#composition-api">\u200B',
    '<h2>Q<a href="#q">x</a></h2>',
  ] },
  { group: 'clean-fragments', config: 'clean', html: [
    '<h2>Intro</h2><p><a href="#intro">up</a> <a href="#nope">gone</a></p>',
    '<p><a href="#later">fwd</a></p><h2>Later</h2>',
    '<ul><li><h3>In List</h3></li></ul><p><a href="#in-list">x</a></p>',
    '<pre><code>## Fake</code></pre><p><a href="#fake">x</a></p>',
  ] },
]

describe('javaScript plugins and cleanup match Rust', () => {
  for (const { group, config, formats = ['markdown'], html } of CASES) {
    for (const format of formats) {
      it(`${group} (${config}, ${format})`, () => {
        const { rust, js } = CONFIGS[config]
        for (const input of html)
          expect(JS[format](input, js()), JSON.stringify(input)).toBe(htmlToMarkdown(input, { ...rust, format }))
      })
    }
  }
})

function chunked(html: string, size: number): ReadableStream<string> {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index >= html.length)
        return controller.close()
      controller.enqueue(html.slice(index, index + size))
      index += size
    },
  })
}

async function drain(output: AsyncIterable<string>): Promise<string> {
  let result = ''
  for await (const chunk of output)
    result += chunk
  return result
}

describe('javaScript streams apply cleanup like one-shot (stream-js-clean-fragments-ignored)', () => {
  const inputs = [
    '<p>x <a href="/a?utm_source=1">l</a> <a href="#nope">f</a></p>',
    ...CASES.filter(c => c.config === 'clean').flatMap(c => c.html),
  ]
  it('clean', async () => {
    const { rust, js } = CONFIGS.clean
    for (const input of inputs) {
      const expected = htmlToMarkdown(input, rust)
      expect(jsHtmlToMarkdown(input, js()), JSON.stringify(input)).toBe(expected)
      for (const size of [1, 3, 16]) {
        const label = `${JSON.stringify(input)} in ${size} char chunks`
        expect(await drain(jsStreamHtmlToMarkdown(chunked(input, size), js())), label).toBe(expected)
        expect(await drain(streamHtmlToMarkdown(chunked(input, size), rust)), label).toBe(expected)
      }
    }
  })

  // The minimal preset differs from Rust on some of these inputs for reasons
  // outside cleanup, so it only checks the stream against one-shot.
  it('minimal', async () => {
    for (const input of inputs) {
      const expected = jsHtmlToMarkdown(input, withMinimalPreset())
      for (const size of [1, 3, 16])
        expect(await drain(jsStreamHtmlToMarkdown(chunked(input, size), withMinimalPreset())), `${JSON.stringify(input)} in ${size} char chunks`).toBe(expected)
    }
  })
})
