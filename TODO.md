**MVP**

- Implement Pruning 

> Pruning discards less relevant nodes based on text density, link density, and tag importance. It’s a heuristic-based approach—if certain sections appear too “thin” or too “spammy,” they’re pruned.

    prune_filter = PruningContentFilter(
        # Lower → more content retained, higher → more content pruned
        threshold=0.45,           
        # "fixed" or "dynamic"
        threshold_type="dynamic",  
        # Ignore nodes with <5 words
        min_word_threshold=5      
    )

- Crawler CLI mode

  - tight integration with crawlee.dev (https://crawlee.dev/js/docs/introduction/adding-urls)
  - will require a new package 


Maybe
- add https://en.wikipedia.org/wiki/Okapi_BM25 support
