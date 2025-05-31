import type { ElementNode, TextNode } from '../types'
import { createBufferRegion } from '../buffer-region'

import {
  TAG_A,
  TAG_ADDRESS,
  TAG_ARTICLE,
  TAG_ASIDE,
  TAG_AUDIO,
  TAG_B,
  TAG_BLOCKQUOTE,
  TAG_BODY,
  TAG_BR,
  TAG_BUTTON,
  TAG_CAPTION,
  TAG_CODE,
  TAG_DD,
  TAG_DETAILS,
  TAG_DIV,
  TAG_DL,
  TAG_DT,
  TAG_EM,
  TAG_EMBED,
  TAG_FIELDSET,
  TAG_FIGCAPTION,
  TAG_FIGURE,
  TAG_FOOTER,
  TAG_FORM,
  TAG_H1,
  TAG_H2,
  TAG_H3,
  TAG_H4,
  TAG_H5,
  TAG_H6,
  TAG_HEAD,
  TAG_HEADER,
  TAG_HR,
  TAG_HTML,
  TAG_I,
  TAG_IFRAME,
  TAG_IMG,
  TAG_INPUT,
  TAG_LI,
  TAG_MAIN,
  TAG_NAV,
  TAG_OBJECT,
  TAG_OL,
  TAG_P,
  TAG_PRE,
  TAG_SCRIPT,
  TAG_SECTION,
  TAG_SELECT,
  TAG_SPAN,
  TAG_STRONG,
  TAG_STYLE,
  TAG_SUMMARY,
  TAG_SVG,
  TAG_TABLE,
  TAG_TBODY,
  TAG_TD,
  TAG_TEXTAREA,
  TAG_TFOOT,
  TAG_TH,
  TAG_THEAD,
  TAG_TR,
  TAG_UL,
  TAG_VIDEO,
} from '../const'
import { createPlugin } from '../pluggable/plugin'

// Regular expressions for scoring based on scoring.md
const REGEXPS = {
  // Positive patterns that suggest high-quality content
  positive: /article|body|content|entry|main|page|post|text|blog|story|recipe|ingredient|instruction|description|docs?|guide|tutorial|reference|manual/i,
  // Negative patterns that suggest low-quality content
  negative: /ad|banner|combx|comment|disqus|extra|foot|header|menu|meta|nav|promo|related|scroll|share|sidebar|sponsor|social|tags|widget|sitemap|copyright|login|register|subscribe|newsletter|signup|category|author|date|publish|cta|button|apply|trial|likes|views|metrics|stats|breadcrumb|pagination|filter|sort|search/i,
  // Used for counting commas to determine complexity
  commas: /,/g,
  // Used for analyzing paragraph endings
  periodAtEnd: /\.( |$)/,
  // Hidden content detection
  hidden: /hidden|display:\s*none|visibility:\s*hidden/i,
  // Additional ad patterns
  advertisement: /^ad-|^ad$|advertisement|sponsor|promo|banner/i,
  // Comment patterns
  comments: /comment|disqus|replies/i,
}

