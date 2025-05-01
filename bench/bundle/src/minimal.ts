import { asyncHtmlToMarkdown } from '../../../dist'

function run() {
  // Full usage with all core features
  const html = `
<h1>Title</h1>
<p>This is a <strong>bold</strong> and <em>italic</em> text.</p>
<p>Here is a <a href="https://example.com">link</a>.</p>
<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>
<blockquote>
  <p>This is a blockquote.</p>
</blockquote>
<pre><code>console.log("Hello, world!");</code></pre>
<img src="image.jpg" alt="Image description">
<p>Another paragraph.</p>
  `
  const markdown = asyncHtmlToMarkdown(html)

  process.stdout.write(markdown)
}

run()
