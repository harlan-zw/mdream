import { htmlToMarkdown } from './browser.js'

// The CDN build (`dist/iife.js`): the browser entry, exposed as window.mdream.
// build.config.ts wraps this module with the wasm-bindgen runtime.

declare global {
  interface Window {
    mdream: {
      htmlToMarkdown: typeof htmlToMarkdown
    }
  }
}

if (typeof window !== 'undefined')
  window.mdream = { htmlToMarkdown }
