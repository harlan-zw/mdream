<script setup>
useSeoMeta({
  title: '@mdream/nuxt Example',
  description: 'Example app demonstrating the @mdream/nuxt module for converting HTML to Markdown',
  author: 'Claude',
  keywords: 'mdream, nuxt, markdown, conversion, html, module',
  robots: 'index, follow',
  ogTitle: '@mdream/nuxt Example',
  ogDescription: 'Example app demonstrating the @mdream/nuxt module for converting HTML to Markdown',
  ogType: 'website',
  twitterCard: 'summary',
})
</script>

<template>
  <div class="container">
    <header>
      <h1>@mdream/nuxt Example</h1>
      <p>This example demonstrates the mdream module for converting HTML pages to Markdown.</p>
    </header>

    <main>
      <section>
        <h2>Features</h2>
        <ul>
          <li>✨ Convert any page to Markdown by adding <code>.md</code> extension</li>
          <li>🤖 Respects robots meta tags (noindex pages return 404)</li>
          <li>⚡ Dynamic generation in development</li>
          <li>📦 Static file generation during prerendering</li>
          <li>📝 Automatic llms.txt generation</li>
        </ul>
      </section>

      <section>
        <h2>Try It Out</h2>
        <p>Test the markdown conversion by accessing these URLs:</p>
        <ul class="links">
          <li>
            <a href="/index.md" target="_blank" rel="noopener">
              📄 Home page as Markdown
            </a>
          </li>
          <li>
            <a href="/about.md" target="_blank" rel="noopener">
              📄 About page as Markdown
            </a>
          </li>
          <li>
            <a href="/blog.md" target="_blank" rel="noopener">
              📄 Blog page as Markdown
            </a>
          </li>
          <li>
            <a href="/noindex.md" target="_blank" rel="noopener">
              ❌ Noindex page (should return 404)
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>Navigation</h2>
        <nav>
          <ul class="nav-links">
            <li>
              <NuxtLink to="/">
                Home
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/about">
                About
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/blog">
                Blog
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/noindex">
                Noindex Page
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </section>

      <section>
        <h2>Code Example</h2>
        <pre><code>// Fetch any page as markdown
const response = await fetch('/about.md')
const markdown = await response.text()
console.log(markdown)</code></pre>
      </section>
    </main>

    <footer>
      <p>Built with <a href="https://nuxt.com" target="_blank">Nuxt</a> and <a href="https://github.com/unjs/mdream" target="_blank">mdream</a></p>
    </footer>
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

section {
  margin-bottom: 2rem;
}

.links li {
  margin: 0.5rem 0;
}

.nav-links {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.nav-links li {
  list-style: none;
}

.nav-links a {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  text-decoration: none;
  border-radius: 0.375rem;
  color: #1f2937;
}

.nav-links a:hover {
  background: #e5e7eb;
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
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}

footer {
  text-align: center;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
}

a {
  color: #2563eb;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
