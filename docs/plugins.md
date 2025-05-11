# MDream Plugin System

MDream now features a powerful plugin system that allows you to customize and extend the HTML-to-Markdown conversion process. This document explains how to use the plugin system and create your own plugins.

## Using Plugins

Plugins can be added to the HTML-to-Markdown conversion process through the `plugins` option:

```typescript
import { filterUnsupportedTags, syncHtmlToMarkdown, withTailwind } from 'mdream'

const html = '<div class="font-bold">Hello, world!</div>'
const markdown = syncHtmlToMarkdown(html, {
  plugins: [
    withTailwind(),
    filterUnsupportedTags()
  ]
})

console.log(markdown) // "**Hello, world!**"
```

Plugins are executed in the order they are provided. This allows you to create chains of plugins that build on each other's functionality.

## Creating Plugins

You can create your own plugins using the `createPlugin` function:

```typescript
import { createPlugin, syncHtmlToMarkdown } from 'mdream'
import { ELEMENT_NODE } from 'mdream/const'

const myPlugin = createPlugin({
  name: 'my-plugin',

  // Optional initialization function
  init() {
    // Initialize plugin state
  },

  // Process attributes before any content is generated
  processAttributes(node) {
    if (node.name === 'div' && node.attributes?.role === 'alert') {
      node.pluginData = {
        'my-plugin': { isAlert: true }
      }
    }
  },

  // Transform content after it's generated
  transformContent(content, node, state) {
    if (node.pluginData?.['my-plugin']?.isAlert) {
      return `⚠️ ${content} ⚠️`
    }
    return content
  },

  // Filter out nodes
  filter: {
    [ELEMENT_NODE](node) {
      // Return false to exclude the node
      return node.name !== 'ad'
    }
  },

  // Add content when entering a node
  onNodeEnter(event, state) {
    if (event.node.type === ELEMENT_NODE && event.node.name === 'aside') {
      return '> '
    }
  },

  // Add content when exiting a node
  onNodeExit(event, state) {
    if (event.node.type === ELEMENT_NODE && event.node.name === 'aside') {
      return '\n'
    }
  },

  // Process nodes before they're handled by the parser
  beforeNodeProcess(node, state) {
    // Return false to skip node processing entirely
    return true
  }
})

const html = '<div role="alert">Important message</div>'
const markdown = syncHtmlToMarkdown(html, {
  plugins: [myPlugin]
})

console.log(markdown) // "⚠️ Important message ⚠️"
```

## Plugin Hooks

Plugins can implement any of the following hooks:

### `init(options?: Record<string, any>): void`

Called when the plugin is initialized. Can be used to set up plugin state.

### `beforeNodeProcess(node: Node, state: MdreamRuntimeState): boolean`

Called before a node is processed by the parser. Return `false` to skip node processing entirely.

### `onNodeEnter(event: NodeEvent, state: MdreamRuntimeState): string | undefined`

Called when entering a node. Return a string to add content before the node's content.

### `onNodeExit(event: NodeEvent, state: MdreamRuntimeState): string | undefined`

Called when exiting a node. Return a string to add content after the node's content.

### `processAttributes(node: ElementNode, state: MdreamRuntimeState): void`

Called to process a node's attributes. Use this to add custom data to nodes based on their attributes.

### `transformContent(content: string, node: Node, state: MdreamRuntimeState): string`

Called to transform content after it's generated. Use this to modify the generated content.

### `filter: ElementFilter`

Used to filter out nodes. Implement the `[ELEMENT_NODE]` function to return `false` for nodes you want to exclude.

### `finish(state: MdreamRuntimeState): void | Record<string, any>`

Called after the entire document is processed. This is useful for plugins that need to analyze the complete document or provide final data through the returned object.

You can implement the `StreamBufferControl` interface by returning a properly structured object from this hook.

## Implementing Stream Buffer Control

MDream supports a special plugin interface for controlling content buffering in streaming mode. Any plugin can implement this interface by returning a `streamBufferControl` object from its `finish` hook:

