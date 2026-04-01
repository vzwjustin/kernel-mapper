# Universal Repo Governance Master Prompt

You are auditing this repository and creating or replacing four core repo-governance files:

1. `CLAUDE.md`
2. `context.md`
3. `WIRING_STATUS.md`
4. `learnings.md`

Your job is to inspect the repository first, then build these files so future agent sessions are more correct, less lazy, less hallucination-prone, less likely to drift, less likely to claim success without proof, less likely to dismiss newly surfaced breakage as “unrelated” without evidence, and more capable of learning from repeated mistakes over time.

This is not a generic template exercise.
This is not a fluffy documentation task.
This is not a one-bug workaround.

You must produce serious repo-grade files that are universal enough to stay useful as the repo evolves, while still being grounded in the real codebase you inspect.

## PRIMARY GOAL

Create a repo memory and operating system for future agent work:

- `CLAUDE.md` = non-negotiable operating rules and behavior policy
- `context.md` = current project truth, architecture, assumptions, boundaries, invariants, and known state
- `WIRING_STATUS.md` = evidence-backed status ledger for what is proven complete, partial, broken, contradicted, blocked, or unproven
- `learnings.md` = reusable lessons, recurring failure patterns, anti-patterns, debugging heuristics, and “do not repeat this mistake” knowledge

These files must work together as one system.

## HARD REQUIREMENT: START WITH REAL INSPECTION

Before writing any of the four files, inspect the repository and determine as much as possible about:

- primary languages
- build systems
- package managers
- lint/typecheck/test/static-analysis commands
- repo layout
- monorepo traits if any
- generated files
- large files
- plugin/module/registration systems
- daemon/service/API/UI/CLI boundaries
- kernel/userspace boundaries if present
- config-heavy or feature-flag-heavy areas
- whether an existing `CLAUDE.md`, `context.md`, `WIRING_STATUS.md`, or `learnings.md` already exists
- whether git history is available
- whether syntax-aware tools like `ast-grep` are available
- whether the repo appears to have:
  - partial fixes
  - stale assumptions
  - fake-complete paths
  - dead code
  - weak verification
  - incomplete runtime proof
  - incomplete registration/build wiring
  - one-sided contract changes
  - agents historically dismissing adjacent failures as “unrelated”
  - exposed-but-unresolved failures that block correctness or verification
  - repeated bug shapes or recurring implementation mistakes
  - repeated refactor drift
  - incomplete cleanup/error-path handling
  - status docs that drift away from code reality

Do not invent repo commands that do not exist.
Do not claim tools are configured unless you found evidence.
Do not copy old weak files blindly.

If any of the four files already exist:
- read them
- evaluate them critically
- preserve only what is still good
- replace weak, stale, vague, or misleading sections

## NON-NEGOTIABLE REPO MEMORY MODEL

The four files you create must explicitly work together like this:

### `CLAUDE.md`
Defines how the agent must behave.

### `context.md`
Defines what is currently believed to be true about the project:
- architecture
- responsibilities
- boundaries
- invariants
- source-of-truth areas
- known state
- known risks
- current assumptions

### `WIRING_STATUS.md`
Defines what has actually been verified:
- complete
- partial
- broken
- contradicted
- blocked
- unproven
- needs runtime validation

### `learnings.md`
Defines what the repo has taught over time:
- recurring failure patterns
- dangerous assumptions
- anti-patterns that caused bugs
- debugging lessons
- patterns of fake-complete work
- lessons from regressions
- lessons from verification failures
- lessons future agents should actively apply

This memory model must be explicit inside the generated `CLAUDE.md`.

## NON-NEGOTIABLE STARTUP SEQUENCE

The generated `CLAUDE.md` must explicitly say that the following happens immediately when it is read:

1. `CLAUDE.md` is loaded as active operating policy
2. `context.md` is read if present
3. `WIRING_STATUS.md` is read if present
4. `learnings.md` is read if present
5. current code reality is compared against docs before trusting them
6. code and evidence win over stale docs when they conflict

This startup flow must be prominent and non-negotiable.

