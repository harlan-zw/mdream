import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('definition lists', () => {
  it('converts address tags', () => {
    const result = syncHtmlToMarkdown(`
      <address>
        John Doe<br>
        123 Main St<br>
        Anytown, CA 12345
      </address>
    `)
    expect(result).toMatchInlineSnapshot(`"<address>John Doe 123 Main St Anytown, CA 12345 </address>"`)
  })

  it('handles definition lists', () => {
    const result = syncHtmlToMarkdown(`
      <dl>
        <dt>HTML</dt>
        <dd>HyperText Markup Language</dd>
        <dt>CSS</dt>
        <dd>Cascading Style Sheets</dd>
      </dl>
    `)
    expect(result).toMatchInlineSnapshot(`
      "<dl><dt>HTML</dt>
      <dd>HyperText Markup Language</dd>
      <dt>CSS</dt>
      <dd>Cascading Style Sheets</dd>
      </dl>"
    `)
  })

  it('handles nested definition lists', () => {
    const result = syncHtmlToMarkdown(`
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
    `)
    expect(result).toMatchInlineSnapshot(`
      "<dl><dt>Web Languages</dt>
      <dd><dl><dt>HTML</dt>
      <dd>HyperText Markup Language</dd>
      <dt>CSS</dt>
      <dd>Cascading Style Sheets</dd></dl></dd>
      <dt>Runtime</dt>
      <dd>JavaScript</dd>
      </dl>"
    `)
  })

  it('handles complex definition list content', () => {
    const result = syncHtmlToMarkdown(`
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
    `)
    expect(result).toMatchInlineSnapshot(`
      "<dl><dt>Term with **formatting**</dt>
      <dd>Definition with [link](https://example.com)</dd>
      <dt>Another Term</dt>
      <dd>

      Paragraph in definition

      - List item in definition

      </dd></dl>"
    `)
  })
})
