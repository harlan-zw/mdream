<script setup lang="ts">
useSeoMeta({
  title: 'Home - MDream Documentation',
  description: 'Welcome to MDream, the fastest HTML to Markdown converter for Node.js. Learn how to convert HTML to Markdown with streaming support and custom plugins.',
})
</script>

<template>
  <div>
    <h1>Welcome to MDream</h1>
    <p>
      MDream is a high-performance HTML to Markdown converter designed for modern Node.js applications.
      It provides both synchronous and streaming APIs, making it perfect for processing large documents
      or handling real-time content conversion.
    </p>

    <h2>Key Features</h2>
    <ul>
      <li>Lightning-fast HTML parsing with custom optimized parser</li>
      <li>Streaming support for processing large documents efficiently</li>
      <li>Extensible plugin system for custom transformations</li>
      <li>Zero dependencies for minimal bundle size</li>
      <li>Full TypeScript support with comprehensive type definitions</li>
    </ul>

    <h2>Getting Started</h2>
    <p>
      To get started with MDream, install it via your favorite package manager. The library works
      seamlessly with both CommonJS and ES modules, and includes built-in support for streaming
      HTML processing. Whether you're building a content management system, documentation generator,
      or any application that needs HTML to Markdown conversion, MDream provides the performance
      and flexibility you need.
    </p>

    <p>
      The plugin system allows you to customize the conversion process at multiple stages, from
      filtering content to transforming specific elements. You can create custom plugins to handle
      special cases in your HTML or extract structured data during the conversion process.
    </p>
  </div>
</template>
