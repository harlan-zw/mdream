import type {
  Node, NodeEvent,
  StackItem, MarkdownState
} from './types.ts';
import { ELEMENT_NODE, TEXT_NODE, DOCUMENT_NODE, COMMENT_NODE } from './const.ts'
import { decodeHTMLEntities, countChar } from './utils.ts';

/**
 * Generate enter/exit events for node traversal
 * Uses stack-based approach to avoid recursion
 */
export async function* generateNodeEvents(root: Node): AsyncGenerator<NodeEvent> {
  const stack: StackItem[] = [{ node: root, visiting: true }];

  while (stack.length > 0) {
    const { node, visiting } = stack.pop()!;

    if (visiting) {
      // First visit (enter)
      yield { type: 'enter', node };

      // Push exit event first (will be processed after all children)
      stack.push({ node, visiting: false });

      // Push children in reverse order (so they're processed in correct order)
      if (node.children && node.children.length) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push({ node: node.children[i], visiting: true });
        }
      }
    } else {
      // Second visit (exit)
      yield { type: 'exit', node };
    }
  }
}

/**
 * Process a node event and generate markdown
 */
export function processNodeEvent(
  event: NodeEvent,
  state: MarkdownState,
  nodeDepthMap: Map<Node, number>
): string {
  const { type: eventType, node } = event;
  const parent = node.parent;

  // Handle comments separately
  if (node.type === COMMENT_NODE) {
    return `<!--${node.value || ''}-->`;
  }

  // Process node based on event type
  let output = eventType === 'enter'
    ? handleNodeEnter(node, parent, state, nodeDepthMap)
    : handleNodeExit(node, parent, state);

  // Update state based on output
  updateStateFromOutput(output, state);

  return output;
}

/**
 * Update markdown state based on output text
 */
function updateStateFromOutput(output: string, state: MarkdownState): void {
  if (!output) return;

  const hasNewlines = output.includes('\n');
  const endsWithNewline = output.endsWith('\n');

  if (hasNewlines) {
    // Count newlines without regex for performance
    const newlineCount = countChar(output, '\n');
    state.consecutiveNewlines = endsWithNewline ? newlineCount : 0;
    state.lastOutputType = endsWithNewline ? 'newline' : 'text';
  } else {
    state.consecutiveNewlines = 0;
    state.lastOutputType = 'text';
  }
}

// Define handler context type
type HandlerContext = {
  node: Node;
  parent?: Node;
  state: MarkdownState;
  nodeDepthMap?: Map<Node, number>;
};

function stateAwareOutput(s: string, state: MarkdownState) {
  if (state.inTable && !state.inColspan) {
    return ''
  }

  // avoid adding extra new lines
  if (state.lastOutputType === 'newline' && (s === '\n\n')) {
    return '\n'
  }
  if (state.lastOutputType === 'none' && (s === '\n' || s === '\n\n')) {
    return s.replace(/\n+/g, '')
  }
  return s
}

// Single tagHandlers record with enter/leave functions
const tagHandlers: Record<
  string,
  {
    enter?: (context: HandlerContext) => string;
    leave?: (context: HandlerContext) => string;
  }
