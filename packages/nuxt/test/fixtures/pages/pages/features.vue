<script setup lang="ts">
useSeoMeta({
  title: 'Features - MDream Conversion Capabilities',
  description: 'Explore MDream\'s powerful features including streaming API, plugin system, custom tag handlers, and performance optimizations for HTML to Markdown conversion.',
})
</script>

<template>
  <div>
    <h1>Features</h1>
    <p>
      MDream offers a comprehensive set of features designed to make HTML to Markdown conversion
      efficient, flexible, and easy to integrate into your applications. From basic conversions
      to advanced streaming and plugin support, MDream has everything you need.
    </p>

    <h2>Streaming Architecture</h2>
    <p>
      The streaming API allows you to process HTML incrementally, which is perfect for large
      documents or real-time content. Instead of loading the entire HTML into memory, MDream
      processes content in chunks, emitting Markdown as soon as each chunk is ready. This approach
      significantly reduces memory usage and provides better performance for large documents.
    </p>

    <h2>Plugin System</h2>
    <p>
      Create custom plugins to extend MDream's functionality. Plugins can intercept the conversion
      process at multiple stages, allowing you to filter content, transform elements, or extract
      data. The plugin API is simple yet powerful, supporting hooks like beforeNodeProcess,
      onNodeEnter, onNodeExit, and processTextNode.
    </p>

    <h2>Performance Optimizations</h2>
    <p>
      MDream is built with performance in mind. It uses a custom HTML parser optimized for speed,
      avoids unnecessary allocations, and employs V8-friendly patterns throughout the codebase.
      String concatenation is minimized, regex usage is carefully controlled, and the parser uses
      a stack-based approach to handle deeply nested structures efficiently.
    </p>

    <h2>Table Support</h2>
    <p>
      Full support for HTML tables with proper alignment detection, colspan handling, and header
      formatting. MDream converts complex table structures into clean Markdown tables that preserve
      the original layout and content structure as closely as possible.
    </p>
  </div>
</template>