// Element Tag Scoring based on scoring.md
const TagScores = {
  // Main structural elements
  [TAG_ARTICLE]: 15, // Explicit content container, highest confidence
  [TAG_SECTION]: 8, // Designated content section
  [TAG_MAIN]: 15, // Main content indicator
  [TAG_P]: 5, // Direct paragraph content
  [TAG_DIV]: 2, // Generic container, slightly positive
  [TAG_BLOCKQUOTE]: 5, // Quoted content, usually important

  // Code and pre-formatted content
  [TAG_PRE]: 8, // Preformatted text/code, high value for documentation
  [TAG_CODE]: 6, // Code content, high value for documentation

  // Media elements
  [TAG_IMG]: 3, // Images are typically content
  [TAG_FIGURE]: 4, // Figure with caption, content-focused
  [TAG_FIGCAPTION]: 3, // Description for a figure
  [TAG_VIDEO]: 3, // Video content
  [TAG_AUDIO]: 3, // Audio content
  [TAG_SVG]: 1, // Vector graphic, slight positive

  // Table elements
  [TAG_TABLE]: 0, // Could be data or layout, neutral
  [TAG_CAPTION]: 2, // Table caption
  [TAG_THEAD]: 0, // Table structure, neutral
  [TAG_TBODY]: 0, // Table structure, neutral
  [TAG_TFOOT]: 0, // Table structure, neutral
  [TAG_TR]: -1, // Table row, slight negative
  [TAG_TH]: -2, // Table header, more negative than cells
  [TAG_TD]: 0, // Table cell, neutral

  // List elements
  [TAG_UL]: -8, // Higher penalty as lists are often navigation
  [TAG_OL]: -5, // Ordered lists still often navigation
  [TAG_LI]: -6, // Higher penalty for list items to avoid nav lists
  [TAG_DL]: 0, // Definition lists, neutral
  [TAG_DT]: 0, // Definition lists, neutral
  [TAG_DD]: 0, // Definition lists, neutral

  // Heading elements
  [TAG_H1]: 1, // Top-level heading (may be site title)
  [TAG_H2]: 1, // Section headers, slightly positive
  [TAG_H3]: 1, // Section headers, slightly positive
  [TAG_H4]: 0, // Minor headers, neutral
  [TAG_H5]: 0, // Minor headers, neutral
  [TAG_H6]: 0, // Minor headers, neutral

  // Navigation and structural elements (negative)
  [TAG_HEADER]: -15, // Page header, often not content but may contain article headers
  [TAG_FOOTER]: -25, // Footer, rarely content
  [TAG_NAV]: -30, // Navigation, not content
  [TAG_ASIDE]: -25, // Sidebar, usually not main content

  // Form elements (negative)
  [TAG_FORM]: -8, // User input, not content
  [TAG_BUTTON]: -5, // Interactive element, not content
  [TAG_INPUT]: -5, // Form field, not content
  [TAG_TEXTAREA]: -5, // Text input, not content
  [TAG_SELECT]: -5, // Drop-down, not content
  [TAG_FIELDSET]: -5, // Form field group, not content

  // Embedded content (mostly negative)
  [TAG_IFRAME]: -3, // Embedded content, often ads
  [TAG_EMBED]: -3, // Embedded content, often ads
  [TAG_OBJECT]: -3, // Embedded content, often ads

  // Links
  [TAG_A]: -8, // Higher penalty to avoid navigation-heavy areas

  // Text formatting
  [TAG_STRONG]: 1, // Emphasized text, slightly positive
  [TAG_B]: 1, // Emphasized text, slightly positive
  [TAG_EM]: 1, // Emphasized text, slightly positive
  [TAG_I]: 1, // Emphasized text, slightly positive

  // Miscellaneous elements
  [TAG_HR]: 0, // Divider, neutral
  [TAG_BR]: 0, // Line break, neutral
  [TAG_SPAN]: 0, // Inline container, neutral
  [TAG_SCRIPT]: -25, // Script, never content
  [TAG_STYLE]: -25, // Style, never content

  // Expandable content
  [TAG_DETAILS]: 2, // Expandable content
  [TAG_SUMMARY]: 1, // Header for expandable content

  // Additional tags not explicitly in scoring.md
  [TAG_ADDRESS]: -3, // Similar to footer, rarely content
}

/**
 * Apply score adjustments based on class and ID names
 */
