/**
 * Generic function to walk through a payload structure and find specified elements
 * @param node The current node to process (could be a string or array)
 * @param predicate Function to determine if the current node matches criteria
 * @param callback Function called when a matching element is found
 * @param path Current path in the tree structure
 */
export function walk<T = any>(
  node: any,
  predicate: (node: any, path: string[]) => boolean,
  callback: (node: T, path: string[]) => void,
  path: string[] = [],
): void {
  // Handle arrays (most content elements are arrays)
  if (Array.isArray(node)) {
    // Check if this node matches the predicate
    if (predicate(node, path)) {
      callback(node as T, path)
    }

    // Process children
    for (let i = 0; i < node.length; i++) {
      walk(node[i], predicate, callback, [...path, i.toString()])
    }
  }
  // Handle objects (like attributes)
  else if (node && typeof node === 'object') {
    // Check if this object matches the predicate
    if (predicate(node, path)) {
      callback(node as T, path)
    }

    // Process each property of the object
    for (const key of Object.keys(node)) {
      walk(node[key], predicate, callback, [...path, key])
    }
  }
}

export function stripHeaderAnchorLinks(payload: any) {
  // match header tag then see if a is inside to a #
  walk(payload, (node) => {
    return Array.isArray(node) && typeof node[0] === 'string' && node[0].startsWith('h')
  }, (child) => {
    if (child[1].id) {
      // remove the id
      delete child[1].id
    }
  })
}

export function modifyRelativeDocLinksWithFramework(
  payload: any,
  framework: string,
): any[] {
  const links = []
  // find a tags and check the href, if it's relative and contains docs and does not have a framework (getPathFramework)
  // then we should add the framework getPathWithFramework
  walk(
    payload,
    node => Array.isArray(node) && node[0] === 'a' && typeof node[1].href === 'string',
    (node) => {
      const href = node[1].href
      if (href.startsWith('/docs/') && !href.includes(`/docs/${framework}`)) {
        // add the framework to the href
        node[1].href = href.replace('/docs/', `/docs/${framework}/`)
      }
      // while we're here make any absolute links target="_blank"
      else if (href.startsWith('http') && !href.includes('/docs/')) {
        node[1].target = '_blank'
        node[1].rel = 'noopener noreferrer'
      }
      links.push(node)
    },
  )
  return links
}

export function replaceImportSpecifier(
  payload: any,
  mapping: Record<string, string>,
  correctUseHeadForTypeScript: boolean,
): void {
  walk(
    payload,
    node => Array.isArray(node) && node[0] === 'pre',
    (node) => {
      if (node[1].code) {
        // do a string replace of the "copy"
        for (const [oldImport, newImport] of Object.entries(mapping)) {
          node[1].code = node[1].code.replaceAll(oldImport, newImport)
        }
      }
      if (!Array.isArray(node[2]))
        return

      // Process all lines directly from the original array
      for (let lineIndex = 2; lineIndex < node[2].length; lineIndex++) {
        const line = node[2][lineIndex]
        if (!Array.isArray(line))
          continue

        for (let i = 0; i < line.length; i++) {
          const segment = line[i]
          if (Array.isArray(segment) && segment[0] === 'span' && typeof segment[2] === 'string') {
            for (const [oldImport, newImport] of Object.entries(mapping)) {
              if (segment[2].includes(oldImport)) {
                // Replace the string directly in the segment
                segment[2] = segment[2].replace(oldImport, newImport)
              }
              else if (correctUseHeadForTypeScript && newImport === 'unhead' && ['useHead', 'useSeoMeta', 'useHeadSafe', 'useScript', 'useServerHead'].includes(segment[2])) {
                // need to insert a span in two indexes ahead
                // Insert the new segment at the correct index
                line.splice(i + 2, 0, ['span', { style: 'color: var(--color-yellow-700)' }, 'unheadInstance'])
                line.splice(i + 3, 0, ['span', { class: 'hljs-symbol' }, ', '])
              }
            }
          }
        }
      }
    },
  )
}
