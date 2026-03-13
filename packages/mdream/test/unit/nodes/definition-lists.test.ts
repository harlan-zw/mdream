import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('definition lists $name', (engineConfig) => {
  it('converts address tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown(`
      <address>
        John Doe<br>
        123 Main St<br>
        Anytown, CA 12345
      </address>
    `, { engine }).markdown
    expect(result).toBe('<address>John Doe 123 Main St Anytown, CA 12345 </address>')
  })

  it('handles definition lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown(`
      <dl>
        <dt>HTML</dt>
        <dd>HyperText Markup Language</dd>
        <dt>CSS</dt>
        <dd>Cascading Style Sheets</dd>
      </dl>
    `, { engine }).markdown
    expect(result).toBe('<dl><dt>HTML</dt>\n<dd>HyperText Markup Language</dd>\n<dt>CSS</dt>\n<dd>Cascading Style Sheets</dd>\n</dl>')
  })

  it('handles nested definition lists', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown(`
      <dl>
        <dt>Web Languages</dt>
        <dd>
          <dl>
            <dt>HTML</dt>
            <dd>HyperText Markup Language</dd>
            <dt>CSS</dt>
            <dd>Cascading Style Sheets</dd>
          </dl>
        </dd>
        <dt>Runtime</dt>
        <dd>JavaScript</dd>
      </dl>
    `, { engine }).markdown
    expect(result).toBe('<dl><dt>Web Languages</dt>\n<dd><dl><dt>HTML</dt>\n<dd>HyperText Markup Language</dd>\n<dt>CSS</dt>\n<dd>Cascading Style Sheets</dd></dl></dd>\n<dt>Runtime</dt>\n<dd>JavaScript</dd>\n</dl>')
  })

  it('handles complex definition list content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const result = htmlToMarkdown(`
      <dl>
        <dt>Term with <strong>formatting</strong></dt>
        <dd>Definition with <a href="https://example.com">link</a></dd>
        <dt>Another Term</dt>
        <dd>
          <p>Paragraph in definition</p>
          <ul>
            <li>List item in definition</li>
          </ul>
        </dd>
      </dl>
    `, { engine }).markdown
    expect(result).toBe('<dl><dt>Term with **formatting**</dt>\n<dd>Definition with [link](https://example.com)</dd>\n<dt>Another Term</dt>\n<dd>\n\nParagraph in definition\n\n- List item in definition\n\n</dd></dl>')
  })
})
