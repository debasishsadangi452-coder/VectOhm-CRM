// Venus CRM Recruiter Copilot - Indeed Content Script
(function () {
  if (window.__VENUS_INDEED_LOADED__) return;
  window.__VENUS_INDEED_LOADED__ = true;

  console.log("[Venus CRM Copilot] Indeed module initialized");

  let cachedJobs = [];
  let selectedJob = null;
  let isWidgetOpen = false;

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

  function setContentEditable(element, text) {
    if (!element) return;
    element.focus();
    const paragraphs = text
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    element.innerHTML = paragraphs;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 1. Auto-fill Indeed Employer Job Creation Form
  function autoFillIndeedJobForm(job) {
    if (!job) return { success: false, error: "No job data provided" };
    let filledCount = 0;

    // Job Title
    const titleInput = document.querySelector("input[name*='jobTitle' i]") ||
                       document.querySelector("input[id*='jobTitle' i]") ||
                       document.querySelector("input[data-testid*='jobTitle' i]") ||
                       document.querySelector("input[placeholder*='Job title' i]");
    if (titleInput) {
      setNativeValue(titleInput, job.title);
      filledCount++;
    }

    // Location
    const locInput = document.querySelector("input[name*='location' i]") ||
                     document.querySelector("input[id*='location' i]") ||
                     document.querySelector("input[data-testid*='location' i]");
    if (locInput && job.location) {
      setNativeValue(locInput, job.location);
      filledCount++;
    }

    // Job Description
    const descEditor = document.querySelector("div.ql-editor") ||
                       document.querySelector("div[contenteditable='true']") ||
                       document.querySelector("textarea[name*='description' i]") ||
                       document.querySelector("textarea[id*='jobDescription' i]");
    if (descEditor) {
      const fullDesc = `${job.description}\n\nRequired Skills: ${(job.skillsRequired || []).join(", ")}\nMinimum Experience: ${job.minExperienceYears || 1} Years\n\nApply directly via: http://localhost:8080/careers/${job.id}`;
      if (descEditor.tagName === "TEXTAREA") {
        setNativeValue(descEditor, fullDesc);
      } else {
        setContentEditable(descEditor, fullDesc);
      }
      filledCount++;
    }

    // Minimum Pay
    const minPayInput = document.querySelector("input[name*='minimumSalary' i]") ||
                        document.querySelector("input[name*='minSalary' i]") ||
                        document.querySelector("input[id*='minimumPay' i]") ||
                        document.querySelector("input[aria-label*='Minimum' i]");
    if (minPayInput && job.budgetMin) {
      setNativeValue(minPayInput, String(job.budgetMin));
      filledCount++;
    }

    // Maximum Pay
    const maxPayInput = document.querySelector("input[name*='maximumSalary' i]") ||
                        document.querySelector("input[name*='maxSalary' i]") ||
                        document.querySelector("input[id*='maximumPay' i]") ||
                        document.querySelector("input[aria-label*='Maximum' i]");
    if (maxPayInput && job.budgetMax) {
      setNativeValue(maxPayInput, String(job.budgetMax));
      filledCount++;
    }

    // Apply URL
    const applyUrlInput = document.querySelector("input[name*='applicationUrl' i]") ||
                          document.querySelector("input[id*='applyUrl' i]") ||
                          document.querySelector("input[placeholder*='https://' i]");
    if (applyUrlInput) {
      setNativeValue(applyUrlInput, `http://localhost:8080/careers/${job.id}`);
      filledCount++;
    }

    return {
      success: filledCount > 0,
      filledCount,
      message: filledCount > 0 ? `Successfully filled ${filledCount} Indeed fields!` : "No job posting fields detected on this page.",
    };
  }

  // 2. Extract Candidate Profile from Indeed Resumes (resumes.indeed.com)
  function extractIndeedCandidateProfile() {
    const isResume = window.location.host.includes("indeed.com") &&
                     (window.location.pathname.includes("/resume/") || window.location.pathname.includes("/candidates/"));
    if (!isResume) return null;

    const nameEl = document.querySelector("h1") || document.querySelector(".resume-profile-header-name");
    const fullName = nameEl ? nameEl.innerText.trim() : "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Candidate";
    const lastName = nameParts.slice(1).join(" ") || "";

    const titleEl = document.querySelector("h2") || document.querySelector(".resume-profile-header-title");
    const currentTitle = titleEl ? titleEl.innerText.trim() : "";

    const locEl = document.querySelector(".resume-profile-header-location") || document.querySelector("[data-testid='location']");
    const rawLocation = locEl ? locEl.innerText.trim() : "";
    const locParts = rawLocation.split(",").map((s) => s.trim());

    return {
      firstName,
      lastName,
      fullName,
      currentTitle,
      city: locParts[0] || "",
      state: locParts[1] || "",
      skills: [],
      source: "indeed_extension",
      profileUrl: window.location.href,
    };
  }

  // 3. Inject Floating Copilot Widget into Indeed page
  function injectWidget() {
    if (document.getElementById("venus-copilot-host")) return;

    const host = document.createElement("div");
    host.id = "venus-copilot-host";

    host.innerHTML = `
      <div class="venus-pill-btn" id="venus-pill-toggle">
        <span class="venus-status-dot"></span>
        <span class="venus-pill-icon">✨</span>
        <span>Venus Indeed Copilot</span>
      </div>

      <div class="venus-copilot-card" id="venus-card">
        <div class="venus-card-header">
          <div class="venus-header-title">
            <span>✨ Venus Copilot for Indeed</span>
            <span class="venus-header-badge">CRM v1.0</span>
          </div>
          <button class="venus-close-btn" id="venus-btn-close" title="Close">✕</button>
        </div>

        <div class="venus-tabs">
          <button class="venus-tab-btn active" id="venus-tab-jobs-btn">Post Requisition</button>
          <button class="venus-tab-btn" id="venus-tab-source-btn">Candidate Sourcing</button>
        </div>

        <div class="venus-card-body">
          <div id="venus-tab-jobs-content">
            <div class="venus-field-group">
              <label class="venus-label">Select Requisition to Post</label>
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

              <button class="venus-btn-primary" id="venus-btn-autofill" style="margin-top: 12px;">
                ⚡ Auto-Fill This Job On Indeed
              </button>
            </div>

            <div id="venus-jobs-status" style="margin-top: 10px;"></div>
          </div>

          <div id="venus-tab-source-content" style="display: none;">
            <div id="venus-candidate-box">
              <div class="venus-alert venus-alert-info">
                Open any Indeed candidate profile or resume to extract and import into Venus Recruitment Center.
              </div>
            </div>
            <div id="venus-sourcing-status" style="margin-top: 10px;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(host);

    const pill = host.querySelector("#venus-pill-toggle");
    const card = host.querySelector("#venus-card");
    const closeBtn = host.querySelector("#venus-btn-close");
    const tabJobsBtn = host.querySelector("#venus-tab-jobs-btn");
    const tabSourceBtn = host.querySelector("#venus-tab-source-btn");
    const tabJobsContent = host.querySelector("#venus-tab-jobs-content");
    const tabSourceContent = host.querySelector("#venus-tab-source-content");
    const jobSelect = host.querySelector("#venus-job-select");
    const autoFillBtn = host.querySelector("#venus-btn-autofill");

    pill.addEventListener("click", () => {
      isWidgetOpen = !isWidgetOpen;
      if (isWidgetOpen) {
        card.classList.add("is-open");
        refreshJobsList();
      } else {
        card.classList.remove("is-open");
      }
    });

    closeBtn.addEventListener("click", () => {
      isWidgetOpen = false;
      card.classList.remove("is-open");
    });

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
    });

    jobSelect.addEventListener("change", (e) => {
      const jobId = e.target.value;
      selectedJob = cachedJobs.find((j) => j.id === jobId) || null;
      renderJobPreview(selectedJob);
    });

    autoFillBtn.addEventListener("click", () => {
      if (!selectedJob) return;
      autoFillBtn.disabled = true;
      autoFillBtn.innerText = "Filling form...";
      const res = autoFillIndeedJobForm(selectedJob);
      const statusDiv = host.querySelector("#venus-jobs-status");

      if (res.success) {
        statusDiv.innerHTML = `<div class="venus-alert venus-alert-success">✓ ${res.message}</div>`;
      } else {
        statusDiv.innerHTML = `<div class="venus-alert venus-alert-warning">⚠️ ${res.error || res.message}</div>`;
      }

      setTimeout(() => {
        autoFillBtn.disabled = false;
        autoFillBtn.innerText = "⚡ Auto-Fill This Job On Indeed";
      }, 1500);
    });
  }

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FILL_JOB_FORM") {
      const result = autoFillIndeedJobForm(request.job);
      sendResponse(result);
      return;
    }

    if (request.action === "EXTRACT_CANDIDATE_DATA") {
      const candidate = extractIndeedCandidateProfile();
      sendResponse({ success: Boolean(candidate), candidate });
      return;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectWidget);
  } else {
    injectWidget();
  }
})();
