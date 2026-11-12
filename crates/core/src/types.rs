use crate::consts::{ATTR_NONE, attr_bit, attr_name};
use crate::entities::decode_html_attribute_entities_into;

/// One attribute: a known name interned to its bit, or an owned lowercase name.
#[derive(Debug, Clone)]
pub(crate) struct Attr {
  bit: u16,
  /// `Some` only when `bit == ATTR_NONE`; a known name comes back from the bit.
  name: Option<Box<str>>,
  value: String,
}

impl Attr {
  #[inline]
  pub fn name(&self) -> &str {
    match &self.name {
      Some(name) => name,
      None => attr_name(self.bit),
    }
  }

  #[inline]
  pub fn value(&self) -> &str {
    &self.value
  }
}

/// 64-bit layout; wasm32 halves these.
#[cfg(target_pointer_width = "64")]
const _: () = assert!(size_of::<Attr>() == 48);
#[cfg(target_pointer_width = "64")]
const _: () = assert!(size_of::<Attributes>() == 24);
#[cfg(target_pointer_width = "64")]
const _: () = assert!(size_of::<ElementNode>() == 64);

/// Marks a retired attribute slot; never a stored bit.
const FREE_SLOT: u16 = u16::MAX - 1;

/// Value buffers larger than this are released, not kept for reuse.
const RETAINED_VALUE_CAPACITY: usize = 64;

/// Compact attribute storage: one linear-scanned Vec (elements have 0-4
/// attributes; cheaper than hashing). Known names intern to [`attr_bit`],
/// costing no allocation; only `ATTR_ALL` long-tail names keep an owned
/// string.
#[derive(Debug, Clone, Default)]
pub(crate) struct Attributes {
  inner: Vec<Attr>,
}

impl Attributes {
  #[inline]
  pub fn new() -> Self {
    Self { inner: Vec::new() }
  }

  #[inline]
  pub fn reserve(&mut self, cap: usize) {
    let free = self.inner.len() - self.live().count();
    self.inner.reserve(cap.saturating_sub(free));
  }

  #[inline]
  fn live(&self) -> impl Iterator<Item = &Attr> {
    self.inner.iter().take_while(|attr| attr.bit != FREE_SLOT)
  }

  #[inline]
  pub fn get_bit(&self, bit: u16) -> Option<&str> {
    self
      .locate_bit(bit)
      .ok()
      .map(|index| &*self.inner[index].value)
  }

  /// Lookup by name, for names with no bit of their own (`style`, `hidden`,
  /// `id`) and for selector matching against arbitrary attributes.
  #[inline]
  pub fn get(&self, key: &str) -> Option<&str> {
    let bit = attr_bit(key.as_bytes());
    if bit != ATTR_NONE {
      return self.get_bit(bit);
    }
    for attr in self.live() {
      if let Some(name) = &attr.name
        && name.eq_ignore_ascii_case(key)
      {
        return Some(&attr.value);
      }
    }
    None
  }

  #[inline]
  pub fn contains_bit(&self, bit: u16) -> bool {
    self.get_bit(bit).is_some()
  }

  /// The live slot for `bit`, or the slot a new attribute takes.
  #[inline]
  fn locate_bit(&self, bit: u16) -> Result<usize, usize> {
    for (index, attr) in self.inner.iter().enumerate() {
      if attr.bit == FREE_SLOT {
        return Err(index);
      }
      if attr.bit == bit {
        return Ok(index);
      }
    }
    Err(self.inner.len())
  }

  #[inline]
  fn claim_slot(&mut self, index: usize) -> &mut Attr {
    if index == self.inner.len() {
      self.inner.push(Attr {
        bit: FREE_SLOT,
        name: None,
        value: String::new(),
      });
    }
    &mut self.inner[index]
  }

  /// Store a known attribute by bit. The first occurrence wins, as in HTML.
  #[inline]
  pub fn insert_known(&mut self, bit: u16, value: Option<&str>) {
    debug_assert!(bit != ATTR_NONE, "a known attribute has a bit");
    let index = match self.locate_bit(bit) {
      Ok(_) => return,
      Err(index) => index,
    };
    let slot = self.claim_slot(index);
    slot.bit = bit;
    write_attribute_value(&mut slot.value, value);
  }

