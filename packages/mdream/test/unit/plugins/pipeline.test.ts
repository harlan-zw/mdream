import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../../src/index.ts'

describe('pipeline transforms', () => {
  it('beforeParse transforms HTML before conversion', () => {
    const result = htmlToMarkdown('<div class="ad">Buy now!</div><p>Real content</p>', {
      pipeline: [{
        beforeParse: html => html.replace(/<div class="ad">.*?<\/div>/g, ''),
      }],
    }).markdown

    expect(result).not.toContain('Buy now')
    expect(result).toContain('Real content')
  })

  it('afterConvert transforms markdown after conversion', () => {
    const result = htmlToMarkdown('<p>Hello world</p>', {
      pipeline: [{
        afterConvert: md => md.replace('Hello', 'Goodbye'),
      }],
    }).markdown

    expect(result).toContain('Goodbye world')
    expect(result).not.toContain('Hello')
  })

  it('chains multiple pipeline transforms in order', () => {
    const result = htmlToMarkdown('<p>original</p>', {
      pipeline: [
        { beforeParse: html => html.replace('original', 'step1') },
        { beforeParse: html => html.replace('step1', 'step2') },
        { afterConvert: md => md.replace('step2', 'step3') },
        { afterConvert: md => `${md.trim()}\n\n---\nAppended` },
      ],
    }).markdown

    expect(result).toContain('step3')
    expect(result).toContain('---\nAppended')
  })

  it('combines pipeline with builtin plugins', () => {
    const result = htmlToMarkdown(
      '<html><head><title>Test</title></head><body><p>Content</p></body></html>',
      {
        plugins: { frontmatter: true },
        pipeline: [{
          afterConvert: md => md.replace('Content', 'Modified Content'),
        }],
      },
    ).markdown

    expect(result).toContain('title: Test')
    expect(result).toContain('Modified Content')
  })

  it.skip('combines pipeline with node-level transforms (JS engine)', () => {
    const result = htmlToMarkdown('<p>Hello</p>', {
      hooks: [{
        processTextNode: (node) => {
          return { content: node.value.toUpperCase(), skip: false }
        },
      }],
      pipeline: [{
        afterConvert: md => `PREFIX\n\n${md}`,
      }],
    }).markdown

    expect(result).toContain('PREFIX')
    expect(result).toContain('HELLO')
  })

  it('afterConvert works with streaming', async () => {
    const html = '<p>Stream test</p>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html)
        controller.close()
      },
    })

    const chunks: string[] = []
    for await (const chunk of streamHtmlToMarkdown(stream, {
      pipeline: [{
        afterConvert: md => md.replace('Stream', 'Pipeline'),
      }],
    })) {
      chunks.push(chunk)
    }

    const result = chunks.join('')
    expect(result).toContain('Pipeline test')
  })

  it('beforeParse works with streaming', async () => {
    const html = '<div class="remove">gone</div><p>Keep this</p>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html)
        controller.close()
      },
    })

    const chunks: string[] = []
    for await (const chunk of streamHtmlToMarkdown(stream, {
      pipeline: [{
        beforeParse: h => h.replace(/<div class="remove">.*?<\/div>/g, ''),
      }],
    })) {
      chunks.push(chunk)
    }

    const result = chunks.join('')
    expect(result).not.toContain('gone')
    expect(result).toContain('Keep this')
  })

  it('works with empty pipeline array (no-op)', () => {
    const result = htmlToMarkdown('<p>Unchanged</p>', { pipeline: [] }).markdown
    expect(result).toContain('Unchanged')
  })

  it('pipeline with only beforeParse skips afterConvert wrapping', () => {
    const result = htmlToMarkdown('<p>test</p><div class="ad">ad</div>', {
      pipeline: [{
        beforeParse: html => html.replace(/<div class="ad">.*?<\/div>/g, ''),
      }],
    }).markdown

    expect(result).toContain('test')
    expect(result).not.toContain('ad')
  })
})
