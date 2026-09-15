# Frontrunner Proof-of-Concept Demo

A single-page web application demonstrating an end-to-end GTM workflow using synthetic CRM data:

$$\text{Messy CRM} \longrightarrow \text{Resolve \& Understand} \longrightarrow \text{Find Lookalikes} \longrightarrow \text{Hold for Review}$$

> **Disclaimer**: This demo mirrors workflows that Frontrunner has described publicly (entity resolution, won-account profiling, lookalike prospecting, signal extraction, and review queues). It is an independent proof-of-concept built with synthetic data and does not claim to reproduce Frontrunner's internal proprietary implementation.

---

## What It Demonstrates

1. **Messy CRM Ingestion (Stage 1)**: Visualizes deliberately dirty CRM data containing duplicate account records, fragmented contact listings, unstandardized job titles, and unformatted freeform sales rep notes.
2. **AI-Driven Processing (Stage 2)**: Staged visual orchestration displaying the step-by-step intelligence pipeline:
   - Duplicate account resolution & canonical record creation
   - Won-account profile mining
   - Signal extraction from unstructured notes (funding, hiring, leadership changes, tech stack)
   - Lookalike scoring & reasoning against won profiles
   - GTM triage holding qualified matches for review
3. **Actionable Pipeline & Human-in-the-Loop Review (Stage 3)**:
   - Dynamic before-to-after impact metrics calculated from real data
   - Canonical entity cards with normalized contacts and chronologically mapped signal feeds
   - Scored lookalikes with transparent decision criteria
   - Review queue with interactive **Approve / Reject** actions and live counter tallies

---

## Architecture

- **Backend**: Node.js + Express
  - `POST /api/process`: Orchestrates Groq API interaction via `groq-sdk` with structured `json_object` response format, robust JSON repair, schema validation, and error handling.
  - `GET /api/dataset`: Serves the synthetic CRM data for raw table rendering.
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (no heavy frontend framework dependencies).
  - High-contrast visual progression from intentionally raw/monospaced CRM tables to a sleek, dark-mode GTM dashboard.
  - Complete client-side state management for review queue approvals/rejections with reset capability.
- **AI Engine**: Groq API powered by `llama-3.3-70b-versatile` for sub-second structured inference.

---

## Setup & Installation

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` to include your Groq API key:
```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3000
```

> **Security Note**: The `.env` file is included in `.gitignore` to prevent API keys from leaking. The Groq API is called strictly server-side; client code never has access to the secret key.

### 3. Start the Server
```bash
npm start
```
The application will be accessible at:
```
http://localhost:3000
```

---

## Synthetic CRM Dataset

The synthetic dataset located in `data/synthetic-crm.js` contains:
- **18 Accounts** across 3 intentional duplicate clusters (`Acme Inc`, `Bolt Logistics`, `NovaPay`), 2 won accounts, and lookalikes ranging from high-confidence matches to intentional non-matches.
- **22 Contacts** with inconsistent titles (`VP Sales`, `Vice President of Sales`, `Head of Sales`, `CRO`) and duplicate people across merged account records.
- **15 Freeform Rep Notes** containing rich GTM signals (funding rounds, executive appointments, team expansions, revops tool evaluations) and varying date formats.

---

## Quality & Safety Safeguards
- Strict JSON schema enforcement via Groq's `response_format: { type: "json_object" }`.
- JSON repair fallback parsing and field-level validation before delivering payloads to the client.
- Clean client-side escaping prevents XSS across unstructured note rendering.
- Graceful degradation with actionable retry states when API limits or network issues occur.
