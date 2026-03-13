import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../index.js'

describe('definition lists', () => {
  it('converts address tags', () => {
    const result = htmlToMarkdown(`
      <address>
        John Doe<br>
        123 Main St<br>
        Anytown, CA 12345
      </address>
    `)
    expect(result).toMatchInlineSnapshot(`"<address>John Doe 123 Main St Anytown, CA 12345 </address>"`)
  })

  it('handles definition lists', () => {
    const result = htmlToMarkdown(`
      <dl>
        <dt>HTML</dt>
        <dd>HyperText Markup Language</dd>
        <dt>CSS</dt>
        <dd>Cascading Style Sheets</dd>
      </dl>
    `)
    expect(result).toMatchInlineSnapshot(`
      "<dl><dt>HTML</dt>

      HyperText Markup Language

      <dt>CSS</dt>

      Cascading Style Sheets

      </dl>"
    `)
  })

  it('handles nested definition lists', () => {
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
    `)
    expect(result).toMatchInlineSnapshot(`
      "<dl><dt>Web Languages</dt>

      <dl><dt>HTML</dt>

      HyperText Markup Language

      <dt>CSS</dt>

      Cascading Style Sheets</dl>

      <dt>Runtime</dt>

      JavaScript

      </dl>"
    `)
  })

  it('handles complex definition list content', () => {
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
    `)
    expect(result).toMatchInlineSnapshot(`
      "<dl><dt>Term with **formatting**</dt>

      Definition with [link](https://example.com)

      <dt>Another Term</dt>

      Paragraph in definition

      - List item in definition

      </dl>"
    `)
  })
})
