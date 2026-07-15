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
    pub fn clear(&mut self) {
        self.inner.clear();
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
        // Custom name takes priority (e.g. custom tags with alias_tag_id)
        if let Some(ref n) = self.custom_name {
            n.as_str()
        } else if let Some(id) = self.tag_id {
            crate::consts::TAG_NAMES[id as usize]
        } else {
            ""
        }
    }
}

#[derive(Clone, Copy)]
pub struct TagHandler {
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

/// Filter plugin: include or exclude elements matching CSS selectors.
///
/// At most one of `include` and `exclude` is applied. `include` restricts
/// output to matched subtrees; `exclude` removes matched subtrees.
#[derive(Debug, Clone, Default)]
pub struct FilterConfig {
    /// CSS selectors for elements to keep; everything else is dropped.
    pub include: Option<Vec<String>>,
    /// CSS selectors for elements to remove from output.
    pub exclude: Option<Vec<String>>,
    /// When `true`, children of an excluded element are still processed.
    pub process_children: Option<bool>,
}

impl FilterConfig {
    /// Exclude elements matching one or more CSS selectors.
    ///
    /// ```rust
    /// use mdream::FilterConfig;
    ///
    /// let cfg = FilterConfig::exclude(&["nav", "footer", ".ad"]);
    /// ```
    pub fn exclude(selectors: &[&str]) -> Self {
        Self {
            exclude: Some(selectors.iter().map(ToString::to_string).collect()),
            ..Default::default()
        }
    }

