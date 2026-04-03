# KernelCanvas

An AI-powered Linux kernel/userspace API designer and builder. Design Generic Netlink interfaces visually, validate ABI safety, and generate production-ready kernel module scaffolding, C UAPI headers, and TypeScript clients.

## What It Does

1. **Describe** a kernel/userspace API in plain English
2. **Generate** a typed schema via AI (OpenRouter)
3. **Edit** the API visually in a drag-and-drop node graph
4. **Validate** ABI safety, wiring completeness, security, and quality (30+ rules)
5. **Generate** C UAPI headers, kernel module scaffolding, TypeScript clients, and docs
6. **Import** existing kernel source to reconstruct API boundary surfaces

## Features

### Visual Graph Editor
React Flow-based node graph with custom node types for commands, events, structs, enums, permissions, and transport configuration. Drag-and-drop creation, inline editing, minimap, and validation badges.

### AI-Powered Design
- **Build from prompt** — describe your API, get a complete schema
- **Edit by instruction** — modify schemas with natural language
- **Explain** — understand design choices and kernel conventions
- **Audit** — automated schema review across 7 dimensions
- **Import & reconstruct** — reverse-engineer schemas from C source
- **Repair** — diagnose and fix broken wiring

### Validation Engine
5 validator groups with 30+ rules:

| Group | What it checks |
|-------|---------------|
| Schema Validity | Duplicate names, missing refs, cycles, empty schemas |
| ABI Safety | Field removal, enum reordering, missing reserved fields, deprecation |
| Wiring Completeness | Missing request/response types, orphaned types, permission gaps |
| Security | Missing privileges, MULTICAST data leakage, unbounded inputs |
| Developer Quality | Naming consistency, nesting depth, struct complexity |

### Code Generation
Deterministic generators producing real, production-quality artifacts:

- **C UAPI Header** — include guards, attribute enums, multicast groups, following kernel conventions
- **Kernel Module Scaffold** — Generic Netlink `genl_ops`, `nla_policy`, `doit` handlers, module init/exit
- **TypeScript Client** — typed interfaces, client factory, transport abstraction
- **Markdown Docs** — full API documentation with field tables
- **Schema JSON** — canonical machine-readable schema

Generated kernel code follows Linux coding style with `BEGIN/END MANUAL SECTION` markers for safe regeneration.

### Create-from-Prompt Wizard
7-stage guided flow:
1. What are you building? (networking, telemetry, driver, event stream, custom)
2. Describe your API (natural language)
3. Interaction style (request/response, events, streaming, mixed)
4. Privilege model (admin, mixed, namespace-aware)
5. Stability expectations (experimental, internal, stable UAPI)
6. Generation targets (schema only, docs + client, full scaffold)
7. Review and generate

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS v4, shadcn/ui |
| Graph Editor | React Flow (@xyflow/react) |
| State | Zustand |
| Data Fetching | TanStack Query |
| Database | Prisma v7 + SQLite |
| Code Editor | Monaco Editor |
| AI Provider | OpenRouter (configurable models per task) |
| Animations | Framer Motion |

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Setup

```sh
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env to add your OpenRouter API key

# Initialize database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

Set your OpenRouter API key in Settings (`/settings`) or via the `.env` file:

```
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

Model routing is configurable per task type (build, edit, explain, audit, import, repair).

## Project Structure

```
src/
  app/                          # Next.js App Router pages + API routes
    api/                        # REST API (projects, schemas, validation, codegen, AI)
    dashboard/                  # Project list
    projects/[id]/              # Project views (graph, schema, artifacts, validation, import)
    settings/                   # API key + model configuration
  components/
    graph/                      # React Flow canvas + 8 custom node types
    layout/                     # App shell (header, sidebars, bottom panel)
    wizard/                     # Create-from-prompt wizard
    ui/                         # shadcn/ui components
  lib/
    ai/                         # OpenRouter provider, task router, tools, system prompts
    codegen/                    # 5 artifact generators + engine
    validation/                 # 5 validator groups + engine
    prisma.ts                   # Database client
  stores/                       # Zustand (project, graph, UI state)
  types/                        # Domain models, graph types, API contracts
prisma/
  schema.prisma                 # 12 database models
```

## Database Models

| Model | Purpose |
|-------|---------|
| Project | Top-level container with kernel range and target languages |
| ApiSchema | Versioned schema with transport, namespace, family |
| Command | API commands with request/response types and privilege requirements |
| Event | Multicast/unicast events with payload types |
| TypeDef | Structs, enums, flags, scalars |
| TypeField | Struct fields with type, optional, reserved flags |
| EnumVariant | Enum/flag values |
| Permission | Capability requirements (CAP_NET_ADMIN, etc.) |
| GeneratedArtifact | Generated code/docs with version tracking |
| ValidationFinding | Validation results with severity and suggested fixes |
| SchemaVersion | Immutable schema snapshots with diffs |
| AiInteraction | AI conversation history with cost tracking |

## Architectural Principles

1. **Schema-first** — the versioned schema is the source of truth; all generation flows from it
2. **UAPI-first** — the userspace contract is the product; kernel internals are changeable
3. **AI-with-guardrails** — AI proposes diffs, never auto-applies; all patches are inspectable
4. **Deterministic codegen** — same schema + generator version = same output
5. **Pluggable subsystems** — transports, validators, generators, and AI providers are extensible

## Phase 1 Scope (Current)

- Generic Netlink as first-class transport
- Schema creation, editing, validation, and generation
- 5 artifact generators (C header, kernel scaffold, TS client, markdown, JSON)
- OpenRouter AI integration with streaming
- Visual graph editor with 8 node types

### Planned

- **Phase 2:** char device + ioctl support, schema diffing UI, richer import analysis
- **Phase 3:** eBPF-aware extensions, compatibility helpers, Tree-sitter import pipeline
- **Phase 4:** Advanced validation, version compare UI, performance tuning

## License

MIT
