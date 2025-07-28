# syntax=docker/dockerfile:1
# Use Crawlee's official Node.js 20 image with Playwright Chrome pre-installed
FROM apify/actor-node-playwright-chrome:20

# Set working directory
WORKDIR /app

# Skip Playwright browser download since they're pre-installed in the base image
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install pnpm globally as root
USER root
RUN npm install -g pnpm@10.13.1

# Copy only package files first for better caching
COPY --chown=myuser:myuser package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY --chown=myuser:myuser packages/mdream/package.json ./packages/mdream/
COPY --chown=myuser:myuser packages/crawl/package.json ./packages/crawl/

# Switch to myuser for dependency installation
USER myuser

# Install all dependencies including production dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code after dependencies are installed
COPY --chown=myuser:myuser packages/mdream/ ./packages/mdream/
COPY --chown=myuser:myuser packages/crawl/ ./packages/crawl/

# Build the packages
RUN cd packages/mdream && npx obuild && cd ../.. && \
    cd packages/crawl && npx obuild && cd ../..

# Set production environment after build
ENV NODE_ENV=production

# Ensure the crawl script is executable
USER root
RUN chmod +x /app/packages/crawl/bin/mdream-crawl.mjs

# Create a wrapper script to handle permissions
RUN printf '#!/bin/sh\n\
# Find output directory from args\n\
OUTPUT_DIR=""\n\
for arg in "$@"; do\n\
  case "$arg" in\n\
    --output=*) OUTPUT_DIR="${arg#*=}" ;;\n\
    -o=*) OUTPUT_DIR="${arg#*=}" ;;\n\
  esac\n\
done\n\
PREV_WAS_OUTPUT=false\n\
for arg in "$@"; do\n\
  if [ "$PREV_WAS_OUTPUT" = "true" ]; then\n\
    OUTPUT_DIR="$arg"\n\
    break\n\
  elif [ "$arg" = "--output" ] || [ "$arg" = "-o" ]; then\n\
    PREV_WAS_OUTPUT=true\n\
  fi\n\
done\n\
OUTPUT_DIR="${OUTPUT_DIR:-/app/output}"\n\
\n\
# Create output directory with proper permissions if it does not exist\n\
if [ ! -d "$OUTPUT_DIR" ]; then\n\
  mkdir -p "$OUTPUT_DIR"\n\
fi\n\
\n\
# Ensure myuser can write to the output directory\n\
chown -R myuser:myuser "$OUTPUT_DIR" 2>/dev/null || true\n\
chmod -R 755 "$OUTPUT_DIR" 2>/dev/null || true\n\
\n\
# Run the actual crawl command as myuser\n\
exec su - myuser -c "cd /app && /app/packages/crawl/bin/mdream-crawl.mjs $*"\n' > /usr/local/bin/mdream-wrapper.sh

RUN chmod +x /usr/local/bin/mdream-wrapper.sh

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DISPLAY=:99

# Set the entrypoint to the wrapper script to handle permissions
ENTRYPOINT ["/usr/local/bin/mdream-wrapper.sh"]
