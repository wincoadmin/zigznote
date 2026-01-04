# zigznote Development Governance

**Status:** Active
**Purpose:** Ensure principled development, minimize bugs, and maintain long-term code health

> This document defines how Claude Code operates when building zigznote. It enforces discipline, prevents "vibe coding," and creates maintainable, production-quality software.

---

## 1. Core Philosophy

> **Code is a liability. Ship the minimum correct code with clear ownership.**

Claude Code is a **development assistant**, not an autonomous builder. Every action must be:
- **Verifiable** — Tests prove correctness
- **Auditable** — Changes are documented
- **Reversible** — Commits are atomic and focused

---

## 2. Execution Principles

### 2.1 Read-First Rule (Mandatory)

Before making any changes, Claude Code must:
1. Read relevant existing files
2. Understand current patterns and conventions
3. Identify what already exists (prevent duplication)
4. Plan minimal changes needed

**Never assume.** Always verify by reading first.

### 2.2 Minimum Code Rule

Implement the **smallest correct solution** that satisfies requirements.

✅ **DO:**
- Solve the immediate problem
- Reuse existing patterns
- Keep functions focused

❌ **DON'T:**
- Add "future-proof" scaffolding
- Create unused abstractions
- Add libraries without justification

### 2.3 Complexity Budget

| Metric | Limit | Action if Exceeded |
|--------|-------|-------------------|
| Function length | 50 lines | Extract sub-functions |
| Function parameters | 4 params | Use options object |
| Nesting depth | 3 levels | Extract early returns |
| Cyclomatic complexity | 10 | Simplify logic |

### 2.4 File Size Guidance (Domain Cohesion > Line Counts)

File size is a **smell, not a rule**. The goal is **domain cohesion** — one file should own one responsibility completely.

**The Principle:**
```
Large file + ONE domain/responsibility → ✅ Fine (add ownership comment)
Large file + MULTIPLE responsibilities → 🚨 Split by responsibility
Small files + fragmented domain → 🚨 Worse than one big file
```

| Situation | Action |
|-----------|--------|
| Router with all domain routes (1000 LOC) | ✅ Keep together — one domain |
| Repository for one entity (800 LOC) | ✅ Keep together — one entity |
| Service handling one domain (600 LOC) | ✅ Keep together — add ownership comment |
| Controller mixing multiple domains | 🚨 Split by domain |
| "Utils" file with unrelated functions | 🚨 Split by purpose |
| Service doing business logic + HTTP calls + logging | 🚨 Split by responsibility |

### File Size Tiers (Guidance Only)

| Tier | LOC | Guidance |
|------|-----|----------|
| 🟢 **Green** | 0–200 | Ideal for most files |
| 🟡 **Yellow** | 200–400 | Fine if single responsibility — add ownership comment |
| 🔴 **Red** | 400–600 | Review: is this ONE domain? If yes, keep it |
| ⬛ **Black** | >600 | Ask: "Can I explain this file's purpose in one sentence?" If yes, keep it |

### When to Split

Split when you answer "yes" to any of these:
- Does this file handle multiple unrelated domains?
- Do different parts of this file change for different reasons?
- Is it hard to name this file because it does multiple things?
- Would tests for this file require mocking unrelated systems?

### When NOT to Split

Keep together when:
- File handles one entity/domain completely
- Splitting would require cross-file imports to understand one concept
- The file can be described in one sentence: "This handles all X operations"

### Ownership Comment (for files >400 LOC)

```typescript
/**
 * @ownership
 * @domain [Domain Name]
 * @description [One sentence: what this file does]
 * @single-responsibility YES — handles all [X] operations
 * @last-reviewed [Date]
 */
```

See PATTERNS.md for code templates and checklists.

---

## 3. Duplication Prevention Protocol

Before writing any code, verify:

- [ ] No duplicate React components with same purpose
- [ ] No duplicate API routes/endpoints
- [ ] No duplicate utility functions
- [ ] No duplicate type definitions
- [ ] No duplicate database queries
- [ ] No conflicting imports

### If Duplication Found

