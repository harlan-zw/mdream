
use crate::consts::{TAG_H1, TAG_H2};
use crate::types::HTMLToMarkdownOptions;

/// Options for splitting markdown into chunks.
pub struct SplitterOptions {
    /// Header tag IDs to split on (TAG_H2..TAG_H6 by default).
    pub headers_to_split_on: Vec<u8>,
    /// Return each line as an individual chunk.
    pub return_each_line: bool,
    /// Strip header lines from chunk content.
    pub strip_headers: bool,
    /// Maximum chunk size in characters.
    pub chunk_size: usize,
    /// Overlap between chunks for context preservation.
    pub chunk_overlap: usize,
}

impl Default for SplitterOptions {
    fn default() -> Self {
        Self {
            headers_to_split_on: vec![TAG_H2, TAG_H2 + 1, TAG_H2 + 2, TAG_H2 + 3, TAG_H2 + 4],
            return_each_line: false,
            strip_headers: true,
            chunk_size: 1000,
            chunk_overlap: 200,
        }
    }
}

/// A single chunk of split markdown with metadata.
pub struct MarkdownChunk {
    pub content: String,
    pub metadata: ChunkMetadata,
}

/// Metadata for a markdown chunk.
pub struct ChunkMetadata {
    /// Header hierarchy at this chunk position (e.g. "h1" -> "Title").
    pub headers: Option<Vec<(String, String)>>,
    /// Code block language if chunk contains code.
    pub code: Option<String>,
    /// Line number range in the original document.
    pub loc: Option<ChunkLoc>,
}

/// Line location range.
pub struct ChunkLoc {
    pub from: usize,
    pub to: usize,
}

/// Strip markdown formatting characters from text: ***, __, **, *, _, `
fn strip_markdown_formatting(text: &str) -> String {
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut result = Vec::with_capacity(len);
    let mut i = 0;
    while i < len {
        let b = bytes[i];
        if b == b'*' || b == b'_' {
            // Check for *** or ___
            if i + 2 < len && bytes[i + 1] == b && bytes[i + 2] == b {
                i += 3;
                continue;
            }
            // Check for ** or __
            if i + 1 < len && bytes[i + 1] == b {
                i += 2;
                continue;
            }
            // Single * or _
            i += 1;
            continue;
        }
        if b == b'`' {
            i += 1;
            continue;
        }
        result.push(b);
        i += 1;
    }
    let s = unsafe { String::from_utf8_unchecked(result) };
    let trimmed = s.trim();
    trimmed.to_string()
}

/// Detect if a line is a markdown header. Returns (level, header_text) if so.
/// Manual scanning, no regex.
#[inline]
fn detect_header(line: &str) -> Option<(u8, &str)> {
    let bytes = line.as_bytes();
    if bytes.is_empty() || bytes[0] != b'#' {
        return None;
    }
    let mut level = 0u8;
    while (level as usize) < bytes.len() && bytes[level as usize] == b'#' {
        level += 1;
        if level > 6 {
            return None;
        }
    }
    // Must be followed by a space
    if (level as usize) >= bytes.len() || bytes[level as usize] != b' ' {
        return None;
    }
    let text_start = level as usize + 1;
    if text_start >= bytes.len() {
        return None;
    }
    Some((level, &line[text_start..]))
}

/// Check if line is an HR (---, ***, ___) but not a frontmatter marker.
#[inline]
fn is_hr(line: &str) -> bool {
    line == "---" || line == "***" || line == "___"
}

/// Count newlines in a byte slice.
#[inline]
fn count_newlines(s: &str) -> usize {
    s.as_bytes().iter().filter(|&&b| b == b'\n').count()
}

/// Check if a line starts with `#{1,6} ` (is a markdown header line).
#[inline]
fn is_header_line(line: &str) -> bool {
    detect_header(line).is_some()
}

/// Count occurrences of ``` in a string.
#[inline]
fn count_backtick_fences(s: &str) -> usize {
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut count = 0;
    let mut i = 0;
    while i + 2 < len {
        if bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            count += 1;
            i += 3;
        } else {
            i += 1;
        }
    }
    count
}