> = {
  h1: {
    enter: () => '\n\n# '
  },
  h2: {
    enter: () => '\n\n## '
  },
  h3: {
    enter: () => '\n\n### '
  },
  h4: {
    enter: () => '\n\n#### '
  },
  h5: {
    enter: () => '\n\n##### '
  },
  h6: {
    enter: () => '\n\n###### '
  },
  p: {
    enter: ({ state }) => stateAwareOutput(state.inBlockquote ? '' : '\n\n', state),
    leave: ({ state }) => state.inBlockquote ? '\n' : ''
  },
  br: {
    enter: () => '\n'
  },
  hr: {
    enter: ({ state }) => stateAwareOutput('\n\n---\n', state)
  },
  strong: {
    enter: ({ state }) => stateAwareOutput('**', state),
    leave: ({ state }) => stateAwareOutput('**', state)
  },
  b: {
    enter: ({ state }) => stateAwareOutput('**', state),
    leave: ({ state }) => stateAwareOutput('**', state)
  },
  em: {
    enter: ({ state }) => stateAwareOutput('*', state),
    leave: ({ state }) => stateAwareOutput('*', state)
  },
  i: {
    enter: ({ state }) => stateAwareOutput('*', state),
    leave: ({ state }) => stateAwareOutput('*', state)
  },
  del: {
    enter: ({ state }) => stateAwareOutput('~~', state),
    leave: ({ state }) => stateAwareOutput('~~', state)
  },
  sub: {
    enter: ({ state }) => stateAwareOutput('<sub>', state),
    leave: ({ state }) => stateAwareOutput('</sub>', state)
  },
  sup: {
    enter: ({ state }) => stateAwareOutput('<sup>', state),
    leave: ({ state }) => stateAwareOutput('</sup>', state)
  },
  ins: {
    enter: ({ state }) => stateAwareOutput('<ins>', state),
    leave: ({ state }) => stateAwareOutput('</ins>', state)
  },
  blockquote: {
    enter: handleBlockquoteEnter,
    leave: handleBlockquoteExit
  },
  code: {
    enter: handleCodeEnter,
    leave: handleCodeExit
  },
  pre: {
    enter: () => ''
  },
  ul: {
    enter: ({ parent, state }) => {
      // Check if this is a nested list inside a list item
      const isNested = parent?.type === ELEMENT_NODE && parent.name === 'li';

      // For nested lists, don't add any additional indentation
      // The list items themselves will handle proper indentation
      if (isNested) {
        return '';
      }

      // For top-level lists, add spacing
      return '\n\n';
    }
  },
  ol: {
    enter: ({ parent }) => {
      // Check if this is a nested list inside a list item
      const isNested = parent?.type === ELEMENT_NODE && parent.name === 'li';

      // For nested lists, don't add any additional indentation
      // The list items themselves will handle proper indentation
      if (isNested) {
        return '';
      }

      // For top-level lists, add spacing
      return '\n\n';
    }
  },
  li: {
    enter: handleListItemEnter,
    leave: handleListItemExit
  },
  a: {
    enter: ({ state }) => stateAwareOutput('[', state),
    leave: handleLinkExit
  },
  img: {
    enter: handleImageEnter
  },
  table: {
    enter: handleTableEnter,
    leave: handleTableExit
  },
  thead: {
    enter: handleTableHeadEnter
  },
  tbody: {
    enter: () => ''
  },
  tfoot: {
    enter: () => ''
  },
  tr: {
    enter: handleTableRowEnter,
    leave: handleTableRowExit
  },
  th: {
    enter: ({ node, parent, state }) => {
      state.inTableHead = true;
      return handleTableCellEnter({ node, parent, state });
    },
    leave: handleTableCellExit
  },
  td: {
    enter: handleTableCellEnter,
    leave: handleTableCellExit
  },
  input: {
    enter: handleInputEnter
  }
};

/**
 * Handle node enter events
 */
export function handleNodeEnter(
  node: Node,
  parent: Node | undefined,
  state: MarkdownState,
  nodeDepthMap: Map<Node, number>
): string {
  if (node.type === TEXT_NODE) {
    return handleTextNode({ node, parent, state });
  }

  if (node.type !== ELEMENT_NODE) {
    return ''; // Skip comments and other node types
  }

  // Use tag handler if available
  const handler = tagHandlers[node.name || '']?.enter;
  if (!handler) return '';

  const context: HandlerContext = { node, parent, state, nodeDepthMap };
  let output = handler(context);

  // Remove leading newlines when at the beginning of document
  if (state.lastOutputType === 'none' && output.startsWith('\n')) {
    output = output.replace(/^\n+/, '');
  }

  return output;
}

/**
 * Handle text node conversion
 */
