import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../../src/index.js'

describe('tables', () => {
  it('converts basic tables with headers', () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Value 1</td>
            <td>Value 2</td>
          </tr>
          <tr>
            <td>Value 3</td>
            <td>Value 4</td>
          </tr>
        </tbody>
      </table>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2 |\n'
      + '| --- | --- |\n'
      + '| Value 1 | Value 2 |\n'
      + '| Value 3 | Value 4 |',
    )
  })

  it('handles tables without thead/tbody', () => {
    const html = `
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Value 1</td>
          <td>Value 2</td>
        </tr>
      </table>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2 |\n'
      + '| --- | --- |\n'
      + '| Value 1 | Value 2 |',
    )
  })

  it('handles tables with formatting in cells', () => {
    const html = `
      <table>
        <tr>
          <th>Formatting</th>
          <th>Example</th>
        </tr>
        <tr>
          <td>Bold</td>
          <td><strong>bold text</strong></td>
        </tr>
        <tr>
          <td>Link</td>
          <td><a href="https://example.com">link</a></td>
        </tr>
      </table>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Formatting | Example |\n'
      + '| --- | --- |\n'
      + '| Bold | **bold text** |\n'
      + '| Link | [link](https://example.com) |',
    )
  })

  it('handles empty table cells', () => {
    const html = `
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Value 1</td>
          <td></td>
        </tr>
        <tr>
          <td></td>
          <td>Value 4</td>
        </tr>
      </table>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2 |\n'
      + '| --- | --- |\n'
      + '| Value 1 | |\n'
      + '|  | Value 4 |',
    )
  })

  it('handles tables with alignment attributes', () => {
    const html = `
      <table>
        <tr>
          <th align="left">Left</th>
          <th align="center">Center</th>
          <th align="right">Right</th>
        </tr>
        <tr>
          <td>1</td>
          <td>2</td>
          <td>3</td>
        </tr>
      </table>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Left | Center | Right |\n'
      + '| :--- | :---: | ---: |\n'
      + '| 1 | 2 | 3 |',
    )
  })

  it.skip('handles tables with colspan and rowspan', () => {
    const html = `
      <table>
        <tr>
          <th>Header 1</th>
          <th colspan="2">Header 2-3</th>
        </tr>
        <tr>
          <td>Value 1</td>
          <td>Value 2</td>
          <td>Value 3</td>
        </tr>
      </table>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2-3 |  |\n'
      + '| --- | --- | --- |\n'
      + '| Value 1 | Value 2 | Value 3 |',
    )
  })
  it('handles large tables without stack overflow', async () => {
    const cols = 10
    const rows = 5000
    const headerCells = Array.from({ length: cols }, (_, i) => `<th>Col ${i}</th>`).join('')
    const row = `<tr>${Array.from({ length: cols }, (_, i) => `<td>Cell ${i}</td>`).join('')}</tr>`
    const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${row.repeat(rows)}</tbody></table>`

    // sync
    const md = htmlToMarkdown(html)
    const lines = md.split('\n')
    // header + separator + rows
    expect(lines.length).toBe(rows + 2)

    // streaming
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(html))
        controller.close()
      },
    })
    let streamed = ''
    for await (const chunk of streamHtmlToMarkdown(stream)) {
      streamed += chunk
    }
    expect(streamed.trim()).toBe(md)
  })

  it('github advanced example', () => {
    const html = `
      <table><thead><tr><th scope="col">Style</th><th scope="col">Syntax</th><th scope="col">Keyboard shortcut</th><th scope="col">Example</th><th scope="col">Output</th></tr></thead><tbody><tr><td>Bold</td><td><code>** **</code> or <code>__ __</code></td><td><kbd>Command</kbd>+<kbd>B</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>B</kbd> (Windows/Linux)</td><td><code>**This is bold text**</code></td><td><strong>This is bold text</strong></td></tr><tr><td>Italic</td><td><code>* *</code> or <code>_ _</code> &emsp;&emsp;&emsp;&emsp;</td><td><kbd>Command</kbd>+<kbd>I</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>I</kbd> (Windows/Linux)</td><td><code>_This text is italicized_</code></td><td><em>This text is italicized</em></td></tr><tr><td>Strikethrough</td><td><code>~~ ~~</code> or <code>~ ~</code></td><td>None</td><td><code>~~This was mistaken text~~</code></td><td><del>This was mistaken text</del></td></tr><tr><td>Bold and nested italic</td><td><code>** **</code> and <code>_ _</code></td><td>None</td><td><code>**This text is _extremely_ important**</code></td><td><strong>This text is <em>extremely</em> important</strong></td></tr><tr><td>All bold and italic</td><td><code>*** ***</code></td><td>None</td><td><code>***All this text is important***</code></td><td><em><strong>All this text is important</strong></em></td></tr><tr><td>Subscript</td><td><code>&lt;sub&gt; &lt;/sub&gt;</code></td><td>None</td><td><code>This is a &lt;sub&gt;subscript&lt;/<wbr>sub&gt; text</code></td><td>This is a <sub>subscript</sub> text</td></tr><tr><td>Superscript</td><td><code>&lt;sup&gt; &lt;/sup&gt;</code></td><td>None</td><td><code>This is a &lt;sup&gt;superscript&lt;/<wbr>sup&gt; text</code></td><td>This is a <sup>superscript</sup> text</td></tr><tr><td>Underline</td><td><code>&lt;ins&gt; &lt;/ins&gt;</code></td><td>None</td><td><code>This is an &lt;ins&gt;underlined&lt;/<wbr>ins&gt; text</code></td><td>This is an <ins>underlined</ins> text</td></tr></tbody></table>`
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "| Style | Syntax | Keyboard shortcut | Example | Output |
      | --- | --- | --- | --- | --- |
      | Bold | \`** **\` or \`__ __\` | \`Command\`+\`B\` (Mac) or \`Ctrl\`+\`B\` (Windows/Linux) | \`**This is bold text**\` | **This is bold text** |
      | Italic | \`* *\` or \`_ _\` &emsp;&emsp;&emsp;&emsp; | \`Command\`+\`I\` (Mac) or \`Ctrl\`+\`I\` (Windows/Linux) | \`_This text is italicized_\` | _This text is italicized_ |
      | Strikethrough | \`~~ ~~\` or \`~ ~\` | None | \`~~This was mistaken text~~\` | ~~This was mistaken text~~ |
      | Bold and nested italic | \`** **\` and \`_ _\` | None | \`**This text is _extremely_ important**\` | **This text is _extremely_ important** |
      | All bold and italic | \`*** ***\` | None | \`***All this text is important***\` | _**All this text is important**_ |
      | Subscript | \`<sub> </sub>\` | None | \`This is a <sub>subscript</sub> text\` | This is a <sub>subscript</sub> text |
      | Superscript | \`<sup> </sup>\` | None | \`This is a <sup>superscript</sup> text\` | This is a <sup>superscript</sup> text |
      | Underline | \`<ins> </ins>\` | None | \`This is an <ins>underlined</ins> text\` | This is an <ins>underlined</ins> text |"
    `)
  })
})
