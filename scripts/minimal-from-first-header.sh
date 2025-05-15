mkdir -p .output

curl -s https://www.bbc.com/news/world | node ./bin/mdream.mjs --origin https://www.bbc.com  | tee .output/bbc-markdown.md
curl -s https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide | node ./bin/mdream.mjs --origin https://developer.mozilla.org | tee .output/mdn-markdown.md
curl -s https://www.nasa.gov/missions/ | node ./bin/mdream.mjs --origin https://www.nasa.gov | tee .output/nasa-markdown.md
curl -s https://www.allrecipes.com/recipe/24059/creamy-rice-pudding/ | node ./bin/mdream.mjs --origin https://www.allrecipes.com | tee .output/allrecipes-markdown.md
curl -s https://github.com/torvalds | node ./bin/mdream.mjs --origin https://github.com | tee .output/github-markdown.md
curl -s https://news.ycombinator.com | node ./bin/mdream.mjs --origin https://news.ycombinator.com | tee .output/hackernews-markdown.md

curl -s https://harlanzw.com | node ./bin/mdream.mjs --origin https://harlanzw.com | tee .output/harlanzw-markdown.md
curl -s https://nuxt.com/docs/getting-started/installation | node ./bin/mdream.mjs --origin https://nuxt.com | tee .output/nuxt-markdown.md
curl -s https://vercel.com/docs/getting-started-with-vercel | node ./bin/mdream.mjs --origin https://vercel.com | tee .output/vercel-markdown.md

# broken fetching
# curl -s https://stackoverflow.com/questions/tagged/javascript | node ./bin/mdream.mjs --origin https://stackoverflow.com | tee .output/stackoverflow-markdown.md
# curl -s https://www.amazon.com/best-sellers-books-Amazon/zgbs/books | node ./bin/mdream.mjs --origin https://www.amazon.com | tee .output/amazon-markdown.md
# curl -s https://arxiv.org/list/cs.AI/recent | node ./bin/mdream.mjs --origin https://arxiv.org | tee .output/arxiv-markdown.md
