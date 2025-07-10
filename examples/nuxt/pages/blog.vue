<script setup>
useSeoMeta({
  title: 'Blog - @mdream/nuxt Example',
  description: 'Blog posts demonstrating @mdream/nuxt markdown conversion features',
  author: 'Claude',
  keywords: 'mdream, nuxt, markdown, conversion, blog, tutorial',
  robots: 'index, follow',
  ogTitle: 'Blog - @mdream/nuxt Example',
  ogDescription: 'Blog posts demonstrating @mdream/nuxt markdown conversion features',
  ogType: 'website',
  twitterCard: 'summary',
})
</script>

<template>
  <div class="container">
    <header>
      <h1>Blog</h1>
      <p>Sample blog posts to demonstrate markdown conversion.</p>
    </header>

    <main>
      <article class="post">
        <h2>Getting Started with @mdream/nuxt</h2>
        <div class="meta">
          <time>December 19, 2024</time>
          <span class="author">by Claude</span>
        </div>
        <div class="content">
          <p>
            The <strong>@mdream/nuxt</strong> module makes it incredibly easy to convert your Nuxt pages
            to Markdown format. Whether you're building documentation, creating content for LLMs,
            or just want to offer your content in multiple formats, this module has you covered.
          </p>

          <h3>Why Markdown?</h3>
          <p>Markdown is:</p>
          <ul>
            <li>Human-readable and easy to write</li>
            <li>Widely supported across platforms</li>
            <li>Perfect for documentation and content</li>
            <li>Ideal for LLM training and consumption</li>
          </ul>

          <h3>Quick Setup</h3>
          <p>Installation is as simple as:</p>
          <pre><code>pnpm add @mdream/nuxt</code></pre>

          <p>Then add it to your <code>nuxt.config.ts</code>:</p>
          <pre><code>export default defineNuxtConfig({
  modules: ['@mdream/nuxt']
})</code></pre>

          <h3>Usage Examples</h3>
          <p>Once installed, you can access any page as Markdown:</p>
          <ul>
            <li><code>/about</code> → <code>/about.md</code></li>
            <li><code>/blog</code> → <code>/blog.md</code></li>
            <li><code>/</code> → <code>/index.md</code></li>
          </ul>

          <blockquote>
            <p>
              <strong>Pro tip:</strong> The module automatically respects robots meta tags,
              so pages marked with <code>noindex</code> won't be converted to markdown.
            </p>
          </blockquote>
        </div>
      </article>

      <article class="post">
        <h2>Advanced Configuration</h2>
        <div class="meta">
          <time>December 19, 2024</time>
          <span class="author">by Claude</span>
        </div>
        <div class="content">
          <p>
            While @mdream/nuxt works great out of the box, you can customize its behavior
            to fit your specific needs.
          </p>

          <h3>Configuration Options</h3>
          <p>Here are the available configuration options:</p>

          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>Type</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>enabled</code></td>
                <td>boolean</td>
                <td>true</td>
                <td>Enable/disable the module</td>
              </tr>
              <tr>
                <td><code>cache.maxAge</code></td>
                <td>number</td>
                <td>3600</td>
                <td>Cache duration in seconds</td>
              </tr>
              <tr>
                <td><code>cache.swr</code></td>
                <td>boolean</td>
                <td>true</td>
                <td>Enable stale-while-revalidate</td>
              </tr>
            </tbody>
          </table>

          <h3>Static Generation</h3>
          <p>
            When using <code>nuxt generate</code>, the module automatically creates
            static markdown files and generates <code>llms.txt</code> artifacts.
          </p>
        </div>
      </article>

      <section class="cta">
        <h2>Try Converting This Blog Page</h2>
        <p>
          <a href="/blog.md" target="_blank" class="button">
            📄 View this blog as Markdown
          </a>
        </p>
      </section>
    </main>

    <nav class="nav">
      <NuxtLink to="/">
        ← Back to Home
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}

header {
  text-align: center;
  margin-bottom: 3rem;
}

h1 {
  color: #2563eb;
  margin-bottom: 1rem;
}

.post {
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.post:last-of-type {
  border-bottom: none;
}

.post h2 {
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.meta {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.meta time {
  margin-right: 1rem;
}

.content h3 {
  color: #374151;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.content p {
  margin-bottom: 1rem;
}

.content ul, .content ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.content li {
  margin: 0.25rem 0;
}

blockquote {
  border-left: 4px solid #2563eb;
  padding-left: 1rem;
  margin: 1.5rem 0;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0 0.5rem 0.5rem 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

th, td {
  border: 1px solid #e5e7eb;
  padding: 0.75rem;
  text-align: left;
}

th {
  background: #f9fafb;
  font-weight: 600;
}

code {
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

pre {
  background: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1rem 0;
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}

.cta {
  text-align: center;
  margin: 3rem 0;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 0.5rem;
}

.button {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 500;
}

.button:hover {
  background: #1d4ed8;
}

.nav {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.nav a {
  color: #2563eb;
  text-decoration: none;
}

.nav a:hover {
  text-decoration: underline;
}

a {
  color: #2563eb;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