function handleTextNode({ node, parent, state }: HandlerContext): string {
  const parentIsCode =
    parent?.type === ELEMENT_NODE &&
    parent.name === 'code';

  // Skip text nodes that are only whitespace at the root level
  if (!parent || parent.type === DOCUMENT_NODE) {
    if (!(node.value || '').trim()) {
      return '';
    }
  }

  // Skip direct output of text when inside a table - will be handled by table rendering
  if (state.inTable) {
    // Walk up the tree to see if we're in a table cell (th or td)
    let currentParent = parent;
    while (currentParent) {
      if (currentParent.type === ELEMENT_NODE &&
          (currentParent.name === 'td' || currentParent.name === 'th')) {
        // Text in a table cell - don't output directly
        return '';
      }
      currentParent = currentParent.parent;
    }
  }

  // Get text content (always decode entities, including in code blocks)
  let text = decodeHTMLEntities(node.value || '');

  // Handle text inside blockquotes
  if (state.inBlockquote && !parentIsCode && text.trim()) {
    if (state.lastOutputType === 'newline' ||
      state.lastOutputType === 'blockstart') {
      // Add blockquote prefix at line start
      text = '> '.repeat(state.blockquoteLevel) + text.trimStart();
    }
  }

  // Check if this text node is inside a list item that has a nested list
  if (parent?.type === ELEMENT_NODE && parent.name === 'li') {
    // Find this text node's index in the parent's children
    const nodeIndex = parent.children.findIndex(child => child === node);

    // Check if next node is a list
    const nextSibling = nodeIndex < parent.children.length - 1 ?
                     parent.children[nodeIndex + 1] : null;

    // If this text has content and is followed by a list, add a newline
    if (text.trim() && nextSibling && nextSibling.type === ELEMENT_NODE &&
        (nextSibling.name === 'ul' || nextSibling.name === 'ol')) {
      text = text.trimEnd() + '\n';
    }

    // If this is just whitespace and it's followed by a nested list, skip it
    if (!text.trim() && nextSibling && nextSibling.type === ELEMENT_NODE &&
        (nextSibling.name === 'ul' || nextSibling.name === 'ol')) {
      return '';
    }
  }

  return text;
}

/**
 * Handle blockquote element enter
 */
function handleBlockquoteEnter({ state }: HandlerContext): string {
  state.blockquoteLevel++;
  state.inBlockquote = true;

  console.log('blockquote enter', state)
  // Check if we're at the beginning of the document
  const prefix = stateAwareOutput((state.blockquoteLevel > 1) ? '\n' : '\n\n', state)

  return prefix + '> '.repeat(state.blockquoteLevel);
}

/**
 * Handle code element enter
 */
function handleCodeEnter({ node, parent, state }: HandlerContext): string {
  if (parent?.type === ELEMENT_NODE && parent.name === 'pre') {
    const language = ((node.attributes?.class || '')
      .replace('language-', '')
      .trim());

    return stateAwareOutput(`\n\n\`\`\`${language}\n`, state)
  }
  return stateAwareOutput('`', state);
}

/**
 * Handle input element enter (for task lists)
 */
function handleInputEnter({ node }: HandlerContext): string {
  if (node.attributes?.type === 'checkbox') {
    const isChecked = node.attributes.checked !== undefined;
    // Don't add trailing space, the text node will provide spacing
    return isChecked ? '[x]' : '[ ]';
  }
  return '';
}

/**
 * Handle list item element enter
 */
function handleListItemEnter({ node, parent, state, nodeDepthMap }: HandlerContext): string {
  const isOrdered = parent?.type === ELEMENT_NODE && parent.name === 'ol';
  const depth = nodeDepthMap?.get(node) || 0;
  const indent = '  '.repeat(depth);

  // Get list item index for ordered lists
  let index = 1;
  if (isOrdered && parent?.children) {
    index = parent.children
      .filter(c => c.type === ELEMENT_NODE && c.name === 'li')
      .findIndex(c => c === node) + 1;
  }

  const marker = isOrdered ? `${index}. ` : '- ';

  // Track that we're in a list item
  state.inListItem = true;

  // Apply the indent before the marker
  return `${indent}${marker}`;
}

/**
 * Handle image element enter
 */
