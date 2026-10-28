// Venus CRM Recruiter Copilot - Popup Controller

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const statusIndicator = document.getElementById("status-indicator");
  const statusLabel = document.getElementById("status-label");
  const jobsCountBadge = document.getElementById("jobs-count");

  // Tabs
  const tabJobsBtn = document.getElementById("tab-jobs-btn");
  const tabSourcingBtn = document.getElementById("tab-sourcing-btn");
  const tabIntentBtn = document.getElementById("tab-intent-btn");
  const tabSettingsBtn = document.getElementById("tab-settings-btn");
  const sectionJobs = document.getElementById("section-jobs");
  const sectionSourcing = document.getElementById("section-sourcing");
  const sectionIntentNews = document.getElementById("section-intent-news");
  const sectionSettings = document.getElementById("section-settings");

  // Jobs section
  const searchInput = document.getElementById("job-search-input");
  const refreshJobsBtn = document.getElementById("refresh-jobs-btn");
  const jobsLoading = document.getElementById("jobs-loading");
  const jobsEmpty = document.getElementById("jobs-empty");
  const jobsList = document.getElementById("jobs-list");

  // Sourcing section
  const rescanCandidateBtn = document.getElementById("btn-rescan-candidate");
  const sourcingIdle = document.getElementById("sourcing-idle");
  const sourcingCard = document.getElementById("sourcing-card");
  const candName = document.getElementById("cand-name");
  const candTitle = document.getElementById("cand-title");
  const candLoc = document.getElementById("cand-loc");
  const candSkills = document.getElementById("cand-skills");
  const candJobSelect = document.getElementById("cand-job-select");
  const importCandidateBtn = document.getElementById("btn-import-candidate-action");

  // Intent News section
  const btnRescanIntent = document.getElementById("btn-rescan-intent");
  const intentIdle = document.getElementById("intent-idle");
  const intentCard = document.getElementById("intent-card");
  const intentVipBanner = document.getElementById("intent-vip-banner");
  const intentStdBanner = document.getElementById("intent-std-banner");
  const intentScoreBadge = document.getElementById("intent-score-badge");
  const intentScoreBadgeStd = document.getElementById("intent-score-badge-std");
  const intentHubBanner = document.getElementById("intent-hub-banner");
  const intentHubText = document.getElementById("intent-hub-text");
  const intentArticleTitle = document.getElementById("intent-article-title");
  const intentCompanyInput = document.getElementById("intent-company-input");
  const intentSourceDomain = document.getElementById("intent-source-domain");
  const intentErpTags = document.getElementById("intent-erp-tags");
  const intentAiTags = document.getElementById("intent-ai-tags");
  const btnIngestIntentAction = document.getElementById("btn-ingest-intent-action");
  const intentIngestResult = document.getElementById("intent-ingest-result");
  const intentDmName = document.getElementById("intent-dm-name");
  const intentDmTitle = document.getElementById("intent-dm-title");
  const intentDmEmail = document.getElementById("intent-dm-email");
  const intentDmPhone = document.getElementById("intent-dm-phone");
  const intentPitchText = document.getElementById("intent-pitch-text");
  const btnCopyPitch = document.getElementById("btn-copy-pitch");

  // Settings section
  const serverUrlInput = document.getElementById("setting-server-url");
  const saveSettingsBtn = document.getElementById("btn-save-settings");
  const accountLoggedIn = document.getElementById("account-logged-in");
  const accountLoggedOut = document.getElementById("account-logged-out");
  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  const toast = document.getElementById("toast");

  // State
  let allJobs = [];
  let currentSettings = { serverUrl: "https://crm.venusglobaltech.com", authToken: null, currentUser: null };
  let extractedCandidate = null;
  let currentScrapedIntent = null;

  // Show Toast
  // Auto-browse (see runAutoBrowse in background.js)
  const autoBrowseToggle = document.getElementById("auto-browse-toggle");
  const autoBrowseStatus = document.getElementById("auto-browse-status");
  const btnAutoBrowseNow = document.getElementById("btn-auto-browse-now");

  function renderAutoBrowseStatus(run) {
    if (!run) return;
    const when = new Date(run.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    autoBrowseStatus.textContent = run.error
      ? `Last run ${when}: ${run.error}`
      : `Last run ${when}: read ${run.read} article(s)${run.failed ? `, ${run.failed} could not be read` : ""}.`;
  }

  chrome.storage.local.get(["autoBrowseEnabled", "autoBrowseLastRun"], (d) => {
    autoBrowseToggle.checked = !!d.autoBrowseEnabled;
    renderAutoBrowseStatus(d.autoBrowseLastRun);
  });

  autoBrowseToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({ action: "SET_AUTO_BROWSE", enabled: autoBrowseToggle.checked }, () => {
      showToast(autoBrowseToggle.checked ? "Auto-browse on: checking every 30 min" : "Auto-browse off");
    });
  });

  btnAutoBrowseNow.addEventListener("click", () => {
    btnAutoBrowseNow.disabled = true;
    autoBrowseStatus.textContent = "Reading queued articles in background tabs...";
    chrome.runtime.sendMessage({ action: "RUN_AUTO_BROWSE_NOW" }, (res) => {
      btnAutoBrowseNow.disabled = false;
      if (res) renderAutoBrowseStatus(res);
    });
  });

  function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.className = "toast";
    }, 3000);
  }

  // Switch Tabs
  function switchTab(tabName) {
    [tabJobsBtn, tabSourcingBtn, tabIntentBtn, tabSettingsBtn].forEach((btn) => btn.classList.remove("active"));
    [sectionJobs, sectionSourcing, sectionIntentNews, sectionSettings].forEach((sec) => (sec.style.display = "none"));

    if (tabName === "jobs") {
      tabJobsBtn.classList.add("active");
      sectionJobs.style.display = "block";
    } else if (tabName === "sourcing") {
      tabSourcingBtn.classList.add("active");
      sectionSourcing.style.display = "block";
      scanCurrentTabCandidate();
    } else if (tabName === "intent") {
      tabIntentBtn.classList.add("active");
      sectionIntentNews.style.display = "block";
      scanCurrentTabIntent();
    } else if (tabName === "settings") {
      tabSettingsBtn.classList.add("active");
      sectionSettings.style.display = "block";
    }
  }

  tabJobsBtn.addEventListener("click", () => switchTab("jobs"));
  tabSourcingBtn.addEventListener("click", () => switchTab("sourcing"));
  tabIntentBtn.addEventListener("click", () => switchTab("intent"));
  tabSettingsBtn.addEventListener("click", () => switchTab("settings"));

  // Init Settings & Status (Instant 0ms render from cache + silent background sync)
  function init() {
    chrome.storage.local.get(["serverUrl", "authToken", "currentUser", "cachedJobs"], (data) => {
      let serverUrl = data.serverUrl;
      // Auto-migrate stale localhost default to cloud production
      if (!serverUrl || serverUrl === "http://localhost:4001") {
        serverUrl = "https://crm.venusglobaltech.com";
        chrome.storage.local.set({ serverUrl });
      }

      currentSettings = {
        serverUrl,
        authToken: data.authToken || null,
        currentUser: data.currentUser || null,
      };

      if (serverUrlInput) {
        serverUrlInput.value = serverUrl;
      }

      updateAuthUI(data.currentUser);

      // Instantly render cached requisitions if available (0ms latency)
      if (Array.isArray(data.cachedJobs) && data.cachedJobs.length > 0) {
        allJobs = data.cachedJobs;
        jobsCountBadge.textContent = allJobs.length;
        renderJobs(allJobs);
        populateRequisitionSelect(allJobs);
        jobsLoading.style.display = "none";
        jobsEmpty.style.display = "none";
        // Silently refresh in background
        loadJobs(true);
      } else {
        // No cache yet, fetch from server with loading spinner
        loadJobs(false);
      }
    });
  }

  function updateAuthUI(user) {
    if (user && currentSettings.authToken) {
      statusIndicator.className = "status-indicator online";
      statusLabel.textContent = `${user.firstName || "Recruiter"}`;
      accountLoggedIn.style.display = "flex";
      accountLoggedOut.style.display = "none";
      userName.textContent = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Venus Recruiter";
      userEmail.textContent = user.email || "";
    } else {
      statusIndicator.className = "status-indicator online";
      statusLabel.textContent = "Public Mode";
      accountLoggedIn.style.display = "none";
      accountLoggedOut.style.display = "flex";
    }
  }

  // Load Jobs
  function loadJobs(silent = false) {
    if (!silent && allJobs.length === 0) {
      jobsLoading.style.display = "flex";
      jobsEmpty.style.display = "none";
      jobsList.innerHTML = "";
    }

    chrome.runtime.sendMessage({ action: "FETCH_JOBS" }, (res) => {
      jobsLoading.style.display = "none";
      if (res && res.success && Array.isArray(res.jobs) && res.jobs.length > 0) {
        allJobs = res.jobs;
        jobsCountBadge.textContent = allJobs.length;
        statusIndicator.className = "status-indicator online";
        jobsEmpty.style.display = "none";
        renderJobs(allJobs);
        populateRequisitionSelect(allJobs);
      } else if (allJobs.length === 0) {
        if (res && res.jobs && res.jobs.length === 0) {
          jobsEmpty.style.display = "flex";
          jobsEmpty.querySelector("p").textContent = "No open requisitions found on Venus CRM.";
        } else {
          statusIndicator.className = "status-indicator offline";
          statusLabel.textContent = "Offline";
          jobsEmpty.style.display = "flex";
          jobsEmpty.querySelector("p").textContent = res?.error || "Could not connect to Venus CRM.";
        }
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatLocation(loc) {
    if (!loc) return "Remote";
    let s = String(loc).trim();
    s = s.replace(/^\[["']?/, "").replace(/["']?\]$/, "").replace(/^"|"$/g, "").trim();
    s = s.replace(/,\s*\d{4,6}$/, "").trim();
    return s || "Remote";
  }

  function formatEmploymentType(type) {
    if (!type) return "Full-Time";
    const map = {
      FULL_TIME: "Full-Time",
      PART_TIME: "Part-Time",
      CONTRACT: "Contract",
      INTERNSHIP: "Internship",
      TEMPORARY: "Temporary",
    };
    return map[type.toUpperCase()] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatSalary(job) {
    if (!job.budgetMin && !job.budgetMax) return "Competitive";
    const curr = job.currency === "USD" ? "$" : (job.currency || "$");
    const min = job.budgetMin;
    const max = job.budgetMax;
    if (min && max && min !== max) {
      const minStr = min >= 1000 ? `${(min / 1000).toFixed(min % 1000 === 0 ? 0 : 1)}k` : min.toLocaleString();
      const maxStr = max >= 1000 ? `${(max / 1000).toFixed(max % 1000 === 0 ? 0 : 1)}k` : max.toLocaleString();
      return `${curr}${minStr} – ${curr}${maxStr}`;
    }
    if (min) {
      const minStr = min >= 1000 ? `${(min / 1000).toFixed(min % 1000 === 0 ? 0 : 1)}k` : min.toLocaleString();
      return `${curr}${minStr}/yr`;
    }
    return "Competitive";
  }

  // Render Jobs
  function renderJobs(jobs) {
    jobsList.innerHTML = "";
    jobs.forEach((job) => {
      const card = document.createElement("div");
      card.className = "job-card";

      const cleanLoc = formatLocation(job.location);
      const cleanType = formatEmploymentType(job.employmentType);
      const cleanSalary = formatSalary(job);

      const skillsHtml = (job.skillsRequired || [])
        .slice(0, 4)
        .map((s) => `<span class="skill-tag">${escapeHtml(s)}</span>`)
        .join("");

      card.innerHTML = `
        <div class="job-header">
          <div class="job-title-group">
            <span class="job-title">${escapeHtml(job.title)}</span>
            <span class="job-code">${escapeHtml(job.jobCode || "REQ")}</span>
          </div>
          <span class="job-status-pill">Active</span>
        </div>
        <div class="job-meta">
          <span class="meta-item">
            <svg class="meta-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${escapeHtml(cleanLoc)}
          </span>
          <span class="meta-dot">•</span>
          <span class="meta-item meta-type">${escapeHtml(cleanType)}</span>
          <span class="meta-dot">•</span>
          <span class="meta-item job-salary">${escapeHtml(cleanSalary)}</span>
        </div>
        ${skillsHtml ? `<div class="job-skills">${skillsHtml}</div>` : ""}
        <div class="job-actions">
          <button class="btn-fill" data-id="${job.id}">
            <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span>Auto-Fill Page</span>
          </button>
          <button class="btn-post" data-id="${job.id}" title="Copy viral post to clipboard">
            <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
            <span>Post</span>
          </button>
          <button class="icon-button" data-apply-id="${job.id}" title="Copy career apply link">
            <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </button>
        </div>
      `;

      // Button handlers
      const fillBtn = card.querySelector(".btn-fill");
      fillBtn.addEventListener("click", () => handleAutoFill(job, fillBtn));

      const postBtn = card.querySelector(".btn-post");
      postBtn.addEventListener("click", () => handleDraftPost(job));

      const applyBtn = card.querySelector("[data-apply-id]");
      applyBtn.addEventListener("click", () => {
        const url = `${currentSettings.serverUrl.replace(/\/$/, "")}/careers/${job.id}`;
        navigator.clipboard.writeText(url).then(() => {
          showToast("Copied career apply link!");
        });
      });

      jobsList.appendChild(card);
    });
  }

  // Auto-Fill Handler
  function handleAutoFill(job, btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="display:inline-block;width:12px;height:12px;border-width:2px;margin-right:6px;"></span><span>Filling...</span>`;

    chrome.runtime.sendMessage({ action: "TRIGGER_AUTO_FILL", job }, (res) => {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>Auto-Fill Page</span>
      `;

      if (res && res.success) {
        showToast(res.message || "Requisition auto-filled on page!");
      } else {
        showToast(res?.error || "Could not fill on this page. Navigate to job posting form.", "error");
      }
    });
  }

  // Draft Post Handler
  function handleDraftPost(job) {
    const skillsText = (job.skillsRequired || []).map((s) => `• ${s}`).join("\n");
    const hashtags = (job.skillsRequired || [])
      .slice(0, 4)
      .map((s) => `#${s.replace(/[^a-zA-Z0-9]/g, "")}`)
      .join(" ");

    const postText = `🚀 WE ARE HIRING! 🚀\n\nWe are looking for an exceptional ${job.title} to join our team!\n\n📍 Location: ${job.location || "Remote"}\n💼 Type: ${job.employmentType || "Full-time"}\n\nKey Requirements:\n${skillsText || "• Proven track record and passion for building scalable solutions"}\n\n📌 Apply directly through our official Venus Careers portal:\n${currentSettings.serverUrl.replace(/\/$/, "")}/careers/${job.id}\n\n#Hiring #Careers #JobOpening ${hashtags}`;

    navigator.clipboard.writeText(postText).then(() => {
      showToast("Copied viral hiring post! Ready to paste into LinkedIn feed.");
    });
  }

  // Filter Jobs Search
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderJobs(allJobs);
      return;
    }
    const filtered = allJobs.filter((j) => {
      const titleMatch = (j.title || "").toLowerCase().includes(q);
      const codeMatch = (j.jobCode || "").toLowerCase().includes(q);
      const locMatch = (j.location || "").toLowerCase().includes(q);
      const skillsMatch = (j.skillsRequired || []).some((s) => s.toLowerCase().includes(q));
      return titleMatch || codeMatch || locMatch || skillsMatch;
    });
    renderJobs(filtered);
  });

  refreshJobsBtn.addEventListener("click", loadJobs);

  // Sourcing Candidate Detection
  function scanCurrentTabCandidate() {
    chrome.runtime.sendMessage({ action: "TRIGGER_EXTRACT_CANDIDATE" }, (res) => {
      if (res && res.success && res.candidate) {
        extractedCandidate = res.candidate;
        sourcingIdle.style.display = "none";
        sourcingCard.style.display = "flex";

        candName.textContent = extractedCandidate.fullName || `${extractedCandidate.firstName} ${extractedCandidate.lastName}`;
        candTitle.textContent = extractedCandidate.currentTitle || "Professional";
        candLoc.textContent = `📍 ${extractedCandidate.city || "Location detected"} ${extractedCandidate.state || ""}`;

        candSkills.innerHTML = (extractedCandidate.skills || [])
          .map((s) => `<span class="skill-tag">${s}</span>`)
          .join("");
      } else {
        extractedCandidate = null;
        sourcingIdle.style.display = "flex";
        sourcingCard.style.display = "none";
      }
    });
  }

  rescanCandidateBtn.addEventListener("click", scanCurrentTabCandidate);

  function populateRequisitionSelect(jobs) {
    candJobSelect.innerHTML = jobs
      .map((j) => `<option value="${j.id}">${j.title} (${j.location || "Remote"})</option>`)
      .join("");
  }

  // Import Candidate Action
  importCandidateBtn.addEventListener("click", () => {
    if (!extractedCandidate) return;

    importCandidateBtn.disabled = true;
    importCandidateBtn.textContent = "Importing to Venus...";

    const candidatePayload = {
      ...extractedCandidate,
      jobPostingId: candJobSelect.value || (allJobs[0] ? allJobs[0].id : undefined),
    };

    chrome.runtime.sendMessage(
      { action: "IMPORT_CANDIDATE", candidateData: candidatePayload },
      (res) => {
        importCandidateBtn.disabled = false;
        importCandidateBtn.textContent = "📥 1-Click Import to Venus Pipeline";

        if (res && res.success) {
          showToast(`Successfully imported ${extractedCandidate.fullName} into Venus CRM!`);
        } else {
          showToast(res?.error || "Failed to import candidate", "error");
        }
      }
    );
  });

  // Intent News Scanning & Ingestion
  function scanCurrentTabIntent() {
    intentIngestResult.style.display = "none";
    intentArticleTitle.textContent = "Scanning active tab for ERP AI & buying signals...";
    intentCompanyInput.value = "";
    intentSourceDomain.textContent = "scanning...";
    intentErpTags.innerHTML = '<span class="placeholder-tag">Scanning ERP vendors...</span>';
    intentAiTags.innerHTML = '<span class="placeholder-tag">Scanning AI triggers...</span>';
    intentVipBanner.style.display = "none";
    intentStdBanner.style.display = "none";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        showIntentIdle();
        return;
      }

      // Check if URL is internal browser page (chrome://, edge://, about:, devtools:)
      const isInternalPage = !activeTab.url || /^(chrome|chrome-extension|edge|about|devtools):/i.test(activeTab.url);
      if (isInternalPage) {
        fallbackTabScan(activeTab);
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "GET_CURRENT_PAGE_INTENT" }, (response) => {
        if (!chrome.runtime.lastError && response && response.success && response.data) {
          renderIntentCard(response.data);
          return;
        }

        // Content script didn't answer (e.g. page was opened before extension reload).
        // Try programmatically injecting scripts/content-intent-scanner.js on the fly.
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              files: ["scripts/content-intent-scanner.js"],
            },
            () => {
              if (chrome.runtime.lastError) {
                fallbackTabScan(activeTab);
                return;
              }

              // Give script a moment to register listeners, then retry
              setTimeout(() => {
                chrome.tabs.sendMessage(activeTab.id, { action: "GET_CURRENT_PAGE_INTENT" }, (retryRes) => {
                  if (!chrome.runtime.lastError && retryRes && retryRes.success && retryRes.data) {
                    renderIntentCard(retryRes.data);
                  } else {
                    fallbackTabScan(activeTab);
                  }
                });
              }, 120);
            }
          );
        } else {
          fallbackTabScan(activeTab);
        }
      });
    });
  }

  function fallbackTabScan(tab) {
    try {
      const title = tab.title || "Enterprise Buying Signal";
      const url = tab.url || "";
      let domain = "web";
      try {
        if (url && !/^(chrome|chrome-extension|edge|about|devtools):/i.test(url)) {
          domain = new URL(url).hostname.replace(/^www\./, "");
        }
      } catch {}

      const isInternalPage = /^(chrome|chrome-extension|edge|about|devtools):/i.test(url);
      const isErp = /\b(SAP|Oracle|NetSuite|Dynamics\s*365|Workday|ServiceNow|Infor)\b/i.test(title);
      const isAi = /\b(AI|GenAI|Copilot|Agent|LLM|Automation)\b/i.test(title);
      const isErpAi = Boolean(isErp && isAi);
      const cleanDomain = domain.toLowerCase().replace(/^(?:www|press|news|newsroom|corporate|investor|about|media|ir|global)\./, "");
      const rootName = cleanDomain.split(".")[0].replace(/[^a-z0-9]/g, "");

      const KNOWN_ENTERPRISES = {
        bmwgroup: "BMW Group",
        bmw: "BMW Group",
        siemens: "Siemens",
        sap: "SAP",
        oracle: "Oracle",
        microsoft: "Microsoft",
        fedex: "FedEx",
        uber: "Uber",
        target: "Target",
        walmart: "Walmart",
        pfizer: "Pfizer",
        nestle: "Nestlé",
        unilever: "Unilever",
        pepsico: "PepsiCo",
        cocacola: "The Coca-Cola Company",
        airbus: "Airbus",
        se: "Schneider Electric",
        loreal: "L'Oréal",
        dhl: "DHL Group",
        bosch: "Bosch",
        mercedesbenz: "Mercedes-Benz",
        mercedes: "Mercedes-Benz",
        bayer: "Bayer",
        hp: "HP Inc.",
        heineken: "Heineken",
        kraftheinz: "Kraft Heinz",
        macys: "Macy's",
        chevron: "Chevron",
        honeywell: "Honeywell",
        comcast: "Comcast",
        salesforce: "Salesforce",
        sony: "Sony Group",
        astrazeneca: "AstraZeneca",
        delta: "Delta Air Lines",
        bookingholdings: "Booking Holdings",
        adobe: "Adobe",
        ge: "General Electric",
        stryker: "Stryker",
        westerndigital: "Western Digital",
        hsbc: "HSBC",
        broadcom: "Broadcom",
        att: "AT&T",
        caesars: "Caesars Entertainment",
        dropbox: "Dropbox",
        chipotle: "Chipotle",
        hertz: "Hertz",
        orange: "Orange",
        cognizant: "Cognizant",
        emerson: "Emerson",
        xerox: "Xerox",
        lyft: "Lyft",
        rockwellautomation: "Rockwell Automation",
        ecolab: "Ecolab"
      };

      let detectedCompany = KNOWN_ENTERPRISES[rootName] || "";
      if (!detectedCompany && rootName.length > 2 && !isInternalPage && !/^(chrome|extensions|newtab|blank)$/i.test(rootName)) {
        detectedCompany = rootName.charAt(0).toUpperCase() + rootName.slice(1);
      }

      const isHubPage =
        /^(PressClub|Newsroom|Press Releases?|Media Center|Latest News|Home|PressClub Global)/i.test(title) ||
        /\b(pressclub|newsroom|media-center|press-releases?)\b/i.test(url);

      const displayTitle = isInternalPage
        ? "Navigate to any enterprise news article or site in Chrome"
        : title;

      const data = {
        articleTitle: displayTitle,
        articleUrl: url,
        sourceDomain: isInternalPage ? "browser" : domain,
        companyName: detectedCompany,
        rawContent: displayTitle,
        keySnippet: displayTitle,
        isErpAiPriority: isErpAi,
        isHubPage,
        tier: isErpAi ? "ERP_AI_VIP" : isErp ? "ENTERPRISE_HIGH" : "STANDARD_GROWTH",
        intentScore: isErpAi ? 96 : isErp ? 85 : 70,
        erpVendors: isErp ? [title.match(/\b(SAP|Oracle|NetSuite|Dynamics\s*365|Workday|ServiceNow|Infor)\b/i)?.[0] || "ERP"] : [],
        aiKeywords: isAi ? [title.match(/\b(AI|GenAI|Copilot|Agent|LLM|Automation)\b/i)?.[0] || "AI"] : [],
        targetedRoles: isErpAi
          ? ["Chief Information Officer", "VP Enterprise Applications", "Director of ERP"]
          : ["CTO", "VP Engineering", "Head of HR"],
      };

      renderIntentCard(data);
    } catch (err) {
      console.error("fallbackTabScan error:", err);
      showIntentIdle();
    }
  }

  function renderIntentCard(data) {
    currentScrapedIntent = data;
    intentIdle.style.display = "none";
    intentCard.style.display = "block";

    intentArticleTitle.textContent = data.articleTitle || "Untitled Article";
    intentCompanyInput.value = data.companyName || "";
    intentSourceDomain.textContent = data.sourceDomain || "web";

    // Hub / Newsroom Index Portal Banner or 404 Error Warning
    if (intentHubBanner) {
      const isErrorPage = /\b(page cannot be found|page not found|404 error|404 not found|error 404)\b/i.test(data.articleTitle || "");
      if (isErrorPage) {
        intentHubBanner.style.display = "block";
        intentHubBanner.style.background = "rgba(239, 68, 68, 0.15)";
        intentHubBanner.style.borderColor = "rgba(239, 68, 68, 0.35)";
        if (intentHubText) {
          intentHubText.innerHTML = `<strong style="color: #f87171;">⚠️ 404 Not Found Page:</strong> This URL is broken or moved on ${data.companyName || "the site"}. Please navigate to an active press release.`;
        }
      } else if (data.isHubPage) {
        intentHubBanner.style.display = "block";
        intentHubBanner.style.background = "rgba(99, 102, 241, 0.12)";
        intentHubBanner.style.borderColor = "rgba(99, 102, 241, 0.25)";
        if (intentHubText) {
          intentHubText.textContent = data.companyName
            ? `You are viewing the ${data.companyName} newsroom hub. For 99/100 ERP AI scoring, click into any specific press release, or ingest this enterprise profile directly.`
            : "You are viewing a newsroom hub. Open any specific press release to auto-scan full ERP AI text, or ingest this enterprise directly.";
        }
      } else {
        intentHubBanner.style.display = "none";
      }
    }

    // ERP Vendors
    if (data.erpVendors && data.erpVendors.length > 0) {
      intentErpTags.innerHTML = data.erpVendors
        .map((v) => `<span class="erp-pill-badge">⚡ ${v}</span>`)
        .join(" ");
    } else {
      intentErpTags.innerHTML = '<span class="placeholder-tag">No specific ERP detected</span>';
    }

    // AI Keywords
    if (data.aiKeywords && data.aiKeywords.length > 0) {
      intentAiTags.innerHTML = data.aiKeywords
        .map((a) => `<span class="ai-pill-badge">✨ ${a}</span>`)
        .join(" ");
    } else {
      intentAiTags.innerHTML = '<span class="placeholder-tag">No AI triggers detected</span>';
    }

    // Tier Banner
    if (data.isErpAiPriority) {
      intentVipBanner.style.display = "flex";
      intentStdBanner.style.display = "none";
      intentScoreBadge.textContent = `${data.intentScore || 96}/100`;
      btnIngestIntentAction.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-svg">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>1-Click Ingest ERP AI Intent to Venus CRM</span>
      `;
    } else {
      intentVipBanner.style.display = "none";
      intentStdBanner.style.display = "flex";
      intentScoreBadgeStd.textContent = `${data.intentScore || 80}/100`;
      btnIngestIntentAction.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-svg">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
        <span>Ingest Buying Intent to Venus CRM</span>
      `;
    }
  }

  function showIntentIdle() {
    intentIdle.style.display = "block";
    intentCard.style.display = "none";
  }

  btnRescanIntent.addEventListener("click", () => {
    scanCurrentTabIntent();
    showToast("Rescanned active tab for intent signals");
  });

  btnIngestIntentAction.addEventListener("click", () => {
    if (!currentScrapedIntent) {
      const companyVal = (intentCompanyInput.value || "").trim();
      const titleVal = (intentArticleTitle.textContent || "").trim();
      const hasRealTitle = titleVal && !titleVal.startsWith("Scanning active tab");

      if (companyVal || hasRealTitle) {
        currentScrapedIntent = {
          articleTitle: hasRealTitle ? titleVal : `${companyVal} Enterprise Buying Signal`,
          articleUrl: "",
          sourceDomain: (intentSourceDomain.textContent || "web").replace(/^scanning\.\.\.$/, "web"),
          companyName: companyVal || "Enterprise Account",
          rawContent: hasRealTitle ? titleVal : `${companyVal} enterprise ERP and AI modernization signal`,
          keySnippet: hasRealTitle ? titleVal : `${companyVal} enterprise modernization`,
          isErpAiPriority: false,
          tier: "STANDARD_GROWTH",
          intentScore: 75,
          erpVendors: [],
          aiKeywords: [],
          targetedRoles: ["Chief Information Officer", "VP Enterprise Applications", "Director of ERP"],
        };
      } else {
        showToast("Please open an article or enter a company name to ingest", "error");
        return;
      }
    }

    const isErrorPage = /\b(page cannot be found|page not found|404 error|404 not found|error 404)\b/i.test(currentScrapedIntent.articleTitle || "");
    if (isErrorPage) {
      showToast("Cannot ingest a 404 error page. Please navigate to an active press release.", "error");
      btnIngestIntentAction.disabled = false;
      return;
    }

    btnIngestIntentAction.disabled = true;
    btnIngestIntentAction.innerHTML = '<span class="spinner" style="display:inline-block;width:12px;height:12px;margin-right:6px;"></span> Finding Decision-Maker & Ingesting...';

    // Strictly whitelist only backend DTO properties to prevent validation errors
    const payload = {
      articleTitle: currentScrapedIntent.articleTitle || "Untitled Article",
      articleUrl: currentScrapedIntent.articleUrl || "",
      sourceDomain: currentScrapedIntent.sourceDomain || "web",
      companyName: intentCompanyInput.value.trim() || currentScrapedIntent.companyName || "",
      rawContent: currentScrapedIntent.rawContent || "",
      keySnippet: currentScrapedIntent.keySnippet || "",
      isErpAiPriority: Boolean(currentScrapedIntent.isErpAiPriority),
      tier: currentScrapedIntent.tier || "STANDARD_GROWTH",
      intentScore: currentScrapedIntent.intentScore || 70,
      erpVendors: currentScrapedIntent.erpVendors || [],
      aiKeywords: currentScrapedIntent.aiKeywords || [],
      targetedRoles: currentScrapedIntent.targetedRoles || [],
    };

    chrome.runtime.sendMessage(
      { action: "INGEST_INTENT_ARTICLE", article: payload },
      (res) => {
        btnIngestIntentAction.disabled = false;
        btnIngestIntentAction.innerHTML = currentScrapedIntent.isErpAiPriority
          ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-svg">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span>1-Click Ingest ERP AI Intent to Venus CRM</span>
          `
          : `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-svg">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            <span>Ingest Buying Intent to Venus CRM</span>
          `;

        if (res && res.success) {
          const article = res.data;
          showToast(`Ingested ${article.companyName || "Company"} Intent to Venus CRM!`);
          intentIngestResult.style.display = "block";

          const dm = article.decisionMaker;
          if (dm) {
            intentDmName.textContent = dm.name || "Executive Contact";
            intentDmTitle.textContent = dm.title || "CIO / VP Applications";
            intentDmEmail.textContent = dm.email ? `✉️ ${dm.email}` : "✉️ Direct Email on Apollo";
            intentDmPhone.textContent = dm.corporatePhone ? `📞 ${dm.corporatePhone}` : "📞 Corporate Line";
          } else {
            intentDmName.textContent = `${payload.companyName || "Target"} Leadership`;
            intentDmTitle.textContent = "Decision-Maker Search Queued";
            intentDmEmail.textContent = "Apollo Queued";
            intentDmPhone.textContent = "Pipeline Active";
          }

          if (article.aiDraftedEmail) {
            intentPitchText.value = article.aiDraftedEmail;
          }
        } else {
          showToast(res?.error || "Failed to ingest article to Venus CRM", "error");
        }
      }
    );
  });

  btnCopyPitch.addEventListener("click", () => {
    if (!intentPitchText.value) return;
    navigator.clipboard.writeText(intentPitchText.value);
    btnCopyPitch.textContent = "Copied!";
    setTimeout(() => {
      btnCopyPitch.textContent = "Copy Pitch";
    }, 2000);
    showToast("Pitch copied to clipboard!");
  });

  // Settings Handlers
  saveSettingsBtn.addEventListener("click", () => {
    const newServerUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    chrome.runtime.sendMessage(
      { action: "SAVE_SETTINGS", serverUrl: newServerUrl, authToken: currentSettings.authToken, currentUser: currentSettings.currentUser },
      (res) => {
        if (res && res.success) {
          currentSettings.serverUrl = newServerUrl;
          showToast("Settings saved successfully!");
          loadJobs();
        }
      }
    );
  });

  loginBtn.addEventListener("click", () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) {
      showToast("Please enter email and password", "error");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    chrome.runtime.sendMessage({ action: "LOGIN", email, password }, (res) => {
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In to Venus CRM";

      if (res && res.success) {
        currentSettings.authToken = res.token;
        currentSettings.currentUser = res.user;
        updateAuthUI(res.user);
        showToast(`Welcome back, ${res.user.firstName}!`);
        loadJobs();
        switchTab("jobs");
      } else {
        showToast(res?.error || "Login failed", "error");
      }
    });
  });

  logoutBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "LOGOUT" }, () => {
      currentSettings.authToken = null;
      currentSettings.currentUser = null;
      updateAuthUI(null);
      showToast("Signed out. Operating in Public Careers Mode.");
      loadJobs();
    });
  });

  // Start
  init();
});