function scoreClassAndId(node: ElementNode) {
  let scoreAdjustment = 0

  // Boost or penalize based on class/ID names
  if (node.attributes?.class) {
    const className = node.attributes.class as string

    // Check for specific strong negative patterns first
    if (/nav|menu|header|footer|sidebar|ad-|advertisement|banner|promo|cta|button|apply|trial|engagement|sharing|likes|views|metrics|stats|breadcrumb|pagination|filter|sort|search/i.test(className)) {
      scoreAdjustment -= 35
    }
    // Then check for other negative patterns
    else if (REGEXPS.negative.test(className)) {
      scoreAdjustment -= 15 // Increased penalty
    }
    // Only apply positive patterns if no negative patterns matched
    else if (REGEXPS.positive.test(className)) {
      scoreAdjustment += 10 // +10 per scoring.md
      // Special boost for documentation content
      if (/docs?|guide|tutorial|reference|manual|article/i.test(className)) {
        scoreAdjustment += 5 // Extra boost for docs
      }
    }
  }

  if (node.attributes?.id) {
    const id = node.attributes.id as string

    // Check for specific strong negative patterns first
    if (/nav|menu|header|footer|sidebar|ad-|advertisement|banner|promo|cta|button|apply|trial|engagement|sharing|likes|views|metrics|stats|breadcrumb|pagination|filter|sort|search/i.test(id)) {
      scoreAdjustment -= 35
    }
    // Then check for other negative patterns
    else if (REGEXPS.negative.test(id)) {
      scoreAdjustment -= 15 // Increased penalty
    }
    // Only apply positive patterns if no negative patterns matched
    else if (REGEXPS.positive.test(id)) {
      scoreAdjustment += 10 // +10 per scoring.md
      // Special boost for documentation content
      if (/docs?|guide|tutorial|reference|manual|article/i.test(id)) {
        scoreAdjustment += 5 // Extra boost for docs
      }
    }
  }

  return scoreAdjustment
}

/**
 * Creates a plugin that implements readability.js style heuristics for content quality assessment
 * Controls content inclusion/exclusion using buffer regions
 */