    /// Include only elements matching one or more CSS selectors.
    ///
    /// ```rust
    /// use mdream::FilterConfig;
    ///
    /// let cfg = FilterConfig::include(&[".content", "main"]);
    /// ```
    pub fn include(selectors: &[&str]) -> Self {
        Self {
            include: Some(selectors.iter().map(ToString::to_string).collect()),
            ..Default::default()
        }
    }
}

/// Isolate-main plugin: restrict output to the `<main>` element.
///
/// Equivalent to `isolateMain: true` in the JS API. Pass `IsolateMainConfig`
/// (or `IsolateMainConfig::default()`) to enable:
///
/// ```rust
/// use mdream::{PluginConfig, IsolateMainConfig};
///
/// let plugins = PluginConfig {
///     isolate_main: Some(IsolateMainConfig),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Default, Copy)]
pub struct IsolateMainConfig;

/// Tailwind plugin: convert Tailwind utility classes to semantic Markdown.
///
/// Equivalent to `tailwind: true` in the JS API. Pass `TailwindConfig`
/// (or `TailwindConfig::default()`) to enable.
#[derive(Debug, Clone, Default, Copy)]
pub struct TailwindConfig;

/// Frontmatter plugin: emit YAML frontmatter extracted from `<head>` metadata.
#[derive(Debug, Clone, Default)]
pub struct FrontmatterConfig {
    /// Extra key/value pairs appended to the frontmatter (reserved keys such
    /// as `title` are silently ignored to avoid overwriting the page title).
    pub additional_fields: Option<Vec<(String, String)>>,
    /// Additional `<meta name="...">` keys to extract beyond the defaults.
    pub meta_fields: Option<Vec<String>>,
}

impl FrontmatterConfig {
    /// Create a config that also extracts extra `<meta name="...">` fields.
    ///
    /// ```rust
    /// use mdream::FrontmatterConfig;
    ///
    /// let cfg = FrontmatterConfig::with_meta_fields(&["author", "keywords"]);
    /// ```
    pub fn with_meta_fields(fields: &[&str]) -> Self {
        Self {
            meta_fields: Some(fields.iter().map(ToString::to_string).collect()),
            ..Default::default()
        }
    }
}

/// Extraction plugin: collect elements matching CSS selectors during conversion.
///
/// Matched elements are returned in [`MdreamResult::extracted`].
#[derive(Debug, Clone, Default)]
pub struct ExtractionConfig {
    /// CSS selectors whose matching elements will be extracted.
    pub selectors: Vec<String>,
}

impl ExtractionConfig {
    /// Create an extraction config from a slice of CSS selector strings.
    ///
    /// ```rust
    /// use mdream::ExtractionConfig;
    ///
    /// let cfg = ExtractionConfig::new(&["h1", "h2", ".summary"]);
    /// ```
    pub fn new(selectors: &[&str]) -> Self {
        Self {
            selectors: selectors.iter().map(ToString::to_string).collect(),
        }
    }
}

/// Pre-parsed selector for efficient matching during parsing
#[derive(Debug, Clone)]
pub enum ParsedSelector {
    Tag(String),
    Class(String),
    Id(String),
    Attribute { name: String, operator: Option<String>, value: Option<String> },
    Compound(Vec<Self>),
}

/// Result element from extraction
#[derive(Debug, Clone)]
pub struct ExtractedElement {
    pub selector: String,
    pub tag_name: String,
    pub text_content: String,
    pub attributes: Vec<(String, String)>,
}

/// Per-tag override applied during conversion.
///
/// Keyed by lowercase tag name in [`PluginConfig::tag_overrides`]. Every field
/// is optional; unset fields fall back to the tag's built-in behaviour.
/// Construct with `..Default::default()` and set only the fields you need:
///
/// ```rust
/// use mdream::TagOverrideConfig;
///
/// let cfg = TagOverrideConfig {
///     enter: Some("^".into()),
///     exit: Some("^".into()),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Default)]
pub struct TagOverrideConfig {
    /// String emitted when entering the tag, replacing its default opening
    /// markdown. e.g. `Some("^".into())` to render `<sup>` as `^`.
    pub enter: Option<String>,
    /// String emitted when exiting the tag, replacing its default closing
    /// markdown. e.g. `Some("^".into())` to close `<sup>` with `^`.
    pub exit: Option<String>,
    /// Blank lines `[before, after]` to surround the tag's output with.
    /// `[0, 0]` keeps the tag inline; higher values force block separation.
    pub spacing: Option<[u8; 2]>,
    /// Whether the tag is treated as inline (`true`) or block (`false`).
    /// Inline tags do not introduce line breaks around their content.
    pub is_inline: Option<bool>,
    /// Whether the tag is void/self-closing (like `<br>`) and has no content
    /// or matching closing tag.
    pub is_self_closing: Option<bool>,
    /// Whether runs of whitespace inside the tag collapse to a single space.
    pub collapses_inner_white_space: Option<bool>,
    /// Tag ID to alias this tag to, making it render exactly like a built-in
    /// tag. Resolve a name to its numeric ID with [`crate::consts::get_tag_id`]:
    ///
    /// ```rust
    /// use mdream::{TagOverrideConfig, consts::get_tag_id};
    ///
    /// let cfg = TagOverrideConfig {
    ///     alias_tag_id: get_tag_id("em"),
    ///     ..Default::default()
    /// };
    /// ```
    pub alias_tag_id: Option<u8>,
}

impl TagOverrideConfig {
    /// Create an override that aliases this tag to a built-in tag by name.
    ///
    /// Unknown tag names return `None` from `get_tag_id`, in which case this
    /// returns an empty (no-op) override; callers should validate the alias
    /// name at construction time.
    ///
    /// ```rust
    /// use mdream::TagOverrideConfig;
    ///
    /// // Render <my-em> exactly like <em>
    /// let cfg = TagOverrideConfig::alias("em");
    /// assert!(cfg.alias_tag_id.is_some());
    /// ```
    pub fn alias(tag_name: &str) -> Self {
        Self {
            alias_tag_id: crate::consts::get_tag_id(tag_name),
            ..Default::default()
        }
    }

