use std::borrow::Cow;
use std::collections::HashMap;

/// Compact attribute storage using Vec for small-N linear scan.
/// Most HTML elements have 0-4 attributes; linear scan on Vec beats HashMap hashing.
#[derive(Debug, Clone, Default)]
pub struct Attributes {
    inner: Vec<(String, String)>,
}

impl Attributes {
    #[inline]
    pub fn new() -> Self {
        Self { inner: Vec::new() }
    }

    #[inline]
    pub fn with_capacity(cap: usize) -> Self {
        Self { inner: Vec::with_capacity(cap) }
    }

    #[inline]
    pub fn get(&self, key: &str) -> Option<&String> {
        for (k, v) in &self.inner {
            if k == key {
                return Some(v);
            }
        }
        None
    }

    #[inline]
    pub fn contains_key(&self, key: &str) -> bool {
        self.inner.iter().any(|(k, _)| k == key)
    }

    #[inline]
    pub fn insert(&mut self, key: String, value: String) {
        for (k, v) in &mut self.inner {
            if *k == key {
                *v = value;
                return;
            }
        }
        self.inner.push((key, value));
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    #[inline]
    pub fn iter(&self) -> std::slice::Iter<'_, (String, String)> {
        self.inner.iter()
    }
}

/// Tailwind-specific data, boxed to keep ElementNode small when tailwind isn't active.
#[derive(Debug, Clone)]
pub struct TailwindData {
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub hidden: bool,
}

#[derive(Debug, Clone)]
pub struct ElementNode {
    // Pointer-sized fields first (8 bytes each on 64-bit)
    pub attributes: Attributes,
    pub tailwind: Option<Box<TailwindData>>,
    /// Only set for custom (non-builtin) tags. Built-in tags derive name from tag_id.
    pub custom_name: Option<String>,
    pub depth: usize,
    pub index: usize,
    pub current_walk_index: usize,
    pub child_text_node_index: usize,
    // Small fields grouped to minimize padding
    pub tag_id: Option<u8>,
    pub contains_whitespace: bool,
    pub excluded_from_markdown: bool,
    /// Cached from tag handler - avoids repeated get_tag_handler lookups
    pub is_inline: bool,
    pub excludes_text_nodes: bool,
    pub is_non_nesting: bool,
    pub collapses_inner_white_space: bool,
    pub spacing: Option<[u8; 2]>,
}

impl ElementNode {
    /// Get the tag name. For built-in tags, derives from tag_id. For custom tags, uses custom_name.
    #[inline]
    pub fn name(&self) -> &str {
        if let Some(id) = self.tag_id {
            crate::consts::TAG_NAMES[id as usize]
        } else if let Some(ref n) = self.custom_name {
            n.as_str()
        } else {
            ""
        }
    }
}

#[derive(Debug, Clone)]
pub struct TextNode {
    pub value: String,
    pub depth: usize,
    pub index: usize,
    pub excluded_from_markdown: bool,
    pub contains_whitespace: bool,
}

#[derive(Debug, Clone)]
pub enum NodeEvent<'a> {
    EnterElement(&'a ElementNode),
    ExitElement(&'a ElementNode),
    EnterText(&'a TextNode),
    Frontmatter(String),
}

pub struct HandlerContext<'a, 'b> {
    pub node: &'a ElementNode,
    pub ancestors: &'b [ElementNode],
    pub options: &'a crate::types::HTMLToMarkdownOptions,
    pub last_content_cache: Option<&'a str>,
    pub depth_map: &'a [u8; crate::consts::MAX_TAG_ID],
}

pub struct TagHandler {
    pub enter: Option<fn(&HandlerContext) -> Option<Cow<'static, str>>>,
    pub exit: Option<fn(&HandlerContext) -> Option<Cow<'static, str>>>,
    pub is_self_closing: bool,
    pub is_non_nesting: bool,
    pub collapses_inner_white_space: bool,
    pub is_inline: bool,
    pub spacing: Option<[u8; 2]>,
    pub excludes_text_nodes: bool,
    /// Whether the tag handler reads attributes (href, src, class, etc.)
    pub needs_attributes: bool,
}

// Internal config types (distinct from NAPI types in lib.rs)

#[derive(Debug, Clone, Default)]
pub struct FilterConfig {
    pub include: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    pub process_children: Option<bool>,
}

#[derive(Debug, Clone, Default)]
pub struct IsolateMainConfig {
    // Empty options for now, just acts as a flag when present
}

#[derive(Debug, Clone, Default)]
pub struct FrontmatterConfig {
    pub additional_fields: Option<HashMap<String, String>>,
    pub meta_fields: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default)]
pub struct TailwindConfig {
    // Empty options for now
}

#[derive(Debug, Clone, Default)]
pub struct ExtractionConfig {
    pub selectors: Vec<String>,
}

/// Pre-parsed selector for efficient matching during parsing
#[derive(Debug, Clone)]
pub enum ParsedSelector {
    Tag(String),
    Class(String),
    Id(String),
    Attribute { name: String, operator: Option<String>, value: Option<String> },
    Compound(Vec<ParsedSelector>),
}

/// Result element from extraction
#[derive(Debug, Clone)]
pub struct ExtractedElement {
    pub selector: String,
    pub tag_name: String,
    pub text_content: String,
    pub attributes: Vec<(String, String)>,
}

#[derive(Debug, Clone)]
pub struct TagOverrideConfig {
    pub enter: Option<String>,
    pub exit: Option<String>,
    pub spacing: Option<[u8; 2]>,
    pub is_inline: Option<bool>,
    pub is_self_closing: Option<bool>,
    pub collapses_inner_white_space: Option<bool>,
    pub alias_tag_id: Option<u8>,
}

#[derive(Debug, Clone, Default)]
pub struct PluginConfig {
    pub filter: Option<FilterConfig>,
    pub isolate_main: Option<IsolateMainConfig>,
    pub frontmatter: Option<FrontmatterConfig>,
    pub tailwind: Option<TailwindConfig>,
    pub extraction: Option<ExtractionConfig>,
    pub tag_overrides: Option<HashMap<String, TagOverrideConfig>>,
}

#[derive(Debug, Clone, Default)]
pub struct HTMLToMarkdownOptions {
    pub origin: Option<String>,
    pub plugins: Option<PluginConfig>,
}

/// Result from html_to_markdown conversion with extraction/frontmatter data
pub struct MdreamResult {
    pub markdown: String,
    pub extracted: Option<Vec<ExtractedElement>>,
    pub frontmatter: Option<HashMap<String, String>>,
}
