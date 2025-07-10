<script setup>
useSeoMeta({
  title: 'Noindex Page - @mdream/nuxt Example',
  description: 'This page demonstrates noindex behavior with the @mdream/nuxt module',
  author: 'Claude',
  keywords: 'mdream, nuxt, noindex, robots, seo, example',
  robots: 'noindex, nofollow',
  ogTitle: 'Noindex Page - @mdream/nuxt Example',
  ogDescription: 'This page demonstrates noindex behavior with the @mdream/nuxt module',
  ogType: 'website',
  twitterCard: 'summary',
})
</script>

<template>
  <div class="container">
    <header>
      <h1>Noindex Page</h1>
      <p>This page has a noindex robots meta tag and won't be converted to markdown.</p>
    </header>

    <main>
      <section class="warning">
        <h2>🚫 This Page is Not Indexable</h2>
        <p>
          This page includes a <code>noindex</code> robots meta tag, which means:
        </p>
        <ul>
          <li>Search engines won't index this page</li>
          <li>The @mdream/nuxt module will return a 404 when trying to access <code>/noindex.md</code></li>
          <li>This page respects SEO best practices</li>
        </ul>
      </section>

      <section>
        <h2>Test the Noindex Behavior</h2>
        <p>
          Try accessing this page as markdown - it should return a 404 error:
        </p>
        <p>
          <a href="/noindex.md" target="_blank" class="button error">
            ❌ Try /noindex.md (will return 404)
          </a>
        </p>
      </section>

      <section>
        <h2>Why This Matters</h2>
        <p>
          The @mdream/nuxt module respects robots meta tags to ensure that:
        </p>
        <div class="features">
          <div class="feature">
            <h3>🔒 Privacy</h3>
            <p>Pages marked as noindex remain private and aren't converted to markdown</p>
          </div>
          <div class="feature">
            <h3>🎯 SEO Compliance</h3>
            <p>Follows the same indexing rules as search engines</p>
          </div>
          <div class="feature">
            <h3>📋 Content Control</h3>
            <p>Developers maintain full control over which content is accessible</p>
          </div>
        </div>
      </section>

      <section>
        <h2>Technical Implementation</h2>
        <p>This page includes the following meta tag:</p>
        <pre><code>&lt;meta name="robots" content="noindex, nofollow"&gt;</code></pre>

        <p>The module checks for this tag and returns a 404 response when the page is requested as markdown.</p>
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
  color: #dc2626;
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

.warning {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.warning h2 {
  color: #dc2626;
  margin-top: 0;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 500;
}

.button.error {
  background: #dc2626;
}

.button.error:hover {
  background: #b91c1c;
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

ul {
  padding-left: 1.5rem;
}

li {
  margin: 0.5rem 0;
}
</style>