```typescript
import { createPlugin, streamHtmlToMarkdown } from 'mdream'

const myBufferPlugin = createPlugin({
  name: 'my-buffer-control',

  // Track content state throughout the document
  init() {
    this.foundMainContent = false
    this.contentScore = 0
    return { bufferControl: true }
  },

  // Analyze text nodes to determine content relevance
  processTextNode(node, state) {
    if (node.value?.includes('Main Article')) {
      this.foundMainContent = true
      this.contentScore = 10
    }
    return undefined
  },

  // Implement the StreamBufferControl interface via the finish hook
  finish(state) {
    return {
      // Add the streamBufferControl object to control buffering
      streamBufferControl: {
        // Whether the stream should buffer content
        shouldBuffer: !this.foundMainContent,
        // A numeric score representing content quality
        score: this.contentScore,
        // Whether relevant content has been found
        hasRelevantContent: this.foundMainContent,
        // Minimum score required to stop buffering
        minRequiredScore: 5.0,
        // Optional debug information
        debug: {
          pluginName: 'my-buffer-control'
        }
      }
    }
  }
})

// Use the buffer control plugin with streaming
for await (const chunk of streamHtmlToMarkdown(
  htmlStream,
  { plugins: [myBufferPlugin] },
  { minDensityScore: 5.0 }
)) {
  console.log(chunk)
}
```

The `streamBufferControl` interface has the following properties:

- `shouldBuffer` (required): Boolean indicating whether content should continue to be buffered
- `score` (optional): Numeric value representing content quality or density
- `hasRelevantContent` (optional): Boolean indicating whether relevant content has been found
- `minRequiredScore` (optional): Threshold value for the score to stop buffering
- `debug` (optional): Object containing debug information

## Built-in Plugins

MDream comes with several built-in plugins that you can use:

### Filter Plugins

- `filterUnsupportedTags()`: Filters out unsupported HTML tags like `script`, `style`, etc.
- `filterExcludeTags(tags: Set<string>)`: Filters out specified HTML tags.
- `filterFromFirstTag(tag: string)`: Only includes content from the first occurrence of a specified tag onwards.

### Addon Plugins

- `withTailwind()`: Adds Tailwind CSS class processing to apply Markdown formatting based on Tailwind classes.

### Buffer Control Plugins

- `createDensityTrackingPlugin(options)`: Creates a simple plugin that tracks content density to control streaming buffer behavior. The options include:
  - `minDensityScore` (default: 5.0): Minimum text density score required to stop buffering content
  - `debugMarkers` (default: false): Whether to include debug markers in the output

### Presets

Presets combine multiple plugins for common use cases:

- `withDefaultPreset(options)`: Basic preset with unsupported tag filtering.
- `withMinimalPreset(options)`: Preset that includes only content elements.
- `withMinimalFromFirstHeaderPreset(options)`: Preset that only includes content from the first header tag onwards.
- `withMinimalFromTagPreset(tag, options)`: Preset that only includes content from the first occurrence of a specified tag onwards.

## Plugin Utilities

MDream provides several utilities for working with plugins:

### `getPluginData<T>(state: MdreamRuntimeState, pluginName: string): T | undefined`

Gets plugin-specific data from the runtime state.

### `setPluginData<T>(state: MdreamRuntimeState, pluginName: string, data: T): void`

Sets plugin-specific data in the runtime state.

### `getNodePluginData<T>(node: ElementNode, pluginName: string): T | undefined`

Gets plugin-specific data from a node.

### `setNodePluginData<T>(node: ElementNode, pluginName: string, data: T): void`

Sets plugin-specific data on a node.

## Best Practices

1. **Use unique plugin names**: Ensure your plugin has a unique name to avoid conflicts with other plugins.
2. **Store plugin data using the plugin name as the key**: This helps prevent collisions with other plugins.
3. **Keep plugins focused**: Each plugin should do one thing well.
4. **Chain plugins**: Use multiple plugins together to build complex functionality.
5. **Respect existing content**: When transforming content, be careful not to break existing Markdown formatting.
6. **Use node attributes**: Store custom data in node attributes or the pluginData object.
