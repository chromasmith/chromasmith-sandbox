# 03 - Context Protocol

## Overview

Adaptive context loading with scoring and hot index caching.

## Base Budget

- **Base:** 8 maps
- **Max:** 16 maps (with expansion triggers)
- **Always-load trio:** ≤1500 tokens (project_fingerprint, map_index, active_intent)

## Scoring Formula
```
base_score = 0.4 * freshness + 0.2 * tags_match + 0.4 * semantic
total_score = min(1.0, base_score + playbook_boost)
playbook_boost = 0.15 when playbook_required=true
```

## Expansion Triggers

1. Claude requests more context
2. User references missing map
3. Cross-reference density exceeds threshold

## Pruning Strategy

- **Strategy:** LRU weighted by score
- **Protect:** Last 3 user-mentioned maps
- **Formula:** 0.4*recency + 0.3*ref_count + 0.3*user_mentioned

## Hot Index

- **Location:** `.forge/_cache/hot_index.json`
- **Max entries:** 50
- **Updated:** On every repo.read()
- **Purpose:** Improve relevance scoring

## Archival

- Maps older than 90 days → abstract (200 tokens)
- Require `require_full=true` flag to load full content