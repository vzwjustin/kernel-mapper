# context.md — Project Truth and Architecture

This file contains current project memory. It is not behavior policy (see `CLAUDE.md`).
It is not verification status (see `WIRING_STATUS.md`).
It is not lessons learned (see `learnings.md`).

**Last updated:** 2026-04-03
**Last verified against code:** 2026-04-03
**Updated by:** agent
**Update timing:** immediate when architecture, boundaries, or invariants change
**Conflict rule:** code and evidence win over stale docs

---

## 1. Project Overview

**KernelCanvas** is a full-stack AI-powered Linux kernel ↔ userspace API designer/builder. It allows developers to:

1. Describe a Linux kernel/userspace API in plain English
2. Have AI convert that into a typed schema and graph model
3. Visually edit the API in a drag-and-drop node graph (React Flow)
4. Generate kernel/userspace scaffolding, docs, tests, and examples
5. Validate ABI safety, wiring completeness, permissions, and maintainability
6. Import an existing codebase and reconstruct the current boundary surface

**Previously:** This repo was `kmap`, a Rust CLI tool parsing Linux kernel source into SQLite. It was completely redesigned into KernelCanvas on 2026-04-03.

**License:** MIT

---

## 2. Repo Shape

```
kernel-mapper/
├── package.json          # Next.js 16 + TypeScript project
├── tsconfig.json
├── next.config.ts
├── prisma/
│   └── schema.prisma     # 12 models: Project, ApiSchema, Command, Event, TypeDef, etc.
├── prisma.config.ts      # Prisma v7 config (SQLite datasource)
├── .env                  # DATABASE_URL=file:./dev.db
└── src/
    ├── app/
    │   ├── layout.tsx              # Root layout with AppShell + Providers
    │   ├── page.tsx                # Landing page
    │   ├── globals.css             # Tailwind v4 + shadcn theme
    │   ├── dashboard/page.tsx      # Project list
    │   ├── settings/page.tsx       # API key + model config
    │   ├── projects/
    │   │   ├── new/page.tsx        # Create-from-prompt wizard
    │   │   └── [id]/
    │   │       ├── layout.tsx      # Project tab navigation
    │   │       ├── page.tsx        # Project overview
    │   │       ├── graph/page.tsx  # React Flow graph editor
    │   │       ├── schema/page.tsx # Monaco schema editor
    │   │       ├── artifacts/page.tsx
    │   │       ├── validation/page.tsx
    │   │       └── import/page.tsx
    │   └── api/
    │       ├── projects/route.ts        # GET/POST projects
    │       ├── projects/[id]/route.ts   # GET/PUT/DELETE project
    │       ├── schemas/route.ts         # POST schema
    │       ├── schemas/[id]/route.ts    # GET/PUT/DELETE schema
    │       ├── schemas/[id]/validate/route.ts
    │       ├── schemas/[id]/generate/route.ts
    │       └── ai/route.ts             # AI interaction (streaming)
    ├── components/
    │   ├── layout/         # AppShell, Header, LeftPanel, RightPanel, BottomPanel
    │   ├── graph/          # GraphCanvas, NodePalette, 8 custom node types
    │   ├── wizard/         # CreateWizard, WizardStep, OptionCard, GenerationPreview
    │   ├── providers.tsx   # QueryClientProvider
    │   └── ui/             # 20 shadcn/ui components
    ├── lib/
    │   ├── prisma.ts       # PrismaClient singleton (libsql adapter)
    │   ├── utils.ts        # shadcn cn() helper
    │   ├── ai/             # OpenRouter provider, task router, tools, prompts
    │   ├── validation/     # 5 validators + engine (schema, ABI, wiring, security, quality)
    │   └── codegen/        # 5 generators + engine (JSON, Markdown, C header, TS client, kernel scaffold)
    ├── stores/             # Zustand: project-store, graph-store, ui-store
    └── types/              # domain.ts, graph.ts, api.ts
```

**Total TypeScript/TSX:** 88 source files
**Stack:** Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui v4 + React Flow + Zustand + Prisma v7 + SQLite

---

## 3. Key Dependencies

| Package | Purpose |
|---------|---------|
| next 16.2 | App framework (App Router) |
| @xyflow/react | Graph editor (React Flow v12) |
| zustand | Client state management |
| @tanstack/react-query | Server state / data fetching |
| prisma 7 + @prisma/client | ORM + database |
| @prisma/adapter-libsql | SQLite driver adapter for Prisma v7 |
| zod | Schema validation (API routes) |
| @monaco-editor/react | Code editor |
| framer-motion | Animations |
| shadcn/ui | UI component library |
| lucide-react | Icons |

