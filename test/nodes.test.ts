import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../src/index.js'
import {parseHTML} from "../src/parser.js";

describe('headings', () => {
  it('converts h1', async () => {
    const html = '<h1>Heading 1</h1>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', async () => {
    const html = '<h2>Heading 2</h2>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', async () => {
    const html = '<h3>Heading 3</h3>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', async () => {
    const html = '<h4>Heading 4</h4>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', async () => {
    const html = '<h5>Heading 5</h5>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', async () => {
    const html = '<h6>Heading 6</h6>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('###### Heading 6')
  })
})

describe('paragraphs and Line Breaks', () => {
  it('converts paragraphs', async () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('First paragraph\n\nSecond paragraph')
  })

  it('converts line breaks', async () => {
    const html = '<p>Line 1<br>Line 2</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Line 1\nLine 2')
  })
})

describe('text Formatting', () => {
  it('converts bold text with <strong>', async () => {
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', async () => {
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', async () => {
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is *italic* text')
  })

  it('converts italic text with <i>', async () => {
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is *italic* text')
  })

  it('handles nested formatting', async () => {
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('This is ***bold and italic*** text')
  })
})

describe('links', () => {
  it('converts simple links', async () => {
    const html = '<a href="https://example.com">Example</a>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links with titles', async () => {
    const html = '<a href="https://example.com" title="Example Site">Example</a>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links in paragraphs', async () => {
    const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Visit [Example](https://example.com) for more info.')
  })
})

describe('images', () => {
  it('converts simple images', async () => {
    const html = '<img src="image.jpg" alt="Description">'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('![Description](image.jpg)')
  })

  it('handles images without alt text', async () => {
    const html = '<img src="image.jpg">'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('![](image.jpg)')
  })

  it('handles images in paragraphs', async () => {
    const html = '<p>An image: <img src="image.jpg" alt="Description"></p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('An image: ![Description](image.jpg)')
  })
})

describe('lists', () => {
  it('converts unordered lists', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Item 1\n- Item 2')
  })

  it('converts ordered lists', async () => {
    const html = '<ol><li>First</li><li>Second</li></ol>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('1. First\n2. Second')
  })

  it('handles nested unordered lists', async () => {
    const html = '<ul><li>Level 1<ul><li>Level 2</li></ul></li><li>Another Level 1</li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Level 1\n  - Level 2\n- Another Level 1')
  })

  it('handles nested ordered lists', async () => {
    const html = '<ol><li>Level 1<ol><li>Level 1.1</li></ol></li><li>Level 2</li></ol>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('1. Level 1\n  1. Level 1.1\n2. Level 2')
  })

  it('handles mixed nested lists', async () => {
    const html = '<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('- Unordered\n  1. Ordered')
  })
})

describe('code', () => {
  it('converts inline code', async () => {
    const html = '<p>Use the <code>print()</code> function</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Use the `print()` function')
  })

  it('converts code blocks without language', async () => {
    const html = '<pre><code>function example() {\n  return true;\n}</code></pre>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('```\nfunction example() {\n  return true;\n}\n```')
  })

  it('converts code blocks with language', async () => {
    const html = '<pre><code class="language-javascript">const x = 1;</code></pre>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('```javascript\nconst x = 1;\n```')
  })
})

describe('blockquotes', () => {
  it('converts blockquotes', async () => {
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote')
  })

  it('handles nested blockquotes', async () => {
    const html = '<blockquote>Outer quote<blockquote>Inner quote</blockquote></blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> Outer quote\n> > Inner quote')
  })

  it('handles blockquotes with paragraphs', async () => {
    const html = '<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> First paragraph\n> Second paragraph')
  })

  it('handles complex nested blockquotes', async () => {
    const html = '<blockquote><p>Outer paragraph</p><blockquote><p>Inner paragraph</p></blockquote></blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> Outer paragraph\n> > Inner paragraph')
  })
  // test for > A quote with an ![image](image.jpg) inside.
  it('handles blockquotes with images', async () => {
    const html = '<blockquote>This is a quote with an <img src="image.jpg" alt="image"></blockquote>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote with an ![image](image.jpg)')
  })
})

describe('horizontal Rules', () => {
  it('converts hr elements', async () => {
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })
})

describe('html Entities', () => {
  it('decodes common HTML entities', async () => {
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', async () => {
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe('© — 😀')
  })
})