The generated `CLAUDE.md` must clearly say:
- these rules are active immediately when read
- they override lazy/minimal/superficial default behavior
- they cannot be selectively ignored later
- they must be followed before planning, editing, refactoring, fixing, or reporting completion

## SELF-LEARNING / LESSON CAPTURE REQUIREMENT

The generated `CLAUDE.md` must explicitly require future sessions to capture important reusable lessons into `learnings.md`.

It must clearly say:
- when a bug reveals a recurring pattern, add the lesson
- when a false assumption causes wasted work, add the lesson
- when a verification failure exposes a recurring weakness, add the lesson
- when a refactor reveals a dangerous anti-pattern, add the lesson
- when a status or context file was wrong in a repeatable way, add the lesson
- when a class of “fake-complete” behavior is discovered, add the lesson
- do not dump raw noise into `learnings.md`
- only record lessons likely to matter again
- write lessons as reusable guidance, not one-off diary notes

The generated `CLAUDE.md` must make clear:
- `context.md` is for current truth
- `WIRING_STATUS.md` is for current proof/status
- `learnings.md` is for transferable lessons and repeated failure prevention

## REPO MEMORY MAINTENANCE RULE

The generated `CLAUDE.md` must explicitly require future agent sessions to keep repo memory files current when repository reality changes.

It must clearly say:

- when architecture, boundaries, source-of-truth files, invariants, assumptions, or known project state change, update `context.md`
- when a fix is verified, downgraded, contradicted, blocked, or newly unproven, update `WIRING_STATUS.md`
- when a subsystem moves from unproven to partial, partial to complete, complete to contradicted, or verified to blocked, record that change
- when a reusable lesson emerges, update `learnings.md`
- do not leave stale claims in any memory file once current code or verification evidence disproves them
- do not preserve optimistic status text just because it was already written
- if a task changes repo truth or verified status, memory files must be updated before calling the work complete, unless explicitly deferred and called out
- if verification was not performed, `WIRING_STATUS.md` must reflect that honestly
- `context.md` stores current project truth and assumptions
- `WIRING_STATUS.md` stores evidence-backed verification status, not hopes or guesses
- `learnings.md` stores reusable lessons, not current-state claims
- if a task changes project truth, verification status, or reusable lessons, updating the relevant memory files is part of completion, not optional follow-up

## OWNERSHIP / STALENESS CONVENTION

The generated non-policy files must include lightweight metadata describing:
- purpose
- who may update them: human, agent, or shared
- expected update timing: immediate, per session, or batched when explicitly deferred
- last updated date
- last verified against code date
- freshness or confidence note where useful
- conflict rule: code and evidence win over stale docs

The generated `CLAUDE.md` must instruct future sessions to treat stale dates as distrust signals rather than cosmetic metadata.
If docs are stale, that should increase verification pressure.
If docs are contradicted by code, that contradiction should be surfaced and, when reusable, recorded in `learnings.md`.

## SUB-AGENT / MULTI-FILE RULE

The generated `CLAUDE.md` must include a strong rule for large tasks:

- for tasks touching more than 5 independent files, use sub-agents in parallel if available
- each agent should own a bounded slice, roughly 5 to 8 files per agent when independence exists
- each agent must have a clearly scoped objective
- each agent must verify its own batch before results are merged
- if sub-agents are not available, emulate the same discipline with phased batching
- do not process large independent multi-file work as one giant sequential blur

This rule must be framed as mandatory behavior, not a soft suggestion.

## LARGE FILE / CHUNKED READ RULE

The generated `CLAUDE.md` must include a non-negotiable large-file reading policy:

- do not assume one file read captured a large file
- for files over a meaningful size threshold, such as >500 lines or any file likely to exceed tool limits, read in chunks
- when tooling has truncation or token limits, use sequential offset/limit chunk reads
- do not edit against unseen portions of a large file
- after long conversations, re-read files before editing instead of trusting memory

This must be explicit.

## SEARCH DISCIPLINE REQUIREMENT

