import type { ElementNode, MdreamRuntimeState } from '../types.ts'
import { MARKDOWN_CODE_BLOCK, TAG_CODE, TAG_PRE } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

/**
 * A plugin that adds language detection from class names on pre and code tags
 * This demonstrates how to extend the built-in tag handlers
 */
export function PreCodePlugin() {
  return createPlugin({
    init(options, tagHandlers) {
      if (!tagHandlers) {
        return
      }

      // Get existing handlers
      const codeHandler = tagHandlers[TAG_CODE]
      const preHandler = tagHandlers[TAG_PRE]

      // Make sure pre tag handler has usesAttributes set
      tagHandlers[TAG_PRE] = {
        ...preHandler,
        usesAttributes: true,
      }

      // Enhance code handler to handle language classes more effectively
      tagHandlers[TAG_CODE] = {
        ...codeHandler,
        usesAttributes: true,
        enter: (context) => {
          const node = context.node
          if ((node.depthMap[TAG_PRE] || 0) > 0) {
            const language = determineLanguage(node)
            return `${MARKDOWN_CODE_BLOCK}${language}\n`
          }

          // Use the original handler for inline code
          return codeHandler.enter?.(context)
        },
      }

      // Return the plugin's state
      return { extendedTagHandlers: true }
    },

    // Process attributes to extract language information
    processAttributes(node: ElementNode, state: MdreamRuntimeState): void {
      if (node.name === 'pre') {
        // Extract and store language information from pre tag
        const preClass = node.attributes?.class || ''
        if (preClass) {
          node.context = node.context || {}
          node.context['pre-code'] = node.context['pre-code'] || {}
          node.context['pre-code'].language = extractLanguageFromClass(preClass)
        }
      }
      else if (node.name === 'code') {
        // Extract language information from code tag
        const codeClass = node.attributes?.class || ''
        if (codeClass) {
          node.context = node.context || {}
          node.context['pre-code'] = node.context['pre-code'] || {}
          node.context['pre-code'].language = extractLanguageFromClass(codeClass)
        }
      }
    },
  })
}

/**
 * Helper function to extract language from class attribute
 */
function extractLanguageFromClass(className: string): string {
  if (!className)
    return ''

  // Try common class patterns
  if (className.startsWith('language-')) {
    return className.substring(9)
  }

  if (className.startsWith('lang-')) {
    return className.substring(5)
  }

  // Look for language- or lang- in any class
  const classes = className.split(/\s+/)
  for (const cls of classes) {
    if (cls.startsWith('language-')) {
      return cls.substring(9)
    }
    if (cls.startsWith('lang-')) {
      return cls.substring(5)
    }
  }

  // Check for common language names
  const commonLanguages = [
    'js',
    'javascript',
    'ts',
    'typescript',
    'html',
    'css',
    'python',
    'ruby',
    'go',
    'rust',
    'java',
    'c',
    'cpp',
    'csharp',
    'php',
    'swift',
  ]

  for (const cls of classes) {
    if (commonLanguages.includes(cls)) {
      return cls
    }
  }

  return ''
}

/**
 * Helper function to determine language for a code block
 */
function determineLanguage(node: ElementNode): string {
  // First check if we have language data on this node
  const codeData = node.context?.['pre-code'] as { language: string } | undefined
  if (codeData?.language) {
    return codeData.language
  }

  // If not, check for parent pre tags
  let parent = node.parent
  while (parent) {
    if (parent.name === 'pre') {
      const preData = parent.context?.['pre-code'] as { language: string } | undefined
      if (preData?.language) {
        return preData.language
      }
      break
    }
    parent = parent.parent
  }

  // Fall back to class attribute directly (for tests)
  const codeClass = node.attributes?.class || ''
  return extractLanguageFromClass(codeClass)
}
