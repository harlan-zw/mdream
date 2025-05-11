// Tag constants for performance optimization
export const TAG_HEAD = 1
export const TAG_DETAILS = 2
export const TAG_SUMMARY = 3
export const TAG_TITLE = 4
export const TAG_META = 5
export const TAG_BR = 6
export const TAG_H1 = 7
export const TAG_H2 = 8
export const TAG_H3 = 9
export const TAG_H4 = 10
export const TAG_H5 = 11
export const TAG_H6 = 12
export const TAG_HR = 13
export const TAG_STRONG = 14
export const TAG_B = 15
export const TAG_EM = 16
export const TAG_I = 17
export const TAG_DEL = 18
export const TAG_SUB = 19
export const TAG_SUP = 20
export const TAG_INS = 21
export const TAG_BLOCKQUOTE = 22
export const TAG_CODE = 23
export const TAG_UL = 24
export const TAG_LI = 25
export const TAG_A = 26
export const TAG_IMG = 27
export const TAG_TABLE = 28
export const TAG_THEAD = 29
export const TAG_TR = 30
export const TAG_TH = 31
export const TAG_TD = 32
export const TAG_OL = 33
export const TAG_PRE = 34
export const TAG_P = 35
export const TAG_DIV = 36
export const TAG_SPAN = 37
export const TAG_TBODY = 38
export const TAG_TFOOT = 39
export const TAG_FORM = 40
export const TAG_NAV = 41
export const TAG_LABEL = 42
export const TAG_BUTTON = 43
export const TAG_BODY = 44
export const TAG_CENTER = 45
export const TAG_KBD = 46
export const TAG_FOOTER = 47
export const TAG_PATH = 48
export const TAG_SVG = 49
export const TAG_ARTICLE = 50
export const TAG_SECTION = 51
export const TAG_SCRIPT = 52
export const TAG_STYLE = 53
export const TAG_LINK = 54
export const TAG_AREA = 55
export const TAG_BASE = 56
export const TAG_COL = 57
export const TAG_EMBED = 58
export const TAG_INPUT = 59
export const TAG_KEYGEN = 60
export const TAG_PARAM = 61
export const TAG_SOURCE = 62
export const TAG_TRACK = 63
export const TAG_WBR = 64
export const TAG_SELECT = 65
export const TAG_TEXTAREA = 66
export const TAG_OPTION = 67
export const TAG_FIELDSET = 68
export const TAG_LEGEND = 69
export const TAG_AUDIO = 70
export const TAG_VIDEO = 71
export const TAG_CANVAS = 72
export const TAG_IFRAME = 73
export const TAG_MAP = 74
export const TAG_DIALOG = 75
export const TAG_METER = 76
export const TAG_PROGRESS = 77
export const TAG_TEMPLATE = 78
export const TAG_ABBR = 79
export const TAG_MARK = 80
export const TAG_Q = 81
export const TAG_SAMP = 82
export const TAG_SMALL = 83
export const TAG_NOSCRIPT = 84
export const TAG_NOFRAMES = 85
export const TAG_XMP = 86
export const TAG_PLAINTEXT = 87
export const TAG_ASIDE = 88
export const TAG_U = 89
export const TAG_CITE = 90
export const TAG_DFN = 91
export const TAG_VAR = 92
export const TAG_TIME = 93
export const TAG_BDO = 94
export const TAG_RUBY = 95
export const TAG_RT = 96
export const TAG_RP = 97

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

export const NodeEventEnter = 0
export const NodeEventExit = 1

