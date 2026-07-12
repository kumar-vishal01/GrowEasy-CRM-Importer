# GrowEasy CSV Importer — Pre-Submission Production-Readiness Audit

**Scope:** full review of the codebase in `groweasy/backend` and `groweasy/frontend` as delivered after Prompt 2 (Build), plus the `GroqProvider` added since. Fixes marked **[APPLIED]** are already in this codebase; fixes marked **[RECOMMENDED]** are documented with a diff but not applied, to keep the change surface reviewable.

---

## 0. Critical — read this first

**A live Groq API key (`GROQ_API_KEY=gsk_...`) was found committed in `backend/.env` in the uploaded project.** This has been removed from the working copy delivered here, and `.env` was already correctly listed in `.gitignore` (so it likely never reached a public repo) — but the key passed through this upload in plaintext, which should be treated as a compromised credential regardless.

**Action required before submission:** rotate/regenerate this key in the Groq console and never place a real key value in a file that gets zipped, emailed, or pasted anywhere — `.env.example` should always contain empty/placeholder values only, which is how it's set up in this project.

---

## 1. Code Review

### 1.1 Bugs found and fixed

**[APPLIED] No timeout on LLM provider HTTP calls.** Both `OpenAIProvider.mapBatch` and `GroqProvider.mapBatch` called `fetch()` with no timeout. A single hung request would occupy a concurrency-limited worker slot (`batchProcessor.ts`, `concurrencyLimit: 4`) indefinitely, stalling the rest of the import with no way to recover except a client-side timeout the code didn't have either.

```diff
- import { LLMProvider, LLMProviderError, RawRow } from "./LLMProvider";
+ import { LLMProvider, LLMProviderError, RawRow, fetchWithTimeout } from "./LLMProvider";
  ...
- response = await fetch(OPENAI_API_URL, { ... });
+ response = await fetchWithTimeout(OPENAI_API_URL, { ... });
```
A shared `fetchWithTimeout` helper (30s default, `LLM_REQUEST_TIMEOUT_MS`-configurable) was added to `LLMProvider.ts`, using `AbortController`, and surfaces a timeout as a **retryable** `LLMProviderError` — so it flows through the existing exponential-backoff retry path with zero changes needed there.

**[APPLIED] Rate limiter memory leak.** `rateLimiter.ts`'s in-memory `Map<ip, bucket>` never removed old entries — every distinct IP ever seen stayed in memory for the life of the process. Added a lazy sweep (every 5 minutes) that drops expired buckets. Fine for a single-instance deployment; a multi-instance deployment still needs a Redis-backed limiter (documented, not built — out of scope for this app's stated architecture).

**[APPLIED] Frontend MIME-type check rejected valid CSVs.** `validateFile()` only allowed `file.type` of exactly `"text/csv"`, `"application/vnd.ms-excel"`, or `""`. In practice browsers report inconsistent MIME types for `.csv` depending on OS (`text/plain`, `application/csv`, etc.), so a real CSV could be rejected purely based on which browser/OS exported it. Changed to trust the `.csv` extension as authoritative and only reject a small denylist of obviously-wrong types (images, PDFs, actual `.xlsx`).

**[APPLIED] Duplicate CSV headers caused silent data loss.** PapaParse's `header: true` mode uses the header string as the object key per row — two columns both named `"Phone"` means one of them silently overwrites the other with no error or warning. Added a duplicate-header check in `csvParser.ts` (frontend) that rejects the file with a clear, actionable message instead.

**[APPLIED] No CSV/formula-injection protection on free-text fields.** Blueprint (Prompt 1) called for this; it was not implemented. `validator.ts` now defuses any free-text field (`name`, `company`, `crm_note`, `description`, etc.) that begins with `=`, `+`, `-`, or `@` by prefixing a `'`, neutralizing spreadsheet-formula execution if this data is ever exported to Excel/Sheets by the CRM downstream.

### 1.2 Type-safety gaps

- `MockProvider.ts` and `OpenAIProvider.ts`/`GroqProvider.ts` use `as never` / `as Record<string, unknown>` casts to loop-assign heterogeneous `CrmRecord` fields. This is a deliberate, contained pattern (the alternative is 15 repetitive assignment lines) but it does mean a typo in a field name inside the loop wouldn't be caught by the compiler. **[RECOMMENDED]**: the new unit test suite (see §5) asserts all 15 keys exist on every mapped record, which is the practical safety net for this pattern.
- `SkippedRecord.reason` includes `"invalid_row_shape"` in its type union, but no code path currently throws it — `validateAndSanitizeRecord` only ever returns `null` with `"missing_email_and_mobile"`. **[RECOMMENDED]**: either remove the unused variant or wire up a real case.