function handleImageEnter({ node }: HandlerContext): string {
  const alt = node.attributes?.alt || '';
  const src = node.attributes?.src || '';
  return `![${alt}](${src})`;
}

/**
 * Handle table element enter
 */
function handleTableEnter({ state }: HandlerContext): string {
  state.inTable = true;
  state.tableData = [];
  state.currentRowCells = [];
  state.columnAlignments = [];
  state.isFirstRow = true;
  state.colspanWidth = 1;
  state.inColspan = false;
  return '\n\n';
}

/**
 * Handle table head element enter
 */
function handleTableHeadEnter({ state }: HandlerContext): string {
  state.inTableHead = true;
  return '';
}

/**
 * Handle table row element enter
 */
function handleTableRowEnter({ state }: HandlerContext): string {
  state.currentRowCells = [];
  return '';
}

/**
 * Handle table cell element enter (th or td)
 */
function handleTableCellEnter({ node, state }: HandlerContext): string {
  // Handle alignment for header cells
  if (node.attributes?.align && state.inTableHead) {
    const align = node.attributes.align.toLowerCase();

    // Store the alignment type directly, not the formatting
    state.columnAlignments.push(align);
  } else if (state.inTableHead &&
    state.columnAlignments.length <= state.currentRowCells.length) {
    // Default alignment (no special alignment)
    state.columnAlignments.push('');
  }

  // Handle colspan
  if (node.attributes?.colspan) {
    const colspan = parseInt(node.attributes.colspan, 10) || 1;
    if (colspan > 1) {
      // Mark that this cell will expand to multiple columns
      state.inColspan = true;
      state.colspanWidth = colspan;
    }
  }

  return '';
}

/**
 * Handle node exit events
 */
export function handleNodeExit(
  node: Node,
  parent: Node | undefined,
  state: MarkdownState
): string {
  if (node.type !== ELEMENT_NODE) {
    return '';
  }

  // Use tag handler if available
  const handler = tagHandlers[node.name || '']?.leave;
  if (!handler) return '';

  return handler({ node, parent, state });
}

/**
 * Handle code element exit
 */
function handleCodeExit({ parent, state }: HandlerContext): string {
  if (parent?.type === ELEMENT_NODE && parent.name === 'pre') {
    return stateAwareOutput('\n```', state)
  }
  return stateAwareOutput('`', state)
}

/**
 * Handle link element exit
 */
function handleLinkExit({ node, state }: HandlerContext): string {
  const href = node.attributes?.href || '';
  return stateAwareOutput(`](${href})`, state)
}

/**
 * Handle list item element exit
 */
function handleListItemExit({ node, parent, state }: HandlerContext): string {
  // Find current item index in parent's children
  if (!parent || !parent.children) return '\n';

  const currentIndex = parent.children.findIndex(child => child === node);

  // Check if this is the last item in the list
  const isLastItem = currentIndex === parent.children.length - 1;

  // Don't add a newline if this is the last list item in a nested list
  // This avoids unwanted blank lines between nested lists and subsequent items
  if (isLastItem && parent.parent &&
      parent.parent.type === ELEMENT_NODE &&
      parent.parent.name === 'li') {
    return '';
  }

  // Don't add newline after the last item in a list to avoid trailing newlines
  if (isLastItem) {
    return '';
  }

  return '\n';
}

/**
 * Handle table cell element exit (th or td)
 */
function handleTableCellExit({ node, state }: HandlerContext): string {
  // Collect cell content
  const cellContent = collectTextFromNode(node);

  // Store the content for this cell
  state.currentRowCells.push(cellContent.trim());

  // If this cell has colspan, add empty cells for the remaining columns
  if (state.inColspan && state.colspanWidth > 1) {
    // Add empty cells for each additional column in the colspan
    for (let i = 1; i < state.colspanWidth; i++) {
      state.currentRowCells.push('');
    }
    // Reset colspan state
    state.inColspan = false;
    state.colspanWidth = 1;
  }

  return '';
}

/**
 * Handle table row element exit
 */
function handleTableRowExit({ state }: HandlerContext): string {
  // Store the row
  state.tableData.push([...state.currentRowCells]);
  if (state.inTableHead) {
    state.isFirstRow = false;
  }
  return '';
}

