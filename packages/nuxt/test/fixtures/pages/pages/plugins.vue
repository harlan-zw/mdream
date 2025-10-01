<script setup lang="ts">
useSeoMeta({
  title: 'Plugin Development - Extend MDream Functionality',
  description: 'Learn how to create custom plugins for MDream. Build extractors, filters, and transformers using the plugin API with hooks for node processing and text transformation.',
})
</script>

<template>
  <div>
    <h1>Plugin Development</h1>
    <p>
      The MDream plugin system provides a powerful way to customize and extend the HTML to Markdown
      conversion process. Plugins can filter content, extract structured data, transform elements,
      or add entirely new conversion behaviors. This guide will help you understand how to create
      effective plugins for your specific use cases.
    </p>

    <h2>Creating a Plugin</h2>
    <p>
      Use the createPlugin helper to build type-safe plugins with proper TypeScript support.
      A plugin is an object with optional hook methods that get called during different stages
      of the conversion process. Each hook receives relevant context about the current node
      being processed and the conversion state.
    </p>

    <h2>Available Hooks</h2>
    <p>
      The beforeNodeProcess hook runs before any node processing and can skip nodes entirely.
      The onNodeEnter hook is called when entering an element node, perfect for adding prefix
      content or setting up state. The onNodeExit hook runs when exiting an element, useful for
      adding suffix content or cleanup. The processTextNode hook handles individual text nodes,
      allowing you to transform or filter text content.
    </p>

    <h2>Example: Content Extraction</h2>
    <p>
      One common use case is extracting structured data during conversion. For example, you might
      want to collect all headings, extract images with their alt text, or find specific elements
      matching a CSS selector. The extractionPlugin helper makes this easy by accepting CSS
      selectors and callbacks for matched elements.
    </p>

    <h2>Example: Ad Blocking</h2>
    <p>
      Another useful pattern is filtering unwanted content. By using the beforeNodeProcess hook,
      you can skip elements that match certain criteria, such as ads, tracking scripts, or
      promotional banners. This keeps your Markdown output clean and focused on the actual content.
    </p>

    <h2>Best Practices</h2>
    <p>
      Keep plugins focused on a single responsibility. Use the state parameter to access conversion
      context without storing global state. Return skip: true to prevent processing of specific
      nodes. Chain multiple plugins to build complex behavior from simple, reusable components.
    </p>
  </div>
</template>