  /// Store a name outside the known set; reachable only under `ATTR_ALL`.
  /// `name` must already be lowercase. First occurrence wins, as above.
  #[inline]
  pub fn insert_custom(&mut self, name: Box<str>, value: Option<&str>) {
    if self.live().any(|attr| attr.name.as_deref() == Some(&*name)) {
      return;
    }
    let index = self.live().count();
    let slot = self.claim_slot(index);
    slot.bit = ATTR_NONE;
    slot.name = Some(name);
    write_attribute_value(&mut slot.value, value);
  }

  #[inline]
  pub fn clear(&mut self) {
    for attr in &mut self.inner {
      if attr.bit == FREE_SLOT {
        break;
      }
      attr.bit = FREE_SLOT;
      attr.name = None;
      if attr.value.capacity() > RETAINED_VALUE_CAPACITY {
        attr.value = String::new();
      }
    }
  }

  /// Name/value pairs in source order, with a known name rebuilt from its bit.
  pub fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
    self.live().map(|attr| (attr.name(), attr.value()))
  }
}

#[inline]
fn write_attribute_value(buffer: &mut String, value: Option<&str>) {
  match value {
    Some(value) => {
      reset_buffer(buffer, value.len());
      decode_html_attribute_entities_into(value, buffer);
    }
    None => buffer.clear(),
  }
}

/// Empty `buffer` for a rewrite of up to `capacity` bytes. A buffer that is too
/// small is replaced, not grown: growing would copy contents that are overwritten.
#[inline]
pub(crate) fn reset_buffer(buffer: &mut String, capacity: usize) {
  if buffer.capacity() < capacity {
    replace_buffer(buffer, capacity);
  } else {
    buffer.clear();
  }
}

#[cold]
#[inline(never)]
fn replace_buffer(buffer: &mut String, capacity: usize) {
  *buffer = String::with_capacity(capacity);
}

#[derive(Debug, Clone)]
pub(crate) struct TailwindData {
  pub prefix: Option<String>,
  pub suffix: Option<String>,
  pub hidden: bool,
}

/// The two rare per-node fields, boxed together so every node stays small.
#[derive(Debug, Clone, Default)]
pub(crate) struct NodeExtras {
  /// Only set for custom (non-builtin) tags; built-in names come from `tag_id`.
  pub custom_name: Option<Box<str>>,
  pub tailwind: Option<TailwindData>,
}

impl NodeExtras {
  /// Extras for a freshly parsed tag: `None` for a built-in, whose name comes
  /// back from `tag_id`. Keeps the boxing decision out of the parser.
  #[inline]
  pub fn for_tag(is_builtin: bool, tag_name: &str) -> Option<Box<Self>> {
    (!is_builtin).then(|| {
      Box::new(Self {
        custom_name: Some(tag_name.into()),
        tailwind: None,
      })
    })
  }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ElementNode {
  // Pointer-sized fields first (8 bytes each on 64-bit)
  pub attributes: Attributes,
  pub extras: Option<Box<NodeExtras>>,
  pub depth: usize,
  pub index: u32,
  pub current_walk_index: u32,
  /// Child-content counter used by whitespace and empty-link handling.
  pub child_text_node_index: u32,
  // Small fields grouped to minimize padding
  pub tag_id: Option<u8>,
  pub has_list_item_output: bool,
  pub excluded_from_markdown: bool,
  /// A plugin skipped this node's start, so its end must not be emitted either.
  /// Unlike `excluded_from_markdown`, the node's descendants stay eligible.
  pub(crate) enter_skipped: bool,
  /// Cached from tag handler - avoids repeated get_tag_handler lookups
  pub is_inline: bool,
  pub excludes_text_nodes: bool,
  pub is_non_nesting: bool,
  pub collapses_inner_white_space: bool,
  pub spacing: Option<[u8; 2]>,
}

impl ElementNode {
  #[inline]
  pub fn custom_name(&self) -> Option<&str> {
    self.extras.as_ref().and_then(|e| e.custom_name.as_deref())
  }

  #[inline]
  pub fn tailwind(&self) -> Option<&TailwindData> {
    self.extras.as_ref().and_then(|e| e.tailwind.as_ref())
  }

  #[inline]
  pub fn set_tailwind(&mut self, data: TailwindData) {
    self.extras.get_or_insert_default().tailwind = Some(data);
  }

