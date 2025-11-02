# 01 - Viewing Stages

## Progressive Disclosure Pattern

Forge Flow uses four viewing stages to progressively increase commitment:

### Stage 1: Artifacts
- **Cost:** Zero files, zero infrastructure
- **Speed:** Instant
- **Use Case:** Quick mockups and ideation
- **Output:** Rendered in Claude's artifact viewer

### Stage 2: Forge View
- **Cost:** Lightweight GitHub repo, components only
- **Speed:** ~30 seconds
- **Trigger:** Explicit command "show me in Forge View"
- **Requires:** User confirmation for repo name (temp or real)
- **Output:** Live preview URL on ForgeView VM

### Stage 3: Vercel Preview
- **Cost:** Full scaffold, infrastructure provisioned
- **Speed:** 2-3 minutes
- **Trigger:** Explicit command "deploy preview" or "live webpage"
- **Requires:** Forge Intake interview
- **Output:** Public preview URL

### Stage 4: Production
- **Cost:** Public domain, production resources
- **Speed:** ~1 minute
- **Trigger:** Explicit command "ship" or "go live"
- **Requires:** Final confirmation
- **Output:** Production URL at custom domain

## Key Principles

1. **Never auto-create infrastructure** - Requires explicit confirmation
2. **Progressive commitment** - Each stage builds on previous
3. **Transparent costs** - Announce timing and resources up front
4. **Safe exploration** - Temp projects for experimentation