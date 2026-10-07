# Docker Usage

These examples use the v2 beta images:

| Image | Use it for | Engine | Size |
|-------|-----------|--------|------|
| `harlanzw/mdream:beta-core` | Converting HTML you already have to Markdown | Native Rust binary | ~600 KB |
| `harlanzw/mdream:beta-crawl` | Fetching/crawling URLs, `llms.txt` generation | Node + Playwright Chrome | ~1.5 GB |

`harlanzw/mdream:beta` is an alias of `:beta-crawl`. Prefer the explicit `:beta-crawl` or `:beta-core` tag.

Both images are published to Docker Hub (`harlanzw/mdream`) and GitHub Container Registry (`ghcr.io/harlan-zw/mdream`) for `linux/amd64`.

## `mdream:beta-core`: HTML to Markdown

This `FROM scratch` image contains one statically linked Rust binary.
It reads HTML from stdin and writes Markdown to stdout.

```bash
# Convert a local HTML file
docker run -i --rm harlanzw/mdream:beta-core < page.html > page.md

# Convert a fetched page (resolve relative links against its origin)
curl -s https://example.com \
  | docker run -i --rm harlanzw/mdream:beta-core --origin https://example.com \
  > example.md
```

### Options

| Flag | Description |
|------|-------------|
| `--origin <url>` / `-o <url>` | Base URL for resolving relative links |
| `--clean-urls` | Strip tracking query params (`utm_*`, `fbclid`, etc.) |
| `--verbose` / `-v` | Print conversion stats to stderr |
| `--help` / `-h` | Show help |

If you need to fetch URLs or render JavaScript, use the `crawl` image.

## `mdream:beta-crawl`: crawl and llms.txt

`@mdream/crawl` with Playwright Chrome pre-installed, for website crawling and `llms.txt` generation.

```bash
# Basic crawling
docker run harlanzw/mdream:beta-crawl https://example.com

# Interactive mode
docker run -it harlanzw/mdream:beta-crawl

# Show help
docker run harlanzw/mdream:beta-crawl --help
```

### Basic Usage

```bash
# Crawl a website with depth limit
docker run harlanzw/mdream:beta-crawl https://example.com --depth 2

# Crawl with exclusions and limits
docker run harlanzw/mdream:beta-crawl https://large-site.com \
  --exclude "*/admin/*" --exclude "*/api/*" --max-pages 50

# Crawl using Playwright for JavaScript sites
docker run harlanzw/mdream:beta-crawl https://spa-site.com --driver playwright
```

### Single Page Conversion

To convert just one page (no crawling), use `--single-page` (alias for `--depth 0`):

```bash
# Convert a single article to Markdown
docker run -v $(pwd)/output:/app/output harlanzw/mdream:beta-crawl \
  https://en.wikipedia.org/wiki/Markdown --single-page --output /app/output

# JavaScript-rendered pages
docker run -v $(pwd)/output:/app/output harlanzw/mdream:beta-crawl \
  https://www.scientificamerican.com/article/whale-songs-follow-basic-human-language-rules \
  --single-page --driver playwright --output /app/output
```

The command writes a `.md` file under `output/`, with a path that mirrors the page URL.
It also writes `output/llms.txt` and `output/llms-full.txt`.

For a static page where you do not need JavaScript rendering, `mdream:beta-core` is far smaller and needs no volume mount.

### Batch: List of URLs from a File

Run the container once per URL. Each command reuses `output/` and saves a Markdown file at the page's URL path:

```bash
# urls.txt: one URL per line
while IFS= read -r url; do
  [ -z "$url" ] && continue
  docker run --rm -v $(pwd)/output:/app/output harlanzw/mdream:beta-crawl \
    "$url" --single-page --output /app/output
done < urls.txt
```

To group output per site, derive a directory from the host:

```bash
while IFS= read -r url; do
  [ -z "$url" ] && continue
  host=$(echo "$url" | awk -F/ '{print $3}')
  mkdir -p "output/$host"
  docker run --rm -v "$(pwd)/output/$host:/app/output" harlanzw/mdream:beta-crawl \
    "$url" --single-page --output /app/output
done < urls.txt
```

### Persistent Output

To save crawled content to your local machine:

```bash
docker run -v $(pwd)/output:/app/output harlanzw/mdream:beta-crawl \
  https://example.com --output /app/output
```

### How It Works

Pass crawl options after the image name. The container forwards them to `mdream-crawl`.

### Environment Variables

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`: Browsers are pre-installed, so installation skips the download.
- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`: Browser location.
- `DISPLAY=:99`: Virtual display for headless browsing.

### Output Files

The crawler writes these files to your output directory:

- `llms.txt`: An index of pages with titles and links.
- `llms-full.txt`: The full Markdown content of the pages.
- Individual `.md` files at paths that mirror each page's URL, such as `wiki/Markdown.md`.

## Building Locally

The `core` image builds entirely from `crates/` source, so it works from a clean checkout:

```bash
docker build -f Dockerfile.core -t mdream-core .
echo '<h1>Hello</h1>' | docker run -i --rm mdream-core
```

Before building the `crawl` image, generate the native bindings in `packages/mdream/napi/`.
Follow the `Setup napi native bindings` step in `.github/workflows/release-docker.yml`.
The release workflow runs that step before `docker build`.

## Tags

| Tag | Image |
|-----|-------|
| `beta-core` | v2 beta core converter |
| `<version>-core` | core converter, version-pinned |
| `beta-crawl` | v2 beta crawler |
| `beta` | alias of `beta-crawl` |
| `<version>` / `<version>-crawl` | crawler, version-pinned |

## Base Images

- `core` builds the `mdream` Rust binary on `rust:alpine` and ships it on `scratch`.
- `crawl` uses `apify/actor-node-playwright-chrome` (Node.js with pnpm, Playwright + Chrome, XVFB).
