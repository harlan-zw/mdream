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
  '&apos;': '\'',  // Added missing &apos; entity
  '&nbsp;': ' ',
}

// Node type constants
export const DOCUMENT_NODE = 0
export const ELEMENT_NODE = 1
export const TEXT_NODE = 2
export const COMMENT_NODE = 3
export const DOCTYPE_NODE = 4