The generated `CLAUDE.md` must require strong search discipline:

- syntax-aware search first when available
- text search as backup and cross-check
- no trust in one grep result
- separate searches for:
  - direct calls
  - indirect calls
  - type references
  - string references
  - config references
  - build references
  - registration references
  - exports/imports/re-exports
  - tests/mocks
  - init/startup references
  - teardown/cleanup references

If `ast-grep` is available, the file should name it as a preferred structural search tool.
But it must remain usable even if `ast-grep` is absent.

## GIT / COMMIT RULE

The generated `CLAUDE.md` must instruct future agents to use git history as supporting evidence when available:

- inspect diffs, not just commit messages
- distinguish claimed fixes from currently verified truth
- check whether later commits weakened, bypassed, or changed the same path

But it must clearly state:
- commit history is evidence of change
- commit history is not proof of correctness by itself

## VERIFICATION RULE

The generated `CLAUDE.md` must forbid claiming success until the strongest applicable repo-native checks have been run.

It must clearly distinguish:
- edited
- built
- linted
- typechecked
- tested
- runtime-validated
- fully verified

It must require honesty when some proof is missing.

It must never allow a generic “done” when work is only partially validated.

## CONTRACT / STATE / WIRING RULE

The generated `CLAUDE.md` must require checking both sides of:
- APIs
- interfaces
- payloads
- registrations
- callbacks
- dispatch tables
- build inclusion
- feature flags
- state ownership
- lifetime/cleanup
- cross-layer boundaries

This must stay broad enough to apply to:
- frontend repos
- backend repos
- monorepos
- CLI tools
- daemons
- services
- API servers
- systems code
- kernel-adjacent code
- mixed repos

## STUB / FAKE-COMPLETE RULE

The generated `CLAUDE.md` must aggressively warn against:
- TODO-backed critical paths
- placeholder returns
- no-op handlers
- fake success paths
- dead code that looks real
- abandoned registrations
- compile-only partial implementations
- code present only for appearance

## NO SCOPE-DODGING / RELATEDNESS RULE

The generated `CLAUDE.md` must explicitly forbid dismissing errors, regressions, warnings, verification failures, or downstream fallout as “unrelated” without proof.

It must require the agent to treat newly surfaced issues as potentially related until proven otherwise.

It must clearly say:

- do not dismiss a failing build, failing test, contract mismatch, runtime error, registration break, state inconsistency, warning spike, downstream regression, or newly surfaced bug as “not related” just because it was not the original task
- if the issue appears in a touched file, touched subsystem, dependency chain, call chain, contract boundary, build path, runtime path, or verification path, it must be investigated as potentially related
- if an issue surfaced only after the change, assume possible relation until disproven
- if a hidden pre-existing issue is exposed by the change, treat it as relevant to completion status even if it predates the edit
- do not use “pre-existing” as an excuse to ignore something that now blocks correctness, verification, build success, runtime behavior, or confidence in the result
- do not use scope language to escape hard debugging when adjacency, dependency fallout, or verification impact exists

The generated `CLAUDE.md` must require surfaced issues to be classified into one of these buckets:

1. DIRECTLY CAUSED BY THE CHANGE
2. INDIRECTLY EXPOSED BY THE CHANGE
3. PRE-EXISTING BUT NOW BLOCKING CORRECTNESS OR VERIFICATION
4. TRULY UNRELATED, WITH EVIDENCE

It must explicitly require that “TRULY UNRELATED” can only be used if supported by concrete evidence.

It must also require future completion reports to include:
- issues discovered during the work
- how they were classified
- whether they block verification
- whether they prevent calling the task complete

## ROOT-CAUSE REASONING RULE

The generated `CLAUDE.md` must require root-cause pressure for non-trivial issues.

It must clearly say:

- for any non-trivial bug, regression, wiring gap, state inconsistency, repeated failure, verification failure, or cross-layer mismatch, do a brief 5 Whys analysis or equivalent root-cause drill-down
- do not stop at the first symptom-level explanation
- do not accept a guard, null check, retry, fallback, or conditional as sufficient if the enabling cause remains unexamined
- if the root cause cannot be fully proven, explicitly separate:
  - confirmed cause
  - suspected enabling cause
  - symptom-only mitigation
  - unresolved uncertainty