  /// Get the tag name. For built-in tags, derives from tag_id. For custom tags, uses custom_name.
  #[inline]
  pub fn name(&self) -> &str {
    // Custom name takes priority (e.g. custom tags with alias_tag_id)
    if let Some(n) = self.custom_name() {
      n
    } else if let Some(id) = self.tag_id {
      crate::consts::TAG_NAMES[id as usize]
    } else {
      ""
    }
  }
}

/// The open-element stack, with closed nodes kept in place past its end.
///
/// Closed nodes stay in their slots, readable through [`Self::retired`].
/// Derefs to the live slice.
#[derive(Debug, Default)]
pub(crate) struct NodeStack {
  nodes: Vec<ElementNode>,
  len: usize,
}

impl std::ops::Deref for NodeStack {
  type Target = [ElementNode];
  #[inline(always)]
  fn deref(&self) -> &[ElementNode] {
    &self.nodes[..self.len]
  }
}

impl std::ops::DerefMut for NodeStack {
  #[inline(always)]
  fn deref_mut(&mut self) -> &mut [ElementNode] {
    &mut self.nodes[..self.len]
  }
}

impl<'a> IntoIterator for &'a NodeStack {
  type Item = &'a ElementNode;
  type IntoIter = std::slice::Iter<'a, ElementNode>;
  #[inline]
  fn into_iter(self) -> Self::IntoIter {
    self.iter()
  }
}

impl NodeStack {
  pub fn with_capacity(capacity: usize) -> Self {
    Self {
      nodes: Vec::with_capacity(capacity),
      len: 0,
    }
  }

  #[inline]
  pub fn push_slot(&mut self) -> &mut ElementNode {
    if self.len == self.nodes.len() {
      self.nodes.push(ElementNode::default());
    }
    self.len += 1;
    &mut self.nodes[self.len - 1]
  }

  #[inline]
  pub fn push(&mut self, node: ElementNode) {
    if self.len == self.nodes.len() {
      self.nodes.push(node);
    } else {
      self.nodes[self.len] = node;
    }
    self.len += 1;
  }

  /// Close the top node in place.
  #[inline]
  pub fn retire(&mut self) -> bool {
    if self.len == 0 {
      return false;
    }
    self.len -= 1;
    true
  }

  #[inline(always)]
  pub fn retired(&self) -> &ElementNode {
    &self.nodes[self.len]
  }

  #[inline(always)]
  pub fn retired_mut(&mut self) -> &mut ElementNode {
    &mut self.nodes[self.len]
  }

  /// Drop a retired node's large values and extras once its exit is emitted.
  /// Otherwise a slot above the live depth holds them until the document ends.
  #[inline]
  pub fn release_retired(&mut self) {
    let node = &mut self.nodes[self.len];
    node.attributes.clear();
    node.extras = None;
  }

  /// Move the retired node out, leaving an empty node in its slot.
  #[inline]
  pub fn take_retired(&mut self) -> ElementNode {
    std::mem::take(&mut self.nodes[self.len])
  }

  /// Put a node taken by [`Self::take_retired`] back, so its buffers are reused.
  #[inline]
  pub fn restore_retired(&mut self, node: ElementNode) {
    self.nodes[self.len] = node;
  }

