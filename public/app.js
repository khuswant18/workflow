(function () {
  "use strict";

  const $stageInput = document.getElementById("stage-input");
  const $stageProcessing = document.getElementById("stage-processing");
  const $stageOutput = document.getElementById("stage-output");
  const $stageError = document.getElementById("stage-error");

  const $btnRun = document.getElementById("btn-run");
  const $btnRetry = document.getElementById("btn-retry");
  const $btnReset = document.getElementById("btn-reset");
  const $errorMessage = document.getElementById("error-message");

  const $tableAccounts = document.querySelector("#table-accounts tbody");
  const $tableContacts = document.querySelector("#table-contacts tbody");
  const $tableNotes = document.querySelector("#table-notes tbody");
  const $tableInbound = document.querySelector("#table-inbound tbody");

  const $rawAccountCount = document.getElementById("raw-account-count");
  const $rawContactCount = document.getElementById("raw-contact-count");
  const $rawNoteCount = document.getElementById("raw-note-count");
  const $rawInboundCount = document.getElementById("raw-inbound-count");

  const $processingSteps = document.getElementById("processing-steps");
  const $summaryBanner = document.getElementById("summary-banner");
  const $clustersGrid = document.getElementById("clusters-grid");
  const $profileCard = document.getElementById("profile-card");
  const $accountsGrid = document.getElementById("accounts-grid");
  const $reviewQueue = document.getElementById("review-queue");
  const $reviewCounters = document.getElementById("review-counters");

  const $tabBtnOutbound = document.getElementById("tab-btn-outbound");
  const $tabBtnInbound = document.getElementById("tab-btn-inbound");
  const $tabContentOutbound = document.getElementById("tab-content-outbound");
  const $tabContentInbound = document.getElementById("tab-content-inbound");

  const $btnRunQualify = document.getElementById("btn-run-qualify");
  const $inboundFilterBar = document.getElementById("inbound-filter-bar");
  const $inboundContainer = document.getElementById("inbound-leads-container");
  const $countAll = document.getElementById("count-all");
  const $countSq = document.getElementById("count-sq");
  const $countMn = document.getElementById("count-mn");
  const $countDq = document.getElementById("count-dq");
  const $inboundStatsPill = document.getElementById("inbound-stats-pill");

  const $modalOutreach = document.getElementById("modal-outreach");
  const $modalOutreachClose = document.getElementById("modal-outreach-close");
  const $modalOutreachTitle = document.getElementById("modal-outreach-title");
  const $modalOutreachBody = document.getElementById("modal-outreach-body");
  const $btnCopyEmail = document.getElementById("btn-copy-email");
  const $copyBtnText = document.getElementById("copy-btn-text");
  const $btnSimulateSend = document.getElementById("btn-simulate-send");

  let rawDataset = null;
  let apiData = null;
  let reviewState = [];
  let qualifiedLeads = [];
  let currentInboundFilter = "all";
  let currentDraftEmail = null;

  async function init() {
    try {
      const res = await fetch("/api/dataset");
      rawDataset = await res.json();
      renderRawTables(rawDataset);
    } catch (e) {
      console.error("Failed to load dataset", e);
    }

    $btnRun.addEventListener("click", runWorkflow);
    $btnRetry.addEventListener("click", runWorkflow);
    $btnReset.addEventListener("click", resetReview);

    $tabBtnOutbound.addEventListener("click", () => switchTab("outbound"));
    $tabBtnInbound.addEventListener("click", () => switchTab("inbound"));

    $btnRunQualify.addEventListener("click", runQualifyAgent);

    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentInboundFilter = chip.dataset.filter;
        renderQualifiedLeads();
      });
    });

    $modalOutreachClose.addEventListener("click", closeModal);
    $modalOutreach.addEventListener("click", (e) => {
      if (e.target === $modalOutreach) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$modalOutreach.classList.contains("hidden")) {
        closeModal();
      }
    });

    $btnCopyEmail.addEventListener("click", copyEmailDraft);
    $btnSimulateSend.addEventListener("click", simulateSendEmail);
  }

  function renderRawTables(data) {
    const { accounts, contacts, notes, inboundLeads } = data;

    if ($rawAccountCount) $rawAccountCount.textContent = `(${accounts.length} records)`;
    if ($rawContactCount) $rawContactCount.textContent = `(${contacts.length} records)`;
    if ($rawNoteCount) $rawNoteCount.textContent = `(${notes.length} records)`;
    if ($rawInboundCount && inboundLeads) $rawInboundCount.textContent = `(${inboundLeads.length} leads)`;

    $tableAccounts.innerHTML = accounts.map(a => `
      <tr>
        <td>${esc(a.company)}</td>
        <td>${a.domain ? esc(a.domain) : '<span class="empty-cell">—</span>'}</td>
        <td>${a.industry ? esc(a.industry) : '<span class="empty-cell">—</span>'}</td>
        <td>${a.size ? esc(a.size) : '<span class="empty-cell">—</span>'}</td>
        <td>${esc(a.stage)}</td>
      </tr>
    `).join("");

    const accountMap = {};
    accounts.forEach(a => { accountMap[a.id] = a.company; });

    $tableContacts.innerHTML = contacts.map(c => `
      <tr>
        <td>${esc(c.name)}</td>
        <td>${esc(accountMap[c.accountId] || "—")}</td>
        <td>${esc(c.title)}</td>
        <td>${c.email ? esc(c.email) : '<span class="empty-cell">—</span>'}</td>
      </tr>
    `).join("");

    $tableNotes.innerHTML = notes.map(n => `
      <tr>
        <td>${esc(accountMap[n.accountId] || "—")}</td>
        <td>${esc(n.note)}</td>
        <td>${n.date ? esc(n.date) : '<span class="empty-cell">—</span>'}</td>
      </tr>
    `).join("");

    if ($tableInbound && inboundLeads) {
      $tableInbound.innerHTML = inboundLeads.map(lead => `
        <tr>
          <td><strong>${esc(lead.name)}</strong></td>
          <td>${esc(lead.company || "—")}</td>
          <td>${esc(lead.title || "—")}</td>
          <td><span class="signal-type-badge">${esc(lead.source)}</span></td>
          <td style="max-width:320px; font-size:0.8rem; color:#475569;">${esc(lead.message)}</td>
        </tr>
      `).join("");
    }
  }

  function showStage(name) {
    $stageInput.classList.toggle("hidden", name !== "input");
    $stageProcessing.classList.toggle("hidden", name !== "processing");
    $stageOutput.classList.toggle("hidden", name !== "output");
    $stageError.classList.toggle("hidden", name !== "error");

    if (name === "output" || name === "error") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const STEP_NAMES = ["resolve", "profile", "signals", "lookalikes", "review"];
  let processingDone = false;

  function resetProcessingSteps() {
    processingDone = false;
    const steps = $processingSteps.querySelectorAll("li");
    steps.forEach(li => {
      li.className = "step-pending";
      li.querySelector(".step-icon").textContent = "○";
    });
  }

  function animateProcessingSteps() {
    const steps = $processingSteps.querySelectorAll("li");
    const delays = [0, 2000, 4000, 6500, 9000];

    STEP_NAMES.forEach((name, i) => {
      setTimeout(() => {
        steps[i].className = "step-active";
        steps[i].querySelector(".step-icon").textContent = "→";

        if (i > 0) {
          steps[i - 1].className = "step-done";
          steps[i - 1].querySelector(".step-icon").textContent = "✓";
        }
      }, delays[i]);
    });

    setTimeout(() => {
      const last = steps[steps.length - 1];
      last.className = "step-done";
      last.querySelector(".step-icon").textContent = "✓";
      processingDone = true;
    }, 11000);
  }

  function waitForProcessingComplete() {
    return new Promise(resolve => {
      const check = () => {
        if (processingDone) return resolve();
        setTimeout(check, 200);
      };
      check();
    });
  }

  async function runWorkflow() {
    showStage("processing");
    resetProcessingSteps();
    animateProcessingSteps();

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const json = await res.json();

      if (!json.success) {
        showError(json.error || "Workflow processing failed.");
        return;
      }

      apiData = json.data;

      reviewState = (apiData.review_queue || []).map(item => ({
        ...item,
        decision: null
      }));

      await waitForProcessingComplete();

      renderOutput();
      showStage("output");

    } catch (err) {
      console.error("Workflow error:", err);
      showError("Connection error. Ensure the server is running.");
    }
  }

  function showError(msg) {
    $errorMessage.textContent = msg;
    showStage("error");
  }

  function renderOutput() {
    renderSummary();
    renderClusters();
    renderProfile();
    renderAccounts();
    renderReviewQueue();
  }

  function switchTab(tab) {
    if (tab === "outbound") {
      $tabBtnOutbound.classList.add("active");
      $tabBtnInbound.classList.remove("active");
      $tabContentOutbound.classList.remove("hidden");
      $tabContentInbound.classList.add("hidden");
    } else {
      $tabBtnInbound.classList.add("active");
      $tabBtnOutbound.classList.remove("active");
      $tabContentInbound.classList.remove("hidden");
      $tabContentOutbound.classList.add("hidden");
    }
  }

  function renderSummary() {
    const d = apiData;
    const meta = d._meta || {};
    const totalRaw = meta.raw_account_count || 0;
    const resolvedCount = (d.accounts || []).length;
    const wonCount = (d.accounts || []).filter(a => a.stage === "won").length;
    const highScoreCount = (d.accounts || []).filter(a => a.lookalike_score >= 70).length;
    const reviewCount = (d.review_queue || []).length;

    const steps = [
      { num: totalRaw, label: "raw account<br>records" },
      { num: resolvedCount, label: "resolved<br>accounts" },
      { num: wonCount, label: "won-account<br>profile" + (wonCount !== 1 ? "s" : "") },
      { num: highScoreCount, label: "high-confidence<br>lookalikes" },
      { num: reviewCount, label: "held for<br>review" },
    ];

    $summaryBanner.innerHTML = `
      <div class="summary-inner">
        <div class="summary-title">Workflow Results</div>
        <div class="summary-flow">
          ${steps.map((s, i) => `
            ${i > 0 ? '<span class="summary-arrow">→</span>' : ""}
            <div class="summary-step" style="animation-delay: ${i * 0.1}s">
              <span class="step-num">${s.num}</span>
              <span class="step-label">${s.label}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderClusters() {
    const clusters = apiData.canonical_clusters || [];
    if (clusters.length === 0) {
      $clustersGrid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No duplicate clusters identified.</p>';
      return;
    }

    $clustersGrid.innerHTML = clusters.map((cluster, i) => `
      <div class="cluster-card" style="animation-delay: ${i * 0.08}s">
        <div class="cluster-canonical-name">
          <svg class="cluster-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          ${esc(cluster.canonical_name)}
        </div>
        <div class="cluster-raw-list">
          ${(cluster.raw_accounts || []).map(r => `
            <div class="cluster-raw-item">
              <span class="cluster-arrow">↳</span>
              <span class="cluster-raw-name">${esc(r)}</span>
            </div>
          `).join("")}
        </div>
        <div class="cluster-reason">${esc(cluster.reasoning)}</div>
      </div>
    `).join("");
  }

  function renderProfile() {
    const p = apiData.won_profile;
    if (!p) {
      $profileCard.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No won-account profile available.</p>';
      return;
    }

    const attrs = [
      { label: "Target Industry", val: p.industry },
      { label: "Company Size Band", val: p.company_size },
      { label: "Growth Stage", val: p.growth_stage },
      { label: "Sales Organization", val: p.sales_org },
      { label: "Key Buying Signals", val: (p.key_signals || []).join(", ") },
      { label: "Conversion Profile", val: p.description },
    ].filter(a => a.val);

    $profileCard.innerHTML = `
      <div class="profile-card-inner">
        <div class="profile-header-row">
          <div>
            <div class="profile-badge">WON-ACCOUNT BENCHMARK</div>
            <div class="profile-name">${esc(p.account_name || "Won Customer")}</div>
          </div>
        </div>
        <div class="profile-attrs">
          ${attrs.map(a => `
            <div class="profile-attr">
              <div class="profile-attr-label">${esc(a.label)}</div>
              <div class="profile-attr-val">${esc(a.val)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderAccounts() {
    const accounts = apiData.accounts || [];
    const sorted = [...accounts].sort((a, b) => {
      if (a.stage === "won") return -1;
      if (b.stage === "won") return 1;
      return (b.lookalike_score || 0) - (a.lookalike_score || 0);
    });

    $accountsGrid.innerHTML = sorted.map((acct, i) => {
      const score = acct.lookalike_score;
      const hasScore = score !== null && score !== undefined && acct.stage !== "won";
      const scoreClass = score >= 70 ? "high" : score >= 40 ? "med" : "low";
      const stageClass = acct.stage === "won" ? "badge-won" : acct.stage === "lost" ? "badge-lost" : "badge-open";

      return `
        <div class="account-card" style="animation-delay: ${i * 0.05}s">
          <div class="account-card-header">
            <div>
              <div class="account-card-name">${esc(acct.canonical_name)}</div>
              ${acct.domain ? `<div class="account-card-domain">${esc(acct.domain)}</div>` : ""}
            </div>
            <span class="account-stage-badge ${stageClass}">${esc(acct.stage)}</span>
          </div>

          <div class="account-meta">
            ${acct.size_band ? `<div class="account-meta-item"><span>Size</span> ${esc(acct.size_band)}</div>` : ""}
            ${acct.industry ? `<div class="account-meta-item"><span>Industry</span> ${esc(acct.industry)}</div>` : ""}
          </div>

          ${renderContacts(acct.contacts)}
          ${renderSignals(acct.signals)}

          ${hasScore ? `
            <div class="lookalike-section">
              <div class="lookalike-header">
                <span class="lookalike-label">Lookalike Score</span>
                <span class="lookalike-score score-${scoreClass}">${score}%</span>
              </div>
              <div class="lookalike-bar">
                <div class="lookalike-bar-fill fill-${scoreClass}" style="width: 0%" data-target="${score}"></div>
              </div>
              ${(acct.lookalike_reasons || []).length > 0 ? `
                <div class="lookalike-reasons">
                  ${acct.lookalike_reasons.map(r => `<div class="lookalike-reason">${esc(r)}</div>`).join("")}
                </div>
              ` : ""}

              ${score >= 60 ? `
                <button class="btn-draft-outreach" data-account="${esc(acct.canonical_name)}" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-sm-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Draft Outreach Email ✨
                </button>
              ` : ""}
            </div>
          ` : ""}
        </div>
      `;
    }).join("");

    requestAnimationFrame(() => {
      setTimeout(() => {
        document.querySelectorAll(".lookalike-bar-fill").forEach(bar => {
          bar.style.width = bar.dataset.target + "%";
        });
      }, 100);
    });

    $accountsGrid.querySelectorAll(".btn-draft-outreach").forEach(btn => {
      btn.addEventListener("click", () => openOutreachDraft(btn.dataset.account));
    });
  }

  function renderContacts(contacts) {
    if (!contacts || contacts.length === 0) return "";
    return `
      <div class="account-contacts">
        <div class="account-contacts-title">Contacts</div>
        ${contacts.map(c => `
          <div class="contact-row">
            <span class="contact-name">${esc(c.name)}</span>
            <span class="contact-sep">·</span>
            <span class="contact-title">${esc(c.title_normalized || c.title || "")}</span>
            ${c.email ? `<span class="contact-sep">·</span><span class="contact-email">${esc(c.email)}</span>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSignals(signals) {
    if (!signals || signals.length === 0) return "";
    return `
      <div class="account-signals">
        <div class="account-signals-title">Signals</div>
        ${signals.map(s => `
          <div class="signal-row">
            <span class="signal-date">${s.approx_date || "—"}</span>
            <span class="signal-dot"></span>
            <span class="signal-detail">
              ${esc(s.detail)}
              <span class="signal-type-badge">${esc(s.type)}</span>
            </span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderReviewQueue() {
    if (reviewState.length === 0) {
      $reviewQueue.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No accounts queued for review.</p>';
      $reviewCounters.innerHTML = "";
      $btnReset.classList.add("hidden");
      return;
    }

    const pending = reviewState.filter(r => r.decision === null).length;
    const approved = reviewState.filter(r => r.decision === "approved").length;
    const rejected = reviewState.filter(r => r.decision === "rejected").length;

    $reviewCounters.innerHTML = `
      <span class="counter-pending">${pending} pending</span>
      ${approved > 0 ? `<span class="counter-approved">${approved} approved</span>` : ""}
      ${rejected > 0 ? `<span class="counter-rejected">${rejected} rejected</span>` : ""}
    `;

    $reviewQueue.innerHTML = reviewState.map((item, i) => {
      const decided = item.decision !== null;
      return `
        <div class="review-card ${decided ? "review-card-decided" : ""}" data-index="${i}">
          <div class="review-card-name">${esc(item.account)}</div>
          <div class="review-card-score">${item.score || "—"}% lookalike match</div>
          <div class="review-card-reason">${esc(item.reason)}</div>
          <div class="review-card-status">Held for review before outreach</div>
          ${decided ? `
            <span class="decision-badge decision-${item.decision}">${item.decision}</span>
            ${item.decision === "approved" ? `
              <button class="btn-draft-outreach" data-account="${esc(item.account)}" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-sm-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Draft Outreach Email ✨
              </button>
            ` : ""}
          ` : `
            <div class="review-actions">
              <button class="btn-approve" data-index="${i}" type="button">Approve</button>
              <button class="btn-reject" data-index="${i}" type="button">Reject</button>
            </div>
            <button class="btn-draft-outreach" data-account="${esc(item.account)}" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-sm-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Draft Outreach Email ✨
            </button>
          `}
        </div>
      `;
    }).join("");

    $btnReset.classList.toggle("hidden", approved === 0 && rejected === 0);

    $reviewQueue.querySelectorAll(".btn-approve").forEach(btn => {
      btn.addEventListener("click", () => handleDecision(parseInt(btn.dataset.index), "approved"));
    });
    $reviewQueue.querySelectorAll(".btn-reject").forEach(btn => {
      btn.addEventListener("click", () => handleDecision(parseInt(btn.dataset.index), "rejected"));
    });
    $reviewQueue.querySelectorAll(".btn-draft-outreach").forEach(btn => {
      btn.addEventListener("click", () => openOutreachDraft(btn.dataset.account));
    });
  }

  function handleDecision(index, decision) {
    if (reviewState[index]) {
      reviewState[index].decision = decision;
      renderReviewQueue();
    }
  }

  function resetReview() {
    reviewState = reviewState.map(item => ({ ...item, decision: null }));
    renderReviewQueue();
  }

  async function runQualifyAgent() {
    if (!apiData || !apiData.won_profile) {
      alert("Please run the main workflow first to mine the won-account profile.");
      return;
    }

    $btnRunQualify.disabled = true;
    $btnRunQualify.innerHTML = `
      <div class="processing-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px"></div>
      Evaluating Inbound Leads...
    `;

    $inboundContainer.innerHTML = `
      <div class="inbound-empty-prompt">
        <div class="processing-spinner" style="margin: 0 auto 16px;"></div>
        <h3>Frontrunner Inbound Agent is Qualifying Leads</h3>
        <p>Matching 8 inbound demo requests & form submissions against won-account ICP...</p>
      </div>
    `;

    try {
      const res = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wonProfile: apiData.won_profile })
      });

      const json = await res.json();
      if (!json.success || !json.data || !json.data.qualified_leads) {
        throw new Error(json.error || "Qualification failed");
      }

      qualifiedLeads = json.data.qualified_leads;

      const sq = qualifiedLeads.filter(l => l.grade === "sales_qualified").length;
      const mn = qualifiedLeads.filter(l => l.grade === "marketing_nurture").length;
      const dq = qualifiedLeads.filter(l => l.grade === "disqualify").length;

      $countAll.textContent = qualifiedLeads.length;
      $countSq.textContent = sq;
      $countMn.textContent = mn;
      $countDq.textContent = dq;

      $inboundStatsPill.textContent = `${sq} sales ready · ${mn} nurture · ${dq} disqualified`;
      $inboundFilterBar.classList.remove("hidden");

      renderQualifiedLeads();

    } catch (err) {
      console.error("Qualify error:", err);
      $inboundContainer.innerHTML = `
        <div class="inbound-empty-prompt" style="border-color:var(--danger)">
          <p style="color:var(--danger)">Failed to qualify inbound leads. Please retry.</p>
        </div>
      `;
    } finally {
      $btnRunQualify.disabled = false;
      $btnRunQualify.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-sm-icon"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>Re-run Inbound Agent</span>
      `;
    }
  }

  function renderQualifiedLeads() {
    let filtered = qualifiedLeads;
    if (currentInboundFilter !== "all") {
      filtered = qualifiedLeads.filter(l => l.grade === currentInboundFilter);
    }

    if (filtered.length === 0) {
      $inboundContainer.innerHTML = `
        <div class="inbound-empty-prompt">
          <p>No leads match the selected filter.</p>
        </div>
      `;
      return;
    }

    const rawMap = {};
    if (rawDataset && rawDataset.inboundLeads) {
      rawDataset.inboundLeads.forEach(r => { rawMap[r.id] = r; });
    }

    $inboundContainer.innerHTML = `
      <div class="inbound-leads-grid">
        ${filtered.map(l => {
          const raw = rawMap[l.id] || {};
          const gradeLabel = l.grade === "sales_qualified" ? "Sales Qualified" :
                             l.grade === "marketing_nurture" ? "Marketing Nurture" : "Disqualified";
          const fillClass = l.grade === "sales_qualified" ? "fill-sq" :
                            l.grade === "marketing_nurture" ? "fill-mn" : "fill-dq";

          return `
            <div class="inbound-lead-card grade-${l.grade}">
              <div class="lead-card-top">
                <div>
                  <div class="lead-person-name">${esc(l.name)}</div>
                  <div class="lead-person-title">${esc(raw.title || "Prospect")}</div>
                  <span class="lead-company-badge">${esc(l.company || raw.company || "Independent")}</span>
                </div>
                <span class="grade-badge badge-${l.grade}">${gradeLabel}</span>
              </div>

              ${raw.source ? `
                <div class="lead-source-row">
                  <span>Source: <strong>${esc(raw.source)}</strong></span>
                  <span>${esc(raw.email || "")}</span>
                </div>
              ` : ""}

              ${raw.message ? `
                <div class="lead-msg-quote">"${esc(raw.message)}"</div>
              ` : ""}

              <div class="confidence-box">
                <div class="confidence-header">
                  <span>ICP Fit Confidence</span>
                  <span>${l.confidence || 75}%</span>
                </div>
                <div class="confidence-track">
                  <div class="confidence-fill ${fillClass}" style="width: ${l.confidence || 75}%"></div>
                </div>
              </div>

              <div class="lead-reasoning">
                ${esc(l.reasoning)}
              </div>

              ${(l.icp_match_factors || []).length > 0 ? `
                <div class="lead-factors">
                  ${l.icp_match_factors.map(f => {
                    const isNeg = f.toLowerCase().includes("no") || f.toLowerCase().includes("not") || f.toLowerCase().includes("mismatch") || f.toLowerCase().includes("lacks");
                    return `<span class="factor-pill ${isNeg ? "neg" : "pos"}">${esc(f)}</span>`;
                  }).join("")}
                </div>
              ` : ""}

              <div class="lead-action-box">
                <span class="next-action-label">Agent Recommended Action:</span>
                <span class="next-action-value">${esc(l.next_action)}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  async function openOutreachDraft(accountName) {
    $modalOutreach.classList.remove("hidden");
    $modalOutreachTitle.textContent = `Drafting Outreach for ${accountName}...`;
    $btnCopyEmail.classList.add("hidden");
    $btnSimulateSend.classList.add("hidden");

    $modalOutreachBody.innerHTML = `
      <div class="modal-loading">
        <div class="processing-spinner"></div>
        <p>Frontrunner SDR Agent is drafting a high-converting cold email tailored to <strong>${esc(accountName)}</strong> and referencing won-customer insights...</p>
      </div>
    `;

    let accountObj = (apiData.accounts || []).find(a => a.canonical_name === accountName);
    if (!accountObj) {
      accountObj = { canonical_name: accountName, industry: "B2B SaaS" };
    }

    try {
      const res = await fetch("/api/draft-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: accountObj,
          wonProfile: apiData.won_profile
        })
      });

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "Failed to generate outreach");
      }

      currentDraftEmail = json.data;
      $modalOutreachTitle.textContent = `Outreach Draft · ${accountName}`;
      $btnCopyEmail.classList.remove("hidden");
      $btnSimulateSend.classList.remove("hidden");

      renderOutreachModal(currentDraftEmail);

    } catch (err) {
      console.error("Outreach draft error:", err);
      $modalOutreachBody.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--danger)">
          <p>Failed to generate personalized email draft. Please retry.</p>
        </div>
      `;
    }
  }

  function renderOutreachModal(draft) {
    $modalOutreachBody.innerHTML = `
      <div class="outreach-meta-card">
        <div class="meta-row">
          <span class="meta-label">To:</span>
          <span class="meta-val">${esc(draft.to_name || "Prospect")} ${draft.to_email ? `&lt;${esc(draft.to_email)}&gt;` : ""}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Company:</span>
          <span class="meta-val">${esc(draft.to_company || "Target Company")}</span>
        </div>
      </div>

      <div class="outreach-subject-row">
        <span style="color:var(--text-muted);font-weight:600">Subject:</span>
        <span style="color:var(--text-primary);font-weight:600">${esc(draft.subject)}</span>
      </div>

      <div class="outreach-body-preview">${esc(draft.body)}</div>

      ${(draft.personalization_notes || []).length > 0 ? `
        <div class="personalization-box">
          <div class="personalization-title">Agent Personalization Strategy</div>
          <div class="personalization-list">
            ${draft.personalization_notes.map(n => `<span class="p-pill">${esc(n)}</span>`).join("")}
          </div>
        </div>
      ` : ""}
    `;
  }

  function closeModal() {
    $modalOutreach.classList.add("hidden");
    currentDraftEmail = null;
  }

  function copyEmailDraft() {
    if (!currentDraftEmail) return;

    const fullText = `Subject: ${currentDraftEmail.subject}\n\n${currentDraftEmail.body}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        setCopySuccess();
      }).catch(() => {
        fallbackCopy(fullText);
      });
    } else {
      fallbackCopy(fullText);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      setCopySuccess();
    } catch (e) {
      console.error(e);
    }
    document.body.removeChild(ta);
  }

  function setCopySuccess() {
    $btnCopyEmail.classList.add("copied");
    $copyBtnText.textContent = "Copied!";
    setTimeout(() => {
      $btnCopyEmail.classList.remove("copied");
      $copyBtnText.textContent = "Copy Email";
    }, 2000);
  }

  function simulateSendEmail() {
    showToast(`✉️ Outreach scheduled to ${currentDraftEmail ? currentDraftEmail.to_name || "prospect" : "prospect"} and logged to CRM`);
    closeModal();
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast-notice";
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#4ecdc4"><path d="M20 6L9 17l-5-5"/></svg>
      <span>${esc(msg)}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "all 0.4s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  function esc(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
