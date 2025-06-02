import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'

describe('quote handling in script/style tags', () => {
  it('should not close script tag when closing tag is inside double quotes', () => {
    const html = `<script>
      const html = "<script>alert('test')</script>";
      console.log(html);
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should not close script tag when closing tag is inside single quotes', () => {
    const html = `<script>
      const html = '<script>alert("test")</script>';
      console.log(html);
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should not close script tag when closing tag is inside backticks', () => {
    const html = `<script>
      const template = \`<script>alert("test")</script>\`;
      console.log(template);
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should handle escaped quotes properly', () => {
    const html = `<script>
      const html = "He said \\"<script>alert('test')</script>\\" to me";
      console.log(html);
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should handle complex JSON with nested quotes in script tag', () => {
    const html = `<script type="application/json">
      {"message": "He said \\"<script>alert('test')</script>\\" to me"}
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should properly close script tag when quotes are balanced', () => {
    const html = `<script>
      const message = "Hello world";
      console.log(message);
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should handle mixed quote types correctly', () => {
    const html = `<script>
      const outer = "He said 'hello' to me";
      const inner = 'She replied "goodbye" back';
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should handle style tags with quotes in CSS content', () => {
    const html = `<style>
      .class:before { content: "</style>"; }
      .other { color: red; }
    </style>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should handle empty quotes', () => {
    const html = `<script>
      const empty = "";
      const alsoempty = '';
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })

  it('should handle multiline strings with closing tags', () => {
    const html = `<script>
      const multiline = \`
        <script>
          alert('nested');
        </script>
      \`;
    </script>
    <p>This should be rendered</p>`
    
    const result = htmlToMarkdown(html)
    expect(result).toBe('This should be rendered')
  })
})