The file must also say:
- do not turn 5 Whys into ritual for tiny trivial edits
- use it where it meaningfully reduces false confidence and catches incomplete fixes

## WHAT-IF / EDGE-CASE CHALLENGE RULE

The generated `CLAUDE.md` must require a brief What If sweep for non-trivial changes.

It must clearly say that for meaningful fixes, refactors, interface changes, wiring changes, or state changes, the agent must challenge the work with questions like:

- what if the input is partial, stale, invalid, or out of order
- what if registration never happens
- what if cleanup fails
- what if downstream still expects the old contract
- what if the fix only works on the happy path
- what if retry/timeout/error paths still break
- what if the change exposes a hidden pre-existing fault
- what if state ownership assumptions are wrong
- what if build inclusion exists but runtime reachability does not

It must also say:
- this is meant to catch blind spots, not create ceremony
- use it to test confidence in non-trivial work, especially around wiring, contracts, state, cleanup, and adjacent fallout

## CONTRADICTION TRACKING RULE

The generated `CLAUDE.md` must require future sessions to actively track contradictions between:
- docs and code
- status files and code
- commit history and current reality
- assumptions and evidence
- “complete” claims and failed verification

It must clearly say:
- contradictions must be surfaced, not silently reconciled
- when evidence conflicts, say so explicitly
- unresolved contradictions should be reflected in `WIRING_STATUS.md`
- repeated contradiction patterns should become lessons in `learnings.md`

## CONFIDENCE DISCIPLINE RULE

The generated `CLAUDE.md` must explicitly discourage fake certainty.

It must require the agent to separate:
- PROVEN
- PARTIALLY PROVEN
- NOT PROVEN
- CONTRADICTED
- BLOCKED
- NEEDS RUNTIME VALIDATION

It must forbid vague confidence phrases like:
- “looks good”
- “seems fine”
- “probably unrelated”
- “should work”
- “appears complete”

unless backed by real evidence.

## REPORTING RULE

The generated `CLAUDE.md` must require future completion reports to include:
- files changed
- why they changed
- checks run
- which checks passed
- what remains unverified
- remaining risks
- whether runtime proof is missing
- any surfaced issues and how they were classified
- whether any surfaced issue blocks full completion
- whether the result is:
  - edited only
  - statically verified
  - tested
  - runtime-validated
  - partially verified
  - blocked
- whether `context.md` was updated
- whether `WIRING_STATUS.md` was updated
- whether `learnings.md` was updated
- if any were not updated, why not

It must forbid empty “done” claims.

## WHAT `context.md` MUST CONTAIN

Create a strong `context.md` that captures the repo’s current truth without turning into a stale bug graveyard.

It must be written as current project memory, not behavior policy.

It should include sections like:

1. Project Overview
- what the project is
- what it appears to do
- high-level architecture

2. Repo Shape
- major directories
- major components
- main languages/tools/frameworks
- build/test/tooling notes

3. Architectural Boundaries
- subsystem boundaries
- layer boundaries
- service/API/UI/CLI/kernel/userspace/plugin/module boundaries if present

4. Boundary Catalog
For the actual boundaries in this project, capture specific instances rather than only generic classes.
Use a table or structured list with fields such as:
- boundary name
- source side
- destination side
- what crosses the boundary: data, control, config, commands, events, files, protocol messages, SQL, rendered output, etc.
- format or protocol
- validation/escaping/normalization requirements
- idempotency or sequencing considerations
- source-of-truth owner
- last verified against code

The goal is to make the actual project boundaries explicit so future agents do not have to rediscover them from scratch.

5. Source of Truth
- which files/areas appear to own key logic
- which components are canonical for contracts/config/state

6. Current Known Invariants
- assumptions that appear architecturally important
- ownership/lifetime rules
- cross-layer constraints
- protocol or state invariants if visible