export function readabilityPlugin() {
  let inHead = false

  return createPlugin({
    onNodeEnter(node, state) {
      // Set default to include content unless explicitly excluded

      if (inHead) {
        return
      }

      // Ensure the node has a context object
      if (!node.context) {
        node.context = {}
      }

      if (node.tagId === TAG_BODY || node.tagId === TAG_HTML) {
        return
      }

      // Allow <head> to be processed (always include head content)
      if (node.tagId === TAG_HEAD) {
        createBufferRegion(node, state, true)
        inHead = true
        return
      }

      const tagScore = TagScores[node.tagId] ?? 0
      const classAndIdScore = scoreClassAndId(node)

      // Initialize metrics for this node
      // Start with neutral score, only apply tag and class/id scoring
      node.context.score = tagScore + classAndIdScore
      node.context.tagCount = 1
      node.context.linkTextLength = 0
      node.context.textLength = 0

      // Check for strong negative patterns that should override parent context
      const hasStrongNegativePattern = (
        (node.name && /nav|header|footer|aside|form|fieldset|button/i.test(node.name))
        || (node.attributes?.class && /nav|menu|header|footer|sidebar|hidden|copyright|ad-|advertisement|banner|promo|related|comment|login|register|subscribe|newsletter|category|meta|tag|cta|button|apply|trial|engagement|sharing|likes|views|metrics|stats|breadcrumb|pagination|filter|sort|search/i.test(node.attributes.class as string))
        || (node.attributes?.id && /nav|menu|header|footer|sidebar|hidden|copyright|ad-|advertisement|banner|promo|related|comment|login|register|subscribe|newsletter|category|meta|tag|cta|button|apply|trial|engagement|sharing|likes|views|metrics|stats|breadcrumb|pagination|filter|sort|search/i.test(node.attributes.id as string))
        || (node.attributes?.style && /display:\s*none|visibility:\s*hidden/i.test(node.attributes.style as string))
        || (node.attributes && Object.keys(node.attributes).some(attr => attr.startsWith('aria-') && node.attributes![attr] === 'true' && /hidden|invisible/i.test(attr)))
      )

      if (hasStrongNegativePattern) {
        // Strong negative patterns: exclude immediately without inheriting parent score
        createBufferRegion(node, state, false)
      }
      else {
        // For all other nodes, don't create inclusion regions immediately
        // Let content flow naturally and only exclude specific problematic content
        // If node has a parent, inherit parent's relevant context
        if (node.parent && node.parent.context) {
          node.context.score += (node.parent.context.score || 0)
        }
      }
      // Negative scores (but > -15) wait for onNodeExit when text content might improve the score
      // Negative scores (but > -10) wait for onNodeExit when text content might improve the score
    },

    processTextNode(node: TextNode) {
      if (!node.parent || inHead)
        return

      const textValue = node.value
      const len = textValue.length

      // Count commas (max 3 points per scoring.md)
      const commaCount = Math.min(3, (textValue.match(REGEXPS.commas) || []).length)

      // Check if this text is inside a link for link density calculation
      const isInsideLink = !!node.parent.depthMap?.[TAG_A]

      // Apply text length and comma count to parent nodes
      let parent = node.parent
      while (parent) {
        if (!parent.context) {
          parent.context = {}
        }

        // Add comma count bonus to parent scores (up to 3)
        parent.context.score = (parent.context.score || 0) + commaCount

        // Track text length for this parent
        parent.context.textLength = (parent.context.textLength || 0) + len

        // If inside a link, track this for link density calculation
        if (isInsideLink) {
          parent.context.linkTextLength = (parent.context.linkTextLength || 0) + len
        }

        parent = parent.parent
      }
    },

    onNodeExit(node, state) {
      // Only process nodes with context
      if (!node.context) {
        return
      }

      if (node.tagId === TAG_BODY || node.tagId === TAG_HTML) {
        return
      }

      if (node.tagId === TAG_HEAD) {
        // closeBufferRegion(node, state)
        inHead = false
        return
      }

      if (inHead) {
        return
      }

      // Apply text length scoring per scoring.md
      const textLength = node.context.textLength || 0

      // Apply empty content penalty for elements with no text
      if (textLength === 0 && node.tagId !== TAG_BODY && !node.childTextNodeIndex) {
        // node.context.score -= 20 // Empty content penalty from scoring.md
      }
      // Apply text length bonuses according to scoring.md
      else if (textLength > 100) {
        node.context.score += 3
      }
      else if (textLength >= 50) {
        node.context.score += 2
      }
      else if (textLength >= 25) {
        node.context.score += 1
      }

      // Calculate link density and apply multiplier if needed
      const linkTextLength = node.context.linkTextLength || 0
      if (textLength > 0) {
        const linkDensity = linkTextLength / textLength

        // Apply more aggressive link density penalty
        if (linkDensity > 0.4) {
          // For very high link density, apply severe penalty and mark as navigation-like
          if (linkDensity > 0.6) {
            node.context.score = node.context.score * 0.02 // 98% reduction
            // If we have high link density, mark as navigation-like content
            if (linkTextLength > 50) {
              node.context.isHighLinkDensity = true
            }
          }
          else {
            // Scale score down based on link density
            node.context.score *= (1 - linkDensity * 2.0) // Even more aggressive scaling
          }
        }
        else if (linkDensity > 0.2) { // Lower threshold for moderate link density
          // Even moderate link density should reduce score significantly
          node.context.score *= (1 - (linkDensity * 1.0))
        }
      }

      // Special penalty for elements with many links based on link density and text length
      if (linkTextLength > 0 && textLength > 0) {
        const linkRatio = linkTextLength / textLength
        const hasDocumentationMarkers = (
          (node.attributes?.class && /docs?|guide|tutorial|reference|manual|article|content/i.test(node.attributes.class as string))
          || (node.attributes?.id && /docs?|guide|tutorial|reference|manual|article|content/i.test(node.attributes.id as string))
          || (node.name && /main|article|section/i.test(node.name))
        )

        if (linkRatio > 0.3 && linkTextLength > 30 && !hasDocumentationMarkers) {
          // This looks like navigation-heavy content (but not documentation with inline links)
          node.context.score -= 10
        }
      }

      // Only exclude content with low scores to reduce fragmentation
      const finalScore = node.context.score

      if (finalScore <= -12) {
        // More aggressive exclusion threshold to filter out navigation and low-quality content
        createBufferRegion(node, state, false)
      }
      // Also exclude high link density content regardless of other scoring
      else if (node.context.isHighLinkDensity || (linkTextLength > 50 && textLength > 0 && (linkTextLength / textLength) > 0.5)) {
        createBufferRegion(node, state, false)
      }
      // Don't create inclusion regions dynamically - let content flow naturally

      // Close any buffer region for this node
      // closeBufferRegion(node, state)

      // For inline elements, propagate score to parent
      if (node.tagHandler?.isInline) {
        const parent = node.parent
        if (parent && parent.context) {
          parent.context.score += finalScore - (parent.context.score || 0)
        }
      }
    },
  })
}
