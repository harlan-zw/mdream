[9]](#cite_note-philosophy-9)</sup>

In 2002 [Aaron Swartz](/wiki/Aaron_Swartz) created [atx](/wiki/Atx_(markup_language)) and referred to it as "the true structured text format". Gruber created the Markdown language in 2004 with Swartz as his "sounding board".<sup>[[13]](#cite_note-Gruber-13)</sup> The goal of the language was to enable people "to write using an easy-to-read and easy-to-write plain text format, optionally convert it to structurally valid [XHTML](/wiki/XHTML) (or [HTML](/wiki/HTML))".<sup>[[5]](#cite_note-md-5)</sup>

Another key design goal was *readability*, that the language be readable as-is, without looking like it has been marked up with tags or formatting instructions,<sup>[[9]](#cite_note-philosophy-9)</sup> unlike text formatted with "heavier" [markup languages](/wiki/Markup_language), such as [Rich Text Format](/wiki/Rich_Text_Format) (RTF), HTML, or even [wikitext](/wiki/Wikitext) (each of which have obvious in-line tags and formatting instructions which can make the text more difficult for humans to read).

Gruber wrote a [Perl](/wiki/Perl) script, `Markdown.pl`, which converts marked-up text input to valid, [well-formed](/wiki/Well-formed_document) XHTML or HTML, encoding angle brackets (`<`, `>`) and [ampersands](/wiki/Ampersand) (`&`), which would be misinterpreted as special characters in those languages. It can take the role of a standalone script, a plugin for [Blosxom](/wiki/Blosxom) or a [Movable Type](/wiki/Movable_Type), or of a text filter for [BBEdit](/wiki/BBEdit).<sup>[[5]](#cite_note-md-5)</sup>

## Rise and divergence

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=2)]

As Markdown's popularity grew rapidly, many Markdown [implementations](/wiki/Implementation) appeared, driven mostly by the need for additional features such as [tables](/wiki/Table_(information)), [footnotes](/wiki/Note_(typography)), definition lists,<sup>[[note 1]](#cite_note-16)</sup> and Markdown inside HTML blocks.

The behavior of some of these diverged from the reference implementation, as Markdown was only characterised by an informal [specification](/wiki/Specification_(technical_standard))<sup>[[16]](#cite_note-17)</sup> and a [Perl](/wiki/Perl) implementation for conversion to HTML.

At the same time, a number of ambiguities in the informal specification had attracted attention.<sup>[[17]](#cite_note-gfm_on_github-why_spec-18)</sup> These issues spurred the creation of tools such as Babelmark<sup>[[18]](#cite_note-babelmark-2-19)</sup><sup>[[19]](#cite_note-babelmark-3-20)</sup> to compare the output of various implementations,<sup>[[20]](#cite_note-21)</sup> and an effort by some developers of Markdown [parsers](/wiki/Parsing) for standardisation. However, Gruber has argued that complete standardization would be a mistake: "Different sites (and people) have different needs. No one syntax would make all happy."<sup>[[21]](#cite_note-22)</sup>

Gruber avoided using curly braces in Markdown to unofficially reserve them for implementation-specific extensions.<sup>[[22]](#cite_note-curlyBraces-23)</sup>

## Standardization

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=3)]

CommonMark

| [![](https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/175px-Markdown-mark.svg.png)](/wiki/File:Markdown-mark.svg) |
| --- |
| [Filename extensions](/wiki/Filename_extension) | `.md`, `.markdown`<sup>[[2]](#cite_note-rfc7763-2)</sup> |
| [Internet media type](/wiki/Media_type) | `text/markdown; variant=CommonMark`<sup>[[7]](#cite_note-rfc7764-7)</sup> |
| [Uniform Type Identifier (UTI)](/wiki/Uniform_Type_Identifier) | *uncertain*<sup>[[23]](#cite_note-cm-uti-24)</sup> |
| UTI conformation | public.plain-text |
| Developed by | [John MacFarlane](/wiki/John_MacFarlane_(philosopher)), open source |
| Initial release | October 25, 2014(10 years ago)(2014-10-25) |
| [Latest release](/wiki/Software_release_life_cycle) | 0.31.2<br>January 28, 2024(14 months ago)(2024-01-28)<sup>[[24]](#cite_note-cm-spec-25)</sup> |
| Type of format | [Open file format](/wiki/Open_file_format) |
| Extended from | Markdown |
| Extended to | GitHub Flavored Markdown |
| Website | [commonmark.org](https://commonmark.org/)[spec.commonmark.org](http://spec.commonmark.org/) |

From 2012, a group of people, including [Jeff Atwood](/wiki/Jeff_Atwood) and [John MacFarlane](/wiki/John_MacFarlane_(philosopher)), launched what Atwood characterised as a standardisation effort.<sup>[[11]](#cite_note-FutureOfMarkdown-11)</sup>

A community website now aims to "document various tools and resources available to document authors and developers, as well as implementors of the various Markdown implementations".<sup>[[25]](#cite_note-26)</sup>

In September 2014, Gruber objected to the usage of "Markdown" in the name of this effort and it was rebranded as CommonMark.<sup>[[12]](#cite_note-ArsTechnica2014-12)</sup><sup>[[26]](#cite_note-27)</sup><sup>[[27]](#cite_note-28)</sup> CommonMark.org published several versions of a specification, reference implementation, test suite, and "[plans] to announce a finalized 1.0 spec and test suite in 2019".<sup>[[28]](#cite_note-commonmark.org-29)</sup>

No 1.0 spec has since been released, as major issues still remain unsolved.<sup>[[29]](#cite_note-30)</sup>

Nonetheless, the following websites and projects have adopted CommonMark: [Discourse](/wiki/Discourse_(software)), [GitHub](/wiki/GitHub), [GitLab](/wiki/GitLab), [Reddit](/wiki/Reddit), [Qt](/wiki/Qt_(software)), [Stack Exchange](/wiki/Stack_Exchange) ([Stack Overflow](/wiki/Stack_Overflow)), and [Swift](/wiki/Swift_(programming_language)).

In March 2016, two relevant informational Internet [RFCs](/wiki/Request_for_Comments) were published:

- RFC [7763](https://www.rfc-editor.org/rfc/rfc7763) introduced [MIME](/wiki/MIME) type `text/markdown`.- RFC [7764](https://www.rfc-editor.org/rfc/rfc7764) discussed and registered the variants [MultiMarkdown](/wiki/MultiMarkdown), GitHub Flavored Markdown (GFM), [Pandoc](/wiki/Pandoc), and Markdown Extra among others.<sup>[[30]](#cite_note-IANA-31)</sup>

## Variants

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=4)]

Websites like [Bitbucket](/wiki/Bitbucket), [Diaspora](/wiki/Diaspora_(social_network)), [Discord](/wiki/Discord),<sup>[[31]](#cite_note-32)</sup>[GitHub](/wiki/GitHub),<sup>[[32]](#cite_note-gfm_on_github-33)</sup>[OpenStreetMap](/wiki/OpenStreetMap), [Reddit](/wiki/Reddit),<sup>[[33]](#cite_note-34)</sup>[SourceForge](/wiki/SourceForge)<sup>[[34]](#cite_note-35)</sup> and [Stack Exchange](/wiki/Stack_Exchange)<sup>[[35]](#cite_note-36)</sup> use variants of Markdown to make discussions between users easier.

Depending on implementation, basic inline [HTML tags](/wiki/HTML_tag) may be supported.<sup>[[36]](#cite_note-37)</sup>

Italic text may be implemented by `_underscores_` or `*single-asterisks*`.<sup>[[37]](#cite_note-italic-38)</sup>

### GitHub Flavored Markdown

[[edit](/w/index.php?title=Markdown&amp;action=edit&amp;section=5)]

GitHub had been using its own variant of Markdown since as early as 2009,<sup>[[38]](#cite_note-39)</sup> which added support for additional formatting such as tables and nesting 