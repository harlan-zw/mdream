import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('quote handling in script/style tags $name', (engineConfig) => {
  it('should not close script tag when closing tag is inside double quotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const html = "<script>alert('test')</script>";
      console.log(html);
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should not close script tag when closing tag is inside single quotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const html = '<script>alert("test")</script>';
      console.log(html);
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should not close script tag when closing tag is inside backticks', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const template = \`<script>alert("test")</script>\`;
      console.log(template);
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should handle escaped quotes properly', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const html = "He said \\"<script>alert('test')</script>\\" to me";
      console.log(html);
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should handle complex JSON with nested quotes in script tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script type="application/json">
      {"message": "He said \\"<script>alert('test')</script>\\" to me"}
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should properly close script tag when quotes are balanced', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const message = "Hello world";
      console.log(message);
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should handle mixed quote types correctly', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const outer = "He said 'hello' to me";
      const inner = 'She replied "goodbye" back';
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should handle style tags with quotes in CSS content', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<style>
      .class:before { content: "</style>"; }
      .other { color: red; }
    </style>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should handle empty quotes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const empty = "";
      const alsoempty = '';
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })

  it('should handle multiline strings with closing tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = `<script>
      const multiline = \`
        <script>
          alert('nested');
        </script>
      \`;
    </script>
    <p>This should be rendered</p>`

    const result = htmlToMarkdown(html, { engine }).markdown
    expect(result).toBe('This should be rendered')
  })
})
