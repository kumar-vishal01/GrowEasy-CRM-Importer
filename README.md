# GrowEasy AI CSV Importer

An AI-powered CSV Importer built for the GrowEasy Software Developer Assignment.

The application accepts CSV files from different sources (Facebook Lead Ads, Google Ads, Excel, CRM exports, manually created spreadsheets, etc.) and intelligently maps them into the GrowEasy CRM schema using a Large Language Model (LLM).

---

## Features

### Frontend

- Drag & Drop CSV upload
- File picker upload
- CSV preview before import
- Responsive preview table
- Sticky table headers
- Horizontal & vertical scrolling
- Import confirmation step
- Progress indicator during AI processing
- Import summary
- Successfully imported records table
- Skipped records table
- Error handling
- Dark Mode

---

### Backend

- REST API built with Express + TypeScript
- AI-powered CRM field mapping
- OpenAI Provider
- Groq Provider
- Mock Provider (used for testing)
- Intelligent prompt engineering
- Batch processing
- Retry support for retryable AI failures
- CSV validation
- CSV parsing fallback
- Data sanitization
- CRM schema validation
- Formula Injection protection
- Rate limiting
- Structured logging
- Health endpoint
- Comprehensive error handling

---

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- CSS Modules

### Backend

- Node.js
- Express
- TypeScript

### AI

- OpenAI
- Groq
- Mock Provider (for testing)

### Testing

- Jest
- Supertest

### Deployment

- Docker
- Docker Compose
- Render
- Vercel

---

## Project Structure

```
groweasy/

├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   ├── batchProcessor.ts
│   │   │   ├── csvParser.ts
│   │   │   └── validator.ts
│   │   ├── types/
│   │   ├── utils/
│   │   └── __tests__/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   └── types/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── render.yaml
├── AUDIT.md
└── README.md
```

---

# CRM Fields

The AI extracts the following fields:

- created_at
- name
- email
- country_code
- mobile_without_country_code
- company
- city
- state
- country
- lead_owner
- crm_status
- crm_note
- data_source
- possession_time
- description

---

# AI Processing Flow

```
Upload CSV
      │
      ▼
Parse CSV
      │
      ▼
Preview Records
      │
      ▼
Confirm Import
      │
      ▼
Backend API
      │
      ▼
Batch Processing
      │
      ▼
LLM Mapping
      │
      ▼
Validation
      │
      ▼
Return CRM Records
      │
      ▼
Display Results
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/your-username/groweasy-csv-importer.git

cd groweasy-csv-importer
```

---

# Backend Setup

```bash
cd backend

npm install
```

Copy

```
.env.example
```

to

```
.env
```

Example

```
OPENAI_API_KEY=your_key

GROQ_API_KEY=your_key

LLM_PROVIDER=openai

PORT=5000
```

Run

```bash
npm run dev
```

Backend

```
http://localhost:5000
```

---

# Frontend Setup

```bash
cd frontend

npm install
```

Copy

```
.env.example
```

to

```
.env.local
```

Example

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Run

```bash
npm run dev
```

Frontend

```
http://localhost:3000
```

---

# Docker

Build

```bash
docker compose build
```

Run

```bash
docker compose up
```

Stop

```bash
docker compose down
```

---

# API

## POST

```
POST /api/import
```

Request

```json
{
  "fileName": "leads.csv",
  "headers": ["Name", "Email"],
  "rows": [
    {
      "Name": "John",
      "Email": "john@example.com"
    }
  ]
}
```

Response

```json
{
  "success": true,
  "meta": {},
  "imported": [],
  "skipped": []
}
```

---

## GET

```
GET /api/health
```

Returns

```json
{
  "status": "ok",
  "provider": "openai"
}
```

---

# Running Tests

Backend

```bash
cd backend

npm test
```

---

# Environment Variables

Backend

```
OPENAI_API_KEY

GROQ_API_KEY

LLM_PROVIDER

PORT

MAX_ROWS

MAX_BODY_SIZE

RATE_LIMIT_PER_MINUTE

CORS_ORIGIN
```

Frontend

```
NEXT_PUBLIC_API_URL
```

---

# Security Features

- Request validation
- CSV validation
- Formula Injection protection
- Rate limiting
- Structured error handling
- Retry mechanism for retryable AI failures
- Type-safe validation layer
- Health monitoring endpoint

---

# Future Improvements

- Streaming CSV parsing for very large files
- Virtualized tables for millions of rows
- Redis-backed distributed rate limiting
- Authentication
- Persistent import history
- Background job queue
- WebSocket-based live progress updates

---

# Author
Vishal Kumar
