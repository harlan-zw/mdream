import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'

describe('escaped backslash in script tags', () => {
  it('parses content after script containing escaped backslashes', () => {
    // This is the exact pattern from Wikipedia: "+\\" in JSON inside <script>
    // The +\\ sequence means: + followed by an escaped backslash
    // The parser must not get stuck thinking it's inside a string
    const html = [
      '<html><head><title>Test</title>',
      '<script>(RLQ=window.RLQ||[]).push(function(){mw.loader.impl(function(){return["user.options@12s5i",function($,jQuery,require,module){mw.user.tokens.set({"patrolToken":"+\\\\","watchToken":"+\\\\","csrfToken":"+\\\\"});',
      '}];});});</script>',
      '</head><body>',
      '<h1>Hello World</h1>',
      '<p>This content must not be lost</p>',
      '</body></html>',
    ].join('')

    const md = htmlToMarkdown(html).markdown
    expect(md).toContain('# Hello World')
    expect(md).toContain('This content must not be lost')
  })

  it('handles multiple escaped backslashes in sequence', () => {
    const html = [
      '<html><head><title>Test</title>',
      '<script>var x = "a]\\\\\\\\b";</script>',
      '</head><body>',
      '<p>Visible content</p>',
      '</body></html>',
    ].join('')

    const md = htmlToMarkdown(html).markdown
    expect(md).toContain('Visible content')
  })

  it('handles backslash-quote at end of script string', () => {
    // +\\" means: + \ (escaped backslash) then " closes the string
    // Parser must recognize the " as closing the string, not escaped
    const html = [
      '<html><head><title>Test</title>',
      '<script>var obj = {"key":"+\\\\"};</script>',
      '</head><body>',
      '<p>After script</p>',
      '</body></html>',
    ].join('')

    const md = htmlToMarkdown(html).markdown
    expect(md).toContain('After script')
  })
})