    /// Create an override that wraps the tag's content with `enter` and `exit` strings.
    ///
    /// ```rust
    /// use mdream::TagOverrideConfig;
    ///
    /// // Render <sup> as ^text^
    /// let cfg = TagOverrideConfig::wrap("^", "^");
    /// ```
    pub fn wrap(enter: impl Into<String>, exit: impl Into<String>) -> Self {
        Self {
            enter: Some(enter.into()),
            exit: Some(exit.into()),
            is_inline: Some(true),
            ..Default::default()
        }
    }
}

/// Plugin configuration bundled into [`HTMLToMarkdownOptions`].
///
/// Every field is optional; only set the plugins you need. All unset fields
/// leave the corresponding feature disabled.
///
/// ```rust
/// use mdream::{PluginConfig, FilterConfig, IsolateMainConfig};
///
/// let plugins = PluginConfig {
///     isolate_main: Some(IsolateMainConfig),
///     filter: Some(FilterConfig::exclude(&["nav", "footer"])),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Default)]
pub struct PluginConfig {
    /// Filter content in or out by CSS selector.
    pub filter: Option<FilterConfig>,
    /// Restrict output to the page's `<main>` element.
    pub isolate_main: Option<IsolateMainConfig>,
    /// Extract `<head>` metadata into YAML frontmatter.
    pub frontmatter: Option<FrontmatterConfig>,
    /// Convert Tailwind utility classes to semantic Markdown.
    pub tailwind: Option<TailwindConfig>,
    /// Collect elements matching CSS selectors into [`MdreamResult::extracted`].
    pub extraction: Option<ExtractionConfig>,
    /// Per-tag rendering overrides keyed by lowercase tag name.
    pub tag_overrides: Option<Vec<(String, TagOverrideConfig)>>,
}

impl PluginConfig {
    /// Enable the isolate-main plugin, which restricts output to `<main>`.
    ///
    /// ```rust
    /// use mdream::PluginConfig;
    ///
    /// let plugins = PluginConfig::isolate_main();
    /// assert!(plugins.isolate_main.is_some());
    /// ```
    pub fn isolate_main() -> Self {
        Self {
            isolate_main: Some(IsolateMainConfig),
            ..Default::default()
        }
    }

    /// Enable the frontmatter plugin, extracting `<head>` metadata.
    ///
    /// ```rust
    /// use mdream::PluginConfig;
    ///
    /// let plugins = PluginConfig::frontmatter();
    /// ```
    pub fn frontmatter() -> Self {
        Self {
            frontmatter: Some(FrontmatterConfig::default()),
            ..Default::default()
        }
    }

    /// Add a tag override, returning `self` for chaining.
    ///
    /// ```rust
    /// use mdream::{PluginConfig, TagOverrideConfig};
    ///
    /// let plugins = PluginConfig::default()
    ///     .with_tag_override("sup", TagOverrideConfig::wrap("^", "^"))
    ///     .with_tag_override("sub", TagOverrideConfig::wrap("~", "~"));
    /// ```
    #[must_use]
    pub fn with_tag_override(mut self, tag: impl Into<String>, config: TagOverrideConfig) -> Self {
        // Keys are matched case-sensitively against lowercase tag names during
        // conversion, so normalize and upsert rather than blindly appending.
        let tag = tag.into().to_ascii_lowercase();
        let overrides = self.tag_overrides.get_or_insert_with(Vec::new);
        if let Some((_, existing)) = overrides.iter_mut().find(|(t, _)| *t == tag) {
            *existing = config;
        } else {
            overrides.push((tag, config));
        }
        self
    }
}

/// Post-processing cleanup options for the generated Markdown.
///
/// All flags are `false` by default. Use [`CleanConfig::all()`] to enable
/// every cleanup rule, or set individual flags for finer control:
///
/// ```rust
/// use mdream::CleanConfig;
///
/// // Enable only URL and redundant-link cleanup
/// let cfg = CleanConfig { urls: true, redundant_links: true, ..Default::default() };
///
/// // Enable every cleanup rule at once
/// let cfg = CleanConfig::all();
/// ```
#[derive(Debug, Clone, Default)]
pub struct CleanConfig {
    /// Strip tracking query parameters from URLs (utm_*, fbclid, gclid, …).
    pub urls: bool,
    /// Strip fragment-only links that don't match any heading slug.
    pub fragments: bool,
    /// Strip links with meaningless hrefs (`#`, `javascript:`) → plain text.
    pub empty_links: bool,
    /// Collapse 3+ consecutive blank lines to 2.
    pub blank_lines: bool,
    /// Strip links where text == URL: `[https://x.com](https://x.com)` → `https://x.com`.
    pub redundant_links: bool,
    /// Strip self-referencing heading anchors: `## [Title](#title)` → `## Title`.
    pub self_link_headings: bool,
    /// Strip images with no alt text: `![](url)` → nothing.
    pub empty_images: bool,
    /// Drop links that produce no visible text: `[](url)` → nothing.
    pub empty_link_text: bool,
}

impl CleanConfig {
    /// Return a `CleanConfig` with every cleanup rule enabled.
    ///
    /// ```rust
    /// use mdream::CleanConfig;
    ///
    /// let cfg = CleanConfig::all();
    /// assert!(cfg.urls && cfg.fragments && cfg.redundant_links);
    /// ```
    pub fn all() -> Self {
        Self {
            urls: true,
            fragments: true,
            empty_links: true,
            blank_lines: true,
            redundant_links: true,
            self_link_headings: true,
            empty_images: true,
            empty_link_text: true,
        }
    }
}

/// Options for [`crate::html_to_markdown`] and [`crate::html_to_markdown_result`].
///
/// Options are disabled by default. Use struct update syntax to set only the
/// options you need:
///
/// ```rust
/// use mdream::{HTMLToMarkdownOptions, CleanConfig};
///
/// let opts = HTMLToMarkdownOptions {
///     origin: Some("https://example.com".into()),
///     clean: Some(CleanConfig::all()),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Default)]
pub struct HTMLToMarkdownOptions {
    /// Base URL used to resolve relative links and image sources.
    pub origin: Option<String>,
    /// Strip common tracking query parameters (utm_*, fbclid, gclid, …) from URLs.
    /// Shorthand for `clean: Some(CleanConfig { urls: true, ..Default::default() })`.
    pub clean_urls: bool,
    /// Fine-grained post-processing cleanup rules.
    pub clean: Option<CleanConfig>,
    /// Plugin configuration (filters, frontmatter, extraction, tag overrides, …).
    pub plugins: Option<PluginConfig>,
    /// Hard-wrap prose at this many characters, breaking on word boundaries.
    ///
    /// Applied inline during conversion (no extra pass), so it is zero-cost when
    /// set to `0`. Code (`<pre>`/`<code>`), tables, and headings are never
    /// wrapped.
    pub wrap_width: usize,
}

impl HTMLToMarkdownOptions {
    /// Set the base URL for resolving relative links and images.
    ///
    /// ```rust
    /// use mdream::HTMLToMarkdownOptions;
    ///
    /// let opts = HTMLToMarkdownOptions::default().with_origin("https://example.com");
    /// ```
    #[must_use]
    pub fn with_origin(mut self, origin: impl Into<String>) -> Self {
        self.origin = Some(origin.into());
        self
    }

