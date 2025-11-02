# 10 - Upgrade Packs (Pillar 4)

## Status

**PLANNED** - Implementation staged for post-T3

## Concept

Modular extensions that add capabilities without core schema modification.

## Structure
```
.forge/packs/
├── analytics-pack/
│   ├── manifest.json
│   ├── verbs.yml
│   ├── schemas/
│   └── migrations/
└── INDEX.json
```

## Operations

- `provision_pack(name)` - Install pack
- `remove_pack(name)` - Uninstall pack
- Pack INDEX tracks installed packs

## Rules

1. Packs cannot modify core schemas without migrations
2. Pack removal must be reversible
3. Dependencies resolved via pack manifest
4. Pack namespaces prevent collisions

## Examples

- **analytics-pack** - PostHog, Mixpanel integration
- **payments-pack** - Stripe, payment flows
- **content-pack** - CMS, scheduling
- **auth-pack** - SSO, MFA