### 1.3 Unhandled edge cases

See §3 for the full edge-case audit table.

### 1.4 Inconsistent error handling

- `importController.ts` catches only around `processAllBatches`; if `getLLMProvider()` itself threw, it would propagate as an unhandled rejection rather than a clean 500. In practice `providerFactory.ts` already guards this by falling back to `MockProvider` on missing API keys, so the risk is low, but it's not defended by a try/catch at the call site. **[RECOMMENDED]**: wrap `getLLMProvider()` in the same try/catch as the batch processing call.

### 1.5 Readability / maintainability

- `OpenAIProvider.ts` and `GroqProvider.ts` are ~90% identical (same prompt-building, same retry/error mapping, same response parsing — only the base URL, header shape, and default model differ). **[RECOMMENDED]**: extract a shared `OpenAICompatibleProvider` base class parameterized by `baseUrl`, `defaultModel`, and `providerName`. This would cut ~120 duplicated lines and make a future third OpenAI-compatible provider (Together, Fireworks, etc.) a 10-line subclass instead of a full copy-paste.
- `GroqProvider.ts` uses inconsistent indentation/blank-line style vs. the rest of the codebase (extra blank lines inside try blocks, 4-space vs. the project's 2-space elsewhere) — cosmetic, but worth a Prettier pass before submission so the file doesn't visibly read as written by a different author.

---

## 2. Security Review

| Area | Finding | Status |
|---|---|---|
| API key exposure | Real Groq key found in `.env` in the upload | **See §0 — rotate the key** |
| File upload validation | MIME check was too strict (§1.1); no magic-byte/content sniffing beyond extension | Extension-based check is reasonable given no raw file bytes ever reach the backend (frontend parses first). **[RECOMMENDED]**: if a raw multipart upload path is ever added, sniff file signature bytes, not just extension. |
| CSV injection risk in parsing | Both parsers (frontend PapaParse, backend RFC4180) treat all content as inert string data — no formula evaluation happens during parsing itself. The real risk is downstream (Excel/Sheets opening exported data), now mitigated — see §1.1. |
| API key handling | Keys read only from `process.env` server-side, never sent to or logged by the client. `logger.ts` explicitly avoids logging PII/raw values. No key material appears in any client-facing response field. | OK |
| Rate limiting | Present (`rateLimiter.ts`, per-IP, 20/min default) but in-memory only — resets on restart, doesn't share state across instances. Documented limitation, acceptable for this app's single-instance scope. | OK for scope, documented |
| CORS | `cors()` configured with a single explicit origin from `CORS_ORIGIN`, not a wildcard — correct. Silent fallback to `http://localhost:3000` if unset was previously undocumented; **[APPLIED]** added a startup warning log so a misconfigured production deploy is loud, not silent. | Fixed |
| Security headers | No `helmet()` or equivalent was present — meant missing `X-Content-Type-Options`, `X-Frame-Options`, CSP, etc. **[APPLIED]** added `helmet()` and `app.disable('x-powered-by')`. | Fixed |
| Unsanitized LLM output in responses | Enum fields were already strictly validated against allow-lists. Free-text fields (`crm_note`, `name`, etc.) were unsanitized until this audit — see §1.1. No XSS risk since the frontend renders these as plain text, never via `dangerouslySetInnerHTML`; the real risk was CSV/formula injection, now mitigated. | Fixed |
| Body size limits | `express.json({ limit: MAX_BODY_SIZE })` (default 15mb) enforced; oversized requests caught by `errorHandler.ts`'s `entity.too.large` branch, return 413 cleanly. | OK |
| Dependency footprint | `helmet` is the only new runtime dependency; `jest`/`supertest`/`ts-jest` are dev/test-only. | OK |

---

## 3. Edge Case Audit

| Case | Behavior before this audit | Behavior now |
|---|---|---|
| Empty CSV (no headers, no rows) | Both parsers throw a clear error | Unchanged — already correct, now covered by a unit test |
| Single-column CSV | Parses fine | Unchanged — already correct, now tested |
| CSV with only a header row, no data | Backend throws `"CSV contains no rows"`; frontend rejects with `"CSV has headers but no data rows"` before any network call | Unchanged — already correct, now tested |
| Huge files (10k+ rows) | Batched at 25 rows/batch, concurrency 4; bounded by `MAX_ROWS` (50k) server-side, 10MB client-side | Unchanged — architecture already handles this; see §4 for tuning notes |
| Duplicate columns | **Previously silent data loss** (last-value-wins, no warning) | **[FIXED]** — rejected upfront with a clear message |
| Non-UTF-8 encoding | Frontend reads via the browser's `FileReader`, defaults to UTF-8, no auto-detection of other encodings (e.g. Windows-1252 exports from older Excel) — a file saved in that encoding shows mojibake rather than crashing | **[RECOMMENDED, not applied]** — detect encoding via BOM/`chardet` and re-decode before parsing; flagged rather than fixed since it adds a new dependency beyond this pass's scope |
| Embedded commas/quotes/newlines | Both parsers handle this correctly | Confirmed via new unit tests |
| All-missing-required-fields row | Skip rule correctly triggers | Confirmed via new unit tests |
| LLM returns malformed JSON | Caught, throws retryable error, after `maxRetries` (3) marked `failed` → rows land in `skipped` with reason `batch_processing_failed`, never silently dropped | Unchanged — already correct |
| LLM returns wrong-length array | Checked explicitly (`results.length !== expectedLength`), throws retryable error rather than silently misaligning row→record mapping | Unchanged — already a good design choice in the original build |
| LLM timeout / rate-limit mid-batch | 429 → retryable, respects `retryAfterMs`; 5xx → retryable; other 4xx → non-retryable (fails fast, correctly); **hung requests previously could stall forever** | **[FIXED]** — now times out and retries |

---

## 4. Performance Optimization

### Batch size tuning
Current default: **25 rows/batch**. Smaller batches (e.g. 10) mean more HTTP round-trips and worse amortization of the ~400-word system prompt's fixed cost, but a smaller blast radius per failure. Larger batches (50–100) amortize better but increase the chance of a truncated/malformed JSON response and make a single failed batch costlier to retry. Recommendation: keep 25 as the default (already configurable via `DEFAULT_BATCH_OPTIONS.batchSize`), but treat this as an empirical tuning knob to A/B test against real messy CSVs and the specific model in use, not a constant to set once and forget.

### Parallel vs. sequential batch processing
Already parallel with a concurrency cap of 4 (`runWithConcurrencyLimit`) — the right default: fully sequential wastes wall-clock time on I/O wait; fully unbounded parallel risks tripping provider rate limits and a thundering herd of simultaneous 429 retries. **[RECOMMENDED, not applied]**: add jitter to the exponential backoff (`baseBackoffMs * 2^attempt + random(0, 250ms)`) so that if many batches fail at once (e.g. a provider outage), their retries don't all land in the same instant.

### Streaming/chunked CSV parsing for large files
Both parsers read the whole file into memory before parsing. At the current 10MB/50k-row cap this is a non-issue. If the cap were raised significantly, the natural next step (already flagged in the original architecture blueprint) is PapaParse's streaming `step` callback on the frontend and a chunked-read/job-queue model on the backend. Not needed at current scope — documented as the correct next lever rather than built speculatively.

### Virtualized table rendering for the result view
Current approach is **pagination** (50 rows/page) rather than virtualization — a deliberate choice to avoid adding `react-window`/`@tanstack/react-virtual` as a dependency for this scope. Pagination handles tens of thousands of rows without rendering slowdown, at the cost of not being one continuous scroll. `ImportedTable`/`SkippedTable` in `ImportResultsTable.tsx` are already pure functions of a row slice, so swapping the slicing mechanism for a virtualized window later is a contained, low-risk change.

### Memoization opportunities in React
- `ImportResultsTable.tsx`'s `pageRows` is already `useMemo`-wrapped keyed on `[rows, page]` — correct.
- `PreviewTable.tsx` recomputes its row slice on every render with no memoization — low-impact today (bounded to 50 rows). **[RECOMMENDED]**: wrap in `useMemo` if a live-filter/search feature is added above it later.
- `IMPORTED_COLUMNS` is already a module-level constant, not recreated per render — correct as-is.

---

## 5. Test Generation

Added a full Jest suite under `backend/src/__tests__/` (zero real network calls required):

- **`csvParser.test.ts`** — 10 tests: simple parse, quoted commas, embedded newlines, escaped quotes, CRLF handling, ragged rows, empty input, headers-only input, single-column CSV, missing trailing newline.
- **`validator.test.ts`** — 14 tests: enum enforcement (valid + invalid `crm_status`/`data_source`), date normalization (valid + unparseable → fallback), multi-email merge, multi-phone merge, skip rule (both-missing / only-email / only-mobile), all-15-fields-present guarantee, and 3 tests for the new CSV-injection fix (neutralizes `=`, neutralizes `@`, leaves ordinary text untouched).
- **`import.integration.test.ts`** — 7 tests against a real Express app instance (via `supertest`) forced onto the `mock` LLM provider: happy-path import + skip, empty-rows rejection, missing-rows-field rejection, malformed-row-shape rejection, over-`MAX_ROWS` rejection (413), unknown-route 404, health-check reporting the active provider.

This required one structural change: **`index.ts` was split into `app.ts` (exports `createApp()`, no `.listen()` call) and a thin `index.ts`** (imports `createApp`, calls `.listen()`). This is what makes the integration test possible without binding a real port — `supertest` drives the app in-memory. Standard, low-risk refactor, no behavior change to the running server.

Run with:
```bash
cd backend && npm install && npm test
```

Not included: a frontend component test suite (React Testing Library for `UploadDropzone`/`ImportResultsTable`) — out of scope for this pass since the prompt's test-generation ask was specifically CSV parsing, field-mapping validation, and the API endpoint, all backend-side and now covered.

---

## 6. Deployment Readiness

- **`backend/Dockerfile`** — multi-stage (`build` compiles TypeScript, `production` installs only prod deps + copies `dist`), runs as the non-root `node` user, includes a `HEALTHCHECK` against `/api/health`.
- **`frontend/Dockerfile`** — multi-stage using Next.js's `standalone` output (`next.config.js` updated with `output: "standalone"`), non-root user. Correctly takes `NEXT_PUBLIC_API_BASE_URL` as a build `ARG`, not just a runtime env var — this matters because Next.js inlines `NEXT_PUBLIC_*` values into the client bundle at build time; setting it only at container-start would silently have no effect.
- **`docker-compose.yml`** — runs both services locally, passes the API base URL as a build arg correctly, LLM provider env vars pass through from the host environment (never hardcoded).
- **`render.yaml`** — backend deploy config: build/start commands, health check path, every env var explicitly listed (secrets marked `sync: false` so Render prompts for them rather than expecting a value in the file).
- **`frontend/vercel.json`** — minimal Next.js framework config. `NEXT_PUBLIC_API_BASE_URL` must still be set in the Vercel project's dashboard environment variables (not just `.env.local`, which isn't deployed) — documented in the README.
- **Health-check endpoint**: `GET /api/health` already existed; now also exercised by an automated test and used by both the Dockerfile `HEALTHCHECK` and `render.yaml`'s `healthCheckPath`.

