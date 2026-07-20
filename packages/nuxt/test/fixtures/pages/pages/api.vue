<script setup lang="ts">
useSeoMeta({
  title: 'API Reference - MDream Functions and Options',
  description: 'Complete API documentation for MDream including htmlToMarkdown, streamHtmlToMarkdown, plugin hooks, and configuration options for HTML to Markdown conversion.',
})
</script>

<template>
  <div>
    <h1>API Reference</h1>
    <p>
      This page provides complete API documentation for MDream, including function signatures,
      options, return types, and usage examples. Whether you're using the synchronous or streaming
      API, this reference will help you understand all available configuration options.
    </p>

    <h2>htmlToMarkdown</h2>
    <p>
      The main synchronous function for converting HTML to Markdown. Accepts an HTML string and
      optional configuration object, returns a Markdown string. This is the simplest way to use
      MDream and is suitable for most use cases where you have the complete HTML content available
      in memory.
    </p>

    <h2>streamHtmlToMarkdown</h2>
    <p>
      The streaming conversion function that processes HTML incrementally. Returns a readable stream
      that emits Markdown chunks as they become available. This function is ideal for large documents
      or scenarios where you want to start processing output before the entire HTML is parsed.
      The stream automatically handles buffering and ensures chunk boundaries fall at sensible
      locations like paragraph or line breaks.
    </p>

    <h2>Options</h2>
    <p>
      Both conversion functions accept an options object to customize behavior. The plugins option
      accepts an array of plugin objects to extend functionality. The origin option sets the base
      URL for resolving relative links. The chunkSize option controls streaming buffer size.
      Additional options control formatting preferences like bullet characters and code block styles.
    </p>

    <h2>Plugin API</h2>
    <p>
      Plugins are objects with optional hook methods. The beforeNodeProcess hook receives a node
      and can return skip: true to prevent processing. The onNodeEnter and onNodeExit hooks receive
      an ElementNode and can return strings to add before or after the element's content. The
      processTextNode hook receives a TextNode and can return transformed content or skip: true.
    </p>

    <h2>Type Definitions</h2>
    <p>
      MDream exports comprehensive TypeScript types including ElementNode, TextNode, MarkdownState,
      Plugin, and all option interfaces. These types provide full IDE support and type safety when
      working with MDream in TypeScript projects. Import types from the main package to use them
      in your code.
    </p>
  </div>
</template>
