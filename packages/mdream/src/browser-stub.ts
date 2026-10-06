// The `mdream` root under the `browser` export condition. The browser API
// returns a Promise, so it lives at `mdream/browser`, and the root types stay
// synchronous. Each export throws only when called: a shared module that calls
// mdream on the server still loads in a browser bundle, and the bundler drops
// this file when nothing calls it.

export function htmlToMarkdown(): never {
  throw new TypeError('In a browser bundle, import htmlToMarkdown from \'mdream/browser\'. It returns a Promise.')
}

export function streamHtmlToMarkdown(): never {
  throw new TypeError('In a browser bundle, import streamHtmlToMarkdown from \'mdream/browser\'.')
}
