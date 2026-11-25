# Changelog

## 2.2.1

Both Markdown engines preserve literal text and code across more formatting boundaries.
Update the packages you use to 2.2.1 and refresh your lockfile.

> [Codex](https://openai.com/codex/) drafted these release notes.

## 2.2.0

mdream 2.2.0 adds an opt-in Markdown-only WASM build and fixes Markdown output in both engines.

- Enable `mdream-markdown` for a smaller browser or edge build that supports streaming. [Setup and supported options](https://github.com/harlan-zw/mdream/blob/10e0fe5103328a06df9d0e0b5c5793c321db734d/packages/mdream/README.md#smaller-markdown-wasm-build), [#501](https://github.com/harlan-zw/mdream/pull/501)
- Share one full WASM binary between the browser and edge builds. [#497](https://github.com/harlan-zw/mdream/pull/497)
- Keep adjacent inline code spans separate and preserve literal punctuation and line breaks. [#505](https://github.com/harlan-zw/mdream/pull/505)
- Keep adjacent lists separate and preserve list content after empty blockquotes. [#418](https://github.com/harlan-zw/mdream/pull/418), [#491](https://github.com/harlan-zw/mdream/pull/491)
- Honor custom `isSelfClosing` tag overrides in the Rust engine. [#431](https://github.com/harlan-zw/mdream/pull/431)

Update the packages you use to 2.2.0 and refresh your lockfile.
Regenerate stored Markdown to apply the output fixes.

> [Codex](https://openai.com/codex/) drafted these release notes.

## 2.1.0

Relative links now respect an eligible HTML `<base href>`.
Code blocks keep language metadata from more HTML sources.

- Resolve later relative URLs against the first eligible `<base href>` in both engines. [#429](https://github.com/harlan-zw/mdream/pull/429)
- Read code languages from `data-language`, `data-lang`, and `<pre>` language classes. [#428](https://github.com/harlan-zw/mdream/pull/428)
- Preserve text around discarded bogus comments and character references. [#397](https://github.com/harlan-zw/mdream/pull/397)
- Preserve vertical tabs and wrapping separators across streamed output. [#398](https://github.com/harlan-zw/mdream/pull/398), [#393](https://github.com/harlan-zw/mdream/pull/393)
- Correct list, quote, heading, and code-fence boundaries across conversion and streaming. [All changes](https://github.com/harlan-zw/mdream/compare/v2.0.3...v2.1.0)
- Fix JavaScript attribute hooks, selector handling, and Vite Markdown request paths. [#376](https://github.com/harlan-zw/mdream/pull/376), [#377](https://github.com/harlan-zw/mdream/pull/377), [#378](https://github.com/harlan-zw/mdream/pull/378), [#380](https://github.com/harlan-zw/mdream/pull/380), [#381](https://github.com/harlan-zw/mdream/pull/381), [#382](https://github.com/harlan-zw/mdream/pull/382), [#383](https://github.com/harlan-zw/mdream/pull/383), [#384](https://github.com/harlan-zw/mdream/pull/384)

Update the packages you use to 2.1.0 and refresh your lockfile.
Regenerate stored Markdown to apply the output fixes.

> [Codex](https://openai.com/codex/) drafted these release notes.