1. **STOP** — Do not write duplicate code
2. **IDENTIFY** — Find existing implementation
3. **REUSE** — Import and extend existing code
4. **REFACTOR** — If existing code needs changes, modify it (don't create alternative)

---

## 4. Error Handling Doctrine

### 4.1 All Errors Must Be Handled

Every piece of code must consider:
- What can fail?
- How will it fail gracefully?
- What does the user see?
- What do logs capture?

### 4.2 Error Hierarchy

```typescript
// All errors extend AppError
AppError (base)
├── ValidationError    // 400 - Bad input
├── AuthenticationError // 401 - Not logged in
├── AuthorizationError  // 403 - Not permitted
├── NotFoundError      // 404 - Resource missing
├── ConflictError      // 409 - Duplicate/conflict
├── RateLimitError     // 429 - Too many requests
└── InternalError      // 500 - Server error (logged, generic message to user)
```

### 4.3 Error Context Requirements

Every error must include:
- **Error code** — Machine-readable identifier
- **User message** — Safe, helpful, non-technical
- **Internal message** — Detailed for logging
- **Trace ID** — Links logs across services
- **Context** — Relevant data (sanitized)

### 4.4 Never Swallow Errors

```typescript
// ❌ FORBIDDEN
try {
  await riskyOperation();
} catch (e) {
  // silently ignored
}

// ✅ REQUIRED
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, traceId, context });
  throw new InternalError('Operation failed', { cause: error });
}
```

---

## 5. Testing Requirements

### 5.1 Coverage Targets

| Type | Target | Enforcement |
|------|--------|-------------|
| Unit tests | 80% | CI blocks if lower |
| Integration tests | Critical paths | Required for APIs |
| E2E tests | Happy paths | Required for user flows |

### 5.2 Test Quality Rules

Tests must be:
- **Deterministic** — Same result every run
- **Isolated** — No test depends on another
- **Fast** — Unit tests < 100ms each
- **Descriptive** — Name describes expected behavior

```typescript
// ✅ Good test name
it('should return 401 when access token is expired')

// ❌ Bad test name
it('test auth')
```

### 5.3 What Must Be Tested

| Component | Required Tests |
|-----------|---------------|
| API routes | Input validation, auth, happy path, error cases |
| Services | Business logic, edge cases |
| Database | Queries return expected data |
| React components | Renders, interactions, error states |
| Hooks | State changes, side effects |

### 5.4 Test-First for Complex Logic

For business logic, write tests first:
1. Write failing test expressing expected behavior
2. Implement minimum code to pass
3. Refactor if needed
4. Verify test still passes

---

## 6. Commit Protocol

### 6.1 Pre-Commit Checklist

Before every commit, verify:

- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] No console.logs left in code
- [ ] No commented-out code
- [ ] No TODO without issue reference
- [ ] Changes match commit message scope

### 6.2 Commit Message Format

```
<type>(<scope>): <imperative summary>

[optional body - what and why]

[optional footer - breaking changes, issue refs]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code change that neither fixes nor adds
- `test` — Adding/updating tests
- `docs` — Documentation only
- `chore` — Tooling, deps, configs
- `perf` — Performance improvement

**Examples:**
```
feat(meetings): add transcript search with vector similarity

fix(auth): refresh token before expiry to prevent logout

refactor(api): extract meeting service from controller
```

### 6.3 Atomic Commits

Each commit must:
- Address ONE concern
- Be independently revertable
- Not break the build
- Include related tests

❌ **Never bundle unrelated changes**

---

## 7. Phase Completion Protocol

At the end of each phase, create a completion file:

### PHASE_X_COMPLETE.md Structure

```markdown
# Phase X Complete

## Summary
Brief description of what was built.

## Files Created/Modified
- List of files with purpose

## Key Decisions
- Architecture choices made
- Trade-offs considered

## How to Verify
- Commands to run
- What to check

## Known Limitations
- What's not included
- Future improvements needed

## Dependencies for Next Phase
- What Phase X+1 needs from this phase

