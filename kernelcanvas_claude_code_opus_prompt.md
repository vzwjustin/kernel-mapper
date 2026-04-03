# KernelCanvas — Claude Code Opus Build Prompt

```text
You are Claude Code running with an Opus-class reasoning model.
Act as a principal engineer, product architect, and implementation lead.

Build a production-grade AI-powered Linux kernel ↔ userspace API designer/builder named KernelCanvas.

You are not here to brainstorm vaguely.
You are here to design the architecture, make grounded engineering decisions, and then build the codebase in an implementation-first way.

==================================================
HOW YOU MUST OPERATE
==================================================

You must work like a serious repo builder.

Rules:
- Think in phases, but implement continuously.
- Do not stop at high-level architecture unless blocked by a hard dependency.
- Prefer maintainable, production-friendly choices over clever ones.
- Keep files focused and boundaries clean.
- Type everything strictly.
- No fake demo logic pretending to be real.
- No silent assumptions without stating them.
- No black-box AI mutations.
- Every AI-originated schema change must be diff-based and inspectable.
- The source of truth must be a versioned schema, not generated code.

When making decisions:
- Prioritize stable userspace contracts.
- Treat kernel internals as changeable implementation details.
- Prefer Generic Netlink as the first-class transport for phase 1.
- Treat ioctl/char-device support as a later expansion unless clearly needed.

When outputting work:
- First give the architecture and build plan.
- Then start creating the actual codebase structure and core files.
- Continue generating real files and implementations rather than stopping early.

==================================================
PROJECT
==================================================

Project name:
KernelCanvas

Core idea:
A visual + AI-assisted builder that lets a developer:

1. Describe a Linux kernel/userspace API in plain English
2. Have AI convert that into a typed schema and graph model
3. Visually edit the API in a drag-and-drop node graph
4. Generate kernel/userspace scaffolding, docs, tests, and examples
5. Validate ABI safety, wiring completeness, permissions, and maintainability
6. Import an existing codebase and reconstruct the current boundary surface

This is intended for real systems and kernel-adjacent engineering, not toy workflows.

==================================================
PRIMARY PRODUCT GOAL
==================================================

Build a full-stack application where the user can:

- prompt the system with a desired API
- receive a schema draft
- receive a graph draft
- inspect assumptions and warnings
- visually edit nodes and edges
- inspect generated artifacts live
- run validation
- compare schema versions
- import existing code and reconstruct likely command/event/type surfaces
- use AI to refine, explain, audit, and repair the design

==================================================
NON-NEGOTIABLE ARCHITECTURAL PRINCIPLES
==================================================

1. Schema-first
   The canonical source of truth is a versioned schema.
   All generation flows from the schema.

2. UAPI-first
   The userspace contract is the product.
   Internal kernel structures must not be treated as stable API.

3. AI-with-guardrails
   AI may propose changes, patches, explanations, and audits.
   AI may not silently change persisted state.
   All AI patches must be shown as diffs before apply.

4. Deterministic codegen
   Generated artifacts must be deterministic from:
   - schema version
   - generator version
   - generation target options

5. Pluggable subsystems
   The platform must be designed so transports, validators, generators, and AI providers can expand later without major rewrites.

==================================================
MANDATORY STACK
==================================================

Frontend:
- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- React Flow
- Zustand or Redux Toolkit
- Monaco editor
- Zod
- TanStack Query
- Framer Motion only where it improves UX without clutter

Backend:
- TypeScript
- Next.js server routes or a clearly justified service split
- Postgres
- Prisma
- Redis if useful
- BullMQ or equivalent for queued jobs if needed

AI/provider layer:
- OpenRouter as primary gateway
- abstraction layer for future providers
- streaming support
- structured output support
- tool-calling support
- per-task model routing
- fallback logic
- retries/timeouts
- usage/cost accounting hooks

Analysis / import layer:
- Tree-sitter for parsing C/C++/Rust/TS
- ripgrep for code search
- optional deeper parsing layer separated cleanly for future expansion

Linux/UAPI scope:
Phase 1:
- Generic Netlink first-class
Phase 2:
- char device + ioctl
Phase 3:
- richer import analysis, eBPF-aware extensions, compatibility helpers

==================================================
WHAT THE PRODUCT MUST CONTAIN
==================================================

A. Create-from-prompt workflow
The user describes the interface they want in natural language.
The system proposes:
- transport choice
- command set
- request/response types
- event types
- permission model
- versioning strategy
- warnings and assumptions

B. Visual graph editor
The user can edit the API through custom graph nodes.

C. Generated artifacts
The system generates:
- schema JSON/YAML
- markdown docs
- TypeScript userspace client
- C UAPI headers
- Generic Netlink-oriented kernel scaffolding
- example CLI
- test scaffolding
- validation reports
- schema diff summaries

D. Validation engine
It must detect:
- schema problems
- ABI/UAPI break risks
- missing handlers
- missing userspace bindings
- missing event flows
- permission/security gaps
- weak extensibility choices
- naming and design inconsistencies

E. Import mode
The user points the app at an existing repo or folder.
The system reconstructs a likely boundary surface and highlights uncertainty.

==================================================
DOMAIN MODEL REQUIREMENTS
==================================================

Design strong domain models for:

Project
- id
- name
- description
- createdAt
- updatedAt
- generatorVersion
- targetKernelRange
- targetUserspaceLanguages

ApiSchema
- version
- transport
- namespace/family
- summary
- compatibilityPolicy
- permissionsModel
- notes

Commands
- id
- name
- description
- requestType
- responseType
- interaction style
- privilege requirements
- idempotency
- failure modes
- introducedVersion
- deprecated flag
- replacement command

Events
- id
- name
- payloadType
- subscription model
- delivery notes
- filtering support
- rate limits
- introducedVersion

Types
- struct
- enum
- flags
- scalar
- nested
- arrays
- optional fields
- opaque handles where justified
- reserved future extension fields
- validation rules

Permissions
- capability requirements
- namespace requirements
- unprivileged/privileged notes
- policy guidance

Compatibility metadata
- forward/backward compatibility notes
- field evolution rules
- deprecation lifecycle
- reserved padding or extension strategy

Generated artifact records
- file path
- type
- schema source version
- generator version
- warnings

==================================================
GRAPH EDITOR REQUIREMENTS
==================================================

Use React Flow and build a polished custom node system.

Required node types:
- API root
- transport
- command
- event
- request struct
- response struct
- enum/flags
- field
- permission
- validator
- compatibility/version
- kernel handler
- userspace binding
- docs/example
- warning/issue
- import-discovered node

Editor capabilities:
- drag/drop creation
- connect/disconnect
- inline editing
- reorder fields
- duplicate nodes
- collapse/expand
- minimap
- search/filter
- undo/redo
- dirty tracking
- autosave
- diff highlights
- validation badges
- traceability from schema nodes to generated files and back

Layout:
Left panel:
- project explorer
- schema entities
- artifact list
- validation list

Center:
- graph canvas

Right:
- properties
- AI suggestions
- generated code preview

Bottom:
- logs
- AI/tool trace
- warnings
- diff summary

==================================================
AI MODES
==================================================

Implement these modes:

1. Build from prompt
2. Edit by instruction
3. Explain design choices
4. Audit current schema/design
5. Import and reconstruct
6. Repair broken or incomplete wiring

For AI changes:
- always produce structured output
- always produce a human-readable explanation
- always produce a diff summary
- never auto-apply without explicit server-side validation

==================================================
OPENROUTER / PROVIDER LAYER
==================================================

Build a provider abstraction.

Suggested interface:

AIProvider
- chat()
- stream()
- generateStructured()
- callWithTools()
- estimateCost()
- listModels()
- healthCheck()

Implement OpenRouterProvider first.

Support:
- secure server-side API key use
- model profiles by task
- fallback profiles
- structured JSON schema validation
- cancellation
- partial streaming to UI
- request/response redaction-aware logging

Suggested task routing:
- lighter model for UI micro-edits and naming
- stronger reasoning model for architecture and audits
- stronger code-capable model for codegen review and repair
- optional judge model to validate high-impact patches

==================================================
TOOL-CALLING SURFACES FOR AI
==================================================

Implement internal tools the model can call, such as:
- read_current_schema
- update_schema_patch
- diff_schema_versions
- list_generated_artifacts
- run_validation_suite
- inspect_graph_node
- search_code_index
- import_repo_summary
- explain_validation_error
- regenerate_artifacts
- get_transport_guidelines
- get_compatibility_rules

Important:
AI does not write directly to the database.
AI proposes structured tool invocations.
The server validates them.

==================================================
VALIDATION ENGINE
==================================================

Build a serious validation engine with machine-readable findings.

Validation groups:

1. Schema validity
- duplicate ids
- illegal cycles
- missing references
- invalid types
- invalid metadata

2. ABI/UAPI safety
- unsafe field removal
- incompatible field changes
- layout-sensitive risk
- enum reuse
- reserved field misuse
- impossible evolution
- missing extension path

3. Wiring completeness
- command without handler stub
- event without subscription flow
- userspace binding missing
- docs missing
- tests missing for risky areas

4. Security / privilege
- ambiguous privilege policy
- event leakage risk
- namespace ambiguity
- unsafe inbound validation
- dangerous assumptions in generated patterns

5. Developer quality
- naming collisions
- duplicated types
- over-nested structures
- inconsistent response models
- confusing contract design

Each finding must include:
- id/code
- severity
- confidence
- explanation
- suggested fix
- impacted nodes/files

==================================================
GENERATION REQUIREMENTS
==================================================

Generate real artifacts from schema.

Phase 1 targets:
- schema JSON/YAML
- markdown docs
- TypeScript client
- C UAPI headers
- Generic Netlink-oriented kernel scaffold
- example CLI
- tests scaffold
- validation report
- diff/changelog summary

Rules:
- deterministic generation
- preserve manual sections
- generator/version headers in generated files
- no hidden rewrite of manual code

Use a protected manual region format like:
BEGIN MANUAL SECTION <name>
END MANUAL SECTION <name>

==================================================
IMPORT MODE REQUIREMENTS
==================================================

Implement an importer pipeline:

1. file discovery
2. parsing/index build
3. symbol extraction
4. boundary candidate detection
5. schema reconstruction
6. confidence scoring
7. missing-wiring report

Importer should look for:
- likely uapi headers
- ioctl definitions
- netlink families/attrs/ops
- request/response structs
- event flows
- userspace call sites
- mismatches between exposed types and handler surfaces

Uncertain mappings must be clearly labeled in UI.

==================================================
UX QUALITY BAR
==================================================

This must feel premium and power-user friendly.
Think Figma + IDE + API designer, but restrained and practical.

Need:
- great dark mode
- good light mode
- crisp spacing
- good typography
- keyboard support
- polished interactions
- low clutter
- sensible defaults

Must include screens for:
- landing
- dashboard
- create-from-prompt wizard
- graph designer
- schema editor
- artifact viewer
- validation center
- import wizard
- provider/settings panel
- version diff viewer

==================================================
CREATE-FROM-PROMPT WIZARD
==================================================

Build a wizard that asks for the right design constraints before generation.

Wizard stages:
1. What are you building?
   - networking control plane
   - telemetry/stats API
   - driver/device control API
   - event stream API
   - custom

2. Interaction style
   - request/response
   - events
   - streaming
   - mixed

3. Privilege model
   - admin only
   - mixed privileged/unprivileged
   - namespace aware
   - custom

4. Stability expectations
   - experimental
   - internal-only
   - stable userspace contract

5. Generation target
   - schema only
   - docs + client
   - full scaffold + docs + tests

==================================================
VERSIONING / HISTORY
==================================================

Support:
- immutable schema versions
- machine-readable diffs
- human diff viewer
- safe/risky/breaking classification
- rollback
- compare any versions

==================================================
SECURITY / OPERATIONS
==================================================

Need:
- secret redaction
- no provider key exposure to client
- rate limiting
- audit trail for AI-applied diffs
- project-level access control ready design
- safe error handling
- size limits for imports
- schema patch validation on server

==================================================
TESTING REQUIREMENTS
==================================================

Implement a real test strategy:
- unit tests for schema model and validators
- unit tests for codegen
- unit tests for AI patch application
- integration tests for build-from-prompt
- integration tests for graph edit -> regen
- integration tests for OpenRouter provider wrapper
- importer tests on sample C codebases
- end-to-end tests for major UI workflows

==================================================
DELIVERABLES
==================================================

Produce:
1. architecture overview
2. folder structure
3. schema/domain types
4. database schema
5. provider layer design
6. graph node system design
7. validation engine design
8. importer design
9. phased implementation plan
10. then begin generating the actual codebase

Do not stop at ideas only.
Build the codebase.

==================================================
IMPLEMENTATION ORDER
==================================================

Phase A
- app shell
- persistence
- schema core
- graph editor core
- OpenRouter provider layer
- create-from-prompt flow

Phase B
- schema diffing
- validation engine v1
- generated docs/client/headers
- artifact viewer
- AI edit-with-diff flow

Phase C
- netlink scaffold generator
- importer v1 with Tree-sitter plumbing
- missing wiring report
- richer audit mode

Phase D
- advanced validation
- stronger importer
- manual section preservation refinements
- version compare UI
- performance tuning

==================================================
OUTPUT FORMAT
==================================================

Your response must begin with:

1. System architecture overview
2. Folder structure
3. Core domain model
4. Database schema
5. Provider integration design
6. Graph editor design
7. Validation engine design
8. Import pipeline design
9. Phased implementation plan

Then start generating the actual codebase files and content.

When uncertain, choose the most maintainable production-ready option and state the assumption clearly.
```
