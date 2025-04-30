import type { DownstreamState } from '../../../src'
import { describe, expect, it } from 'vitest'
import { processPartialHTMLToMarkdown } from '../../../src/parser.ts'
import { HTMLStreamAdapter } from '../../../src/stream.ts'

describe('State Persistence in HTML Stream Adapter', () => {
  it('should preserve state between HTML chunks (nested elements)', async () => {
    const adapter = new HTMLStreamAdapter()

    // First chunk opens a blockquote and a paragraph
    const chunk1 = '<blockquote><p>First part of the quote'
    const output1 = await adapter.processChunk(chunk1)

    // Second chunk continues within the paragraph
    const chunk2 = ' with some <strong>emphasized</strong> text'
    const output2 = await adapter.processChunk(chunk2)

    // Third chunk closes the paragraph but keeps the blockquote open
    const chunk3 = '</p><p>Second paragraph'
    const output3 = await adapter.processChunk(chunk3)

    // Fourth chunk closes everything
    const chunk4 = ' in the same blockquote.</p></blockquote>'
    const output4 = await adapter.processChunk(chunk4)

    // Final flush
    const output5 = await adapter.flush()

    // Combine all outputs
    const fullOutput = [output1, output2, output3, output4, output5].join('')

    // If state is persisted correctly, we should have properly formatted blockquote markdown
    // with both paragraphs properly preceded by "> "
    expect(fullOutput).toContain('> First part of the quote with some **emphasized** text')
    expect(fullOutput).toContain('> Second paragraph in the same blockquote.')
    expect(fullOutput.match(/>/g)?.length).toBeGreaterThanOrEqual(2) // At least two blockquote markers
  })

  it('should preserve state between HTML chunks (complex nested elements)', async () => {
    const adapter = new HTMLStreamAdapter()

    // A complex HTML example split across multiple chunks
    // First chunk starts a list
    const chunk1 = '<ul><li>First item'
    // Second chunk nests a blockquote inside the list item
    const chunk2 = ' with <blockquote><p>A nested quote'
    // Third chunk adds emphasis within the blockquote
    const chunk3 = ' with <em>emphasis</em>'
    // Fourth chunk closes the blockquote but keeps the list item open
    const chunk4 = '</p></blockquote> and more text'
    // Fifth chunk closes the first list item and opens a second
    const chunk5 = '</li><li>Second item'
    // Final chunk closes everything
    const chunk6 = ' with plain text</li></ul>'

    // Process all chunks sequentially
    await adapter.processChunk(chunk1)
    await adapter.processChunk(chunk2)
    await adapter.processChunk(chunk3)
    await adapter.processChunk(chunk4)
    await adapter.processChunk(chunk5)
    const output = await adapter.processChunk(chunk6)
    const finalOutput = await adapter.flush()

    // Combine output
    const fullOutput = output + finalOutput

    // Check that the nested structure is correctly preserved
    expect(fullOutput).toContain('- First item with')
    expect(fullOutput).toContain('> A nested quote with *emphasis*')
    expect(fullOutput).toContain('and more text')
    expect(fullOutput).toContain('- Second item with plain text')
  })

  it('should preserve table state across chunks', async () => {
    const adapter = new HTMLStreamAdapter()

    // First chunk starts a table with header
    const chunk1 = '<table><thead><tr><th>Name</th>'
    // Second chunk continues the header
    const chunk2 = '<th>Age</th><th>Location</th></tr></thead><tbody><tr>'
    // Third chunk starts the first data row
    const chunk3 = '<td>John</td><td>30</td><td>New York</td></tr><tr>'
    // Fourth chunk adds the second data row and closes the table
    const chunk4 = '<td>Jane</td><td>25</td><td>San Francisco</td></tr></tbody></table>'

    // Process chunks sequentially
    await adapter.processChunk(chunk1)
    await adapter.processChunk(chunk2)
    await adapter.processChunk(chunk3)
    const output = await adapter.processChunk(chunk4)
    const finalOutput = await adapter.flush()

    // Combine output
    const fullOutput = output + finalOutput

    // Verify table structure
    expect(fullOutput).toContain('| Name | Age | Location |')
    expect(fullOutput).toContain('| --- | --- | --- |')
    expect(fullOutput).toContain('| John | 30 | New York |')
    expect(fullOutput).toContain('| Jane | 25 | San Francisco |')

    // Check for proper table alignment (should have 3 columns)
    const headerRow = fullOutput.match(/\| Name \| Age \| Location \|/)
    const separatorRow = fullOutput.match(/\| --- \| --- \| --- \|/)
    const dataRow1 = fullOutput.match(/\| John \| 30 \| New York \|/)
    const dataRow2 = fullOutput.match(/\| Jane \| 25 \| San Francisco \|/)

    expect(headerRow).not.toBeNull()
    expect(separatorRow).not.toBeNull()
    expect(dataRow1).not.toBeNull()
    expect(dataRow2).not.toBeNull()
  })

  it('should allow passing and updating custom state with htmlToMarkdownStream', async () => {
    // Create a custom state
    const customState: DownstreamState = {
      lastOutputType: 'none',
      nodeStack: [],
      tableData: [],
      tableCurrentRowCells: [],
      tableColumnAlignments: [],
      tableColspanWidth: 1,
    }

    // Process blockquote HTML
    const html = '<blockquote><p>This is a blockquote</p></blockquote>'
    const stream = processPartialHTMLToMarkdown(html, {}, customState)

    // Collect all chunks
    for await (const _ of stream) {
      // Just collecting the chunks
    }

    // State should now reflect any changes
    expect(customState.lastOutputType).not.toBe('none')
  })

  it('should successfully track list state with htmlToMarkdownStream', async () => {
    // Create a custom state
    const customState: DownstreamState = {
      lastOutputType: 'none',
      nodeStack: [],
      tableData: [],
      tableCurrentRowCells: [],
      tableColumnAlignments: [],
      tableColspanWidth: 1,
    }

    // Process HTML with list
    const html = '<ul><li>First item</li><li>Second item</li></ul>'
    const stream = processPartialHTMLToMarkdown(html, {}, customState)

    // Collect all chunks
    for await (const _ of stream) {
      // Just collecting the chunks
    }

    // After processing all HTML, state should be updated
    expect(customState.lastOutputType).not.toBe('none')

    // Stack should be empty at the end (all tags closed)
    expect(customState.nodeStack.length).toBe(0)
  })

  it('should preserve state for multiple HTML chunks', async () => {
    // Create a sequence of HTML chunks
    const html1 = '<p>First paragraph</p>'
    const html2 = '<p>Second paragraph</p>'

    // Create a custom state to track between chunks
    const customState: DownstreamState = {
      lastOutputType: 'none',
      nodeStack: [],
      tableData: [],
      tableCurrentRowCells: [],
      tableColumnAlignments: [],
      tableColspanWidth: 1,
    }

    // Process first chunk
    const stream1 = processPartialHTMLToMarkdown(html1, {}, customState)
    for await (const _ of stream1) {
      // Just collecting chunks
    }

    // State should be modified by first chunk
    const outputTypeAfterFirstChunk = customState.lastOutputType

    // Process second chunk with the same state object
    const stream2 = processPartialHTMLToMarkdown(html2, {}, customState)
    for await (const _ of stream2) {
      // Just collecting chunks
    }

    // Verify state was maintained between chunks
    expect(outputTypeAfterFirstChunk).not.toBe('none')
  })

  it('should allow passing custom state to control formatting', async () => {
    // Create an HTML string with nested lists
    const html = '<ul><li>First<ul><li>Nested</li></ul></li></ul>'

    // Create a custom state with modified table formatting options
    const customState: DownstreamState = {
      lastOutputType: 'none',
      nodeStack: [],
      tableData: [],
      tableCurrentRowCells: [],
      tableColumnAlignments: [],
      tableColspanWidth: 1,
      // Add custom options if desired
      options: {
        chunkSize: 4096,
      },
    }

    // Convert HTML to markdown with our custom state
    const markdownStream = processPartialHTMLToMarkdown(html, {}, customState)

    // Collect all chunks
    const chunks = []
    for await (const chunk of markdownStream) {
      chunks.push(chunk)
    }

    // Check the output and final state
    const output = chunks.join('')
    expect(output).toContain('- First')
    expect(output).toContain('  - Nested')

    // Verify state was updated during the process
    expect(customState.lastOutputType).not.toBe('none')
    expect(customState.nodeStack.length).toBe(0) // Stack should be empty at end
  })
})