7. Behavioral Invariants
Document behavior-level truths, not just structure.
Include things like:
- operations that must be idempotent
- operations that are intentionally not safe to repeat
- sequencing requirements
- required preconditions
- destructive vs additive vs replace-in-place behavior
- retry semantics
- cleanup / rollback expectations
- user-visible ordering assumptions
- “safe once, unsafe twice” or “must happen before X” constraints

This section should help prevent bugs caused by doing the right thing in the wrong order or assuming repeatability where it does not exist.

8. Known Risks / Watch Areas
- risky areas
- likely incomplete areas
- historically fragile-looking areas
- places where verification matters most
- places where adjacent fallout or “unrelated” claims would be dangerous

9. Current Known State
- what appears wired
- what appears partial
- what is not yet proven
- what still needs validation

10. Root-Cause Watchpoints
- recurring failure shapes
- places where symptom-only fixes would be dangerous
- areas where repeated 5 Whys / What If pressure is likely valuable

11. Do Not Confuse With Status
A short section making clear that `context.md` contains project truth and assumptions, while `WIRING_STATUS.md` contains evidence-backed verification status, and `learnings.md` contains reusable lessons.

`context.md` must stay broad, durable, and readable.
Do not cram it with every temporary bug detail.
Do not make it a dumping ground for random observations.

## WHAT `WIRING_STATUS.md` MUST CONTAIN

Create a strong `WIRING_STATUS.md` that functions as an evidence ledger.

It must be concrete, blunt, and verification-oriented.

Use this structure:

# WIRING_STATUS.md

## 1. Executive Verdict
Blunt summary of:
- what is truly complete
- what is partial
- what is fake-complete
- what is broken
- what remains unproven
- what is blocked by surfaced failures

## 2. Source Inputs
- CLAUDE.md reviewed: yes/no
- context.md reviewed: yes/no
- previous WIRING_STATUS.md reviewed: yes/no
- learnings.md reviewed: yes/no
- git history consulted: yes/no
- other critical docs consulted
- contradictions found between docs and code

## 3. Verification Coverage Map
For each major subsystem or important claim, identify what kinds of proof exist:
- code-read proof
- search/reachability proof
- build proof
- test proof
- runtime proof
- commit/history proof
- missing proof types

This section should make it obvious whether something is merely inspected or actually proven.

## 4. Subsystem Inventory
For each major subsystem:
- name
- purpose
- key files
- entry points
- boundaries crossed
- status: COMPLETE / PARTIAL / STUBBED / DEAD / INCONSISTENT / BLOCKED / UNPROVEN
- confidence: HIGH / MEDIUM / LOW

## 5. Reachability Chains
For important subsystems, show actual chains:
entry point -> intermediate layers -> handler -> state mutation -> output/effect

Mark where chains are:
- complete
- partial
- broken
- blocked
- unproven

## 6. Fix Verification Table
For claimed or discovered fixes:
- fix name
- original failure mode
- relevant commits if known
- root cause addressed? yes/no/partial
- changed files
- reachable after fix? yes/no/unknown
- regression risk
- surfaced adjacent issues
- verdict: VERIFIED / PARTIAL / NOT PROVEN / BROKEN / BLOCKED

## 7. Surfaced Issue Classification
For issues discovered during inspection or verification:
- issue name
- where it appeared
- classification:
  - DIRECTLY CAUSED BY THE CHANGE
  - INDIRECTLY EXPOSED BY THE CHANGE
  - PRE-EXISTING BUT NOW BLOCKING CORRECTNESS OR VERIFICATION
  - TRULY UNRELATED, WITH EVIDENCE
- evidence
- does it block full verification? yes/no
- does it block completion? yes/no

## 8. Root-Cause / What-If Findings
For important failures, gaps, or risky subsystems:
- issue or subsystem
- brief 5 Whys summary or equivalent root-cause chain
- what was confirmed vs suspected
- key What If risks that remain
- whether the current fix is root-cause-level, symptom-level, or mixed

