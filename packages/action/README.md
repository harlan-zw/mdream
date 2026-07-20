# @mdream/action

GitHub Action that processes prerendered HTML files into `llms.txt` artifacts for CI/CD workflows.

## Setup

Add the action to any workflow step after your site build completes. Requires Node.js to be available in the runner environment.

```yaml
- uses: harlan-zw/mdream@v1
  with:
    glob: 'dist/**/*.html'
    site-name: My Documentation
    description: Technical documentation and guides
    origin: 'https://mydocs.com'
```

## Usage

### Basic

```yaml
- name: Generate llms.txt artifacts
  uses: harlan-zw/mdream@v1
  with:
    glob: 'dist/**/*.html'
    site-name: My Documentation
    description: Technical documentation and guides
    origin: 'https://mydocs.com'
```

Generates `llms.txt`, `llms-full.txt`, and a `md/` directory in the current working directory.

### Full Workflow

```yaml
name: Generate LLMs.txt

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  generate-llms-txt:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install dependencies
        run: npm ci

      - name: Build documentation
        run: npm run build

      - name: Generate llms.txt artifacts
        id: llms
        uses: harlan-zw/mdream@v1
        with:
          glob: 'dist/**/*.html'
          site-name: My Documentation
          description: Technical documentation and guides
          origin: 'https://mydocs.com'
          output: dist

      - name: Upload llms.txt artifacts
        uses: actions/upload-artifact@v4
        with:
          name: llms-txt-artifacts
          path: |
            dist/llms.txt
            dist/llms-full.txt
            dist/md/

      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Using Outputs

Reference the action outputs in subsequent steps:

```yaml
- name: Generate llms.txt artifacts
  id: llms
  uses: harlan-zw/mdream@v1
  with:
    glob: 'dist/**/*.html'
    site-name: My Docs
    description: My documentation site
    origin: 'https://mydocs.com'
    output: dist

- name: Print generated file paths
  run: |
    echo "llms.txt: ${{ steps.llms.outputs.llms-txt-path }}"
    echo "llms-full.txt: ${{ steps.llms.outputs.llms-full-txt-path }}"
    echo "Markdown files: ${{ steps.llms.outputs.markdown-files }}"
```

### Verbose Logging

```yaml
- name: Generate llms.txt artifacts
  uses: harlan-zw/mdream@v1
  with:
    glob: 'dist/**/*.html'
    site-name: My Docs
    description: My documentation site
    origin: 'https://mydocs.com'
    verbose: 'true'
```

## API Reference

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `glob` | Yes | | Glob pattern to match HTML files (e.g., `dist/**/*.html`). |
| `site-name` | Yes | | Name of your site. Used as the heading in generated files. |
| `description` | Yes | | Description of your site content. Rendered as a blockquote below the site name. |
| `origin` | Yes | | Base URL of your site (e.g., `https://mysite.com`). Used to construct full page URLs. |
| `output` | No | `.` | Output directory for generated files. Created recursively if it does not exist. |
| `chunk-size` | No | `4096` | Chunk size for streaming processing. |
| `verbose` | No | `false` | Enable verbose logging. Prints configuration values to the action log. |

### Outputs

| Output | Description |
|--------|-------------|
| `llms-txt-path` | Path to the generated `llms.txt` file. |
| `llms-full-txt-path` | Path to the generated `llms-full.txt` file. |
| `markdown-files` | JSON array of paths to all generated individual Markdown files. |

### Generated Files

| File | Description |
|------|-------------|
| `llms.txt` | Index listing all pages with titles, URLs, and descriptions. |
| `llms-full.txt` | Full Markdown content of every page with YAML frontmatter and a table of contents. |
| `md/<path>.md` | Individual Markdown files mirroring the site URL hierarchy. |

### URL Path Resolution

HTML file paths are converted to URL paths automatically:

| File Path | Resolved URL |
|-----------|-------------|
| `dist/index.html` | `/` |
| `dist/about.html` | `/about` |
| `dist/docs/getting-started.html` | `/docs/getting-started` |
| `dist/blog/2024/post.html` | `/blog/2024/post` |

The `.html` extension is stripped. `index.html` files resolve to their parent directory path. The `origin` input is prepended to construct full URLs in the output.

### Metadata Extraction

Metadata is extracted from each HTML file in the following priority order:

**Title:** `<title>` tag, then `<meta property="og:title">`.
**Description:** `<meta name="description">`, then `<meta property="og:description">`.

Descriptions are truncated to 100 characters in the `llms.txt` listing. Full metadata is embedded as YAML frontmatter in `llms-full.txt`.

## License

[MIT](../../LICENSE.md)
