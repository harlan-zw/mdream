import { withMinimalPreset } from '@mdream/js'
import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('figure $name', (engineConfig) => {
  it('converts figure with image and figcaption', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="photo.jpg" alt="A photo"><figcaption>Photo caption</figcaption></figure>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('![A photo](photo.jpg)\n\n*Photo caption*')
  })

  it('converts figure with only a figcaption', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><figcaption>Photo caption</figcaption></figure>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('*Photo caption*')
  })

  it('converts figure with only an image', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="photo.jpg" alt="A photo"></figure>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('![A photo](photo.jpg)')
  })

  it('drops empty figcaption markers at document start and inside lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<figcaption></figcaption>', { engine })).toBe('')
    expect(htmlToMarkdown('<figcaption><div></div></figcaption>', { engine })).toBe('')
    expect(htmlToMarkdown('Before <figcaption><strong></strong></figcaption>After', { engine })).toBe('Before After')
    expect(htmlToMarkdown('Before<figcaption></figcaption>After', { engine })).toBe('BeforeAfter')
    expect(htmlToMarkdown('Before<figcaption></figcaption> After', { engine })).toBe('Before After')
    expect(htmlToMarkdown('Before <figcaption></figcaption>After', { engine })).toBe('Before After')
    expect(htmlToMarkdown('<p>Before</p><figcaption></figcaption>After', { engine })).toBe('Before\n\nAfter')
    expect(htmlToMarkdown('<ul><li>Before<figure><figcaption></figcaption></figure>After</li></ul>', { engine }))
      .toBe('- Before After')
  })

  it('preserves surrounding text for empty plain-text captions', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('Before<figcaption></figcaption>After', { engine, format: 'text' })).toBe('BeforeAfter')
    expect(htmlToMarkdown('Before <figcaption> \n </figcaption>After', { engine, format: 'text' })).toBe('Before After')
    expect(htmlToMarkdown('Before<figcaption>One</figcaption><figcaption></figcaption>After', { engine, format: 'text' }))
      .toBe('Before\n\nOne\n\nAfter')
  })

  it('normalizes spacing between consecutive figures', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="/a" alt="A"><figcaption>First</figcaption></figure><figure><img src="/b" alt="B"><figcaption>Second</figcaption></figure>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('![A](/a)\n\n*First*\n\n![B](/b)\n\n*Second*')
  })

  it('keeps figcaption in its list item', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><figure><img src="/i" alt="A"><figcaption>Caption</figcaption></figure></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('- ![A](/i)\n\n  *Caption*')
  })

  it('normalizes spacing after a caption-ending list item', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<ul><li><figcaption>One</figcaption></li><li>Two</li></ul>', { engine }))
      .toBe('- *One*\n\n- Two')
    expect(htmlToMarkdown('<ol><li><figcaption>One</figcaption></li><li>Two</li></ol>', { engine }))
      .toBe('1. *One*\n\n2. Two')
    expect(htmlToMarkdown('<ul><li><figcaption>One</figcaption></li></ul><p>After</p>', { engine }))
      .toBe('- *One*\n\nAfter')
    expect(htmlToMarkdown('<ul><li><figcaption>One</figcaption><blockquote>Quote</blockquote></li></ul>', { engine }))
      .toBe('- *One*\n\n  > Quote')
  })

  it('keeps caption spacing inside a list when content follows', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><figure><figcaption>Caption</figcaption><img src="/i" alt="A"></figure></li></ul>'
    expect(htmlToMarkdown(html, { engine })).toBe('- *Caption*\n\n  ![A](/i)')
    expect(htmlToMarkdown('<ul><li><figcaption>Outer</figcaption><ul><li>Inner</li></ul></li></ul>', { engine }))
      .toBe('- *Outer*\n\n  - Inner')
    expect(htmlToMarkdown('<ul><li>Before<figcaption> Caption </figcaption>After</li></ul>', { engine }))
      .toBe('- Before\n\n  *Caption*\n\n  After')
    expect(htmlToMarkdown('<ul><li>Before <figcaption> Caption </figcaption> After</li></ul>', { engine }))
      .toBe('- Before\n\n  *Caption*\n\n  After')
    expect(htmlToMarkdown('<ul><li><figcaption>x</figcaption><span> After</span></li></ul>', { engine }))
      .toBe('- *x*\n\n  After')
  })

  it('collapses source whitespace at figcaption block boundaries', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('Before <figcaption> Caption </figcaption> After', { engine }))
      .toBe('Before\n\n*Caption*\n\nAfter')
    expect(htmlToMarkdown('<figcaption><span> Caption</span></figcaption>', { engine })).toBe('*Caption*')
    expect(htmlToMarkdown('<figcaption><div> Caption</div></figcaption>', { engine })).toBe('*Caption*')
    expect(htmlToMarkdown('<em><figcaption><div>x</div></figcaption></em>', { engine })).toBe('**x**')
    expect(htmlToMarkdown('<figcaption>One*<span> Two</span></figcaption>', { engine })).toBe(String.raw`*One\* Two*`)
    expect(htmlToMarkdown('a<br><figcaption>b</figcaption>', { engine })).toBe('a  \n\n*b*')
    expect(htmlToMarkdown('<figcaption><a href="/x"></a> x</figcaption>', { engine })).toBe('*[](/x)x*')
    expect(htmlToMarkdown('<figcaption><a href="/x">a</a> x</figcaption>', { engine })).toBe('*[a](/x) x*')
    expect(htmlToMarkdown('<blockquote>Before <figcaption> Caption </figcaption> After</blockquote>', { engine }))
      .toBe('> Before\n>\n> *Caption*\n>\n> After')
  })

  it('keeps caption markers around table-cell breaks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<figcaption><br>x</figcaption>', { engine })).toBe('*x*')
    expect(htmlToMarkdown('<blockquote><figcaption><br>x</figcaption></blockquote>', { engine }))
      .toBe('>   \n> *x*')
    const html = '<table><tr><td><figure><figcaption><br>x</figcaption></figure></td></tr></table>'
    expect(htmlToMarkdown(html, { engine })).toBe('| *<br>x* |\n| --- |')
  })

  it('does not commit a caption for retracted inline output', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('Before<figcaption><em></em><br>x</figcaption>', { engine }))
      .toBe('Before  \n*x*')
    expect(htmlToMarkdown('<figcaption><a href="#"></a><blockquote>x</blockquote></figcaption>', {
      engine,
      clean: { emptyLinks: true },
    })).toBe('> *x*')
    expect(htmlToMarkdown('<figcaption><a href="/x"></a><blockquote>x</blockquote></figcaption>', {
      engine,
      clean: { emptyLinkText: true },
    })).toBe('> *x*')
    expect(htmlToMarkdown('A<figcaption><img src="i"></figcaption>B', {
      engine,
      clean: { emptyImages: true },
    })).toBe('AB')
    expect(htmlToMarkdown('A<figcaption><img src="i" alt=" "></figcaption>B', {
      engine,
      clean: { emptyImages: true },
    })).toBe('AB')
    expect(htmlToMarkdown('<figcaption><em><a href="x"><br></a></em></figcaption>', {
      engine,
      clean: { emptyLinkText: true },
    })).toBe('')
    expect(htmlToMarkdown('<figcaption><em><a href="x"></a></em>x</figcaption>', {
      engine,
      clean: { emptyLinkText: true },
    })).toBe('*x*')
    expect(htmlToMarkdown('<figcaption><a href="x"><br></a>x</figcaption>', { engine }))
      .toBe('*[  \n](x)x*')
    expect(htmlToMarkdown('<figcaption><a href="https://x.com">https://x.com</a></figcaption>', { engine }))
      .toBe('*<https://x.com>*')
    expect(htmlToMarkdown('a <figcaption><br>x</figcaption>', { engine })).toBe('a  \n*x*')
    expect(htmlToMarkdown('a<figcaption><br></figcaption> b', { engine })).toBe('a  \nb')
    expect(htmlToMarkdown('<figcaption><pre>x</pre></figcaption>', { engine }))
      .toBe('*```\nx\n```*')
    expect(htmlToMarkdown('<pre><figcaption><em></em></figcaption></pre>', { engine })).toBe('')
  })

  it('places a completed caption boundary before an inline marker', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<figcaption>x</figcaption><em>b</em>', { engine }))
      .toBe('*x*\n\n*b*')
    expect(htmlToMarkdown('<figure><img src="i" alt="A"><figcaption><a href="x">Source</a></figcaption></figure>', { engine }))
      .toBe('![A](i)\n\n*[Source](x)*')
  })

  it('drops caption breaks owned by a cleaned empty link', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="i" alt="A"><figcaption><a href="x"><br></a>Caption</figcaption></figure>'
    expect(htmlToMarkdown(html, { engine, clean: { emptyLinkText: true } }))
      .toBe('![A](i)\n\n*Caption*')
  })

  it('honors explicit caption spacing through plain-text formatting wrappers', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('Before<em><figcaption>Caption</figcaption></em>After', {
      engine,
      format: 'text',
      plugins: { tagOverrides: { figcaption: { spacing: [1, 1] } } },
    })).toBe('Before\nCaption\nAfter')
    expect(htmlToMarkdown('A<figcaption><br>x</figcaption>', { engine, format: 'text' }))
      .toBe('A\nx')
  })

  it('suppresses caption markers inside preformatted content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<pre><figcaption>text</figcaption></pre>', { engine }))
      .toBe('```\ntext\n```')
    expect(htmlToMarkdown('<pre><figcaption> \n </figcaption></pre>', { engine }))
      .toBe('')
    expect(htmlToMarkdown('<pre><figcaption><code>x</code></figcaption></pre>', { engine }))
      .toBe('```\nx\n```')
  })

  it('places wrapper exit output after the caption boundary', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><figure><figcaption>x</figcaption></figure>After</li></ul>'
    expect(htmlToMarkdown(html, {
      engine,
      plugins: { tagOverrides: { figure: { exit: 'TAIL' } } },
    })).toBe('- *x*\n\n  TAIL After')
  })

  it('keeps the default opener with an exit-only caption override', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<figcaption>x</figcaption>', {
      engine,
      plugins: { tagOverrides: { figcaption: { exit: ')' } } },
    })).toBe('*x)')
  })

  it('does not mistake emphasis before an empty block for a caption suffix', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<ul><li><em>x</em><p></p><blockquote>q</blockquote></li></ul>'
    expect(htmlToMarkdown(html, { engine })).toBe('- *x*\n\n  \n  > q')
  })

  it('does not split an enclosing link with figcaption spacing', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const figure = '<a href="/x"><figure><img src="/i" alt="A"><figcaption>Caption</figcaption></figure></a>'
    expect(htmlToMarkdown(figure, { engine })).toBe('[![A](/i)*Caption*](/x)')
    expect(htmlToMarkdown(`<ul><li>${figure}</li></ul>`, { engine })).toBe('- [![A](/i)*Caption*](/x)')
  })

  it('separates a figcaption before its image', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><figcaption>Caption</figcaption><img src="/i" alt="A"></figure>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('*Caption*\n\n![A](/i)')
  })

  it('preserves figcaption block spacing through an inline wrapper', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<figure><img src="/i" alt="A"><span><figcaption>Caption</figcaption></span></figure>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('![A](/i)\n\n*Caption*')
  })

  it('preserves the figcaption block boundary in plain text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { engine, format: 'text' as const }
    expect(htmlToMarkdown('<figure><img src="/i" alt="Alt"><figcaption>Caption</figcaption></figure>', options))
      .toBe('Alt\n\nCaption')
    expect(htmlToMarkdown('<ul><li><figure><img alt=A><figcaption>Caption</figcaption></figure></li></ul>', options))
      .toBe('A\n\nCaption')
    expect(htmlToMarkdown('<ul><li><figcaption>Caption</figcaption><img alt=A></li></ul>', options))
      .toBe('Caption\n\nA')
    expect(htmlToMarkdown('<ul><li>Before<figcaption> Caption </figcaption>After</li></ul>', options))
      .toBe('Before\n\nCaption\n\nAfter')
    expect(htmlToMarkdown('<blockquote>Before<span><figcaption><span> Caption</span></figcaption></span>After</blockquote>', options))
      .toBe('Before\n\nCaption\n\nAfter')
  })

  it('preserves figure content with minimal preset', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<html><body><main><figure><img src="photo.jpg" alt="A photo"><figcaption>Caption</figcaption></figure></main></body></html>'
    const markdown = htmlToMarkdown(html, { ...withMinimalPreset(), engine })
    expect(markdown).toBe('![A photo](photo.jpg)\n\n*Caption*')
  })
})