    /// Enable tracking-URL cleanup (`utm_*`, `fbclid`, `gclid`, …).
    ///
    /// ```rust
    /// use mdream::HTMLToMarkdownOptions;
    ///
    /// let opts = HTMLToMarkdownOptions::default().with_clean_urls();
    /// ```
    #[must_use]
    pub fn with_clean_urls(mut self) -> Self {
        self.clean_urls = true;
        self
    }

    /// Apply a [`CleanConfig`] cleanup preset.
    ///
    /// ```rust
    /// use mdream::{HTMLToMarkdownOptions, CleanConfig};
    ///
    /// let opts = HTMLToMarkdownOptions::default().with_clean(CleanConfig::all());
    /// ```
    #[must_use]
    pub fn with_clean(mut self, clean: CleanConfig) -> Self {
        self.clean = Some(clean);
        self
    }

    /// Enable plugins via a [`PluginConfig`].
    ///
    /// ```rust
    /// use mdream::{HTMLToMarkdownOptions, PluginConfig};
    ///
    /// let opts = HTMLToMarkdownOptions::default()
    ///     .with_plugins(PluginConfig::isolate_main());
    /// ```
    #[must_use]
    pub fn with_plugins(mut self, plugins: PluginConfig) -> Self {
        self.plugins = Some(plugins);
        self
    }

    /// Hard-wrap prose at `width` characters on word boundaries.
    ///
    /// ```rust
    /// use mdream::HTMLToMarkdownOptions;
    ///
    /// let opts = HTMLToMarkdownOptions::default().with_wrap_width(80);
    /// ```
    #[must_use]
    pub fn with_wrap_width(mut self, width: usize) -> Self {
        self.wrap_width = width;
        self
    }
}

/// Result from html_to_markdown conversion with extraction/frontmatter data
pub struct MdreamResult {
    pub markdown: String,
    pub extracted: Option<Vec<ExtractedElement>>,
    pub frontmatter: Option<Vec<(String, String)>>,
}

/// Output format for conversion.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum OutputFormat {
    /// Markdown output (default).
    #[default]
    Markdown,
    /// Plain text output with Markdown/HTML syntax omitted.
    Text,
}
