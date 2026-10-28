// Venus CRM - ERP AI & Company Intent News Content Scanner
// Automatically detects enterprise buying intent and ERP AI modernization signals on any web page

(function () {
  // Prevent duplicate execution
  if (window.__venusIntentScannerInitialized) return;
  window.__venusIntentScannerInitialized = true;

  // ERP Vendors regex dictionary
  const ERP_PATTERNS = [
    { name: "SAP S/4HANA", regex: /\b(SAP\s+S\/?4HANA|S4HANA|S\/4\s+HANA|RISE\s+with\s+SAP)\b/i },
    { name: "SAP", regex: /\b(SAP|SAP\s+ECC|SAP\s+BTP|Business\s+Technology\s+Platform|SAP\s+Signavio|SAP\s+Ariba|SuccessFactors|SAP\s+Datasphere|SAP\s+Joule)\b/i },
    { name: "Oracle Cloud ERP", regex: /\b(Oracle\s+Cloud\s+ERP|Oracle\s+Fusion|Oracle\s+EBS|Oracle\s+ERP|OCI\b)/i },
    { name: "Oracle NetSuite", regex: /\b(NetSuite|Oracle\s+NetSuite)\b/i },
    { name: "Microsoft Dynamics 365", regex: /\b(Dynamics\s+365|D365|Business\s+Central|Dynamics\s+AX|Dynamics\s+NAV|Power\s+Platform|Power\s+Automate)\b/i },
    { name: "Workday", regex: /\b(Workday|Workday\s+HCM|Workday\s+Financials?|Adaptive\s+Planning)\b/i },
    { name: "ServiceNow", regex: /\b(ServiceNow|Now\s+Platform|Now\s+Assist)\b/i },
    { name: "Infor", regex: /\b(Infor|Infor\s+CloudSuite|Infor\s+LN|Infor\s+M3)\b/i },
    { name: "Salesforce", regex: /\b(Salesforce|Agentforce|Sales\s+Cloud|Service\s+Cloud)\b/i },
  ];

  // AI & Modernization regex dictionary
  const AI_PATTERNS = [
    { name: "Generative AI", regex: /\b(Generative\s+AI|GenAI|LLM|Large\s+Language\s+Models?|ChatGPT|OpenAI|Claude|Gemini)\b/i },
    { name: "Enterprise Copilot", regex: /\b(Copilot|Microsoft\s+Copilot|SAP\s+Joule|Enterprise\s+Copilot|AI\s+Assistant)\b/i },
    { name: "Agentic AI / Autonomous Agents", regex: /\b(Agentic\s+AI|Autonomous\s+Agents?|AI\s+Agents?|Multi-agent|AI\s+Workflows?)\b/i },
    { name: "ERP AI Modernization", regex: /\b(ERP\s+(?:AI|Modernization|Transformation|Migration)|AI\s+for\s+ERP|Autonomous\s+ERP|AI\s+Enablement)\b/i },
    { name: "Process Automation & RPA", regex: /\b(RPA|Robotic\s+Process\s+Automation|Process\s+Mining|Workflow\s+Automation|Intelligent\s+Automation)\b/i },
    { name: "Supply Chain & Operations AI", regex: /\b(Supply\s+Chain\s+AI|Predictive\s+Maintenance|Automated\s+Procurement|Demand\s+Forecasting|Predictive\s+Logistics)\b/i },
    { name: "Enterprise AI & Machine Learning", regex: /\b(Artificial\s+Intelligence|\bAI\b|Machine\s+Learning|\bML\b|Predictive\s+AI|AI-Powered|AI-Driven|Deep\s+Learning)\b/i },
  ];

  // General Intent News triggers
  const INTENT_TRIGGERS = [
    /\b(?:selects|selected|chooses|chose|implements|implementing|deploys|deploying|migrates|migrating\s+to|partners\s+with|partners\s+on)\b/i,
    /\b(?:multi-million|million-dollar|digital\s+transformation|cloud\s+transformation|system\s+integrator|modernization\s+initiative)\b/i,
    /\b(?:raises|raised|\$\d+(?:\.\d+)?(?:M|B)|Series\s+[A-F]|growth\s+capital|expansion|new\s+headquarters)\b/i,
    /\b(?:digitalization|digitalisation|go-live|went\s+live|rollout|rolled\s+out|standardized|standardizing|cloud\s+architecture|cloud\s+strategy|transformation)\b/i,
  ];

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
    schneider: "Schneider Electric",
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

  function extractCompanyName(title, sourceDomain) {
    // 1. Check known enterprise domains
    const cleanDomain = (sourceDomain || "").toLowerCase().replace(/^(?:www|press|news|newsroom|corporate|investor|about|media|ir|global)\./, "");
    const rootName = cleanDomain.split(".")[0].replace(/[^a-z0-9]/g, "");
    if (KNOWN_ENTERPRISES[rootName]) {
      return KNOWN_ENTERPRISES[rootName];
    }

    // 2. Check title prefix/action regex
    const cleanTitle = title.replace(/\s*[|\-–—].*$/, "").trim();
    const companyRegexes = [
      /^([A-Z0-9][A-Za-z0-9\s&,.]{1,35}?)\s+(?:Selects|Chooses|Deploys|Adopts|Migrates|Partners|Taps|Implements|Signs|Expands|Announces|Teams|Modernizes|Unveils|Rolls Out)\b/i,
      /\b(?:How|Why)\s+([A-Z0-9][A-Za-z0-9\s&,.]{1,35}?)\s+(?:Is|Uses|Deploys|Scaled|Transformed|Migrated)\b/i,
      /\b(?:at|for|with)\s+([A-Z0-9][A-Za-z0-9\s&,.]{1,30}?)(?:'s|\s+to|\s+for|\s*$|\s*[|\-–—])/i,
    ];

    for (const rx of companyRegexes) {
      const match = cleanTitle.match(rx);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (!/^(TechCrunch|Bloomberg|Reuters|Forbes|PR\s*Newswire|Business\s*Wire|VentureBeat|CNBC|The|A|An)$/i.test(candidate)) {
          return candidate;
        }
      }
    }

    // 3. Check title suffix after delimiter (e.g. "Focus on Digitalization | BMW Group")
    const titleParts = title.split(/\s+[|\-–—]\s+/);
    if (titleParts.length > 1) {
      const lastPart = titleParts[titleParts.length - 1].trim();
      if (lastPart.length >= 2 && lastPart.length <= 40 && !/^(TechCrunch|Bloomberg|Reuters|Forbes|PR\s*Newswire|Business\s*Wire|VentureBeat|CNBC|Home|Page\s*\d+)$/i.test(lastPart)) {
        return lastPart;
      }
    }

    // 4. Check og:site_name (strip media/press suffix)
    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content");
    if (ogSiteName) {
      const cleaned = ogSiteName.replace(/\s*(PressClub|Press\s*Club|Newsroom|Media\s*Center|Press\s*Room|Press|News|Portal|Media|Wire|Official|Corporate|Global|Blog|Times|Post|Daily)\b/gi, "").trim();
      if (cleaned.length >= 2 && cleaned.length <= 40) {
        return cleaned;
      }
    }

    // 5. Check JSON-LD publisher / author / organization
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const json = JSON.parse(s.innerText);
        const name = json?.publisher?.name || json?.author?.name || json?.about?.name || json?.name;
        if (typeof name === "string" && name.length >= 2 && name.length <= 40) {
          const cleaned = name.replace(/\s*(PressClub|Newsroom|Press|News|Portal|Media)\b/gi, "").trim();
          if (cleaned) return cleaned;
        }
      }
    } catch {}

    // 6. Fallback: formatted root domain if not a news outlet
    if (!/^(techcrunch|bloomberg|reuters|prnewswire|businesswire|forbes|venturebeat|cnbc|wsj|ft|zdnet)\.com$/i.test(cleanDomain)) {
      const parts = rootName.split(/[-_]/).filter(Boolean);
      if (parts.length > 0) {
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      }
    }

    return "";
  }

  function extractPageData() {
    const title =
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      document.querySelector("h1")?.innerText?.trim() ||
      document.title ||
      "";

    const metaDesc =
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      "";

    const canonicalUrl =
      document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
      window.location.href;

    const sourceDomain = window.location.hostname.replace(/^www\./, "");

    // Hub / Newsroom Index Page Detection
    const isHubPage =
      window.location.pathname === "/" ||
      window.location.pathname === "" ||
      /^(PressClub|Newsroom|Press Releases?|Media Center|Latest News|Home|PressClub Global)/i.test(title) ||
      /\b(pressclub|newsroom|media-center|press-releases?|press-room|all-news)\b/i.test(window.location.pathname);

    // Deep Article Text Extraction
    const articleContainer =
      document.querySelector("article, main, [role='main'], [itemprop='articleBody'], .press-release, .article-content, .article-body, .story-content, .entry-content, .news-detail, #content, .content") ||
      document.body;

    const headings = Array.from(articleContainer.querySelectorAll("h1, h2, h3"))
      .map((h) => h.innerText.trim())
      .filter((t) => t.length > 5 && !/(cookie|navigation|search|menu)/i.test(t));

    const paragraphs = Array.from(articleContainer.querySelectorAll("p, [class*='paragraph'], [class*='body-text']"))
      .map((p) => p.innerText.trim())
      .filter((t) => t.length > 25 && !/(cookie|all rights reserved|privacy policy|terms of service|terms of use|subscribe)/i.test(t))
      .slice(0, 35);

    // Also scan teaser links on page if on hub page
    const teaserTitles = isHubPage
      ? Array.from(document.querySelectorAll("article h2, article h3, .news-item a, .teaser a, .headline a, a[href*='/article/']"))
          .map((a) => a.innerText.trim())
          .filter((t) => t.length > 15)
          .slice(0, 10)
      : [];

    const fullSnippet = [title, metaDesc, ...headings, ...paragraphs, ...teaserTitles].join(" \n ");

    // Check ERP vendors
    const detectedErp = [];
    ERP_PATTERNS.forEach((p) => {
      if (p.regex.test(fullSnippet)) detectedErp.push(p.name);
    });

    // Check AI keywords
    const detectedAi = [];
    AI_PATTERNS.forEach((p) => {
      if (p.regex.test(fullSnippet)) detectedAi.push(p.name);
    });

    // General intent trigger match
    const hasIntentTrigger = INTENT_TRIGGERS.some((re) => re.test(fullSnippet));

    // Determine ERP AI priority
    const hasErp = detectedErp.length > 0;
    const hasAi = detectedAi.length > 0;
    const isErpAiPriority = hasErp && hasAi;

    // Continuous multi-factor dynamic intent scoring formula
    let baseScore = 54;
    const wordCount = fullSnippet.split(/\s+/).filter(Boolean).length;
    if (wordCount > 50) baseScore += 2;
    if (wordCount > 120) baseScore += 3;
    if (wordCount > 300) baseScore += 3;
    if (wordCount > 600) baseScore += 2;

    const techMatches = (title.match(/\b(startup|tech|cloud|software|platform|enterprise|business|market|digital|growth|hiring|data|ai|saas|venture)\b/gi) || []).length;
    baseScore += Math.min(techMatches * 2, 6);

    let titleEntropy = 0;
    for (let i = 0; i < title.length; i++) {
      titleEntropy = (titleEntropy + title.charCodeAt(i) * (i + 1)) % 7;
    }
    baseScore += titleEntropy;

    let growthScore = 0;
    if (hasIntentTrigger) {
      const fundingCount = (fullSnippet.match(/\b(raises?|series\s+[a-f]|valuation|funding|invests?|acquisition|ipo|merger)\b/gi) || []).length;
      growthScore += 8 + Math.min(fundingCount * 2, 8);
    }

    let erpScore = 0;
    if (detectedErp.length > 0) {
      erpScore += 16;
      if (detectedErp.some((e) => e.includes("S/4HANA") || e.includes("Fusion"))) erpScore += 6;
      erpScore += Math.min(detectedErp.length * 3, 8);
    }

    let aiScore = 0;
    if (detectedAi.length > 0) {
      aiScore += 12;
      if (detectedAi.some((a) => a.includes("Copilot") || a.includes("Agentic") || a.includes("Generative"))) aiScore += 5;
      aiScore += Math.min(detectedAi.length * 2, 6);
    }

    const computedTotal = baseScore + growthScore + erpScore + aiScore;

    let tier = "STANDARD_GROWTH";
    let intentScore = 65;

    if (isErpAiPriority) {
      tier = "ERP_AI_VIP";
      intentScore = Math.min(99, Math.max(95, 95 + Math.min(detectedErp.length + detectedAi.length, 4)));
    } else if (computedTotal >= 80 || hasErp || (hasAi && hasIntentTrigger)) {
      tier = "ENTERPRISE_HIGH";
      intentScore = Math.min(94, Math.max(80, computedTotal >= 80 ? computedTotal : 81 + Math.min(detectedErp.length * 3, 9)));
    } else {
      tier = "STANDARD_GROWTH";
      intentScore = Math.min(79, Math.max(55, computedTotal));
    }

    const detectedCompany = extractCompanyName(title, sourceDomain);

    const targetedRoles = isErpAiPriority
      ? ["Chief Information Officer", "VP of Enterprise Applications", "Director of ERP", "Head of IT Transformation"]
      : ["Chief Technology Officer", "VP of Engineering", "Head of HR", "Chief Executive Officer"];

    return {
      articleTitle: title,
      articleUrl: canonicalUrl,
      sourceDomain,
      companyName: detectedCompany,
      rawContent: fullSnippet.slice(0, 3000),
      keySnippet: (metaDesc || paragraphs[0] || headings[0] || title).slice(0, 350),
      isErpAiPriority,
      isHubPage,
      tier,
      intentScore,
      erpVendors: detectedErp,
      aiKeywords: detectedAi,
      targetedRoles,
    };
  }

  // Floating pill UI in page corner when high-intent or ERP AI article detected
  function injectFloatingBadge(data) {
    if (!data.isErpAiPriority && data.intentScore < 80) return;
    if (document.getElementById("venus-intent-scanner-badge")) return;

    const badge = document.createElement("div");
    badge.id = "venus-intent-scanner-badge";
    badge.className = data.isErpAiPriority ? "venus-badge-vip" : "venus-badge-high";

    const erpLabel = data.erpVendors.length ? data.erpVendors.join(", ") : "Enterprise";
    const aiLabel = data.aiKeywords.length ? data.aiKeywords[0] : "AI Modernization";

    badge.innerHTML = `
      <div class="venus-badge-content">
        <div class="venus-badge-header">
          <span class="venus-sparkle">✨</span>
          <span class="venus-pill-tag">${data.isErpAiPriority ? "⭐ VIP ERP AI Intent" : "🔥 Intent News"}</span>
          <span class="venus-score-tag">Score: ${data.intentScore}</span>
          <button class="venus-badge-close" id="venus-badge-close-btn">&times;</button>
        </div>
        <div class="venus-badge-summary">
          <strong>${data.companyName ? data.companyName + ": " : ""}${erpLabel}</strong>
          ${data.isErpAiPriority ? `+ ${aiLabel}` : ""}
        </div>
        <div class="venus-badge-action-row">
          <button class="venus-btn-ingest" id="venus-btn-quick-ingest">
            <span class="btn-icon">⚡</span> Ingest to Venus CRM
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(badge);

    document.getElementById("venus-badge-close-btn")?.addEventListener("click", () => {
      badge.remove();
    });

    document.getElementById("venus-btn-quick-ingest")?.addEventListener("click", async () => {
      const btn = document.getElementById("venus-btn-quick-ingest");
      if (!btn) return;

      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner"></span> Ingesting & Finding Decision Maker...`;

      const { isHubPage, ...cleanData } = data;
      chrome.runtime.sendMessage(
        {
          action: "INGEST_INTENT_ARTICLE",
          article: cleanData,
        },
        (res) => {
          if (res && res.success) {
            btn.className = "venus-btn-ingest success";
            const dm = res.data?.decisionMaker;
            const dmText = dm ? `Matched: ${dm.name} (${dm.title || "CIO"})` : "Saved to Venus CRM";
            btn.innerHTML = `✅ ${dmText}`;
            setTimeout(() => {
              badge.style.opacity = "0";
              setTimeout(() => badge.remove(), 400);
            }, 4500);
          } else {
            btn.disabled = false;
            btn.className = "venus-btn-ingest error";
            btn.innerHTML = `⚠️ ${res?.error || "Ingest failed, click to retry"}`;
          }
        }
      );
    });
  }

  // Listen for popup inquiries
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_CURRENT_PAGE_INTENT") {
      const pageData = extractPageData();
      sendResponse({ success: true, data: pageData });
      return false; // synchronous response
    }
  });

  // Run scanner when page is settled
  setTimeout(() => {
    const data = extractPageData();
    injectFloatingBadge(data);
  }, 1200);
})();
