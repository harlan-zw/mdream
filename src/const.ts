// Set of void tags that don't need closing tags
export const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

// HTML character entity mapping
export const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': '\'',
  '&apos;': '\'', // Added missing &apos; entity
  '&nbsp;': ' ',
}

// Node type constants
export const ELEMENT_NODE = 1
export const TEXT_NODE = 2

export const NON_SUPPORTED_NODES = new Set([
  'form',
  'script',
  'style',
  'input',
  'link',
  'select',
  'textarea',
  'option',
  'label',
  'fieldset',
  'legend',
  'audio',
  'video',
  'canvas',
  'iframe',
  'svg',
  'map',
  'area',
  'dialog',
  'meter',
  'progress',
  'template',
])

export const NEW_LINE_CONFIG: Record<string, { enter: number, exit: number }> = {
  blockquote: { enter: 1, exit: 1 },
  code: { enter: 0, exit: 0 },
  li: { enter: 1, exit: 0 },
  tr: { enter: 0, exit: 1 },
  thead: { enter: 0, exit: 1 },
  tbody: { enter: 0, exit: 1 },
  head: { enter: 0, exit: 0 },
  html: { enter: 0, exit: 0 },
  body: { enter: 0, exit: 0 },
}
export const INLINE_ELEMENTS = [
  'a',
  'abbr',
  'b',
  'br',
  'code',
  'em',
  'i',
  'img',
  'kbd',
  'mark',
  'q',
  'span',
  'samp',
  'small',
  'strong',
  'sub',
  'sup',
  'th',
  'td',
  'link',
  'meta',
  'title',
  'meta',
  'head',
]

export const MINIMAL_EXCLUDE_ELEMENTS = new Set([
  'footer',
  'header',
  'nav',
  'aside',
])
// Tags that don't support nested tags - they should be automatically closed when a new tag opens
export const NON_NESTING_TAGS = new Set([
  'title',
  'textarea',
  'style',
  'script',
  'noscript',
  'iframe',
  'noframes',
  'xmp',
  'plaintext',
  'option',
])

export const USES_ATTRIBUTES = new Set([
  'a',
  'meta',
  'code',
  'img',
  'th',
])

export const DEFAULT_CHUNK_SIZE = 8224
