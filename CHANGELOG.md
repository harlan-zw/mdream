# Changelog

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