describe('combined Elements', () => {
  it('handles complex content with multiple element types', async () => {
    const html = `
      <h1>Document Title</h1>
      <p>This is a <strong>bold</strong> and <em>important</em> paragraph with a <a href="https://example.com">link</a>.</p>
      <ul>
        <li>Item with <code>inline code</code></li>
        <li>Item with <a href="https://example.org">another link</a></li>
      </ul>
      <blockquote>
        <p>A quote with an <img src="image.jpg" alt="image"> inside.</p>
      </blockquote>
      <pre><code class="language-js">console.log("Hello world!");</code></pre>
    `
    const doc = parseHTML(html)
    expect(doc).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "attributes": {},
            "children": [
              {
                "children": [],
                "parent": [Circular],
                "type": 2,
                "value": "Document Title",
              },
            ],
            "name": "h1",
            "parent": [Circular],
            "type": 1,
          },
          {
            "attributes": {},
            "children": [
              {
                "children": [],
                "parent": [Circular],
                "type": 2,
                "value": "This is a ",
              },
              {
                "attributes": {},
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "bold",
                  },
                ],
                "name": "strong",
                "parent": [Circular],
                "type": 1,
              },
              {
                "children": [],
                "parent": [Circular],
                "type": 2,
                "value": " and ",
              },
              {
                "attributes": {},
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "important",
                  },
                ],
                "name": "em",
                "parent": [Circular],
                "type": 1,
              },
              {
                "children": [],
                "parent": [Circular],
                "type": 2,
                "value": " paragraph with a ",
              },
              {
                "attributes": {
                  "href": "https://example.com",
                },
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "link",
                  },
                ],
                "name": "a",
                "parent": [Circular],
                "type": 1,
              },
              {
                "children": [],
                "parent": [Circular],
                "type": 2,
                "value": ".",
              },
            ],
            "name": "p",
            "parent": [Circular],
            "type": 1,
          },
          {
            "attributes": {},
            "children": [
              {
                "attributes": {},
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "Item with ",
                  },
                  {
                    "attributes": {},
                    "children": [
                      {
                        "children": [],
                        "parent": [Circular],
                        "type": 2,
                        "value": "inline code",
                      },
                    ],
                    "name": "code",
                    "parent": [Circular],
                    "type": 1,
                  },
                ],
                "name": "li",
                "parent": [Circular],
                "type": 1,
              },
              {
                "attributes": {},
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "Item with ",
                  },
                  {
                    "attributes": {
                      "href": "https://example.org",
                    },
                    "children": [
                      {
                        "children": [],
                        "parent": [Circular],
                        "type": 2,
                        "value": "another link",
                      },
                    ],
                    "name": "a",
                    "parent": [Circular],
                    "type": 1,
                  },
                ],
                "name": "li",
                "parent": [Circular],
                "type": 1,
              },
            ],
            "name": "ul",
            "parent": [Circular],
            "type": 1,
          },
          {
            "attributes": {},
            "children": [
              {
                "attributes": {},
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "A quote with an ",
                  },
                  {
                    "attributes": {
                      "alt": "image",
                      "src": "image.jpg",
                    },
                    "children": [],
                    "name": "img",
                    "parent": [Circular],
                    "type": 1,
                  },
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": " inside.",
                  },
                ],
                "name": "p",
                "parent": [Circular],
                "type": 1,
              },
            ],
            "name": "blockquote",
            "parent": [Circular],
            "type": 1,
          },
          {
            "attributes": {},
            "children": [
              {
                "attributes": {
                  "class": "language-js",
                },
                "children": [
                  {
                    "children": [],
                    "parent": [Circular],
                    "type": 2,
                    "value": "console.log("Hello world!");",
                  },
                ],
                "name": "code",
                "parent": [Circular],
                "type": 1,
              },
            ],
            "name": "pre",
            "parent": [Circular],
            "type": 1,
          },
        ],
        "type": 0,
      }
    `)
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '# Document Title\n\n'
      + 'This is a **bold** and *important* paragraph with a [link](https://example.com).\n\n'
      + '- Item with `inline code`\n'
      + '- Item with [another link](https://example.org)\n\n'
      + '> A quote with an ![image](image.jpg) inside.\n\n'
      + '```js\nconsole.log("Hello world!");\n```',
    )
  })
})

describe('tables', () => {
  it('converts basic tables with headers', async () => {
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
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2 |\n'
      + '| --- | --- |\n'
      + '| Value 1 | Value 2 |\n'
      + '| Value 3 | Value 4 |',
    )
  })

  it('handles tables without thead/tbody', async () => {
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
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2 |\n'
      + '| --- | --- |\n'
      + '| Value 1 | Value 2 |',
    )
  })

  it('handles tables with formatting in cells', async () => {
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
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Formatting | Example |\n'
      + '| --- | --- |\n'
      + '| Bold | **bold text** |\n'
      + '| Link | [link](https://example.com) |',
    )
  })

  it('handles empty table cells', async () => {
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
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2 |\n'
      + '| --- | --- |\n'
      + '| Value 1 |  |\n'
      + '|  | Value 4 |',
    )
  })

  it('handles tables with alignment attributes', async () => {
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
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Left | Center | Right |\n'
      + '| :--- | :---: | ---: |\n'
      + '| 1 | 2 | 3 |',
    )
  })

  it('handles tables with colspan and rowspan', async () => {
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
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Header 1 | Header 2-3 |  |\n'
      + '| --- | --- | --- |\n'
      + '| Value 1 | Value 2 | Value 3 |',
    )
  })
  it('github advanced example', async () => {
    const html = `
      <table><thead><tr><th scope="col">Style</th><th scope="col">Syntax</th><th scope="col">Keyboard shortcut</th><th scope="col">Example</th><th scope="col">Output</th></tr></thead><tbody><tr><td>Bold</td><td><code>** **</code> or <code>__ __</code></td><td><kbd>Command</kbd>+<kbd>B</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>B</kbd> (Windows/Linux)</td><td><code>**This is bold text**</code></td><td><strong>This is bold text</strong></td></tr><tr><td>Italic</td><td><code>* *</code> or <code>_ _</code> &emsp;&emsp;&emsp;&emsp;</td><td><kbd>Command</kbd>+<kbd>I</kbd> (Mac) or <kbd>Ctrl</kbd>+<kbd>I</kbd> (Windows/Linux)</td><td><code>_This text is italicized_</code></td><td><em>This text is italicized</em></td></tr><tr><td>Strikethrough</td><td><code>~~ ~~</code> or <code>~ ~</code></td><td>None</td><td><code>~~This was mistaken text~~</code></td><td><del>This was mistaken text</del></td></tr><tr><td>Bold and nested italic</td><td><code>** **</code> and <code>_ _</code></td><td>None</td><td><code>**This text is _extremely_ important**</code></td><td><strong>This text is <em>extremely</em> important</strong></td></tr><tr><td>All bold and italic</td><td><code>*** ***</code></td><td>None</td><td><code>***All this text is important***</code></td><td><em><strong>All this text is important</strong></em></td></tr><tr><td>Subscript</td><td><code>&lt;sub&gt; &lt;/sub&gt;</code></td><td>None</td><td><code>This is a &lt;sub&gt;subscript&lt;/<wbr>sub&gt; text</code></td><td>This is a <sub>subscript</sub> text</td></tr><tr><td>Superscript</td><td><code>&lt;sup&gt; &lt;/sup&gt;</code></td><td>None</td><td><code>This is a &lt;sup&gt;superscript&lt;/<wbr>sup&gt; text</code></td><td>This is a <sup>superscript</sup> text</td></tr><tr><td>Underline</td><td><code>&lt;ins&gt; &lt;/ins&gt;</code></td><td>None</td><td><code>This is an &lt;ins&gt;underlined&lt;/<wbr>ins&gt; text</code></td><td>This is an <ins>underlined</ins> text</td></tr></tbody></table>`
    const markdown = await htmlToMarkdown(html)
    expect(markdown).toBe(
      '| Style | Syntax | Keyboard shortcut | Example | Output |\n'
      + '| --- | --- | --- | --- | --- |\n'
      + '| Bold | ** ** or __ __ | Command+B (Mac) or Ctrl+B (Windows/Linux) | **This is bold text** | <strong>This is bold text</strong> |\n'
      + '| Italic | * * or _ _ &emsp;&emsp;&emsp;&emsp; | Command+I (Mac) or Ctrl+I (Windows/Linux) | _This text is italicized_ | <em>This text is italicized</em> |\n'
      + '| Strikethrough | ~~ ~~ or ~ ~ | None | ~~This was mistaken text~~ | <del>This was mistaken text</del> |\n'
      + '| Bold and nested italic | ** ** and _ _ | None | **This text is _extremely_ important** | <strong>This text is <em>extremely</em> important</strong> |\n'
      + '| All bold and italic | *** *** | None | ***All this text is important*** | <em><strong>All this text is important</strong></em> |\n'
      + '| Subscript | <sub> </sub> | None | This is a <sub>subscript</sub> text. |\n'
      + '| Superscript | <sup> </sup>  | None  | This is a <sup>superscript</sup> text. |\n'
      + '| Underline  | <ins> </ins>  | None  | This is an <ins>underlined</ins> text. |\n',
    )
  })
})