---

## 4. Architectural Boundaries

### Layer structure:

```
Pages (app/**/page.tsx)
  ↓ uses
Components (components/**)     ← React UI
  ↓ reads/writes
Stores (stores/*.ts)           ← Zustand client state
  ↓ fetches from
API Routes (app/api/**)        ← Next.js server routes
  ↓ calls
Libraries (lib/**)             ← Validation, codegen, AI provider
  ↓ persists to
Database (Prisma + SQLite)     ← Source of truth
```

### Key boundaries:

- **Frontend → API:** All data flows through Next.js API routes. No direct DB access from client.
- **AI provider → OpenRouter:** Server-side only. API key never exposed to client.
- **Schema → Codegen:** Generators receive structured schema, produce artifact strings.
- **Schema → Validation:** Validators receive schema, produce findings array.
- **Graph ↔ Schema:** Zustand stores manage sync between React Flow graph and schema data.

---

## 5. Source of Truth

| Area | Source of truth |
|------|----------------|
| Database schema | `prisma/schema.prisma` (12 models) |
| Domain types | `src/types/domain.ts` |
| Graph types | `src/types/graph.ts` |
| API contracts | `src/types/api.ts` + Zod schemas in routes |
| Validation rules | `src/lib/validation/*.ts` |
| Codegen templates | `src/lib/codegen/*.ts` |
| AI prompts/tools | `src/lib/ai/prompts.ts` + `src/lib/ai/tools.ts` |
| UI state | Zustand stores in `src/stores/` |

---

## 6. Database Models (Prisma)

12 models: Project, ApiSchema, Command, Event, TypeDef, TypeField, EnumVariant, Permission, GeneratedArtifact, ValidationFinding, SchemaVersion, AiInteraction

Key relationships:
- Project → ApiSchema (1:many)
- ApiSchema → Command, Event, TypeDef, Permission (1:many each)
- Command → TypeDef (FK: requestTypeId, responseTypeId)
- Event → TypeDef (FK: payloadTypeId)
- TypeDef → TypeField, EnumVariant (1:many each)
- Cascade deletes on Project → all children

---

## 7. Validation Engine

5 validator groups, 30+ rules:
- **Schema Validity** (V001-V010): duplicates, missing refs, cycles, empties
- **ABI Safety** (A001-A006): field removal, enum reuse, reserved fields, deprecation
- **Wiring Completeness** (W001-W006): missing types, orphaned types, permission gaps
- **Security** (S001-S005): missing privileges, data leakage, DoS risk
- **Developer Quality** (Q001-Q005): naming, nesting, complexity, collisions

---

## 8. Codegen Engine

5 generators:
- **SCHEMA_JSON**: Full schema as JSON
- **MARKDOWN_DOCS**: API documentation in Markdown
- **C_UAPI_HEADER**: Linux UAPI header with include guards, enums, attrs
- **TS_CLIENT**: TypeScript client with types and factory
- **KERNEL_SCAFFOLD**: Generic Netlink kernel module (.c file)

All generators follow Linux kernel conventions (SCREAMING_SNAKE_CASE, SPDX, BEGIN/END MANUAL SECTION).

---

## 9. Known State

### Working:
- Build passes (`next build` succeeds)
- TypeScript passes (`tsc --noEmit` zero errors)
- All 18 routes registered (10 pages + 8 API routes)
- Prisma schema validated and DB pushed
- All 88 source files compile

### Not yet wired / runtime-tested:
- No tests exist
- No runtime validation of any feature
- AI provider not tested (requires OpenRouter API key)
- Import pipeline is mock/demo data
- Graph ↔ Schema sync not fully wired
- No CI/CD

---

## 10. Architectural Principles (from KernelCanvas design)

1. **Schema-first:** Versioned schema is source of truth. All generation flows from schema.
2. **UAPI-first:** Userspace contract is the product. Kernel internals are changeable.
3. **AI-with-guardrails:** AI proposes diffs, never auto-applies. All patches inspectable.
4. **Deterministic codegen:** Same schema + generator version = same output.
5. **Pluggable subsystems:** Transports, validators, generators, AI providers are extensible.
