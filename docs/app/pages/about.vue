<template>
  <UContainer class="py-10 px-4">
    <div class="max-w-3xl mx-auto">
      <h1 class="font-display text-3xl font-bold mb-6 text-center dark:text-white">
        About MDream
      </h1>

      <UCard class="mb-8">
        <div class="prose dark:prose-invert max-w-none">
          <p>
            MDream is a high-performance HTML to Markdown converter designed for speed and accuracy.
            Built with a focus on streaming capabilities, it's perfect for processing large HTML documents
            without excessive memory usage.
          </p>

          <h2>Why MDream?</h2>
          <p>
            Unlike other HTML-to-Markdown converters, MDream is built from the ground up with performance in mind:
          </p>
          <ul>
            <li><strong>Manual HTML parsing</strong> - Doesn't rely on browser DOM for better performance</li>
            <li><strong>Non-recursive traversal</strong> - Uses stack-based approach to handle large documents</li>
            <li><strong>Streaming support</strong> - Processes content in chunks with optimal breakpoints</li>
            <li><strong>Custom entity decoder</strong> - Optimized HTML entity handling</li>
            <li><strong>Configurable output</strong> - Apply filters to customize the conversion process</li>
          </ul>

          <h2>Key Features</h2>

          <h3>Performance-Optimized</h3>
          <p>
            MDream is engineered for speed, with careful optimization to ensure fast conversion even for
            large documents.
          </p>

          <h3>Streaming API</h3>
          <p>
            Process HTML content in chunks, allowing you to handle large documents efficiently without
            waiting for the entire conversion to complete.
          </p>

          <h3>Customizable Filters</h3>
          <p>
            Apply various filters to control what gets converted:
          </p>
          <ul>
            <li><code>minimal</code>: Only convert the most common HTML elements</li>
            <li><code>from-first-tag</code>: Start conversion from a specific HTML tag</li>
            <li><code>exclude-tags</code>: Skip specific HTML tags during conversion</li>
            <li><code>minimal-from-first-header</code>: Combine minimal mode with starting from the first header</li>
          </ul>

          <h3>Comprehensive Tag Support</h3>
          <p>
            MDream handles a wide range of HTML elements:
          </p>
          <ul>
            <li>Headings (h1-h6)</li>
            <li>Paragraphs and line breaks</li>
            <li>Text formatting (strong, em, del, etc.)</li>
            <li>Links and images</li>
            <li>Lists (ordered and unordered, with nesting)</li>
            <li>Tables with alignment and colspan support</li>
            <li>Blockquotes with proper nesting</li>
            <li>Code blocks with language detection</li>
          </ul>
        </div>
      </UCard>

      <h2 class="font-display text-xl font-bold mb-4 dark:text-white">
        Integration Examples
      </h2>

      <div class="grid md:grid-cols-2 gap-6 mb-8">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-command-line" class="text-primary-500" />
              <h3 class="font-semibold">
                CLI Usage
              </h3>
            </div>
          </template>
          <UCodeBlock
            language="bash" code="# Install globally
npm install -g mdream

# Convert HTML from stdin to stdout
cat input.html | mdream > output.md

# Control chunk size for streaming
cat large.html | mdream --chunk-size 8192 > output.md"
          />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-code-bracket" class="text-primary-500" />
              <h3 class="font-semibold">
                Node.js Usage
              </h3>
            </div>
          </template>
          <UCodeBlock
            language="javascript" code="import { htmlToMarkdown } from 'mdream'
import fs from 'node:fs'

// Basic conversion
const html = fs.readFileSync('input.html', 'utf8')
const markdown = htmlToMarkdown(html)
fs.writeFileSync('output.md', markdown)

// With options
const result = htmlToMarkdown(html, {
  filters: ['minimal', 'from-first-tag'],
  origin: 'https://example.com',
})"
          />
        </UCard>
      </div>

      <UCard class="mb-8">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-beaker" class="text-primary-500" />
            <h3 class="font-semibold">
              Advanced Streaming Example
            </h3>
          </div>
        </template>
        <UCodeBlock
          language="javascript" code="import { streamHtmlToMarkdown } from 'mdream'
import fs from 'node:fs'

async function convertLargeFile() {
  // Create readable stream from file
  const htmlStream = fs.createReadStream('large.html')

  // Create writable stream for output
  const outputStream = fs.createWriteStream('output.md')

  // Process HTML stream in chunks
  for await (const chunk of streamHtmlToMarkdown(htmlStream, {
    filters: 'minimal-from-first-header',
    origin: 'https://example.com',
  })) {
    // Write each markdown chunk to output
    outputStream.write(chunk)
  }

  outputStream.end()
}

convertLargeFile()"
        />
      </UCard>

      <div class="text-center mt-12">
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          Want to contribute or report issues?
        </p>
        <div class="flex justify-center gap-4">
          <UButton
            to="https://github.com/harlan-zw/mdream"
            target="_blank"
            color="gray"
            icon="i-heroicons-code-bracket-square"
          >
            GitHub Repository
          </UButton>
          <UButton
            to="https://github.com/harlan-zw/mdream/issues"
            target="_blank"
            color="gray"
            icon="i-heroicons-bug-ant"
          >
            Report Issues
          </UButton>
        </div>
      </div>
    </div>
  </UContainer>
</template>
