# Tailwind CSS Addon for MDream

This addon converts Tailwind CSS utility classes to appropriate Markdown formatting when converting HTML to Markdown. It respects Tailwind's mobile-first approach with responsive breakpoints.

## Features

- Converts typography-related Tailwind classes to their Markdown equivalents
- Handles element visibility with `hidden` classes
- Follows mobile-first responsive design principles (base → sm → md → lg → xl → 2xl)
- Works alongside other filters like `minimal` and `minimal-from-first-header`

## Installation

The Tailwind addon is included in the MDream package. No additional installation is required.

## Usage

```javascript
import { syncHtmlToMarkdown, withTailwind } from 'mdream'

// HTML with Tailwind classes
const html = '<p class="font-bold italic">Bold and italic text</p>'

// With Tailwind support
const markdown = syncHtmlToMarkdown(html, {
  plugins: [withTailwind()]
})
// Result: "***Bold and italic text***"

// Without Tailwind support (default)
const markdownPlain = syncHtmlToMarkdown(html)
// Result: "Bold and italic text"
```

## Using the Older API (For Backward Compatibility)

For backward compatibility, you can still use the older API:

```javascript
import { addTailwindSupport, syncHtmlToMarkdown } from 'mdream'

// Using the older API
const markdown = syncHtmlToMarkdown(html, {
  plugins: [addTailwindSupport()]
})
```

## Combining with Other Plugins

You can combine Tailwind support with other MDream plugins:

```javascript
import { filterUnsupportedTags, syncHtmlToMarkdown, withTailwind } from 'mdream'

const html = `
  <nav class="bg-blue-500 p-4">Navigation</nav>
  <main>
    <h1 class="font-bold">Title</h1>
    <p class="italic">Content</p>
  </main>
  <footer class="mt-8">Footer</footer>
  <script>console.log("This should be removed")</script>
`

// With Tailwind support and filters
const markdown = syncHtmlToMarkdown(html, {
  plugins: [
    withTailwind(),
    filterUnsupportedTags()
  ],
  filters: 'minimal'
})

// Result: "# **Title**\n\n*Content*"
// (nav and footer are excluded by the minimal filter, script is removed by unsupported tags filter)
```

## Supported Tailwind Classes

The addon currently supports these Tailwind classes:

### Typography
- `font-bold`, `font-semibold`, `font-black`, `font-extrabold`, `font-medium` → Bold (`**text**`)
- `italic`, `font-italic` → Italic (`*text*`)
- `line-through` → Strikethrough (`~~text~~`)

### Display/Visibility
- `hidden` → Element is completely removed from output

## Responsive Classes

The addon respects Tailwind's mobile-first approach when handling responsive classes:

```javascript
// HTML with responsive classes
const html = '<p class="font-normal md:font-bold lg:italic">Responsive text</p>'

// lg:italic takes precedence over md:font-bold
const markdown = syncHtmlToMarkdown(html, {
  plugins: [tailwindPlugin()]
})
// Result: "*Responsive text*"
```

When multiple breakpoints provide conflicting styles, the largest breakpoint wins. For example, with `md:hidden lg:block`, the element would be visible in the output because `lg:block` overrides `md:hidden`.

## Extending Tailwind Support

You can extend the Tailwind plugin by creating your own plugin that builds on top of it:

```javascript
import { createPlugin, syncHtmlToMarkdown, withTailwind } from 'mdream'

// Create a plugin that adds custom Tailwind class handling
const customTailwind = createPlugin({
  name: 'custom-tailwind',

  // Process attributes after the main Tailwind plugin
  processAttributes(node) {
    if (node.attributes?.class?.includes('bg-red-500')) {
      // Add a warning emoji to elements with red background
      node.pluginData = {
        'custom-tailwind': { warning: true }
      }
    }
  },

  // Transform content after Tailwind has processed it
  transformContent(content, node) {
    if (node.pluginData?.['custom-tailwind']?.warning) {
      return `⚠️ ${content}`
    }
    return content
  }
})

// Use both plugins
const html = '<p class="font-bold bg-red-500">Warning message</p>'
const markdown = syncHtmlToMarkdown(html, {
  plugins: [
    withTailwind(),
    customTailwind
  ]
})
// Result: "⚠️ **Warning message**"
```

## Limitations

- Only typography formatting classes are converted to Markdown (bold, italic, strikethrough)
- Other Tailwind classes (spacing, colors, etc.) have no effect as they can't be represented in Markdown
- Complex formatting combinations may not render as expected in all Markdown renderers
