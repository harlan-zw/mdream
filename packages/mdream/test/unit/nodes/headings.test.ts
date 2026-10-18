import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('headings $name', (engineConfig) => {
  it('converts h1', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h1>Heading 1</h1>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h2>Heading 2</h2>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h3>Heading 3</h3>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h4>Heading 4</h4>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h5>Heading 5</h5>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<h6>Heading 6</h6>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('###### Heading 6')
  })

  it('nested headers', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<a href="/test"><h1>Heading 1</h1></a><ul><li><h2>Heading 2</h2></li></ul>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('[<h1>Heading 1</h1>](/test)\n\n- ## Heading 2')
  })

  // In a list item the heading's own `#` marker follows the item marker or the
  // continuation indent: it is no closing sequence to escape, and the next block
  // still opens its own line, as it does at the root.
  it.each([
    ['<main><ul><li><h3></h3><p>Partner description</p></li></ul></main>', '- ###\n\n  Partner description'],
    ['<ol><li><h3></h3><p>Partner description</p></li></ol>', '1. ###\n\n   Partner description'],
    ['<ol start="10"><li><h1></h1><p>b</p></li></ol>', '10. #\n\n    b'],
    ['<ul><li><h3></h3></li><li>b</li></ul>', '- ###\n- b'],
    ['<ul><li>a<ul><li>b<ul><li><h3></h3><p>c</p></li></ul></li></ul></li></ul>', '- a\n  - b\n    - ###\n\n      c'],
    ['<ol><li>a<ol><li>b<ol><li><h3></h3><p>c</p></li></ol></li></ol></li></ol>', '1. a\n   1. b\n      1. ###\n\n         c'],
    ['<ul><li><pre>x</pre><h3></h3><p>b</p></li></ul>', '- ```\n  x\n  ```\n\n  ###\n\n  b'],
    ['<ul><li><hr><h3></h3><p>b</p></li></ul>', '- ***\n\n  ###\n\n  b'],
    ['<ul><li><h2></h2><pre>code</pre></li></ul>', '- ##\n\n  ```\n  code\n  ```'],
    ['<ul><li><h2></h2><table><tr><td>x</td></tr></table></li></ul>', '- ##\n\n  | x |\n  | --- |'],
    ['<ul><li><h2></h2><ul><li>b</li></ul></li></ul>', '- ##\n  - b'],
    ['<blockquote><ul><li><h3></h3><p>b</p></li></ul></blockquote>', '> - ###\n>\n>   b'],
    ['<blockquote><ol><li><h3></h3><p>b</p></li></ol></blockquote>', '> 1. ###\n>\n>    b'],
    ['<ul><li><blockquote><h3></h3><p>b</p></blockquote></li></ul>', '- \n  > ###\n  >\n  > b'],
    ['<h3></h3><p>Partner description</p>', '###\n\nPartner description'],
    ['<blockquote><h3></h3><p>b</p></blockquote>', '> ###\n>\n> b'],
  ])('closes an empty heading in a list item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })

  it.each([
    ['<ul><li><h3>#</h3><p>b</p></li></ul>', '- ### \\#\n\n  b'],
    ['<ul><li><h3>###</h3><p>b</p></li></ul>', '- ### \\###\n\n  b'],
    ['<ol><li><h3>a #</h3></li></ol>', '1. ### a \\#'],
    ['<ul><li><pre>x</pre><h3>#</h3></li></ul>', '- ```\n  x\n  ```\n\n  ### \\#'],
    // The escaped run keeps the heading's trailing space trimmable.
    ['<ul><li><h3> # </h3><p>b</p></li></ul>', '- ### \\#\n\n  b'],
  ])('escapes a closing hash run in a list item: %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown(html, { engine })).toBe(expected)
  })
})
