# Docker Usage

mdream ships two Docker images for two different jobs:

| Image | Use it for | Engine | Size |
|-------|-----------|--------|------|
| `harlanzw/mdream:core` | Converting HTML you already have to Markdown | Native Rust binary | ~600 KB |
| `harlanzw/mdream:crawl` | Fetching/crawling URLs, `llms.txt` generation | Node + Playwright Chrome | ~1.5 GB |

`harlanzw/mdream:latest` is a back-compat alias of `:crawl`. Prefer the explicit `:crawl` or `:core` tag.

Both images are published to Docker Hub (`harlanzw/mdream`) and GitHub Container Registry (`ghcr.io/harlan-zw/mdream`) for `linux/amd64`.

## `mdream:core` — HTML to Markdown

A `FROM scratch` image containing a single statically linked Rust binary. It reads HTML from stdin and writes Markdown to stdout. No Node, no browser, nothing to mount.

```bash
# Convert a local HTML file
docker run -i --rm harlanzw/mdream:core < page.html > page.md

# Convert a fetched page (resolve relative links against its origin)
curl -s https://example.com \
  | docker run -i --rm harlanzw/mdream:core --origin https://example.com \
  > example.md
```

### Options

| Flag | Description |
|------|-------------|
| `--origin <url>` / `-o <url>` | Base URL for resolving relative links |
| `--clean-urls` | Strip tracking query params (`utm_*`, `fbclid`, etc.) |
| `--verbose` / `-v` | Print conversion stats to stderr |
| `--help` / `-h` | Show help |

The `core` image only converts HTML it is given; it does not fetch URLs or render JavaScript. For that, use `crawl`.

## `mdream:crawl` — crawl and llms.txt

`@mdream/crawl` with Playwright Chrome pre-installed, for website crawling and `llms.txt` generation.

```bash
# Basic crawling
docker run harlanzw/mdream:crawl https://example.com

# Interactive mode
docker run -it harlanzw/mdream:crawl

# Show help
docker run harlanzw/mdream:crawl --help
```

### Basic Usage

```bash
# Crawl a website with depth limit
docker run harlanzw/mdream:crawl https://example.com --depth 2

# Crawl with exclusions and limits
docker run harlanzw/mdream:crawl https://large-site.com \
  --exclude "*/admin/*" --exclude "*/api/*" --max-pages 50

# Crawl using Playwright for JavaScript sites
docker run harlanzw/mdream:crawl https://spa-site.com --driver playwright
```

### Single Page Conversion

To convert just one page (no crawling), use `--single-page` (alias for `--depth 0`):

```bash
# Convert a single article to Markdown
docker run -v $(pwd)/output:/app/output harlanzw/mdream:crawl \
  https://en.wikipedia.org/wiki/Markdown --single-page --output /app/output

# JavaScript-rendered pages
docker run -v $(pwd)/output:/app/output harlanzw/mdream:crawl \
  https://www.scientificamerican.com/article/whale-songs-follow-basic-human-language-rules \
  --single-page --driver playwright --output /app/output
```

Output: a path-mirrored `.md` file under `output/` (e.g. `output/wiki/Markdown.md`), plus `output/llms.txt` and `output/llms-full.txt`.

For a static page where you do not need JavaScript rendering, `mdream:core` is far smaller and needs no volume mount.

### Batch: List of URLs from a File

Loop a URL list through the container, one page each. The output directory is reused so all pages collect under `output/` (each file lands at a path that mirrors its URL):

```bash
# urls.txt — one URL per line
while IFS= read -r url; do
  [ -z "$url" ] && continue
  docker run --rm -v $(pwd)/output:/app/output harlanzw/mdream:crawl \
    "$url" --single-page --output /app/output
done < urls.txt
```

To group output per site, derive a directory from the host:

```bash
while IFS= read -r url; do
  [ -z "$url" ] && continue
  host=$(echo "$url" | awk -F/ '{print $3}')
  mkdir -p "output/$host"
  docker run --rm -v "$(pwd)/output/$host:/app/output" harlanzw/mdream:crawl \
    "$url" --single-page --output /app/output
done < urls.txt
```

### Persistent Output

To save crawled content to your local machine:

```bash
docker run -v $(pwd)/output:/app/output harlanzw/mdream:crawl \
  https://example.com --output /app/output
```

### How It Works

The container's `ENTRYPOINT` acts directly as the `mdream-crawl` command:
- All arguments passed to `docker run` are forwarded to `mdream-crawl`
- No need to specify command names, just pass your crawl options

### Environment Variables

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` - Already set (browsers pre-installed)
- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` - Browser location
- `DISPLAY=:99` - Virtual display for headless browsing

### Output Files

The crawler generates these artifacts in your output directory:
- `llms.txt` - Consolidated text file optimized for LLM consumption
- `llms-full.txt` - Extended format with comprehensive metadata
- Individual `.md` files at paths mirroring each page's URL (e.g. `wiki/Markdown.md`)

## Building Locally

```bash
# core image
docker build -f Dockerfile.core -t mdream-core .
echo '<h1>Hello</h1>' | docker run -i --rm mdream-core

# crawl image
docker build -f Dockerfile.crawl -t mdream-crawl .
docker run mdream-crawl https://example.com
```

## Tags

| Tag | Image |
|-----|-------|
| `core` | core converter |
| `<version>-core` | core converter, version-pinned |
| `crawl` | crawler |
| `latest` | crawler (back-compat alias of `crawl`) |
| `<version>` / `<version>-crawl` | crawler, version-pinned |

## Base Images

- `core` builds the `mdream` Rust binary on `rust:alpine` and ships it on `scratch`.
- `crawl` uses `apify/actor-node-playwright-chrome` (Node.js with pnpm, Playwright + Chrome, XVFB).