## Test Coverage
- Coverage percentage
- Critical paths tested
```

---

## 8. Debugging Workflow

When encountering bugs, follow this exact sequence:

### Step 1: Reproduce
- Identify exact steps to trigger bug
- Note error messages, logs, stack traces

### Step 2: Isolate
- Narrow down to smallest failing case
- Identify which component fails

### Step 3: Hypothesize (One at a Time)
- Form single hypothesis about cause
- Do NOT form multiple competing theories

### Step 4: Verify
- Prove or disprove hypothesis with evidence
- Check logs, database state, network calls

### Step 5: Fix
- Apply minimal fix to root cause
- Do NOT fix symptoms

### Step 6: Test
- Add test that would have caught this bug
- Verify fix doesn't break other tests

### Step 7: Document
- Add comment explaining why fix was needed
- Update docs if behavior changed

---

## 9. Security Principles

### 9.1 Secrets Handling

- **NEVER** commit secrets to code
- **NEVER** log sensitive data
- **NEVER** return secrets in API responses
- **ALWAYS** use environment variables
- **ALWAYS** use `.env.example` for documentation

### 9.2 Input Validation

```typescript
// ALL external input must be validated
// - User input (forms, params)
// - API responses (third-party)
// - Database results (when schema might change)
// - File uploads (type, size, content)
```

### 9.3 Authentication/Authorization

- Verify auth on EVERY protected route (middleware)
- Check resource ownership (can THIS user access THIS resource?)
- Use parameterized queries (prevent SQL injection)
- Sanitize output (prevent XSS)

---

## 10. Operational Traceability

### 10.1 Trace IDs

Every request gets a unique trace ID that follows it through:
- API logs
- Service calls
- Database queries
- Third-party API calls
- Error reports

### 10.2 Structured Logging

```typescript
// ✅ Good logging
logger.info('Meeting processed', {
  traceId,
  meetingId,
  duration: processingTime,
  transcriptLength
});

// ❌ Bad logging
console.log('done processing meeting ' + meetingId);
```

### 10.3 Error Tracking

All errors must be sent to Sentry with:
- Trace ID
- User context (sanitized)
- Request context
- Stack trace
- Custom tags (feature area, severity)

---

## 11. Ownership & Maintainability

### 11.1 Self-Documenting Code

Code should explain itself through:
- Descriptive names (not abbreviations)
- Small, focused functions
- Clear type definitions
- Logical file organization

### 11.2 Comments Explain WHY

```typescript
// ✅ Good comment - explains WHY
// Deepgram sometimes returns empty segments for silence > 3s
// Filter these to avoid UI gaps in transcript display
const validSegments = segments.filter(s => s.text.trim());

// ❌ Bad comment - explains WHAT (code already shows this)
// Filter segments
const validSegments = segments.filter(s => s.text.trim());
```

### 11.3 README per Major Folder

Each major folder should have a README explaining:
- What this folder contains
- Key files and their purpose
- How to extend/modify
- Common patterns used

---

## 12. Delete or Justify Rule

If code is written but not used:
- **DELETE IT** — Unused code is dangerous code
- Or **JUSTIFY IT** — Document why it must exist

No speculative code. No "might need this later."

---

## 13. Enforcement

This governance is enforced through:

| Mechanism | What It Catches |
|-----------|-----------------|
| TypeScript strict mode | Type errors, null issues |
| ESLint | Code quality, patterns |
| Prettier | Formatting consistency |
| Jest coverage | Untested code |
| Husky pre-commit | Lint/test before commit |
| CI pipeline | All of the above |
| Sentry | Production errors |
| Code review | Logic issues, architecture |

---

## Summary

**Before writing code:**
1. Read existing code
2. Check for duplicates
3. Plan minimal changes

**While writing code:**
4. Follow complexity limits
5. Handle all errors
6. Write tests alongside

**Before committing:**
7. Run all checks
8. Write clear commit message
9. Verify atomic scope

**After completing phase:**
10. Create completion document
11. Document known issues
12. Prepare handoff

---

**This document is law inside zigznote.**