## 9. Build / Registration / Inclusion Proof
List:
- build inclusion proof
- registration proof
- export/import proof
- feature-flag proof
- anything present but not actually included

## 10. Contract and Invariant Check
List:
- mismatched contracts
- one-sided API changes
- ownership mistakes
- state invariant violations
- boundary mismatches

## 11. Missing or Incomplete Wiring
List concrete gaps:
- missing registration
- missing propagation
- missing call site
- ignored return path
- missing cleanup
- missing config wiring
- missing tests
- dead code pretending to be active
- runtime path absent
- build inclusion absent

## 12. Stub / Dead Code Report
List:
- dead code
- unreachable paths
- no-op handlers
- TODO-backed critical logic
- fake success paths
- placeholder implementations

## 13. Fix Log
Keep a chronological verification-oriented log, not a generic changelog.
For each entry record:
- date
- commit or reference if available
- subsystem or boundary touched
- what was broken
- what was changed
- verification level achieved
- current standing: VERIFIED / PARTIAL / CONTRADICTED / REGRESSED / BLOCKED

This is meant to make regression patterns and repeated bug categories visible across sessions.

## 14. Verified Working
Only items actually proven.

## 15. Verified Partial
Items clearly present but not end-to-end complete.

## 16. Verified Broken
Items proven broken.

## 17. Blocked
Items whose verification or completion is blocked by surfaced failures or unresolved adjacent issues.

## 18. Not Proven
Items that may exist but are not yet provable.

## 19. Needs Runtime Validation
Items structurally plausible but lacking runtime proof.

## 20. Highest-Value Next Actions
Rank the next steps that would reduce uncertainty most.

## 21. Evidence Appendix
For important claims include:
- file path
- symbol/function/type/subsystem name
- why it matters
- line numbers if available
- commit reference if relevant

The file must use explicit evidence language like:
- PROVEN
- PARTIALLY PROVEN
- NOT PROVEN
- CONTRADICTED BY CODE
- BLOCKED BY MISSING RUNTIME EVIDENCE
- BLOCKED BY SURFACED FAILURE

Do not let it become vague.

## WHAT `learnings.md` MUST CONTAIN

Create a strong `learnings.md` that captures reusable lessons without becoming random notes.

It should include sections like:

1. Project-Specific Patterns
- repeated bug shapes unique to this repo
- common incomplete-fix patterns in this architecture
- repeated contract mistakes in this codebase
- repeated wiring failures in this repo
- “when you touch X in this repo, always check Y” lessons

2. Universal Heuristics
Capture portable lessons that apply beyond this repo, such as:
- whenever external parsed data enters a structured output format, verify escaping
- whenever an operation can be triggered repeatedly, verify idempotency
- whenever a boundary transforms data, verify both format and ownership expectations
- whenever a change is build-clean but not runtime-proven, do not overclaim
- whenever a fix exposes a pre-existing issue, classify it instead of dismissing it

These should be written as reusable heuristics, not diary notes.

3. Dangerous Assumptions
- assumptions that caused wrong edits
- assumptions that caused false confidence
- assumptions that repeatedly failed

4. Verification Lessons
- checks that caught important issues
- checks that were missing when they should have existed
- patterns where “build passes” still hid failure

5. Refactor Lessons
- ways refactors drifted
- partial-migration traps
- boundaries commonly forgotten
- files or layers that tend to get missed

6. Search Lessons
- where grep was misleading
- where syntax-aware search was necessary
- where dynamic/config/build references mattered more than direct calls

7. Scope / Relatedness Lessons
- cases where “unrelated” turned out to be wrong
- adjacency patterns that usually matter
- build/test/runtime fallout patterns that future agents should not dismiss

8. Root-Cause Lessons
- places where symptom-only fixes were misleading
- recurring enabling causes
- good root-cause heuristics for this repo

9. Practical Heuristics
- short reusable rules future agents should apply
- “always check X when changing Y” style lessons
- “do not trust Z without verification” style lessons

The file must be:
- reusable
- concise
- high-signal
- lesson-oriented
- not a diary
- not a status file
- not a duplicate of `context.md` or `WIRING_STATUS.md`

