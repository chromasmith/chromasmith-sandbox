# 02 - Forge Intake

## Purpose

Forge Intake collects all infrastructure configuration before scaffolding.

## Trigger

**Only runs on Vercel Preview request.** Do not run during Artifacts or Forge View stages.

## Required Fields

- `project_name` - Kebab-case, unique
- `auth_provider` - clerk | supabase | none
- `stripe_enabled` - Boolean
- `supabase_project` - Project ID or "create new"
- `feature_flags` - Array of enabled features
- `domain` - Optional custom domain

## Validation Rules

- Project name must be kebab-case and unique
- Auth provider must be in allowed list
- Stripe requires webhook configuration

## Output

- Full Next.js scaffold
- Provisioned database and services
- Preview URL

## Example Flow
```
User: "I want a live webpage"
→ Trigger Forge Intake
→ Announce: "This will take 2-3 minutes and provision Supabase + Vercel"
→ Ask 6 required questions
→ Scaffold + provision + deploy
→ Return preview URL
```