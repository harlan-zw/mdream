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
}

#[derive(Debug, Clone)]
pub struct ElementNode {
    // Pointer-sized fields first (8 bytes each on 64-bit)
    pub name: String,
    pub attributes: Attributes,
    pub tailwind_prefix: Option<String>,
    pub tailwind_suffix: Option<String>,
    pub depth: usize,
    pub index: usize,
    pub current_walk_index: usize,
    pub child_text_node_index: usize,
    // Fixed-size array
    pub depth_map: [u8; crate::consts::MAX_TAG_ID],
    // Small fields grouped to minimize padding
    pub tag_id: Option<u8>,
    pub contains_whitespace: bool,
    pub excluded_from_markdown: bool,
    pub tailwind_hidden: bool,
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

// Handler functions need context.
// In Rust, we can pass the node and a slice of its ancestors (parents) up to the root.
// ancestors[0] is the root, ancestors.last() is the immediate parent.
pub struct HandlerContext<'a, 'b> {
    pub node: &'a ElementNode,
    pub ancestors: &'b [ElementNode],
    pub options: &'a crate::types::HTMLToMarkdownOptions,
    pub last_content_cache: Option<&'a str>,
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
pub struct PluginConfig {
    pub filter: Option<FilterConfig>,
    pub isolate_main: Option<IsolateMainConfig>,
    pub frontmatter: Option<FrontmatterConfig>,
    pub tailwind: Option<TailwindConfig>,
}

#[derive(Debug, Clone, Default)]
pub struct HTMLToMarkdownOptions {
    pub origin: Option<String>,
    pub plugins: Option<PluginConfig>,
}
