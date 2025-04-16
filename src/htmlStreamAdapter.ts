// HTML Stream Adapter - Connects streaming HTML input to the markdown converter

import type { Node } from './types.ts';
import { htmlToMarkdownStream } from './index.ts';

/**
 * Adapter for processing HTML streams and converting them to markdown streams
 */
export class HTMLStreamAdapter {
  private buffer: string = '';
  private currentDoc: Node | null = null;

  /**
   * Process an HTML chunk and return any complete markdown that can be generated
   * @param htmlChunk A chunk of HTML content
   * @param options Options for markdown conversion
   */
  async processChunk(htmlChunk: string, options?: { chunkSize?: number }): Promise<string> {
    // Add this chunk to our buffer
    this.buffer += htmlChunk;

    // Try to find complete HTML structures
    const completeHTML = this.extractCompleteHTML();

    if (!completeHTML) {
      return ''; // No complete structures yet
    }

    // Convert complete HTML to markdown
    const markdownStream = htmlToMarkdownStream(completeHTML, options);
    const chunks = [];

    for await (const chunk of markdownStream) {
      chunks.push(chunk);
    }

    return chunks.join('');
  }

  /**
   * Extract any complete HTML structures from the buffer
   * @returns Complete HTML string or null if none found
   */
  private extractCompleteHTML(): string | null {
    // Simple heuristic: check for balanced tags
    // In a production environment, you'd want a more robust approach

    // If no opening tag yet, nothing to extract
    if (this.buffer.indexOf('<') === -1) {
      return null;
    }

    // Count opening and closing tags
    let openCount = 0;
    let closeCount = 0;
    let inTag = false;
    let inComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      const nextChar = i < this.buffer.length - 1 ? this.buffer[i + 1] : '';

      // Handle comments
      if (!inComment && !inString && char === '<' && nextChar === '!') {
        const commentStart = this.buffer.substring(i, i + 4);
        if (commentStart === '<!--') {
          inComment = true;
          i += 3; // Skip past <!--
          continue;
        }
      }

      if (inComment) {
        // Check for comment end
        if (char === '-' && nextChar === '-') {
          const commentEnd = this.buffer.substring(i, i + 3);
          if (commentEnd === '-->') {
            inComment = false;
            i += 2; // Skip past -->
          }
        }
        continue;
      }

      // Handle string literals inside tags
      if (inTag && !inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        continue;
      }

      if (inString && char === stringChar) {
        inString = false;
        continue;
      }

      // Only process tag boundaries when not in a string
      if (!inString) {
        // Tag opening
        if (char === '<' && nextChar !== '/') {
          inTag = true;
          openCount++;
        }
        // Tag closing
        else if (char === '<' && nextChar === '/') {
          inTag = true;
          closeCount++;
        }
        // End of any tag
        else if (char === '>') {
          inTag = false;
        }
      }
    }

    // If we have a balanced set of tags, extract that portion
    if (openCount > 0 && openCount === closeCount) {
      const completeHTML = this.buffer;
      this.buffer = '';
      return completeHTML;
    }

    return null;
  }

  /**
   * Process all remaining buffered content
   * @param options Options for markdown conversion
   */
  async flush(options?: { chunkSize?: number }): Promise<string> {
    // Process any remaining content in the buffer
    if (this.buffer.length === 0) {
      return '';
    }

    // Convert whatever is left to markdown
    const markdownStream = htmlToMarkdownStream(this.buffer, options);
    const chunks = [];

    for await (const chunk of markdownStream) {
      chunks.push(chunk);
    }

    // Clear the buffer
    this.buffer = '';

    return chunks.join('');
  }
}

/**
 * Creates a markdown stream from an HTML stream
 * @param htmlStream Async generator yielding HTML chunks
 * @param options Options for markdown conversion
 */
export async function* createMarkdownStreamFromHTMLStream(
  htmlStream: AsyncIterable<string>,
  options?: { chunkSize?: number }
): AsyncGenerator<string> {
  const adapter = new HTMLStreamAdapter();

  for await (const htmlChunk of htmlStream) {
    const markdownChunk = await adapter.processChunk(htmlChunk, options);
    if (markdownChunk) {
      yield markdownChunk;
    }
  }

  // Process any remaining content
  const finalChunk = await adapter.flush(options);
  if (finalChunk) {
    yield finalChunk;
  }
}
