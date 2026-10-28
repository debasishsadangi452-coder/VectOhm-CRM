// Venus CRM Recruiter Copilot - Background Service Worker

const DEFAULT_SERVER_URL = "https://crm.venusglobaltech.com";

// Helper to fetch with fast cloud & local fallback (tries cloud production, then localhost)
async function apiFetchWithFallback(baseServerUrl, path, options = {}) {
  const cleanBase = (baseServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, "");
  const candidates = [
    cleanBase === "http://localhost:4001" ? DEFAULT_SERVER_URL : cleanBase,
    DEFAULT_SERVER_URL,
    "http://localhost:4001",
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError = null;
  for (const base of candidates) {
    try {
      const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
      const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
      const timeoutMs = isLocal ? 1200 : 3500;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return { res, workingBaseUrl: base };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Cannot connect to Venus CRM API (tried cloud & localhost).");
}

// Ensure default serverUrl is cloud on install / update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["serverUrl", "autoBrowseEnabled"], (data) => {
    if (!data.serverUrl || data.serverUrl === "http://localhost:4001") {
      chrome.storage.local.set({ serverUrl: DEFAULT_SERVER_URL });
    }
    scheduleAutoBrowse(!!data.autoBrowseEnabled);
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_SETTINGS") {
    chrome.storage.local.get(["serverUrl", "authToken", "currentUser"], (data) => {
      let serverUrl = data.serverUrl || DEFAULT_SERVER_URL;
      if (serverUrl === "http://localhost:4001") {
        serverUrl = DEFAULT_SERVER_URL;
      }
      sendResponse({
        serverUrl,
        authToken: data.authToken || null,
        currentUser: data.currentUser || null,
      });
    });
    return true; // async response
  }

  if (request.action === "SAVE_SETTINGS") {
    chrome.storage.local.set(
      {
        serverUrl: request.serverUrl || DEFAULT_SERVER_URL,
        authToken: request.authToken || null,
        currentUser: request.currentUser || null,
      },
      () => {
        sendResponse({ success: true });
      }
    );
    return true;
  }

  if (request.action === "LOGIN") {
    chrome.storage.local.get(["serverUrl"], async (data) => {
      try {
        const { res, workingBaseUrl } = await apiFetchWithFallback(data.serverUrl, "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: request.email, password: request.password }),
        });

        if (res.ok) {
          const body = await res.json();
          chrome.storage.local.set(
            {
              serverUrl: workingBaseUrl,
              authToken: body.accessToken,
              currentUser: body.user,
            },
            () => {
              sendResponse({ success: true, user: body.user, token: body.accessToken });
            }
          );
        } else {
          const err = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: err.message || "Invalid email or password" });
        }
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : "Failed to connect to Venus CRM server",
        });
      }
    });
    return true;
  }

  if (request.action === "LOGOUT") {
    chrome.storage.local.remove(["authToken", "currentUser"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "FETCH_JOBS") {
    chrome.storage.local.get(["serverUrl", "authToken", "cachedJobs"], async (data) => {
      try {
        // Try public careers endpoint first (returns all OPEN requisitions)
        const { res, workingBaseUrl } = await apiFetchWithFallback(data.serverUrl, "/api/careers/jobs", {
          method: "GET",
        });

        if (res.ok) {
          const jobs = await res.json();
          chrome.storage.local.set({ serverUrl: workingBaseUrl, cachedJobs: jobs, lastFetch: Date.now() });
          sendResponse({ success: true, jobs });
          return;
        }

        // If public route unavailable or user has auth token, try internal route
        const headers = {};
        if (data.authToken) {
          headers["Authorization"] = `Bearer ${data.authToken}`;
        }
        const authRes = await apiFetchWithFallback(data.serverUrl, "/api/job-postings?status=OPEN", { headers });
        if (authRes.res.ok) {
          const jobs = await authRes.res.json();
          chrome.storage.local.set({ serverUrl: authRes.workingBaseUrl, cachedJobs: jobs, lastFetch: Date.now() });
          sendResponse({ success: true, jobs });
          return;
        }
      } catch (err) {
        // Fallback to cached jobs if available so UI does not hang or error out
        if (Array.isArray(data.cachedJobs) && data.cachedJobs.length > 0) {
          sendResponse({ success: true, jobs: data.cachedJobs, fromCache: true });
          return;
        }
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : "Failed to connect to Venus CRM server",
        });
      }
    });
    return true;
  }

  if (request.action === "IMPORT_CANDIDATE") {
    chrome.storage.local.get(["serverUrl", "authToken", "cachedJobs"], async (data) => {
      const candidateData = { ...request.candidateData };

      // Ensure jobPostingId is populated (fallback to first cached job if not selected)
      if (!candidateData.jobPostingId && Array.isArray(data.cachedJobs) && data.cachedJobs.length > 0) {
        candidateData.jobPostingId = data.cachedJobs[0].id;
      }

      try {
        if (data.authToken) {
          // Authenticated import: full candidate record creation with SOURCED stage
          const payload = {
            firstName: candidateData.firstName || "Unknown",
            lastName: candidateData.lastName || "Candidate",
            email: candidateData.email || `${(candidateData.firstName || "candidate").toLowerCase()}.${Date.now()}@sourced.talent`,
            phone: candidateData.phone || undefined,
            currentTitle: candidateData.currentTitle || candidateData.title || undefined,
            city: candidateData.city || undefined,
            state: candidateData.state || undefined,
            skills: Array.isArray(candidateData.skills) ? candidateData.skills : [],
            summary: candidateData.summary || undefined,
            source: candidateData.source || "linkedin_copilot",
            stage: "SOURCED",
            jobPostingId: candidateData.jobPostingId,
          };

          const { res } = await apiFetchWithFallback(data.serverUrl, "/api/candidates", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.authToken}`,
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const result = await res.json();
            sendResponse({ success: true, candidate: result, mode: "authenticated" });
            return;
          }
        }

        // Public fallback import via careers apply
        if (candidateData.jobPostingId) {
          const publicPayload = {
            jobPostingId: candidateData.jobPostingId,
            firstName: candidateData.firstName || "Unknown",
            lastName: candidateData.lastName || "Candidate",
            email: candidateData.email || `${(candidateData.firstName || "candidate").toLowerCase()}.${Date.now()}@sourced.talent`,
            phone: candidateData.phone || undefined,
            source: candidateData.source || "copilot_extension",
          };

          const { res } = await apiFetchWithFallback(data.serverUrl, "/api/careers/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(publicPayload),
          });

          if (res.ok) {
            const result = await res.json();
            sendResponse({ success: true, candidate: result, mode: "public_apply" });
            return;
          }
          const errData = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: errData.message || `HTTP ${res.status}` });
        } else {
          sendResponse({
            success: false,
            error: "No job requisition selected. Please select a job before importing.",
          });
        }
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : "Failed to import candidate to CRM",
        });
      }
    });
    return true;
  }

  if (request.action === "TRIGGER_AUTO_FILL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "FILL_JOB_FORM",
            job: request.job,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse(response || { success: false, error: "Content script did not respond" });
          }
        );
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }

  if (request.action === "TRIGGER_EXTRACT_CANDIDATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "EXTRACT_CANDIDATE_DATA" },
          (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse(response || { success: false, error: "Content script did not respond" });
          }
        );
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }

  if (request.action === "SCAN_TAB_INTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "GET_CURRENT_PAGE_INTENT" },
          (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse(response || { success: false, error: "Tab did not respond" });
          }
        );
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }

  if (request.action === "INGEST_INTENT_ARTICLE") {
    ingestIntentArticle(request.article).then(sendResponse);
    return true;
  }

  if (request.action === "SET_AUTO_BROWSE") {
    chrome.storage.local.set({ autoBrowseEnabled: !!request.enabled }, () => {
      scheduleAutoBrowse(!!request.enabled);
      if (request.enabled) runAutoBrowse();
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "RUN_AUTO_BROWSE_NOW") {
    runAutoBrowse().then(sendResponse);
    return true;
  }
});

// Posts a scraped article to every reachable CRM (cloud production for the
// desktop app, localhost for local dev).
function ingestIntentArticle(article) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverUrl", "authToken"], async (data) => {
      const headers = { "Content-Type": "application/json" };
      if (data.authToken) {
        headers["Authorization"] = `Bearer ${data.authToken}`;
      }

      const endpoints = [
        "https://crm.venusglobaltech.com/api/intent-news/ingest-scraped",
        "http://localhost:4001/api/intent-news/ingest-scraped",
        "http://localhost:4001/intent-news/ingest-scraped",
      ];
      if (data.serverUrl) {
        const cleanCustom = data.serverUrl.replace(/\/$/, "");
        if (!endpoints.some((e) => e.startsWith(cleanCustom))) {
          endpoints.unshift(`${cleanCustom}/api/intent-news/ingest-scraped`);
        }
      }

      let primaryResult = null;
      let lastError = null;

      await Promise.allSettled(
        endpoints.map(async (url) => {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify(article),
            });
            if (res.ok) {
              const body = await res.json();
              if (!primaryResult) primaryResult = body;
            } else {
              const err = await res.json().catch(() => ({}));
              lastError = err.message || `HTTP ${res.status}`;
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : "Network error";
          }
        })
      );

      if (primaryResult) {
        resolve({ success: true, data: primaryResult });
      } else {
        resolve({
          success: false,
          error: lastError || "Failed to sync scraped intent article to Venus CRM",
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Auto-browse: the CRM server finds intent news on its own, but Google News
// links only resolve in a real browser. Every 30 minutes this opens the
// server's queue of unread articles in background tabs, reads the full text
// with the intent scanner, and sends it back so Gemini can score the article.

const AUTO_BROWSE_ALARM = "venus-auto-browse";
const AUTO_BROWSE_BATCH = 8;
let autoBrowseRunning = false;

function scheduleAutoBrowse(enabled) {
  if (enabled) {
    chrome.alarms.create(AUTO_BROWSE_ALARM, { periodInMinutes: 30, delayInMinutes: 1 });
  } else {
    chrome.alarms.clear(AUTO_BROWSE_ALARM);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_BROWSE_ALARM) runAutoBrowse();
});

// Alarms survive restarts, but re-create in case the extension was reloaded.
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["autoBrowseEnabled"], (d) => scheduleAutoBrowse(!!d.autoBrowseEnabled));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Waits until the tab has left Google News and finished loading the publisher page.
async function waitForArticle(tabId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(1000);
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return false;
    let host = "";
    try {
      host = new URL(tab.url || tab.pendingUrl || "").hostname;
    } catch {}
    if (tab.status === "complete" && host && !/(^|\.)(news|consent)\.google\.com$/.test(host)) {
      await sleep(2500); // let the content script (document_idle) settle
      return true;
    }
  }
  return false;
}

function readTabIntent(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "GET_CURRENT_PAGE_INTENT" }, (res) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(res?.success ? res.data : null);
    });
  });
}

async function runAutoBrowse() {
  if (autoBrowseRunning) return { success: false, error: "Auto-browse is already running" };
  autoBrowseRunning = true;
  const summary = { at: new Date().toISOString(), read: 0, failed: 0, error: null };
  try {
    const data = await chrome.storage.local.get(["serverUrl", "authToken", "autoBrowseTried"]);
    if (!data.authToken) throw new Error("Sign in to Venus CRM in the extension first");
    const tried = data.autoBrowseTried || [];

    const { res } = await apiFetchWithFallback(data.serverUrl, "/api/intent-news/scraped/needs-full-text?take=25", {
      headers: { Authorization: `Bearer ${data.authToken}` },
    });
    const queue = (await res.json()).filter((a) => !tried.includes(a.id)).slice(0, AUTO_BROWSE_BATCH);

    for (const item of queue) {
      tried.push(item.id);
      let tab = null;
      try {
        tab = await chrome.tabs.create({ url: item.url, active: false });
        const page = (await waitForArticle(tab.id)) ? await readTabIntent(tab.id) : null;
        if (!page || !page.rawContent) {
          summary.failed++;
          continue;
        }
        const result = await ingestIntentArticle({
          articleTitle: (page.articleTitle && page.articleTitle.length > 10 ? page.articleTitle : item.title).slice(0, 500),
          articleUrl: item.url, // the queued URL, so the server updates the same row
          sourceDomain: page.sourceDomain,
          rawContent: page.rawContent,
          keySnippet: page.keySnippet,
          companyName: page.companyName || undefined,
          // The server already looked up decision-makers and drafted the email for this one.
          autoFindDecisionMakers: false,
          autoDraftEmail: false,
        });
        result.success ? summary.read++ : summary.failed++;
      } catch (e) {
        summary.failed++;
      } finally {
        if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
    await chrome.storage.local.set({ autoBrowseTried: tried.slice(-500) });
  } catch (e) {
    summary.error = e instanceof Error ? e.message : String(e);
  } finally {
    autoBrowseRunning = false;
    await chrome.storage.local.set({ autoBrowseLastRun: summary });
  }
  return { success: !summary.error, ...summary };
}