### Environment variable checklist for deployment
- [ ] `CORS_ORIGIN` set to the real deployed frontend URL (app now warns loudly at startup if left unset)
- [ ] `LLM_PROVIDER` set to `groq` or `openai` (not left at `mock`) for a real demo
- [ ] `GROQ_API_KEY` / `OPENAI_API_KEY` set as a **secret**, never in a committed file
- [ ] `NEXT_PUBLIC_API_BASE_URL` set to the real deployed backend URL, at **build time**
- [ ] `RATE_LIMIT_PER_MINUTE` reviewed for expected demo traffic

---

## 7. Documentation Review

`README.md` (repo root) was rewritten to include setup instructions, environment variable tables for both apps, local run steps (including Docker), an architecture overview, full API documentation (request/response shapes, error codes), a known-limitations section, and a bonus-features-implemented section. See that file directly rather than duplicating it here.

---

## 8. Final Submission Checklist

| Item | Status |
|---|---|
| Hosted app URL | **Placeholder — not filled in.** Add the live Render/Vercel URLs to the README once deployed. |
| GitHub repo structure | Matches the documented `backend/` + `frontend/` + root-level configs layout. **Action needed:** the uploaded zip included both apps' `node_modules/` (≈400MB combined) and generated `package-lock.json` files — `node_modules/` must not be committed; confirm your git client actually respects `.gitignore` (already correct in both apps) before the first commit, since a zip export doesn't go through `.gitignore`. |
| Position-applied note | Not present in any file reviewed. If the take-home instructions require a cover note or a specific header naming the role applied for, that still needs to be added manually. |
| README completeness | Addressed in §7 / the rewritten `README.md`. |
| Exposed secret | **Blocking issue — see §0.** Rotate the Groq key before submission regardless of whether it reached a public repo. |
| Tests present and passing | New Jest suite added (§5). **Not executed in this review's sandbox** (no network access to install jest/supertest) — logic was independently verified by direct execution of the validator and CSV parser functions outside Jest, which passed; recommend running `npm test` yourself once before submitting to confirm the suite is green end-to-end. |
| Docker builds succeed | **Not executed in this review's sandbox** (no network access to pull base images/install deps) — Dockerfiles follow standard, well-tested Node/Next.js patterns, but should be built locally (`docker compose build`) once before relying on them for grading. |