  /// Retire and take the top node, for callers that need it owned.
  #[inline]
  pub fn pop(&mut self) -> Option<ElementNode> {
    self.retire().then(|| self.take_retired())
  }
}

#[derive(Clone, Copy)]
pub(crate) struct TagHandler {
  pub is_self_closing: bool,
  pub is_non_nesting: bool,
  pub collapses_inner_white_space: bool,
  pub is_inline: bool,
  pub spacing: Option<[u8; 2]>,
  pub excludes_text_nodes: bool,
  /// `ATTR_*` bitmask of the attribute names this tag's rendering reads.
  /// Anything outside it is skipped instead of lowercased, decoded, and stored.
  pub wanted_attrs: u16,
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
pub(crate) enum ParsedSelector {
  Tag(String),
  Class(String),
  Id(String),
  Attribute {
    name: String,
    operator: Option<String>,
    value: Option<String>,
  },
  Compound(Vec<Self>),
}

/// Result element from extraction
#[derive(Debug, Clone)]
#[non_exhaustive]
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
  /// tag. Resolve a name to its numeric ID with [`crate::get_tag_id`]:
  ///
  /// ```rust
  /// use mdream::{TagOverrideConfig, get_tag_id};
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

/// Plugin configuration bundled into [`HtmlToMarkdownOptions`].
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
  ///
  /// A link can only be judged once every heading is known, so streaming holds
  /// the whole document and returns it from `finish` instead of yielding it
  /// chunk by chunk.
  pub fragments: bool,
  /// Strip links with meaningless or executable hrefs → plain text.
  pub empty_links: bool,
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
/// use mdream::{HtmlToMarkdownOptions, CleanConfig};
///
/// let opts = HtmlToMarkdownOptions {
///     origin: Some("https://example.com".into()),
///     clean: Some(CleanConfig::all()),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Default)]
pub struct HtmlToMarkdownOptions {
  /// Base URL used to resolve relative links and image sources.
  pub origin: Option<String>,
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
  /// Cap on the bytes one construct may buffer — a text node, a tag, an open code
  /// block or inline code span, a table row's columns, or the script text an
  /// extraction reads; `0` (the default) is unlimited. Content past the cap is
  /// **dropped**, bounding memory on adversarial input. The result never depends on
  /// chunking, and the cap applies to one-shot conversion as well as streaming.
  /// Comments, doctypes and unsurfaced CDATA are never buffered, so never capped.
  ///
  /// A start tag is measured against what conversion *retains*. Attributes it
  /// cannot use are scanned and discarded as they stream past, costing no budget
  /// however large: a megabyte of `data-*` leaves its element, and any `href` on
  /// it, intact. A retained attribute that does not fit drops the whole tag, as
  /// does a custom element whose minimal `<name>` token would exceed the cap.
  ///
  /// A `plugins` filter, extraction, or Tailwind config makes every attribute
  /// readable, so none can be classified as unused; there the cap is measured
  /// against the tag's raw length and an over-long tag is dropped whole.
  ///
  /// Output an open construct holds back from streaming is charged too: a quote's
  /// unfinished line (or all of it while a link inside is open), a heading's
  /// trailing `#` run, a self-link heading's text, the `<br>` breaks written since
  /// the last text. Past the cap nothing can be dropped without breaking the
  /// construct, so the document is cut before the next tag.
  ///
  /// [`MdreamResult::truncated`] reports whether it fired.
  pub max_node_bytes: usize,
}

impl HtmlToMarkdownOptions {
  /// Set the base URL for resolving relative links and images.
  ///
  /// ```rust
  /// use mdream::HtmlToMarkdownOptions;
  ///
  /// let opts = HtmlToMarkdownOptions::default().with_origin("https://example.com");
  /// ```
  #[must_use]
  pub fn with_origin(mut self, origin: impl Into<String>) -> Self {
    self.origin = Some(origin.into());
    self
  }

  /// Apply a [`CleanConfig`] cleanup preset.
  ///
  /// ```rust
  /// use mdream::{HtmlToMarkdownOptions, CleanConfig};
  ///
  /// let opts = HtmlToMarkdownOptions::default().with_clean(CleanConfig::all());
  ///
  /// // Strip tracking query parameters only.
  /// let opts = HtmlToMarkdownOptions::default()
  ///     .with_clean(CleanConfig { urls: true, ..Default::default() });
  /// ```
  #[must_use]
  pub fn with_clean(mut self, clean: CleanConfig) -> Self {
    self.clean = Some(clean);
    self
  }

  /// Enable plugins via a [`PluginConfig`].
  ///
  /// ```rust
  /// use mdream::{HtmlToMarkdownOptions, PluginConfig};
  ///
  /// let opts = HtmlToMarkdownOptions::default()
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
  /// use mdream::HtmlToMarkdownOptions;
  ///
  /// let opts = HtmlToMarkdownOptions::default().with_wrap_width(80);
  /// ```
  #[must_use]
  pub fn with_wrap_width(mut self, width: usize) -> Self {
    self.wrap_width = width;
    self
  }

