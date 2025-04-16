import { htmlToMarkdownStream } from '../src/index.ts';
import { describe, test, expect } from 'vitest'

describe('HTML-to-Markdown Streaming', () => {
  // Helper function to collect all chunks from a stream
  async function collectStreamOutput(stream: AsyncGenerator<string>): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks.join('');
  }

  // Helper to simulate streaming HTML in chunks
  async function* generateHTMLChunks(htmlParts: string[]): AsyncGenerator<string> {
    for (const part of htmlParts) {
      yield part;
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  test('should handle simple HTML streaming', async () => {
    // Setup HTML parts
    const htmlParts = [
      '<h1>Hello ',
      'World</h1><p>This is a ',
      'test paragraph.</p>'
    ];

    // Create HTML stream
    const htmlStream = generateHTMLChunks(htmlParts);

    // Process HTML stream to markdown
    const markdownStream = htmlToMarkdownStream(await collectStreamOutput(htmlStream));

    // Collect markdown output
    const markdownOutput = await collectStreamOutput(markdownStream);

    // Verify output
    expect(markdownOutput).toContain('# Hello World');
    expect(markdownOutput).toContain('This is a test paragraph.');
  });

  test('should handle incomplete HTML tags across chunks', async () => {
    // HTML with tags split across chunks
    const htmlParts = [
      '<div><p>First ',
      'paragraph with <strong>bold ',
      'text</strong> and some ',
      'regular text.</p><ul><li>Item ',
      '1</li><li>Item 2</li></ul></div>'
    ];

    const htmlStream = generateHTMLChunks(htmlParts);
    const markdownStream = htmlToMarkdownStream(await collectStreamOutput(htmlStream));
    const markdownOutput = await collectStreamOutput(markdownStream);

    expect(markdownOutput).toContain('First paragraph with **bold text** and some regular text.');
    expect(markdownOutput).toContain('- Item 1');
    expect(markdownOutput).toContain('- Item 2');
  });

  test('should handle large documents with custom chunk size', async () => {
    // Create a large HTML document
    const createLargeHTML = () => {
      let html = '<div>';
      for (let i = 0; i < 100; i++) {
        html += `<p>Paragraph ${i} with some content to make it longer.</p>`;
      }
      html += '</div>';
      return html;
    };

    const largeHTML = createLargeHTML();
    const markdownStream = htmlToMarkdownStream(largeHTML, { chunkSize: 500 });

    // Collect and count chunks
    const chunks: string[] = [];
    for await (const chunk of markdownStream) {
      chunks.push(chunk);
    }

    // Should have multiple chunks due to size limitation
    expect(chunks.length).toBeGreaterThan(1);

    // Verify content when joined
    const fullMarkdown = chunks.join('');
    expect(fullMarkdown).toContain('Paragraph 0 with some content');
    expect(fullMarkdown).toContain('Paragraph 99 with some content');
  });

  test('should maintain proper markdown structure across chunks', async () => {
    // HTML with structured content
    const html = `
      <h1>Main Title</h1>
      <p>Introduction paragraph that's long enough to potentially cross chunk boundaries.</p>
      <h2>Section 1</h2>
      <p>Content for section 1 with <strong>bold</strong> and <em>italic</em> text.</p>
      <ul>
        <li>List item 1</li>
        <li>List item 2 with <a href="https://example.com">a link</a></li>
      </ul>
      <h2>Section 2</h2>
      <p>More content with code: <code>const x = 1;</code></p>
      <pre><code class="language-javascript">
      function example() {
        return "This is a code block";
      }
      </code></pre>
    `;

    // Use small chunk size to force multiple chunks
    const markdownStream = htmlToMarkdownStream(html, { chunkSize: 200 });
    const chunks: string[] = [];

    for await (const chunk of markdownStream) {
      chunks.push(chunk);
      // Make sure each chunk is no larger than specified
      expect(chunk.length).toBeLessThanOrEqual(200);
    }

    // Check that we got multiple chunks
    expect(chunks.length).toBeGreaterThan(1);

    // Verify full content when joined
    const fullMarkdown = chunks.join('');
    expect(fullMarkdown).toContain('# Main Title');
    expect(fullMarkdown).toContain('## Section 1');
    expect(fullMarkdown).toContain('**bold**');
    expect(fullMarkdown).toContain('*italic*');
    expect(fullMarkdown).toContain('- List item 1');
    expect(fullMarkdown).toContain('[a link](https://example.com)');
    expect(fullMarkdown).toContain('`const x = 1;`');
    expect(fullMarkdown).toContain('```javascript');
  });

  test('should handle tables properly across chunks', async () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>John Doe</td>
            <td>30</td>
            <td>New York</td>
          </tr>
          <tr>
            <td>Jane Smith</td>
            <td>25</td>
            <td>San Francisco</td>
          </tr>
        </tbody>
      </table>
    `;

    const markdownStream = htmlToMarkdownStream(html, { chunkSize: 100 });
    const fullMarkdown = await collectStreamOutput(markdownStream);

    // Check that table is properly formatted
    expect(fullMarkdown).toContain('| Name | Age | Location |');
    expect(fullMarkdown).toContain('| --- | --- | --- |');
    expect(fullMarkdown).toContain('| John Doe | 30 | New York |');
    expect(fullMarkdown).toContain('| Jane Smith | 25 | San Francisco |');
  });

  test('should handle streaming HTML with nested elements', async () => {
    // HTML with nested elements
    const htmlParts = [
      '<div class="container">',
      '<blockquote><p>This is a quote ',
      'with some <em>emphasized</em> text.</p>',
      '<p>Second paragraph in blockquote.</p></blockquote>',
      '<div><h3>Nested heading</h3><p>Nested paragraph ',
      'content.</p></div></div>'
    ];

    const htmlStream = generateHTMLChunks(htmlParts);
    const markdownStream = htmlToMarkdownStream(await collectStreamOutput(htmlStream));
    const markdownOutput = await collectStreamOutput(markdownStream);

    expect(markdownOutput).toContain('> This is a quote with some *emphasized* text.');
    expect(markdownOutput).toContain('> Second paragraph in blockquote.');
    expect(markdownOutput).toContain('### Nested heading');
    expect(markdownOutput).toContain('Nested paragraph content.');
  });

  test('should handle HTML with special characters and entities', async () => {
    const htmlParts = [
      '<p>Special characters: &lt;&gt;&amp;',
      '&quot;&apos;&nbsp;&#8212;&#x1F600;</p>',
      '<pre><code>if (x &lt; 10) { return true; }</code></pre>'
    ];

    const htmlStream = generateHTMLChunks(htmlParts);
    const markdownStream = htmlToMarkdownStream(await collectStreamOutput(htmlStream));
    const markdownOutput = await collectStreamOutput(markdownStream);

    expect(markdownOutput).toContain('Special characters: <>&"\'');
    expect(markdownOutput).toContain('if (x < 10) { return true; }');
  });

  test('should handle modified chunk size setting', async () => {
    // Create HTML content
    const html = '<p>' + 'a'.repeat(2000) + '</p><p>' + 'b'.repeat(2000) + '</p>';

    // Test with default chunk size (should be one large chunk)
    const defaultStream = htmlToMarkdownStream(html);
    const defaultChunks: string[] = [];
    for await (const chunk of defaultStream) {
      defaultChunks.push(chunk);
    }

    // Test with small chunk size (should be multiple chunks)
    const smallChunkStream = htmlToMarkdownStream(html, { chunkSize: 500 });
    const smallChunks: string[] = [];
    for await (const chunk of smallChunkStream) {
      smallChunks.push(chunk);
      // Each chunk should be around the chunk size or less
      expect(chunk.length).toBeLessThanOrEqual(600); // Allow some flexibility
    }

    // Small chunk size should produce more chunks
    expect(smallChunks.length).toBeGreaterThan(defaultChunks.length);

    // Content should be the same
    expect(smallChunks.join('')).toEqual(defaultChunks.join(''));
  });

  test('should handle error gracefully during streaming', async () => {
    // Create invalid HTML that might cause parsing issues
    const invalidHTML = '<p>Valid part</p><invalid></unclosed>';

    // The stream should not throw but instead provide error message in output
    const markdownStream = htmlToMarkdownStream(invalidHTML);
    const output = await collectStreamOutput(markdownStream);

    // Should still contain the valid part
    expect(output).toContain('Valid part');
  });
});
