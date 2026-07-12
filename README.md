# GrowEasy — AI-Powered CSV Importer

Full-stack tool that ingests arbitrary CSV lead exports (Facebook Lead Ads, Google Ads, Excel, manual spreadsheets) and uses an LLM to map them onto a fixed 15-field GrowEasy CRM schema, with deterministic validation as a safety net against bad LLM output.

> **Submission note:** built as a take-home project. See `AUDIT.md` in this same folder for the full pre-submission code/security/performance review this README's "Known Limitations" section summarizes.

```
groweasy/
├── backend/          Express + TypeScript API
├── frontend/          Next.js (App Router) + TypeScript UI
├── docker-compose.yml Local full-stack run via Docker
├── render.yaml         Render deployment config (backend)
└── AUDIT.md            Full engineering audit (code/security/perf/tests)
```

---

## 1. Setup & Local Run

### Prerequisites
- Node.js ≥ 18
- npm

### Backend

```bash
cd backend
cp .env.example .env      # defaults work out of the box — LLM_PROVIDER=mock
npm install
npm run dev                # http://localhost:4000
```

Verify: `curl http://localhost:4000/api/health` → `{"status":"ok","provider":"mock",...}`

### Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                # http://localhost:3000
```

Open **http://localhost:3000**, drop in a CSV, and walk through Upload → Preview → Confirm → Results.

### Running with Docker instead

```bash
docker compose up --build
```
Frontend on :3000, backend on :4000. Set `LLM_PROVIDER`, `GROQ_API_KEY`, etc. via a `.env` file next to `docker-compose.yml` or your shell environment before running.

### Running tests

```bash
cd backend
npm install
npm test
```
Covers CSV parsing edge cases, validator business rules (enum enforcement, date normalization, skip rule, multi-value merge, CSV-injection sanitization), and an integration test of `POST /api/import` against the mock provider (no network/API key required).

---

## 2. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `4000` | |
| `CORS_ORIGIN` | **yes in production** | `http://localhost:3000` | Set to the deployed frontend URL |
| `MAX_BODY_SIZE` | no | `15mb` | Express JSON body limit |
| `MAX_ROWS` | no | `50000` | Hard cap on rows per import |
| `RATE_LIMIT_PER_MINUTE` | no | `20` | Per-IP requests/minute to `/api/import` |
| `LOG_LEVEL` | no | `info` | Set `debug` for verbose validator logs |
| `LLM_PROVIDER` | no | `mock` | `mock` \| `groq` \| `openai` |
| `LLM_REQUEST_TIMEOUT_MS` | no | `30000` | Hard timeout per LLM batch call |
| `GROQ_API_KEY` | only if `LLM_PROVIDER=groq` | — | **Never commit this file with a real key filled in** |
| `GROQ_MODEL` | no | `llama-3.3-70b-versatile` | |
| `OPENAI_API_KEY` | only if `LLM_PROVIDER=openai` | — | Same caution as above |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | yes | `http://localhost:4000` |

> `NEXT_PUBLIC_*` variables are baked into the client bundle at **build time**. When deploying, set this in your host's dashboard (Vercel project settings) or as a Docker build `ARG` — setting it only as a runtime env var will not work.

---

## 3. Architecture Overview

```
Browser → client-side CSV parse (PapaParse, preview only, no AI call)
        → user clicks "Confirm Import"
        → POST /api/import (full parsed rows as JSON)
        → backend chunks rows into batches (25 rows default)
        → batches dispatched to LLM provider, 4 concurrent, retry+backoff on failure
        → every LLM-mapped row re-validated in code (enums, dates, skip rule,
          multi-value split, CSV-injection sanitization) — LLM output is
          never trusted as final
        → structured JSON response { imported, skipped, meta }
        → tabbed, paginated results table in the browser
```

