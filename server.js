require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");
const path = require("path");
const { accounts, contacts, notes, inboundLeads } = require("./data/synthetic-crm");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

if (!GROQ_API_KEY) {
  console.error("ERROR: GROQ_API_KEY is not set. Create a .env file with your key.");
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

function buildPrompt(data) {
  return `You are a GTM data analyst. You will receive messy CRM data (accounts, contacts, and rep notes). Your job is to:

1. ENTITY RESOLUTION: Identify duplicate account records that refer to the same company. Collapse them into canonical accounts. Use domain matching, name similarity, and context clues. Pick the best canonical name for each cluster.

2. WON-ACCOUNT PROFILE: Find accounts with stage "won". Use them (especially the primary won account) as the reference profile. Extract key attributes: industry, company size, growth stage, hiring signals, leadership changes, funding signals, sales organization characteristics, and other GTM-relevant signals. The won-account profile answers: "What describes the account that already converted?"

3. SIGNAL EXTRACTION: Read every freeform note and extract structured signals. Each signal must have:
   - type: one of "funding", "leadership_change", "hiring", "growth", "budget", "expansion", "sales_team_change", "technology_change", "other"
   - detail: a concise description
   - approx_date: YYYY-MM or YYYY-MM-DD if the note supports a date inference. Use null if no date can be inferred. Do NOT invent dates unsupported by the text.

4. LOOKALIKE SCORING: Compare every non-won canonical account against the won-account profile. Assign a lookalike_score from 0 to 100. For each scored account, provide 2-5 reasons explaining the score. Factors: industry match, company size similarity, growth signals, leadership hires, funding stage, sales org maturity, GTM motion similarity.

5. REVIEW QUEUE: Any account with a lookalike_score >= 70 should be added to the review queue with action "hold_for_review" and a short reason.

Return ONLY valid JSON with this exact structure (no markdown, no backticks, no explanation):

{
  "resolved_clusters": [
    {
      "canonical_name": "string",
      "original_records": ["string array of original company names/entries that were merged"],
      "domain": "string",
      "merge_reasoning": "brief explanation of why these records were merged"
    }
  ],
  "won_account_profile": {
    "account": "string — canonical name of the primary won account",
    "domain": "string",
    "attributes": [
      { "name": "string — attribute name", "value": "string — attribute value" }
    ]
  },
  "accounts": [
    {
      "canonical_name": "string",
      "domain": "string",
      "size_band": "string — normalized size range like '201-500'",
      "industry": "string",
      "stage": "string — won/open/lost",
      "contacts": [
        {
          "name": "string",
          "title_normalized": "string — normalized job title",
          "email": "string or null"
        }
      ],
      "signals": [
        {
          "type": "string — one of the signal types listed above",
          "detail": "string",
          "approx_date": "string or null"
        }
      ],
      "lookalike_score": "number 0-100 or null for won accounts",
      "lookalike_reasons": ["string array — only for non-won accounts"]
    }
  ],
  "review_queue": [
    {
      "account": "string — canonical name",
      "score": "number",
      "reason": "string — why this account is held for review",
      "action": "hold_for_review"
    }
  ]
}

Here is the messy CRM data:

ACCOUNTS:
${JSON.stringify(data.accounts, null, 2)}

CONTACTS:
${JSON.stringify(data.contacts, null, 2)}

NOTES:
${JSON.stringify(data.notes, null, 2)}

Important rules:
- Merge duplicates intelligently. "Acme Inc", "ACME", and "acme.com" are the same company.
- Normalize job titles: "VP Sales", "VP, Sales", "Vice President of Sales", "Head of Sales" should all become a standard form.
- Deduplicate contacts that appear to be the same person across duplicate account records.
- Every non-won account MUST have a lookalike_score and lookalike_reasons.
- Won accounts should have lookalike_score: null and empty lookalike_reasons.
- Only include accounts in review_queue if lookalike_score >= 70.
- Return ONLY the JSON object. No other text.`;
}

function tryParseJSON(text) {
  
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function validateResponse(data) {
  if (!data || typeof data !== "object") return false;
  if (!data.accounts || !Array.isArray(data.accounts)) return false;
  if (!data.won_account_profile || !data.won_account_profile.account) return false;
  if (!data.review_queue || !Array.isArray(data.review_queue)) return false;
  return true;
}

app.post("/api/process", async (req, res) => {
  try {
    const crmData = { accounts, contacts, notes };
    const prompt = buildPrompt(crmData);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let completion;
    try {
      completion = await groq.chat.completions.create(
        {
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a structured data analyst. You always respond with valid JSON only. No markdown, no explanation, no preamble."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          reasoning_effort: "low",
          max_tokens: 3500,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json({
        success: false,
        error: "The model returned an empty response. Please try again."
      });
    }

    const parsed = tryParseJSON(rawContent);
    if (!parsed) {
      return res.status(502).json({
        success: false,
        error: "The model returned invalid JSON. Please try again."
      });
    }

    if (!validateResponse(parsed)) {
      return res.status(502).json({
        success: false,
        error: "The model response is missing required fields. Please try again."
      });
    }

    if (!parsed.won_profile && parsed.won_account_profile) {
      parsed.won_profile = parsed.won_account_profile;
    }
    if (!parsed.canonical_clusters && parsed.resolved_clusters) {
      parsed.canonical_clusters = parsed.resolved_clusters;
    }

    parsed._meta = {
      raw_account_count: accounts.length,
      raw_contact_count: contacts.length,
      raw_note_count: notes.length,
      total_raw_records: accounts.length + contacts.length + notes.length
    };

    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error("API error:", err.message);

    if (err.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "The request timed out. Please try again."
      });
    }

    return res.status(500).json({
      success: false,
      error: "The workflow could not be processed. Check the API configuration and try again."
    });
  }
});

function buildQualifyPrompt(leads, wonProfile) {
  return `You are an inbound lead qualification agent for a B2B SaaS company.

You have access to the won-account ICP (Ideal Customer Profile) from a previous analysis:
${JSON.stringify(wonProfile, null, 2)}

Below are inbound form submissions. For each lead, you must:
1. Grade it: "sales_qualified", "marketing_nurture", or "disqualify"
2. Provide a confidence score from 0-100
3. Explain your reasoning in 1-2 sentences
4. Suggest the best next action

Grading criteria based on the won-account ICP:
- sales_qualified: Strong ICP match (B2B SaaS or similar, 100-500 employees, has sales team, buying signals, relevant title)
- marketing_nurture: Partial match (right industry but wrong stage, interesting but not ready)
- disqualify: No fit (wrong industry entirely, not a business, spam, too small/large to fit)

Return ONLY valid JSON:
{
  "qualified_leads": [
    {
      "id": "string — the lead's id",
      "name": "string",
      "company": "string",
      "grade": "sales_qualified | marketing_nurture | disqualify",
      "confidence": 85,
      "reasoning": "string — why this grade was assigned",
      "next_action": "string — recommended next step",
      "icp_match_factors": ["string array — which ICP attributes matched or didn't"]
    }
  ]
}

INBOUND LEADS:
${JSON.stringify(leads, null, 2)}

Important:
- Every lead must appear in the output.
- Be strict: only truly strong matches should be sales_qualified.
- Return ONLY the JSON object.`;
}

app.post("/api/qualify", async (req, res) => {
  try {
    const wonProfile = req.body.wonProfile || req.body.won_profile || req.body.won_account_profile;
    if (!wonProfile) {
      return res.status(400).json({ success: false, error: "Won-account profile is required." });
    }

    const prompt = buildQualifyPrompt(inboundLeads, wonProfile);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let completion;
    try {
      completion = await groq.chat.completions.create(
        {
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: "You are an inbound lead qualification agent. Return ONLY valid JSON. No markdown, no explanation."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          reasoning_effort: "low",
          max_tokens: 2000,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json({ success: false, error: "Empty response from model." });
    }

    const parsed = tryParseJSON(rawContent);
    if (!parsed || !parsed.qualified_leads) {
      return res.status(502).json({ success: false, error: "Invalid qualification response." });
    }

    parsed._meta = { total_leads: inboundLeads.length };
    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error("Qualify error:", err.message);
    return res.status(500).json({ success: false, error: "Lead qualification failed. Try again." });
  }
});

function buildOutreachPrompt(account, wonProfile) {
  return `You are a sales development representative drafting a personalized cold outreach email.

You are reaching out to a prospect account that was identified as a strong lookalike to a won customer.

WON ACCOUNT PROFILE (your reference):
${JSON.stringify(wonProfile, null, 2)}

PROSPECT ACCOUNT:
${JSON.stringify(account, null, 2)}

Write a personalized cold email that:
1. References a specific signal or attribute from the prospect's data
2. Draws a connection to how companies like the won account have benefited
3. Is concise (under 150 words), professional, and not pushy
4. Includes a clear but soft call-to-action
5. Uses the contact's first name if available

Return ONLY valid JSON:
{
  "subject": "string — email subject line",
  "body": "string — the email body text",
  "to_name": "string — recipient name",
  "to_email": "string — recipient email",
  "to_company": "string — company name",
  "personalization_notes": ["string array — what was personalized and why"]
}`;
}

app.post("/api/draft-outreach", async (req, res) => {
  try {
    const { account } = req.body;
    const wonProfile = req.body.wonProfile || req.body.won_profile || req.body.won_account_profile;
    if (!account || !wonProfile) {
      return res.status(400).json({ success: false, error: "Account and won profile required." });
    }

    const prompt = buildOutreachPrompt(account, wonProfile);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let completion;
    try {
      completion = await groq.chat.completions.create(
        {
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a skilled SDR. Write personalized, concise cold emails. Return ONLY valid JSON."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.4,
          reasoning_effort: "low",
          max_tokens: 1000,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json({ success: false, error: "Empty response." });
    }

    const parsed = tryParseJSON(rawContent);
    if (!parsed || !parsed.subject || !parsed.body) {
      return res.status(502).json({ success: false, error: "Invalid outreach draft." });
    }

    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error("Outreach draft error:", err.message);
    return res.status(500).json({ success: false, error: "Outreach drafting failed. Try again." });
  }
});

app.get("/api/dataset", (req, res) => {
  res.json({ accounts, contacts, notes, inboundLeads });
});

app.listen(PORT, () => {
  console.log(`Frontrunner PoC running at http://localhost:${PORT}`);
  console.log(`Using model: ${GROQ_MODEL}`);
});
