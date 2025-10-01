<script setup lang="ts">
useSeoMeta({
  title: 'Performance Guide - Optimize MDream Conversion Speed',
  description: 'Learn about MDream\'s performance characteristics, optimization techniques, and best practices for fast HTML to Markdown conversion with minimal memory usage.',
})
</script>

<template>
  <div>
    <h1>Performance Guide</h1>
    <p>
      MDream is designed from the ground up for performance. This guide explains the architectural
      decisions that make MDream fast, and provides best practices for achieving optimal performance
      in your applications. Understanding these concepts will help you make the most of MDream's
      capabilities.
    </p>

    <h2>Custom HTML Parser</h2>
    <p>
      Unlike many HTML to Markdown converters that rely on browser DOM APIs or heavy parsing
      libraries, MDream includes a custom-built HTML parser optimized specifically for conversion
      tasks. This parser avoids unnecessary work, doesn't build a complete DOM tree, and uses
      memory-efficient data structures. The result is significantly faster parsing, especially
      for large documents.
    </p>

    <h2>Streaming Architecture Benefits</h2>
    <p>
      The streaming API isn't just about convenience—it's a fundamental performance feature.
      By processing HTML incrementally and emitting Markdown as soon as each chunk is ready,
      MDream reduces memory pressure and allows your application to start working with converted
      content immediately. This is particularly important for server-side rendering or real-time
      content processing scenarios.
    </p>

    <h2>V8 Optimizations</h2>
    <p>
      The codebase follows V8-friendly patterns throughout. String concatenation is minimized
      in favor of array joining. Regular expressions are used sparingly and carefully. Object
      shapes are kept monomorphic to enable inline caching. Function calls are structured to
      allow inlining. These low-level optimizations add up to significant performance gains.
    </p>

    <h2>Memory Management</h2>
    <p>
      MDream uses a stack-based traversal approach instead of recursion, which prevents stack
      overflow on deeply nested HTML and allows better memory control. The parser immediately
      processes nodes rather than accumulating them in memory. Strings are reused where possible,
      and temporary allocations are minimized throughout the conversion pipeline.
    </p>

    <h2>Benchmarking</h2>
    <p>
      The repository includes benchmark suites that test both string and streaming modes against
      real-world HTML samples. Run these benchmarks to measure performance on your target platform
      and compare different configuration options. The benchmarks also help identify performance
      regressions during development.
    </p>
  </div>
</template>