  /// Drop content past `bytes` in one buffered construct, including a text node,
  /// token, code block, or inline code span. Applies to one-shot and streaming conversion.
  ///
  /// ```rust
  /// use mdream::HtmlToMarkdownOptions;
  ///
  /// let opts = HtmlToMarkdownOptions::default().with_max_node_bytes(64 * 1024);
  /// ```
  #[must_use]
  pub fn with_max_node_bytes(mut self, bytes: usize) -> Self {
    self.max_node_bytes = bytes;
    self
  }
}

/// Result from html_to_markdown conversion with extraction/frontmatter data
#[non_exhaustive]
pub struct MdreamResult {
  pub markdown: String,
  pub extracted: Option<Vec<ExtractedElement>>,
  pub frontmatter: Option<Vec<(String, String)>>,
  /// Whether `max_node_bytes` fired. `false` guarantees the output is exactly what
  /// an uncapped conversion produces. `true` is conservative: dropping an unemitted
  /// attribute costs no output, so the markdown may still be identical.
  pub truncated: bool,
}

#[cfg(not(any(feature = "markdown", feature = "text", feature = "html")))]
compile_error!("mdream needs at least one output format feature: `markdown`, `text`, or `html`.");

/// Output format for conversion.
///
/// Each variant exists only when its cargo feature is enabled. Cargo unifies
/// features across a build, so another crate can add a variant to yours. A
/// `match` on this enum needs a `_` arm.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[non_exhaustive]
pub enum OutputFormat {
  /// Markdown output (default).
  #[cfg(feature = "markdown")]
  Markdown,
  /// Plain text output with Markdown/HTML syntax omitted.
  #[cfg(feature = "text")]
  Text,
  /// Allowlisted semantic HTML output.
  #[cfg(feature = "html")]
  Html,
}

#[cfg(any(feature = "markdown", feature = "text", feature = "html"))]
impl Default for OutputFormat {
  /// Markdown, or the first enabled format when the build omits Markdown.
  fn default() -> Self {
    #[cfg(feature = "markdown")]
    return Self::Markdown;
    #[cfg(all(not(feature = "markdown"), feature = "text"))]
    return Self::Text;
    #[cfg(all(not(feature = "markdown"), not(feature = "text"), feature = "html"))]
    return Self::Html;
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::consts::{ATTR_HREF, ATTR_SRC, ATTR_TITLE};

  fn pairs(attrs: &Attributes) -> Vec<(String, String)> {
    attrs
      .iter()
      .map(|(name, value)| (name.to_string(), value.to_string()))
      .collect()
  }

  /// Recycled slots must never leak a previous node's attributes: lookups and
  /// iteration stop at the first retired slot even though the buffers stay.
  #[test]
  fn cleared_slots_are_invisible_and_reused() {
    let mut attrs = Attributes::new();
    // Long enough that the refill below fits this slot's buffer and reuses it.
    attrs.insert_known(ATTR_HREF, Some("/first.html"));
    attrs.insert_known(ATTR_TITLE, Some("Tom &amp; Jerry"));
    attrs.insert_custom("data-x".into(), Some("1"));
    assert_eq!(attrs.get_bit(ATTR_TITLE), Some("Tom & Jerry"));
    assert_eq!(attrs.get("data-x"), Some("1"));

    attrs.clear();
    assert_eq!(attrs.get_bit(ATTR_HREF), None);
    assert_eq!(attrs.get_bit(ATTR_TITLE), None);
    assert_eq!(attrs.get("data-x"), None);
    assert!(pairs(&attrs).is_empty());

    // Refill fewer than before: the third retired slot keeps its stale value
    // but must stay hidden.
    let buffer = attrs.inner[0].value.as_ptr();
    attrs.insert_known(ATTR_SRC, Some("/img.png"));
    attrs.insert_known(ATTR_SRC, Some("/second.png"));
    attrs.insert_known(ATTR_HREF, None);
    assert_eq!(attrs.inner[0].value.as_ptr(), buffer, "slot buffer reused");
    assert_eq!(
      pairs(&attrs),
      [
        ("src".to_string(), "/img.png".to_string()),
        ("href".to_string(), String::new())
      ]
    );
    assert_eq!(attrs.get("data-x"), None);
    assert_eq!(attrs.get_bit(ATTR_TITLE), None);
  }

  #[test]
  fn oversized_value_buffers_are_released() {
    let mut attrs = Attributes::new();
    let big = "x".repeat(RETAINED_VALUE_CAPACITY + 1);
    attrs.insert_known(ATTR_SRC, Some(&big));
    attrs.insert_known(ATTR_HREF, Some("/a"));
    attrs.clear();
    assert_eq!(attrs.inner[0].value.capacity(), 0);
    assert!(attrs.inner[1].value.capacity() > 0);
  }
}