/**
 * Handle table element exit
 */
function handleTableExit({ state }: HandlerContext): string {
  state.inTable = false;
  state.inTableHead = false;

  // If no rows, return empty string
  if (state.tableData.length === 0) {
    return '';
  }

  return renderMarkdownTable(state);
}

/**
 * Render a markdown table from state data
 */
function renderMarkdownTable(state: MarkdownState): string {
  // Find max column count
  let columnCount = 0;
  for (const row of state.tableData) {
    columnCount = Math.max(columnCount, row.length);
  }

  // Ensure all rows have same number of cells
  for (const row of state.tableData) {
    while (row.length < columnCount) {
      row.push('');
    }
  }

  // Ensure we have alignments for all columns
  while (state.columnAlignments.length < columnCount) {
    state.columnAlignments.push('');
  }

  // Map alignment values to markdown alignment syntax
  const alignmentMarkers = state.columnAlignments.map(align => {
    switch (align) {
      case 'left': return ':---';
      case 'center': return ':---:';
      case 'right': return '---:';
      default: return '---';
    }
  });

  // Build markdown table
  const parts = [];

  // Header row (first row)
  if (state.tableData.length > 0) {
    parts.push('| ' + state.tableData[0].join(' | ') + ' |');

    // Alignment row (second row)
    parts.push('| ' + alignmentMarkers.join(' | ') + ' |');

    // Data rows (remaining rows)
    for (let i = 1; i < state.tableData.length; i++) {
      parts.push('| ' + state.tableData[i].join(' | ') + ' |');
    }
  }

  return parts.join('\n');
}

/**
 * Handle blockquote element exit
 */
function handleBlockquoteExit({ state }: HandlerContext): string {
  state.blockquoteLevel--;
  if (state.blockquoteLevel === 0) {
    state.inBlockquote = false;
    state.lastOutputType = 'blockend';
  }
  return '';
}

/**
 * Collect text content from a node and its children
 */
export function collectTextFromNode(node: Node): string {
  if (!node.children || node.children.length === 0) {
    return node.type === TEXT_NODE
      ? decodeHTMLEntities(node.value || '')
      : '';
  }

  // Pre-allocate for better performance on large nodes
  const result: string[] = [];

  for (const child of node.children) {
    if (child.type === TEXT_NODE) {
      result.push(decodeHTMLEntities(child.value || ''));
    } else if (child.type === ELEMENT_NODE) {
      // Handle formatting elements
      switch (child.name) {
        case 'strong':
        case 'b':
          result.push('**' + collectTextFromNode(child) + '**');
          break;
        case 'em':
        case 'i':
          result.push('*' + collectTextFromNode(child) + '*');
          break;
        case 'del':
          result.push('~~' + collectTextFromNode(child) + '~~');
          break;
        case 'sub':
          result.push('<sub>' + collectTextFromNode(child) + '</sub>');
          break;
        case 'sup':
          result.push('<sup>' + collectTextFromNode(child) + '</sup>');
          break;
        case 'ins':
          result.push('<ins>' + collectTextFromNode(child) + '</ins>');
          break;
        case 'code':
          result.push('`' + collectTextFromNode(child) + '`');
          break;
        case 'a': {
          const href = child.attributes?.href || '';
          result.push('[' + collectTextFromNode(child) + '](' + href + ')');
          break;
        }
        case 'img': {
          const alt = child.attributes?.alt || '';
          const src = child.attributes?.src || '';
          result.push('![' + alt + '](' + src + ')');
          break;
        }
        case 'input': {
          if (child.attributes?.type === 'checkbox') {
            const isChecked = child.attributes.checked !== undefined;
            result.push(isChecked ? '[x] ' : '[ ] ');
          }
          break;
        }
        default:
          result.push(collectTextFromNode(child));
          break;
      }
    } else if (child.type === COMMENT_NODE) {
      result.push('<!--' + (child.value || '') + '-->');
    }
  }

  return result.join('');
}

