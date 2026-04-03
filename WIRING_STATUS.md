# WIRING_STATUS.md — Evidence-Backed Verification Ledger

**Last updated:** 2026-04-03
**Last verified against code:** 2026-04-03
**Updated by:** agent
**Update timing:** immediate when verification status changes
**Conflict rule:** code and evidence win over stale docs

---

## 1. Executive Verdict

- **Truly complete:** Full project redesign from Rust CLI to Next.js/TypeScript full-stack app. Build passes, TypeScript clean.
- **Partial:** All features are structurally present but runtime-unproven.
- **Fake-complete:** Nothing overtly fake. Import pipeline uses demo data (clearly placeholder).
- **Broken:** Nothing broken at build level.
- **Unproven:** Every runtime path. No tests. No CI.
- **Blocked:** Nothing blocked by external dependencies.

---

## 2. Build Verification

| Check | Result | Evidence |
|-------|--------|----------|
| `npx tsc --noEmit` | PASS (0 errors) | Run 2026-04-03 |
| `npx next build` | PASS (all 18 routes) | Run 2026-04-03 |
| `npx prisma validate` | PASS | Run 2026-04-03 |
| `npx prisma db push` | PASS (dev.db created) | Run 2026-04-03 |

---

## 3. Route Inventory

### Pages (10):
| Route | Type | Status |
|-------|------|--------|
| `/` | Static | Landing page |
| `/dashboard` | Static | Project list |
| `/settings` | Static | Settings |
| `/projects/new` | Static | Create wizard |
| `/projects/[id]` | Dynamic | Project overview |
| `/projects/[id]/graph` | Dynamic | Graph editor |
| `/projects/[id]/schema` | Dynamic | Schema editor |
| `/projects/[id]/artifacts` | Dynamic | Artifact viewer |
| `/projects/[id]/validation` | Dynamic | Validation center |
| `/projects/[id]/import` | Dynamic | Import wizard |

### API Routes (8):
| Route | Methods | Status |
|-------|---------|--------|
| `/api/projects` | GET, POST | Prisma CRUD |
| `/api/projects/[id]` | GET, PUT, DELETE | Prisma CRUD |
| `/api/schemas` | POST | Prisma create |
| `/api/schemas/[id]` | GET, PUT, DELETE | Prisma CRUD |
| `/api/schemas/[id]/validate` | POST | Validation engine |
| `/api/schemas/[id]/generate` | POST | Codegen engine |
| `/api/ai` | POST | OpenRouter streaming |

---

## 4. Subsystem Status

| Subsystem | Files | Build Status | Runtime Status |
|-----------|-------|-------------|----------------|
| App Shell (layout) | 5 | PASS | NOT PROVEN |
| Graph Editor (9 nodes) | 11 | PASS | NOT PROVEN |
| Create Wizard | 4 | PASS | NOT PROVEN |
| Validation Engine (5 validators) | 7 | PASS | NOT PROVEN |
| Codegen Engine (5 generators) | 8 | PASS | NOT PROVEN |
| AI Provider (OpenRouter) | 5 | PASS | NOT PROVEN |
| API Routes | 8 | PASS | NOT PROVEN |
| Zustand Stores | 3 | PASS | NOT PROVEN |
| Domain Types | 3 | PASS | N/A (types only) |
| Prisma Schema | 1 | VALIDATED | DB pushed |

---

## 5. What Is Not Proven

- Every user-facing interaction
- AI provider connectivity (requires API key)
- Database CRUD through API routes
- Graph editor rendering and interactions
- Validation engine correctness
- Codegen output correctness
- Import pipeline (demo data only)
- Schema ↔ Graph sync
- Streaming AI responses
- All client-side state management

---

## 6. Result Classification

**STATICALLY VERIFIED** — TypeScript type check and Next.js production build pass. Zero runtime proof exists.