**LLM provider abstraction:** `backend/src/services/llm/LLMProvider.ts` defines the interface; `MockProvider` (rule-based, offline), `GroqProvider`, and `OpenAIProvider` implement it. Swapping providers is a one-line env var change (`LLM_PROVIDER`) — nothing else in the codebase needs to know which is active.

**Why stateless (no DB):** each import is a self-contained request/response. See `AUDIT.md` §Performance/Architecture for when persistence would become necessary (import history, async job queue for very large files, deduplication).

---

## 4. API Documentation

### `POST /api/import`

**Request body:**
```json
{
  "fileName": "leads.csv",
  "headers": ["Full Name", "Email", "Phone"],
  "rows": [
    { "Full Name": "Jane Doe", "Email": "jane@x.com", "Phone": "9876543210" }
  ]
}
```

**200 response:**
```json
{
  "success": true,
  "meta": {
    "totalRows": 1,
    "totalImported": 1,
    "totalSkipped": 0,
    "failedBatches": 0,
    "processingTimeMs": 842,
    "provider": "groq"
  },
  "imported": [ { "created_at": "...", "name": "Jane Doe", "email": "jane@x.com", "...": "..." } ],
  "skipped": [ { "rowIndex": 3, "reason": "missing_email_and_mobile", "rawRow": { "...": "..." } } ]
}
```

**Error responses:**

| Status | `error` code | Cause |
|---|---|---|
| 400 | `invalid_csv` / `invalid_request` / `invalid_json` | Empty/malformed rows, bad JSON body |
| 413 | `file_too_large` | Row count exceeds `MAX_ROWS`, or body exceeds `MAX_BODY_SIZE` |
| 429 | `rate_limited` | Per-IP rate limit exceeded (see `retryAfterMs`) |
| 500 | `internal_error` | Unexpected server error |
| 404 | `not_found` | Unknown route |

Note: if individual LLM batches fail after retries, the endpoint still returns **200** with those rows reported under `skipped` (`reason: "batch_processing_failed"`) and `meta.failedBatches > 0` — a partial provider outage never fails the whole import.

### `GET /api/health`
Returns `{ status, provider, timestamp }`. Used by Docker/Render health checks.

---

## 5. Known Limitations

- **No persistence.** Stateless request/response only — no import history, no deduplication against previously imported leads.
- **Progress bar is an estimate**, not real per-batch telemetry — the backend returns one final response rather than streaming batch completion events (documented in `ProgressIndicator.tsx`).
- **Results table uses pagination (50 rows/page), not virtualization.** Comfortably handles tens of thousands of rows without a rendering dependency; `react-window` is a documented drop-in upgrade if true single-scroll virtualization is needed.
- **In-memory rate limiter** — fine for a single instance; needs a Redis-backed limiter behind a load balancer / multiple instances.
- **File cap:** 10MB / 50,000 rows client-side, `MAX_ROWS` server-side (both configurable).
- **CSV re-parsing on the backend (`csvParser.ts`) is currently unused in the live request path** — the frontend sends pre-parsed JSON rows. Kept as a safety net / alternate entry point for a raw-text upload API, documented so it isn't mistaken for dead code.

## 6. Bonus Features Implemented

- Pluggable LLM provider architecture (Mock / Groq / OpenAI) with a genuinely useful **rule-based offline mock** — not a stub — that exercises the entire pipeline (batching, retry, validation, skip rule, UI states) with zero API cost.
- Exponential backoff + per-request timeout on every LLM call, with partial-failure handling so one bad batch never fails the whole import.
- CSV/formula-injection sanitization on free-text fields, defending against a future "export to Excel" feature in the CRM.
- Duplicate-CSV-header detection (silent data loss otherwise) and permissive-but-safe file-type validation (handles inconsistent browser MIME types for `.csv`).
- Dockerized (multi-stage builds, health checks) with `docker-compose.yml`, plus ready-to-use Render and Vercel configs.
- Jest unit + integration test suite, including an end-to-end API test using the mock provider (no live API key needed to run CI).
