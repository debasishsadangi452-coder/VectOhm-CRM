// Venus CRM Recruiter Copilot - LinkedIn Content Script
(function () {
  if (window.__VENUS_LINKEDIN_LOADED__) return;
  window.__VENUS_LINKEDIN_LOADED__ = true;

  console.log("[Venus CRM Copilot] LinkedIn module initialized");

  // State
  let cachedJobs = [];
  let selectedJob = null;
  let isWidgetOpen = false;

  // React-safe DOM input setter
  function setNativeValue(element, value) {
    if (!element) return;
    element.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ContentEditable / Rich text setter (Lexical / DraftJS / Quill)
  function setContentEditable(element, text) {
    if (!element) return;
    element.focus();
    // Wrap text into clean HTML paragraphs
    const paragraphs = text
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    element.innerHTML = paragraphs;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 1. Candidate Profile Extraction (linkedin.com/in/*)
  function extractCandidateProfile() {
    const isProfilePage = window.location.pathname.startsWith("/in/") ||
                          window.location.pathname.includes("/talent/profile/");
    if (!isProfilePage) return null;

    // Full name
    const nameEl = document.querySelector("h1.text-heading-xlarge") ||
                   document.querySelector("h1.inline.t-24") ||
                   document.querySelector("main h1");
    const fullName = nameEl ? nameEl.innerText.trim() : "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Candidate";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Headline / Current Title
    const headlineEl = document.querySelector("div.text-body-medium.break-words") ||
                       document.querySelector(".pv-text-details__left-panel div.text-body-medium") ||
                       document.querySelector("div.top-card__headline");
    const currentTitle = headlineEl ? headlineEl.innerText.trim() : "";

    // Location
    const locEl = document.querySelector("span.text-body-small.inline.t-black--light.break-words") ||
                  document.querySelector(".pv-text-details__left-panel span.text-body-small");
    const rawLocation = locEl ? locEl.innerText.trim() : "";
    const locParts = rawLocation.split(",").map((s) => s.trim());
    const city = locParts[0] || "";
    const state = locParts[1] || "";

    // Summary / About
    const aboutEl = document.querySelector("#about ~ div .display-flex span[aria-hidden='true']") ||
                    document.querySelector("section[data-section='summary'] .pv-shared-text-with-see-more");
    const summary = aboutEl ? aboutEl.innerText.trim() : "";

    // Skills
    const skillEls = document.querySelectorAll("#skills ~ div .pvs-list__outer-container span[aria-hidden='true']");
    const skills = Array.from(skillEls)
      .map((el) => el.innerText.trim())
      .filter((s) => s.length > 1 && !s.includes("endorse") && !s.includes("skill"))
      .slice(0, 8);

    return {
      firstName,
      lastName,
      fullName,
      currentTitle,
      city,
      state,
      summary,
      skills,
      source: "linkedin_extension",
      profileUrl: window.location.href,
    };
  }

  // 2. Job Requisition Auto-Filler for LinkedIn Job Posting
  function autoFillLinkedInJobForm(job) {
    if (!job) return { success: false, error: "No job data provided" };
    let filledCount = 0;

    // Title
    const titleInput = document.querySelector("input[name*='jobTitle' i]") ||
                       document.querySelector("input[aria-label*='Job title' i]") ||
                       document.querySelector("input[id*='job-title' i]") ||
                       document.querySelector("input[placeholder*='Job title' i]") ||
                       document.querySelector("input.jobs-form__input");
    if (titleInput) {
      setNativeValue(titleInput, job.title);
      filledCount++;
    }

    // Location
    const locInput = document.querySelector("input[name*='location' i]") ||
                     document.querySelector("input[aria-label*='Location' i]") ||
                     document.querySelector("input[id*='location' i]");
    if (locInput && job.location) {
      setNativeValue(locInput, job.location);
      filledCount++;
    }

    // Workplace type (Remote / Hybrid / On-site)
    const radioButtons = document.querySelectorAll("input[type='radio'], button[role='radio']");
    radioButtons.forEach((radio) => {
      const text = (radio.innerText || radio.getAttribute("value") || "").toLowerCase();
      if (job.workLocationType && text.includes(job.workLocationType.toLowerCase())) {
        radio.click();
        filledCount++;
      }
    });

    // Job Description (Rich Editor)
    const descEditor = document.querySelector("div.ql-editor") ||
                       document.querySelector("div[role='textbox'][aria-label*='Description' i]") ||
                       document.querySelector("div.jobs-description__editor") ||
                       document.querySelector("textarea[name*='description' i]");
    if (descEditor) {
      const fullDesc = `${job.description}\n\nRequired Skills: ${(job.skillsRequired || []).join(", ")}\nMin Experience: ${job.minExperienceYears || 1} Years`;
      if (descEditor.tagName === "TEXTAREA") {
        setNativeValue(descEditor, fullDesc);
      } else {
        setContentEditable(descEditor, fullDesc);
      }
      filledCount++;
    }

    // External Application URL
    const applyUrlInput = document.querySelector("input[name*='externalApply' i]") ||
                          document.querySelector("input[aria-label*='External apply' i]") ||
                          document.querySelector("input[placeholder*='http' i]");
    if (applyUrlInput) {
      const applyUrl = `http://localhost:8080/careers/${job.id}`;
      setNativeValue(applyUrlInput, applyUrl);
      filledCount++;
    }

    return {
      success: filledCount > 0,
      filledCount,
      message: filledCount > 0 ? `Successfully filled ${filledCount} fields!` : "No job posting fields detected on this page.",
    };
  }

  // 3. Generate Viral Hiring Post for LinkedIn Feed
  function generateHiringAnnouncement(job) {
    if (!job) return "";
    const skillsText = (job.skillsRequired || []).map((s) => `• ${s}`).join("\n");
    const hashtags = (job.skillsRequired || [])
      .slice(0, 4)
      .map((s) => `#${s.replace(/[^a-zA-Z0-9]/g, "")}`)
      .join(" ");

    return `🚀 WE ARE HIRING! 🚀\n\nWe are looking for a talented ${job.title} to join our ${job.hiringDepartment?.name || "growing"} team!\n\n📍 Location: ${job.location || "Remote"}\n💼 Type: ${job.employmentType || "Full-time"}\n${job.budgetMin ? `💰 Compensation: ${job.currency || "$"}${job.budgetMin.toLocaleString()} - ${job.budgetMax ? job.budgetMax.toLocaleString() : ""}` : ""}\n\nKey Skills & Stack:\n${skillsText || "• Problem solving and collaborative execution"}\n\n🔗 Apply directly on our official Venus Careers portal:\nhttp://localhost:8080/careers/${job.id}\n\nFeel free to share or tag anyone who might be a great fit!\n\n#Hiring #Careers #JobOpening ${hashtags}`;
  }

  // 4. Inject Floating Copilot Widget into LinkedIn page
  function injectWidget() {
    if (document.getElementById("venus-copilot-host")) return;

    const host = document.createElement("div");
    host.id = "venus-copilot-host";

    host.innerHTML = `
      <div class="venus-pill-btn" id="venus-pill-toggle">
        <span class="venus-status-dot"></span>
        <span class="venus-pill-icon">✨</span>
        <span>Venus Copilot</span>
      </div>

      <div class="venus-copilot-card" id="venus-card">
        <div class="venus-card-header">
          <div class="venus-header-title">
            <span>✨ Venus Recruiter Copilot</span>
            <span class="venus-header-badge">CRM v1.0</span>
          </div>
          <button class="venus-close-btn" id="venus-btn-close" title="Close">✕</button>
        </div>

        <div class="venus-tabs">
          <button class="venus-tab-btn active" data-tab="jobs" id="venus-tab-jobs-btn">Job Requisitions</button>
          <button class="venus-tab-btn" data-tab="source" id="venus-tab-source-btn">Candidate Sourcing</button>
        </div>

        <div class="venus-card-body">
          <!-- Jobs Tab -->
          <div id="venus-tab-jobs-content">
            <div class="venus-field-group">
              <label class="venus-label">Select Venus Requisition</label>
              <select class="venus-select" id="venus-job-select">
                <option value="">Loading active jobs...</option>
              </select>
            </div>

            <div id="venus-job-preview" style="display: none; margin-top: 10px;">
              <div class="venus-snapshot">
                <div class="venus-snapshot-title" id="venus-preview-title"></div>
                <div class="venus-snapshot-meta">
                  <span id="venus-preview-loc"></span> • <span class="venus-snapshot-badge" id="venus-preview-salary"></span>
                </div>
                <div class="venus-chips" id="venus-preview-chips"></div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
                <button class="venus-btn-primary" id="venus-btn-autofill">
                  ⚡ Auto-Fill This Job On Page
                </button>
                <button class="venus-btn-secondary" id="venus-btn-copy-post">
                  📢 Draft Viral LinkedIn Hiring Post
                </button>
              </div>
            </div>

            <div id="venus-jobs-status" style="margin-top: 10px;"></div>
          </div>

          <!-- Sourcing Tab -->
          <div id="venus-tab-source-content" style="display: none;">
            <div id="venus-candidate-box">
              <div class="venus-alert venus-alert-info">
                Navigate to any LinkedIn candidate profile to extract and 1-click import into Venus Recruitment Center.
              </div>
            </div>
            <div id="venus-sourcing-status" style="margin-top: 10px;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(host);

    // Event Listeners
    const pill = host.querySelector("#venus-pill-toggle");
    const card = host.querySelector("#venus-card");
    const closeBtn = host.querySelector("#venus-btn-close");
    const tabJobsBtn = host.querySelector("#venus-tab-jobs-btn");
    const tabSourceBtn = host.querySelector("#venus-tab-source-btn");
    const tabJobsContent = host.querySelector("#venus-tab-jobs-content");
    const tabSourceContent = host.querySelector("#venus-tab-source-content");
    const jobSelect = host.querySelector("#venus-job-select");
    const autoFillBtn = host.querySelector("#venus-btn-autofill");
    const copyPostBtn = host.querySelector("#venus-btn-copy-post");

    // Toggle card
    pill.addEventListener("click", () => {
      isWidgetOpen = !isWidgetOpen;
      if (isWidgetOpen) {
        card.classList.add("is-open");
        refreshJobsList();
        checkCandidateProfile();
      } else {
        card.classList.remove("is-open");
      }
    });

    closeBtn.addEventListener("click", () => {
      isWidgetOpen = false;
      card.classList.remove("is-open");
    });

    // Tab switching
    tabJobsBtn.addEventListener("click", () => {
      tabJobsBtn.classList.add("active");
      tabSourceBtn.classList.remove("active");
      tabJobsContent.style.display = "block";
      tabSourceContent.style.display = "none";
    });

    tabSourceBtn.addEventListener("click", () => {
      tabSourceBtn.classList.add("active");
      tabJobsBtn.classList.remove("active");
      tabSourceContent.style.display = "block";
      tabJobsContent.style.display = "none";
      checkCandidateProfile();
    });

    // Job selection
    jobSelect.addEventListener("change", (e) => {
      const jobId = e.target.value;
      selectedJob = cachedJobs.find((j) => j.id === jobId) || null;
      renderJobPreview(selectedJob);
    });

    // Auto-fill
    autoFillBtn.addEventListener("click", () => {
      if (!selectedJob) return;
      autoFillBtn.disabled = true;
      autoFillBtn.innerText = "Filling form...";
      const res = autoFillLinkedInJobForm(selectedJob);
      const statusDiv = host.querySelector("#venus-jobs-status");

      if (res.success) {
        statusDiv.innerHTML = `<div class="venus-alert venus-alert-success">✓ ${res.message}</div>`;
      } else {
        statusDiv.innerHTML = `<div class="venus-alert venus-alert-warning">⚠️ ${res.error || res.message}</div>`;
      }

      setTimeout(() => {
        autoFillBtn.disabled = false;
        autoFillBtn.innerText = "⚡ Auto-Fill This Job On Page";
      }, 1500);
    });

    // Copy Post
    copyPostBtn.addEventListener("click", () => {
      if (!selectedJob) return;
      const postText = generateHiringAnnouncement(selectedJob);
      navigator.clipboard.writeText(postText).then(() => {
        const statusDiv = host.querySelector("#venus-jobs-status");
        statusDiv.innerHTML = `<div class="venus-alert venus-alert-success">✓ Copied viral hiring post to clipboard! Paste it into LinkedIn feed.</div>`;
      });
    });

    // Auto-open Sourcing tab if on profile
    if (window.location.pathname.startsWith("/in/")) {
      tabSourceBtn.click();
    }
  }

  // Refresh Jobs
  function refreshJobsList() {
    chrome.runtime.sendMessage({ action: "FETCH_JOBS" }, (response) => {
      const select = document.querySelector("#venus-job-select");
      if (!select) return;

      if (response && response.success && Array.isArray(response.jobs)) {
        cachedJobs = response.jobs;
        if (cachedJobs.length === 0) {
          select.innerHTML = `<option value="">No open requisitions in CRM</option>`;
          return;
        }

        select.innerHTML = `<option value="">-- Choose Requisition (${cachedJobs.length} open) --</option>` +
          cachedJobs.map((j) => `<option value="${j.id}">${j.title} (${j.location || "Remote"})</option>`).join("");

        if (!selectedJob && cachedJobs.length > 0) {
          selectedJob = cachedJobs[0];
          select.value = selectedJob.id;
          renderJobPreview(selectedJob);
        }
      } else {
        select.innerHTML = `<option value="">Failed to connect to Venus CRM</option>`;
      }
    });
  }

  // Render Job Preview
  function renderJobPreview(job) {
    const preview = document.querySelector("#venus-job-preview");
    if (!preview) return;

    if (!job) {
      preview.style.display = "none";
      return;
    }

    preview.style.display = "block";
    document.querySelector("#venus-preview-title").innerText = job.title;
    document.querySelector("#venus-preview-loc").innerText = `${job.location || "Remote"} • ${job.employmentType || "Full-time"}`;
    document.querySelector("#venus-preview-salary").innerText = job.budgetMin
      ? `${job.currency || "$"}${job.budgetMin.toLocaleString()} - ${job.budgetMax ? job.budgetMax.toLocaleString() : ""}`
      : "Competitive";

    const chipsEl = document.querySelector("#venus-preview-chips");
    chipsEl.innerHTML = (job.skillsRequired || [])
      .slice(0, 5)
      .map((s) => `<span class="venus-chip">${s}</span>`)
      .join("");
  }

  // Check Candidate Profile
  function checkCandidateProfile() {
    const candidateBox = document.querySelector("#venus-candidate-box");
    if (!candidateBox) return;

    const candidate = extractCandidateProfile();
    if (!candidate || !candidate.fullName) {
      candidateBox.innerHTML = `
        <div class="venus-alert venus-alert-info">
          Open a LinkedIn candidate profile (/in/username) to extract data and import with 1 click.
        </div>
      `;
      return;
    }

    candidateBox.innerHTML = `
      <div class="venus-snapshot">
        <div class="venus-snapshot-title">👤 ${candidate.fullName}</div>
        <div class="venus-snapshot-meta">${candidate.currentTitle || "Professional"}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">📍 ${candidate.city || "Location available"} ${candidate.state || ""}</div>
        <div class="venus-chips">
          ${candidate.skills.map((s) => `<span class="venus-chip">${s}</span>`).join("")}
        </div>
      </div>

      <div class="venus-field-group" style="margin-top: 10px;">
        <label class="venus-label">Link to Requisition</label>
        <select class="venus-select" id="venus-sourcing-job-select">
          ${cachedJobs.map((j) => `<option value="${j.id}">${j.title}</option>`).join("")}
        </select>
      </div>

      <button class="venus-btn-primary" id="venus-btn-import-candidate" style="margin-top: 12px;">
        📥 1-Click Import Candidate to Venus CRM
      </button>
    `;

    const importBtn = candidateBox.querySelector("#venus-btn-import-candidate");
    importBtn.addEventListener("click", () => {
      const jobSelect = candidateBox.querySelector("#venus-sourcing-job-select");
      const targetJobId = jobSelect ? jobSelect.value : null;

      importBtn.disabled = true;
      importBtn.innerText = "Importing to Venus CRM...";

      const candidatePayload = {
        ...candidate,
        jobPostingId: targetJobId || (selectedJob ? selectedJob.id : undefined),
      };

      chrome.runtime.sendMessage(
        { action: "IMPORT_CANDIDATE", candidateData: candidatePayload },
        (res) => {
          const statusDiv = document.querySelector("#venus-sourcing-status");
          if (res && res.success) {
            statusDiv.innerHTML = `
              <div class="venus-alert venus-alert-success">
                ✓ <strong>${candidate.fullName}</strong> successfully imported into Venus Recruitment Center (Stage: SOURCED)!
              </div>
            `;
          } else {
            statusDiv.innerHTML = `
              <div class="venus-alert venus-alert-warning">
                ⚠️ Import error: ${res?.error || "Could not save candidate"}
              </div>
            `;
          }
          importBtn.disabled = false;
          importBtn.innerText = "📥 1-Click Import Candidate to Venus CRM";
        }
      );
    });
  }

  // Handle runtime messages from Extension Popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FILL_JOB_FORM") {
      const result = autoFillLinkedInJobForm(request.job);
      sendResponse(result);
      return;
    }

    if (request.action === "EXTRACT_CANDIDATE_DATA") {
      const candidate = extractCandidateProfile();
      sendResponse({ success: Boolean(candidate), candidate });
      return;
    }
  });

  // Inject widget after page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectWidget);
  } else {
    injectWidget();
  }
})();
