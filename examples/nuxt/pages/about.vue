<script setup>
useSeoMeta({
  title: 'About - @mdream/nuxt Example',
  description: 'Learn about the @mdream/nuxt module and how it converts HTML to Markdown',
  author: 'Claude',
  keywords: 'mdream, nuxt, about, markdown, html, converter, module',
  robots: 'index, follow',
  ogTitle: 'About - @mdream/nuxt Example',
  ogDescription: 'Learn about the @mdream/nuxt module and how it converts HTML to Markdown',
  ogType: 'website',
  twitterCard: 'summary',
})
</script>

<template>
  <div class="container">
    <header>
      <h1>About @mdream/nuxt</h1>
      <p>Learn more about this powerful Nuxt module.</p>
    </header>

    <main>
      <section>
        <h2>What is @mdream/nuxt?</h2>
        <p>
          @mdream/nuxt is a Nuxt module that seamlessly converts your HTML pages to Markdown format.
          It's built on top of the powerful <a href="https://github.com/unjs/mdream" target="_blank">mdream</a>
          library and provides a simple way to make your content available in Markdown format.
        </p>
      </section>

      <section>
        <h2>How It Works</h2>
        <ol>
          <li><strong>Request</strong>: User requests a page with <code>.md</code> extension</li>
          <li><strong>Fetch</strong>: Module fetches the original HTML page</li>
          <li><strong>Validate</strong>: Checks robots meta tags for indexability</li>
          <li><strong>Convert</strong>: Transforms HTML to clean Markdown using mdream</li>
          <li><strong>Serve</strong>: Returns Markdown with proper content-type headers</li>
        </ol>
      </section>

      <section>
        <h2>Key Features</h2>
        <div class="features">
          <div class="feature">
            <h3>🚀 Zero Configuration</h3>
            <p>Works out of the box with sensible defaults. Just install and go!</p>
          </div>
          <div class="feature">
            <h3>🤖 SEO Aware</h3>
            <p>Respects robots meta tags and won't convert noindex pages.</p>
          </div>
          <div class="feature">
            <h3>⚡ Development Friendly</h3>
            <p>Dynamic generation in development, static files in production.</p>
          </div>
          <div class="feature">
            <h3>📝 LLM Ready</h3>
            <p>Automatically generates llms.txt and llms-full.txt during static builds.</p>
          </div>
        </div>
      </section>

      <section>
        <h2>Installation</h2>
        <pre><code>pnpm add @mdream/nuxt</code></pre>

        <h3>Configuration</h3>
        <pre><code>export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  mdream: {
    enabled: true,
    mdreamOptions: {
      // mdream conversion options
    },
    cache: {
      maxAge: 3600, // 1 hour
      swr: true
    }
  }
})</code></pre>
      </section>

      <section>
        <h2>Try Converting This Page</h2>
        <p>
          <a href="/about.md" target="_blank" class="button">
            📄 View this page as Markdown
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

h2 {
  color: #1f2937;
  margin-top: 2rem;
  margin-bottom: 1rem;
}

h3 {
  color: #374151;
  margin-bottom: 0.5rem;
}

section {
  margin-bottom: 2rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.feature {
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
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

ol {
  padding-left: 1.5rem;
}

ol li {
  margin: 0.5rem 0;
}
</style>
