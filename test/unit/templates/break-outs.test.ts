import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

// code that tries to break out of its context by adding open / close tags as content
describe('break-outs', () => {
  it('script block', () => {
    const html = `<script type="application/json" id="hydration">{"url":"/en-US/docs/Web/JavaScript/Guide","doc":{"body":[{"type":"prose","value":{"id":null,"title":null,"isH3":false,"content":"<p>The JavaScript Guide shows you how to use <a href=\\"/en-US/docs/Web/JavaScript\\">JavaScript</a> and gives an overview of the language. If you need exhaustive information about a language feature, have a look at the <a href=\\"/en-US/docs/Web/JavaScript/Reference\\">JavaScript reference</a>.</p>\\n<p>This Guide is divided into the following chapters.</p>"}},{"type":"prose","value":{"id":"introduction","title":"Introduction","isH3":false,"content":"<p>Overview: <a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction\\">Introduction</a></p>\\n<ul>\\n<li><a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction#where_to_find_javascript_information\\">About this guide</a></li>\\n<li><a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction#what_is_javascript\\">About JavaScript</a></li>\\n<li><a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction#javascript_and_java\\">JavaScript and Java</a></li>\\n<li><a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction#javascript_and_the_ecmascript_specification\\">ECMAScript</a></li>\\n<li><a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction#getting_started_with_javascript\\">Tools</a></li>\\n<li><a href=\\"/en-US/docs/Web/JavaScript/Guide/Introduction#whats_next\\">What's next</a></li>\\n</ul>"}},{"type":"prose","value":{"id":"grammar_and_types","title":"Grammar and types","isH3":false,"content":"<p>Overview: <a href=\\"/en-US/docs/Web/JavaScript/Guide/Grammar_and_types\\">Grammar and types</a></script>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`""`)
  })
  it('style block', () => {
    const html = `<style type="text/css">.hds-term-item-inner{display:flex;align-items:center;justify-content:space-between;/* <p>this is a p tag</p>> */}</style>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`""`)
  })
})
