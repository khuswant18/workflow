# Frontrunner GTM Agent Workflow — Proof of Concept

An interactive web prototype demonstrating how AI agents automate Go-To-Market (GTM) workflows using messy CRM data.

This project mirrors the publicly described workflows of [Frontrunner](https://usefr.com/) ("Cursor for GTM"), including **Entity Resolution**, **Won-Account ICP Mining**, **Lookalike Prospecting**, **Human-in-the-Loop Review**, and **Inbound Lead Qualification**.

---

## ⚡ How It Works

```text
[Messy CRM Export] ──► [AI Resolution & ICP Mining] ──► [Lookalike Scoring] ──► [Hold for Review] ──► [Personalized Outreach]
                                                                        └──► [Inbound Lead Qualification]
```

### The Problem
Real CRM data is messy: duplicate accounts, inconsistent names, missing fields, and crucial buying signals buried in freeform sales rep notes. Reps waste hours manually researching accounts, qualifying leads, and drafting outreach.

### The Solution
AI agents autonomously turn messy data into actionable pipeline:
1. **Clean & Deduplicate**: Merges fragmented records into single canonical accounts.
2. **Learn From Won Deals**: Analyzes converted customers to extract an Ideal Customer Profile (ICP).
3. **Find & Score Lookalikes**: Ranks open accounts against the won profile using extracted signals (funding rounds, executive hires, team growth).
4. **Hold for Review**: Keeps humans in control by holding high-intent prospects for review rather than auto-sending.
5. **Qualify Inbound Leads**: Automatically scores incoming demo requests against the same ICP and suggests next actions.
6. **Draft Personalized Outreach**: Generates tailored cold emails that reference real signals and won-customer success.

---

## 🚀 Core Features

### 1. Stage 1 — The Messy Reality
Visualizes raw, uncleaned CRM tables:
- **Accounts**: Inconsistent naming (`Acme Inc`, `ACME`, `acme.com`), missing domains, and mixed company sizes.
- **Contacts**: Fragmented titles (`VP Sales`, `Vice President of Sales`, `Head of Sales`, `CRO`).
- **Rep Notes**: Unstructured text with hidden buying signals (Series B funding, VP hires, SDR expansion).
- **Inbound Submissions**: Live demo requests and form submissions waiting for qualification.

### 2. Stage 2 — Autonomous Processing
Watch the pipeline execute step-by-step:
- Resolve duplicate accounts
- Mine won-account profile
- Extract structured signals with dates from notes
- Score lookalike accounts (0–100%)
- Hold high-confidence matches for review

### 3. Stage 3 — Multi-Agent Intelligence Dashboard

* **Agent 1: Lookalike Prospecting & Review Queue**
  * **Summary Flow**: Clear before-and-after numbers (e.g. 18 raw accounts → 12 resolved → 2 won reference profiles → 4 high-match lookalikes).
  * **Entity Clusters**: View merged records and the exact reasoning behind each merge.
  * **Won Profile Card**: Extracted benchmark attributes (target size, stage, buying signals).
  * **Resolved Accounts**: Clean cards with normalized contacts and chronological signal timelines.
  * **Review Queue**: Interactive **Approve** and **Reject** buttons with live counters.
  * **Outreach Drafter ✨**: Click on any approved account to generate a personalized cold email referencing specific signals and won-customer proof points. Includes 1-click clipboard copy and CRM simulation.

* **Agent 2: Inbound Lead Qualification Agent**
  * Evaluates inbound form submissions in real time against the won ICP.
  * Grades each lead:
    * 🟢 **Sales Qualified** — Strong ICP fit, routed directly to SDR/AE.
    * 🟡 **Marketing Nurture** — Right industry, early stage, routed to nurture sequence.
    * ⚪ **Disqualified** — Out-of-scope or student inquiries, auto-archived.
  * Shows confidence score bar, positive/negative ICP match factors, and recommended next steps.
  * Interactive filter chips to view leads by grade.

---

## 🛠️ Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/khuswant18/workflow.git
cd workflow
npm install
```

### 2. Add Your Groq API Key
Copy the example environment file:
```bash
cp .env.example .env
```
Open `.env` and add your [Groq API Key](https://console.groq.com/keys):
```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
PORT=3000
```

### 3. Run the App
```bash
npm start
```
Open your browser at:
```
http://localhost:3000
```

Click **"Run Workflow"** to see the transformation live!

---

## 📁 Project Structure

```text
workflow/
├── data/
│   └── synthetic-crm.js    # Synthetic CRM dataset (accounts, contacts, notes, inbound leads)
├── public/
│   ├── index.html          # Clean 3-stage UI + outreach modal
│   ├── style.css           # Premium dark-mode design system & animations
│   └── app.js              # Client state, workflow tabs, lead filtering & modal logic
├── server.js               # Express API + Groq structured AI agent endpoints
├── .env.example            # Environment configuration template
├── .gitignore              # Protects .env and dependencies
├── package.json            # Node dependencies
└── README.md               # Project documentation
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/dataset` | `GET` | Returns raw synthetic accounts, contacts, notes, and inbound leads |
| `/api/process` | `POST` | Ingests CRM data, performs entity resolution, mines won profile, extracts signals, and scores lookalikes |
| `/api/qualify` | `POST` | Grades inbound leads against the won-account ICP in real time |
| `/api/draft-outreach` | `POST` | Generates a personalized cold outreach email for a selected account |

---

## 💡 Tech Stack

- **Backend**: Node.js, Express
- **AI Inference**: Groq SDK (`openai/gpt-oss-120b` or `llama-3.3-70b-versatile`) with structured JSON schema enforcement
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (zero external UI framework dependencies, fast load time)
- **Styling**: Modern dark theme with CSS custom properties, glassmorphism, and responsive layout