// Map string tag names to numeric constants
export const TagIdMap: Record<string, number> = {
  head: TAG_HEAD,
  details: TAG_DETAILS,
  summary: TAG_SUMMARY,
  title: TAG_TITLE,
  meta: TAG_META,
  br: TAG_BR,
  h1: TAG_H1,
  h2: TAG_H2,
  h3: TAG_H3,
  h4: TAG_H4,
  h5: TAG_H5,
  h6: TAG_H6,
  hr: TAG_HR,
  strong: TAG_STRONG,
  b: TAG_B,
  em: TAG_EM,
  i: TAG_I,
  del: TAG_DEL,
  sub: TAG_SUB,
  sup: TAG_SUP,
  ins: TAG_INS,
  blockquote: TAG_BLOCKQUOTE,
  code: TAG_CODE,
  ul: TAG_UL,
  li: TAG_LI,
  a: TAG_A,
  img: TAG_IMG,
  table: TAG_TABLE,
  thead: TAG_THEAD,
  tr: TAG_TR,
  th: TAG_TH,
  td: TAG_TD,
  ol: TAG_OL,
  pre: TAG_PRE,
  p: TAG_P,
  div: TAG_DIV,
  span: TAG_SPAN,
  tbody: TAG_TBODY,
  tfoot: TAG_TFOOT,
  form: TAG_FORM,
  nav: TAG_NAV,
  label: TAG_LABEL,
  button: TAG_BUTTON,
  body: TAG_BODY,
  center: TAG_CENTER,
  kbd: TAG_KBD,
  footer: TAG_FOOTER,
  path: TAG_PATH,
  svg: TAG_SVG,
  article: TAG_ARTICLE,
  section: TAG_SECTION,
  script: TAG_SCRIPT,
  style: TAG_STYLE,
  link: TAG_LINK,
  area: TAG_AREA,
  base: TAG_BASE,
  col: TAG_COL,
  embed: TAG_EMBED,
  input: TAG_INPUT,
  keygen: TAG_KEYGEN,
  param: TAG_PARAM,
  source: TAG_SOURCE,
  track: TAG_TRACK,
  wbr: TAG_WBR,
  select: TAG_SELECT,
  textarea: TAG_TEXTAREA,
  option: TAG_OPTION,
  fieldset: TAG_FIELDSET,
  legend: TAG_LEGEND,
  audio: TAG_AUDIO,
  video: TAG_VIDEO,
  canvas: TAG_CANVAS,
  iframe: TAG_IFRAME,
  map: TAG_MAP,
  dialog: TAG_DIALOG,
  meter: TAG_METER,
  progress: TAG_PROGRESS,
  template: TAG_TEMPLATE,
  abbr: TAG_ABBR,
  mark: TAG_MARK,
  q: TAG_Q,
  samp: TAG_SAMP,
  small: TAG_SMALL,
  noscript: TAG_NOSCRIPT,
  noframes: TAG_NOFRAMES,
  xmp: TAG_XMP,
  plaintext: TAG_PLAINTEXT,
  aside: TAG_ASIDE,
  u: TAG_U,
  cite: TAG_CITE,
  dfn: TAG_DFN,
  var: TAG_VAR,
  time: TAG_TIME,
  bdo: TAG_BDO,
  ruby: TAG_RUBY,
  rt: TAG_RT,
  rp: TAG_RP,
}

// Maximum tag ID for creating the typed array (97 for TAG_RP + 1 for buffer)
export const MAX_TAG_ID = 98

// Pre-defined strings to avoid repeated allocations
export const MARKDOWN_STRONG = '**'
export const MARKDOWN_EMPHASIS = '_'
export const MARKDOWN_STRIKETHROUGH = '~~'
export const MARKDOWN_CODE_BLOCK = '```'
export const MARKDOWN_INLINE_CODE = '`'
export const MARKDOWN_HORIZONTAL_RULE = '---'

// Newline configurations
export const NO_SPACING: readonly [number, number] = [0, 0]
export const DEFAULT_BLOCK_SPACING: readonly [number, number] = [2, 2]
export const BLOCKQUOTE_SPACING: readonly [number, number] = [1, 1]
export const LIST_ITEM_SPACING: readonly [number, number] = [1, 0]
export const TABLE_ROW_SPACING: readonly [number, number] = [0, 1]