## WHAT `CLAUDE.md` MUST CONTAIN

Create a strict, readable, non-bloated policy file with strong headings and numbered rules.

It must include sections covering:

1. Bootstrap / Startup Rules
2. Repo Memory Loading Order
3. Operating Philosophy
4. Pre-Work Discipline
5. Phase / Scope Discipline
6. Verification Requirements
7. Search Discipline
8. Large File / Context Decay Discipline
9. Edit Safety
10. Refactor / Architecture Discipline
11. Contract / State / Wiring Discipline
12. Stub / Dead Code / Fake-Complete Detection
13. No Scope-Dodging / Relatedness Discipline
14. Root-Cause / 5 Whys Discipline
15. What-If / Edge-Case Discipline
16. Git / Commit Awareness
17. Contradiction / Confidence Discipline
18. Reporting Rules
19. Repo Memory Maintenance Rules
20. Lesson Capture Rules

Inside it, make sure all of these are explicit:
- rules are active immediately when read
- rules are non-negotiable
- repo memory files are read at startup
- code wins over stale docs
- large multi-file tasks over 5 independent files require sub-agents or phased batches
- large files must be read in chunks when needed
- future agents must re-read files before editing after long conversations
- success cannot be claimed without real verification
- commit history is supporting evidence only
- reports must separate edited vs verified vs runtime-validated
- surfaced issues must not be dismissed as unrelated without proof
- surfaced issues must be classified and reported
- non-trivial bugs and regressions require brief root-cause reasoning
- non-trivial changes require a brief What If sweep
- reusable lessons must be captured into `learnings.md`

## TONE REQUIREMENTS

All four files must be:
- direct
- strict
- readable
- structured
- easy to scan
- not fluffy
- not vague
- not stuffed with motivational filler
- not written like a blog post

## IMPORTANT CONSTRAINTS

- do not invent commands that do not exist
- do not invent tooling that is not present
- do not overfit these files to one temporary bug
- do not stuff `CLAUDE.md` with fast-changing repo facts
- do not make `context.md` a stale issue graveyard
- do not make `WIRING_STATUS.md` vague
- do not make `learnings.md` a noisy diary
- do not skip the 5+ file sub-agent / batching rule
- do not skip the large-file chunk-read rule
- do not skip the content-memory startup model
- do not skip verification/reporting discipline
- do not skip the no-scope-dodging rule
- do not allow “unrelated” or “pre-existing” to function as unproven escape hatches
- do not turn 5 Whys or What If into useless ceremony for trivial edits

## OUTPUT FORMAT

Your final output must contain exactly these sections:

### A. Repo Traits Detected
A concise summary of what you found:
- languages
- build/test/tooling shape
- architecture shape
- important boundaries
- available search/history tools
- important limits or uncertainties

### B. Full `CLAUDE.md`
Output the complete file in one block, ready to save.

### C. Full `context.md`
Output the complete file in one block, ready to save.

### D. Full `WIRING_STATUS.md`
Output the complete file in one block, ready to save.

### E. Full `learnings.md`
Output the complete file in one block, ready to save.

### F. Short Closing Note
Briefly explain:
- what was intentionally kept broad
- what was adapted to this repo specifically
- what future sessions should update in `context.md`
- what future sessions should update in `WIRING_STATUS.md`
- what future sessions should update in `learnings.md`

## QUALITY BAR

The final result should feel like:
- a serious repo operating manual
- a project memory system
- a verification ledger
- a reusable lessons system
- a guardrail against lazy edits, stale assumptions, fake-complete wiring, false “done” claims, and scope-dodging through “unrelated” excuses

Assume this repo has a history of:
- partial fixes
- stale assumptions
- fake-complete paths
- weak verification
- agents incorrectly dismissing adjacent breakage as unrelated
- repeated failure patterns that were not being captured as lessons

Now inspect the repository and produce:
- a new `CLAUDE.md`
- a new `context.md`
- a new `WIRING_STATUS.md`
- a new `learnings.md`
