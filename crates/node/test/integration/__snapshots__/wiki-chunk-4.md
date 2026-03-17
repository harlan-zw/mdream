[block content](/wiki/HTML_element#Block_elements) inside list elements, as well as GitHub-specific features such as auto-linking references to commits, issues, usernames, etc.

In 2017, GitHub released a formal specification of its GitHub Flavored Markdown (GFM) that is based on CommonMark.<sup>[[32]](#cite_note-gfm_on_github-33)</sup> It is a [strict superset](/wiki/Superset) of CommonMark, following its specification exactly except for tables, [strikethrough](/wiki/Strikethrough), [autolinks](/wiki/Automatic_hyperlinking) and task lists, which GFM adds as extensions.<sup>[[39]](#cite_note-40)</sup>

Accordingly, GitHub also changed the parser used on their sites, which required that some documents be changed. For instance, GFM now requires that the [hash symbol](/wiki/Number_sign) that creates a heading be separated from the heading text by a space character.

### Markdown Extra

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=6)]

Markdown Extra is a [lightweight markup language](/wiki/Lightweight_markup_language) based on Markdown implemented in [PHP](/wiki/PHP) (originally), [Python](/wiki/Python_(programming_language)) and [Ruby](/wiki/Ruby_(programming_language)).<sup>[[40]](#cite_note-fortin-2018-41)</sup> It adds the following features that are not available with regular Markdown:

- Markdown markup inside [HTML](/wiki/HTML) blocks- Elements with id/class attribute- "Fenced code blocks" that span multiple lines of code- Tables<sup>[[41]](#cite_note-42)</sup>- Definition lists- Footnotes- Abbreviations

Markdown Extra is supported in some [content management systems](/wiki/Content_management_system) such as [Drupal](/wiki/Drupal),<sup>[[42]](#cite_note-43)</sup>[Grav (CMS)](/wiki/Grav_(CMS)) and [TYPO3](/wiki/TYPO3).<sup>[[43]](#cite_note-44)</sup>

## Examples

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=7)]

| Text using Markdown syntax | Corresponding HTML produced by a Markdown processor | Text viewed in a browser |
| --- | --- | --- |
| Heading
=======

Sub-heading
-----------

# Alternative heading

## Alternative sub-heading

Paragraphs are separated 
by a blank line.

Two spaces at the end of a line  
produce a line break. | <h1>Heading</h1>

<h2>Sub-heading</h2>

<h1>Alternative heading</h1>

<h2>Alternative sub-heading</h2>

<p>Paragraphs are separated
by a blank line.</p>

<p>Two spaces at the end of a line<br />
produce a line break.</p> | HeadingSub-headingAlternative headingAlternative sub-headingParagraphs are separated by a blank line.Two spaces at the end of a line<br>produce a line break. |
| Text attributes _italic_, **bold**, `monospace`.

Horizontal rule:

--- | <p>Text attributes <em>italic</em>, <strong>bold</strong>, <code>monospace</code>.</p>

<p>Horizontal rule:</p>

<hr /> | Text attributes *italic*, **bold**, `monospace`.Horizontal rule:--- |
| Bullet lists nested within numbered list:

1. fruits
*apple
*banana
2. vegetables
-carrot
-broccoli | <p>Bullet lists nested within numbered list:</p>

<ol>
  <li>fruits <ul>
      <li>apple</li>
      <li>banana</li>
  </ul></li>
  <li>vegetables <ul>
      <li>carrot</li>
      <li>broccoli</li>
  </ul></li>
</ol> | Bullet lists nested within numbered list:<li>fruits
<ul><li>apple</li><li>banana</li></ul></li><li>vegetables
<ul><li>carrot</li><li>broccoli</li></ul></li> |
| A [link](http://example.com).

![Image](Icon-pictures.png "icon")

> Markdown uses email-style
characters for blockquoting.
>
> Multiple paragraphs need to be prepended individually.

Most inline <abbr title="Hypertext Markup Language">HTML</abbr> tags are supported. | <p>A <a href="http://example.com">link</a>.</p>

<p><img alt="Image" title="icon" src="Icon-pictures.png" /></p>

{{blockquote|
<p>Markdown uses email-style characters for blockquoting.</p>
<p>Multiple paragraphs need to be prepended individually.</p>
}}

<p>Most inline <abbr title="Hypertext Markup Language">HTML</abbr> tags are supported.</p> | A [link](http://example.com/).![Image](https://upload.wikimedia.org/wikipedia/commons/5/5c/Icon-pictures.png)> Markdown uses email-style characters for blockquoting.Multiple paragraphs need to be prepended individually.Most inline HTML tags are supported. |

## Implementations

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=8)]

Implementations of Markdown are available for over a dozen [programming languages](/wiki/Programming_language); in addition, many [applications](/wiki/Application_software), platforms and [frameworks](/wiki/Software_framework) support Markdown.<sup>[[44]](#cite_note-45)</sup> For example, Markdown [plugins](/wiki/Plug-in_(computing)) exist for every major [blogging](/wiki/Blog) platform.<sup>[[12]](#cite_note-ArsTechnica2014-12)</sup>

While Markdown is a minimal markup language and is read and edited with a normal [text editor](/wiki/Text_editor), there are specially designed editors that preview the files with styles, which are available for all major platforms. Many general-purpose text and [code editors](/wiki/Source-code_editor) have [syntax highlighting](/wiki/Syntax_highlighting) plugins for Markdown built into them or available as optional download. Editors may feature a side-by-side preview window or render the code directly in a [WYSIWYG](/wiki/WYSIWYG) fashion.

## See also

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=9)]

- [Comparison of document markup languages](/wiki/Comparison_of_document_markup_languages)- [Comparison of documentation generators](/wiki/Comparison_of_documentation_generators)- [Lightweight markup language](/wiki/Lightweight_markup_language)- [Wiki markup](/wiki/Wiki_markup)

## Explanatory notes

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=10)]

1. **[^](#cite_ref-16)**Technically HTML description lists

## References

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=11)]

1. **[^](#cite_ref-df-2022_1-0)**Gruber, John (8 January 2014). ["The Markdown File Extension"](https://daringfireball.net/linked/2014/01/08/markdown-extension). The Daring Fireball Company, LLC. [Archived](https://web.archive.org/web/20200712120733/https://daringfireball.net/linked/2014/01/08/markdown-extension) from the original on 12 July 2020. Retrieved 27 March 2022