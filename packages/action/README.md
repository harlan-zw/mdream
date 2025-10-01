# @mdream/action

GitHub Action for generating `llms.txt` artifacts from HTML files.

This action processes HTML files using glob patterns to generate LLM-ready artifacts in CI/CD workflows. Useful for prerendered sites, it creates both condensed and comprehensive LLM-ready files that can be uploaded as artifacts or deployed with your site whenever you make changes.

## Usage

### Complete Workflow Example

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
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build documentation
        run: npm run build

      - name: Generate llms.txt artifacts
        uses: harlan-zw/mdream@main
        with:
          glob: 'dist/**/*.html'
          site-name: My Documentation
          description: Comprehensive technical documentation and guides
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

      - name: Deploy to GitHub Pages (optional)
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Inputs

See [action.yml](../../action.yml) for all available options and advanced configuration.

## License

[MIT](../../LICENSE.md)
