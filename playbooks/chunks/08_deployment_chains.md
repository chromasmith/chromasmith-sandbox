# 08 - Deployment Chains

## Source App Development
```
Forge Flow → Forge Map → Forge Intake → Source Apps → GitHub
```

**Key:** No production config in source apps (enforced by CI)

## App-Forge Scaffold

Transforms pristine source templates into deployment-ready apps:

1. Copy source template
2. Apply company branding
3. Configure environment
4. Inject production config

## Visual Iteration Loop
```
Code change → GitHub push → Webhook → ForgeView pull → PM2 reload → Ladle render
```

**Speed:** < 10 seconds from commit to live preview

## Branch Strategy

- `feature/*` → dev (integration test, ForgeView update)
- `dev` → main (all tests pass, QA approval, Vercel production deploy)

## Webhook Flow

**GitHub → ForgeView:**
1. Push event sent to ForgeView webhook listener
2. HMAC-SHA256 signature verification
3. Branch and org validation
4. `git pull` execution
5. PM2 zero-downtime reload
6. Component rendered in Ladle

**Port:** 9000 (public on ForgeView only)