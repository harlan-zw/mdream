# Plugin API

The mdream package provides a flexible plugin API that allows you to extend the HTML to Markdown conversion process in various ways.

## Plugin Lifecycle

A plugin in mdream has several lifecycle hooks that allow it to interact with the conversion process:

1. `init` - Called when the plugin is first initialized
2. `beforeNodeProcess` - Called before a node is processed
3. `onNodeEnter` - Called when entering a node
4. `onNodeExit` - Called when exiting a node
5. `processAttributes` - Called to process node attributes
6. `processTextNode` - Called to process text nodes
7. `transformContent` - Called to transform content before it's added to the output

## Creating a Plugin

You can create a plugin using the `createPlugin` function:

```typescript
import { createPlugin } from 'mdream'

const myPlugin = createPlugin({
  name: 'my-plugin',
  init(options) {
    // Initialize plugin state
    return { myPluginActive: true }
  },
  processTextNode(node, state) {
    // Process text nodes
    return { content: node.value.toUpperCase(), skip: false }
  }
})
```

## Extending Tag Handlers

Plugins can now extend the built-in tag handlers via the `init` hook. This allows you to customize how specific HTML tags are converted to Markdown.

```typescript
import { createPlugin } from 'mdream'
import { TAG_DIV } from 'mdream/const'

const divPlugin = createPlugin({
  name: 'div-plugin',
  init(options, tagHandlers) {
    if (!tagHandlers)
      return

    // Modify the DIV tag handler
    tagHandlers[TAG_DIV] = {
      ...tagHandlers[TAG_DIV], // Keep existing properties
      enter: (context) => {
        // Custom handling for DIV tags
        return '<custom-div>'
      },
      exit: (context) => {
        return '</custom-div>'
      }
    }
  }
})
```

### Example: Enhanced Code Block Plugin

The `pre-code` plugin demonstrates how to extend tag handlers to enhance code block language detection:

```typescript
import { withPreCodePlugin } from 'mdream'

const markdown = syncHtmlToMarkdown(html, {
  plugins: [withPreCodePlugin()]
})
```

This plugin improves language detection for code blocks by:

1. Looking for language indicators in both `pre` and `code` tags
2. Supporting multiple class naming patterns (`language-js`, `lang-js`, `js`)
3. Recognizing common language names directly as classes

## Using Plugin Data

Plugins can store and retrieve data both globally and per-node:

```typescript
import { createPlugin, getNodePluginData, setNodePluginData } from 'mdream'

const dataPlugin = createPlugin({
  name: 'data-plugin',
  processAttributes(node, state) {
    // Store data on a node
    setNodePluginData(node, 'data-plugin', { important: true })
  },
  beforeNodeProcess(node, state) {
    // Retrieve data from a node
    const data = getNodePluginData(node, 'data-plugin')
    return data?.important || false
  }
})
```

## Combining Plugins

You can use multiple plugins together to extend functionality:

```typescript
const markdown = syncHtmlToMarkdown(html, {
  plugins: [
    withTailwind(),
    withPreCodePlugin(),
    myCustomPlugin()
  ]
})
```

Plugins are applied in the order they are listed, so earlier plugins may affect the behavior of later ones.