/// Split markdown text into chunks based on headers, HRs, and size limits.
pub fn split_markdown(markdown: &str, opts: &SplitterOptions) -> Vec<MarkdownChunk> {
    assert!(opts.chunk_overlap < opts.chunk_size, "chunk_overlap must be less than chunk_size");

    let markdown = markdown.trim_start();
    if markdown.trim().is_empty() {
        return Vec::new();
    }

    let lines: Vec<&str> = markdown.split('\n').collect();
    let line_count = lines.len();

    // Build line start position index
    let mut line_starts: Vec<usize> = Vec::with_capacity(line_count);
    let mut pos = 0usize;
    for line in &lines {
        line_starts.push(pos);
        pos += line.len() + 1; // +1 for '\n'
    }

    // Detect frontmatter block
    let mut frontmatter_end_idx: isize = -1;
    if !lines.is_empty() && lines[0].trim() == "---" {
        for i in 1..line_count {
            if lines[i].trim() == "---" {
                frontmatter_end_idx = i as isize;
                break;
            }
        }
    }

    // State
    let mut header_hierarchy: Vec<(u8, String)> = Vec::new();
    let mut seen_split_headers: u8 = 0; // bitfield: bit (tag_id - TAG_H1)
    let mut current_chunk_code_language = String::new();
    let mut in_code_block = false;
    let mut line_number: usize = 1;
    let mut last_chunk_end_position: usize = 0;
    let mut last_split_position: usize = 0;
    let mut chunks: Vec<MarkdownChunk> = Vec::new();

    // Inline flush function equivalent
    let flush_chunk = |chunks: &mut Vec<MarkdownChunk>,
                       last_chunk_end_position: &mut usize,
                       last_split_position: &mut usize,
                       line_number: &mut usize,
                       current_chunk_code_language: &mut String,
                       header_hierarchy: &Vec<(u8, String)>,
                       end_position: usize,
                       apply_overlap: bool,
                       strip_headers: bool,
                       chunk_overlap: usize| {
        let end_position = end_position.min(markdown.len());
        let start = (*last_chunk_end_position).min(end_position);
        let original_chunk_content = &markdown[start..end_position];

        if original_chunk_content.trim().is_empty() {
            *last_chunk_end_position = end_position;
            return;
        }

        let chunk_content = if strip_headers {
            let filtered: Vec<&str> = original_chunk_content
                .split('\n')
                .filter(|line| !is_header_line(line))
                .collect();
            let joined = filtered.join("\n");
            let trimmed = joined.trim().to_string();
            if trimmed.is_empty() {
                *last_chunk_end_position = end_position;
                return;
            }
            trimmed
        } else {
            original_chunk_content.trim_end().to_string()
        };

        let newline_count = count_newlines(original_chunk_content);

        let mut metadata = ChunkMetadata {
            headers: None,
            code: None,
            loc: Some(ChunkLoc {
                from: *line_number,
                to: *line_number + newline_count,
            }),
        };

        if !header_hierarchy.is_empty() {
            let mut headers = Vec::new();
            for &(tag_id, ref text) in header_hierarchy.iter() {
                let level = tag_id - TAG_H1 + 1;
                headers.push((format!("h{}", level), text.clone()));
            }
            metadata.headers = Some(headers);
        }

        if !current_chunk_code_language.is_empty() {
            metadata.code = Some(current_chunk_code_language.clone());
        }

        chunks.push(MarkdownChunk {
            content: chunk_content,
            metadata,
        });

        *current_chunk_code_language = String::new();
        *last_split_position = end_position;

        if apply_overlap && chunk_overlap > 0 {
            let content_len = original_chunk_content.len();
            let max_overlap = if content_len > 1 { content_len - 1 } else { 0 };
            let actual_overlap = chunk_overlap.min(max_overlap);
            let mut overlap_pos = end_position - actual_overlap;
            // Snap to char boundary
            while overlap_pos < markdown.len() && !markdown.is_char_boundary(overlap_pos) {
                overlap_pos += 1;
            }
            *last_chunk_end_position = overlap_pos;
        } else {
            *last_chunk_end_position = end_position;
        }

        *line_number += newline_count;
    };

    for i in 0..line_count {
        let line = lines[i];
        let line_pos = line_starts[i];
        let is_frontmatter = frontmatter_end_idx >= 0
            && (i == 0 || i == frontmatter_end_idx as usize);

        // Code block tracking
        if line.starts_with("```") {
            if !in_code_block {
                in_code_block = true;
                let lang = line[3..].trim();
                if !lang.is_empty() && current_chunk_code_language.is_empty() {
                    current_chunk_code_language = lang.to_string();
                }
            } else {
                in_code_block = false;
            }
        }

        if !in_code_block && !line.starts_with("```") {
            // Header detection
            let header_match = if !is_frontmatter {
                detect_header(line)
            } else {
                None
            };

            if let Some((level, header_text)) = header_match {
                let tag_id = TAG_H1 + level - 1;
                let stripped_text = strip_markdown_formatting(header_text);

                if opts.headers_to_split_on.contains(&tag_id) {
                    let bit = 1u8 << (tag_id - TAG_H1);
                    if seen_split_headers & bit != 0 {
                        flush_chunk(
                            &mut chunks, &mut last_chunk_end_position, &mut last_split_position,
                            &mut line_number, &mut current_chunk_code_language, &header_hierarchy,
                            line_pos, false, opts.strip_headers, opts.chunk_overlap,
                        );
                        // Clear hierarchy at this level and below
                        header_hierarchy.retain(|(k, _)| *k < tag_id);
                    }
                    seen_split_headers |= bit;
                }
                if let Some(entry) = header_hierarchy.iter_mut().find(|(k, _)| *k == tag_id) {
                    entry.1 = stripped_text;
                } else {
                    header_hierarchy.push((tag_id, stripped_text));
                }
            }

            // HR detection
            if !is_frontmatter && header_match.is_none() && is_hr(line) {
                flush_chunk(
                    &mut chunks, &mut last_chunk_end_position, &mut last_split_position,
                    &mut line_number, &mut current_chunk_code_language, &header_hierarchy,
                    line_pos, false, opts.strip_headers, opts.chunk_overlap,
                );
            }
        }

        // Size-based splitting
        if !opts.return_each_line {
            let line_end = (line_pos + line.len() + 1).min(markdown.len());
            let current_chunk_size = if line_end > last_chunk_end_position {
                line_end - last_chunk_end_position
            } else {
                0
            };

            if current_chunk_size > opts.chunk_size {
                let ideal_split_pos = last_chunk_end_position + opts.chunk_size;
                let current_md = &markdown[..line_end.min(markdown.len())];
                let separators: [&str; 4] = ["\n\n", "```\n", "\n", " "];
                let mut split_position: isize = -1;

                for sep in &separators {
                    // rfind from ideal_split_pos, snapped to a char boundary
                    let mut search_end = ideal_split_pos.min(current_md.len());
                    while search_end < current_md.len() && !current_md.is_char_boundary(search_end) {
                        search_end += 1;
                    }
                    let search_region = &current_md[..search_end];
                    if let Some(idx) = search_region.rfind(sep) {
                        let candidate_split_pos = idx + sep.len();

                        // Don't split inside code blocks (odd backtick fence count)
                        let before_split = &current_md[..candidate_split_pos];
                        if count_backtick_fences(before_split) % 2 == 1 {
                            continue;
                        }

                        if candidate_split_pos > last_split_position {
                            split_position = candidate_split_pos as isize;
                            break;
                        }
                    }
                }

                let final_split = if split_position == -1 || (split_position as usize) <= last_chunk_end_position {
                    line_end
                } else {
                    split_position as usize
                };

                flush_chunk(
                    &mut chunks, &mut last_chunk_end_position, &mut last_split_position,
                    &mut line_number, &mut current_chunk_code_language, &header_hierarchy,
                    final_split, true, opts.strip_headers, opts.chunk_overlap,
                );
            }
        }
    }

    // Final flush
    flush_chunk(
        &mut chunks, &mut last_chunk_end_position, &mut last_split_position,
        &mut line_number, &mut current_chunk_code_language, &header_hierarchy,
        markdown.len(), false, opts.strip_headers, opts.chunk_overlap,
    );

    // return_each_line post-processing
    if opts.return_each_line && !chunks.is_empty() {
        let mut line_chunks: Vec<MarkdownChunk> = Vec::new();
        for chunk in chunks {
            let chunk_start_line = chunk.metadata.loc.as_ref().map_or(1, |loc| loc.from);
            for (i, chunk_line) in chunk.content.split('\n').enumerate() {
                if !chunk_line.trim().is_empty() {
                    line_chunks.push(MarkdownChunk {
                        content: chunk_line.to_string(),
                        metadata: ChunkMetadata {
                            headers: chunk.metadata.headers.clone(),
                            code: chunk.metadata.code.clone(),
                            loc: Some(ChunkLoc {
                                from: chunk_start_line + i,
                                to: chunk_start_line + i,
                            }),
                        },
                    });
                }
            }
        }
        return line_chunks;
    }

    chunks
}

/// Convert HTML to Markdown and split into chunks in one call.
pub fn html_to_markdown_chunks(
    html: &str,
    md_opts: HTMLToMarkdownOptions,
    split_opts: &SplitterOptions,
) -> Vec<MarkdownChunk> {
    let markdown = crate::html_to_markdown(html, md_opts);
    split_markdown(&markdown, split_opts)
}
