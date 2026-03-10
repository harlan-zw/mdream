import { createJavaScriptEngine } from './index.js'

const { htmlToMarkdown } = createJavaScriptEngine()

// Export to global window object for browser usage
declare global {
  interface Window {
    mdream: {
      htmlToMarkdown: typeof htmlToMarkdown
    }
  }
}

const mdream = {
  htmlToMarkdown,
}

if (typeof window !== 'undefined') {
  window.mdream = mdream
}

export default mdream
export { htmlToMarkdown }
