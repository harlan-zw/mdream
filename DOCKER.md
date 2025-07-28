# Docker Usage

This Docker image provides `@mdream/crawl` with Playwright Chrome pre-installed for website crawling and llms.txt generation in containerized environments.

## Quick Start

```bash
# Basic crawling
docker run harlanzw/mdream:latest https://example.com

# Interactive mode
docker run -it harlanzw/mdream:latest

# Show help
docker run harlanzw/mdream:latest --help
```

## Available Images

- **Docker Hub**: `harlanzw/mdream:latest`, `harlanzw/mdream:v0.8.5`
- **GitHub Container Registry**: `ghcr.io/harlan-zw/mdream:latest`
- **Platform**: Supports `linux/amd64`

## Basic Usage

```bash
# Crawl a website with depth limit
docker run harlanzw/mdream:latest https://example.com --depth 2

# Crawl with exclusions and limits
docker run harlanzw/mdream:latest https://large-site.com \
  --exclude "*/admin/*" --exclude "*/api/*" --max-pages 50

# Crawl using Playwright for JavaScript sites
docker run harlanzw/mdream:latest https://spa-site.com --driver playwright
```

## Persistent Output

To save crawled content to your local machine:

```bash
# Mount output directory
docker run -v $(pwd)/output:/app/output harlanzw/mdream:latest \
  https://example.com --output /app/output
```

## Building Locally

```bash
docker build -t mdream-local .
docker run mdream-local https://example.com
```

## How It Works

The Docker container is configured with `ENTRYPOINT` to act directly as the `mdream-crawl` command:
- All arguments passed to `docker run` are forwarded to `mdream-crawl`
- No need to specify command names - just pass your crawl options
- Clean, intuitive interface that feels like using the CLI directly

## Environment Variables

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` - Already set (browsers pre-installed)
- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` - Browser location
- `DISPLAY=:99` - Virtual display for headless browsing

## Output Files

The crawler generates these artifacts in your output directory:
- `llms.txt` - Consolidated text file optimized for LLM consumption
- `llms-full.txt` - Extended format with comprehensive metadata
- `md/` - Individual Markdown files for each crawled page

## Base Image

Uses `apify/actor-node-playwright-chrome:20` which includes:
- Node.js 20 with pnpm
- Playwright with Chrome browser pre-installed
- XVFB for headless browsing support
- Optimized for web crawling and automation
