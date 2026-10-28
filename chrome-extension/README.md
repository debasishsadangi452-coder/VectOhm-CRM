# Venus CRM — Job Board Auto-Poster & Recruiter Copilot 🚀

> **Executive-Grade Chrome Extension (Manifest V3)** for automating job requisition syndication and candidate sourcing across **LinkedIn**, **Indeed**, and **Naukri & Resdex** directly connected to your **Venus CRM Recruitment Center** (`/recruitment`) and public **Careers Portal** (`/careers`).

---

## 📑 Table of Contents
1. [Architecture & System Flow](#-architecture--system-flow)
2. [Key Capabilities](#-key-capabilities)
3. [Installation & Setup](#-installation--setup)
4. [Authentication & Modes of Operation](#-authentication--modes-of-operation)
5. [Job Board Operational Guide](#-job-board-operational-guide)
   - [LinkedIn Job Posting & Feed Announcements](#1-linkedin)
   - [Indeed Employer Requisitions](#2-indeed)
   - [Naukri & Resdex Recruitment](#3-naukri--resdex)
6. [Reverse Candidate Sourcing (1-Click Import)](#-reverse-candidate-sourcing-1-click-import)
7. [Technical Architecture & Security](#-technical-architecture--security)
8. [File Structure](#-file-structure)

---

## 🏛 Architecture & System Flow

The Venus Recruiter Copilot bridges your Venus CRM backend with major employment platforms through a non-invasive, secure Manifest V3 browser extension.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Venus CRM Backend                             │
│  - GET  /api/careers/jobs        (Public open requisitions)             │
│  - GET  /api/job-postings        (Full recruitment center requisitions) │
│  - POST /api/candidates          (Direct pipeline candidate import)     │
│  - POST /api/careers/apply       (Public candidate application)         │
│  - POST /api/auth/login          (Recruiter JWT authentication)         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     │ JSON RPC / REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Venus Recruiter Copilot (Chrome Extension)               │
│                                                                         │
│  ┌───────────────────────┐            ┌──────────────────────────────┐  │
│  │   Popup Controller    │◄──────────►│  Background Service Worker   │  │
│  │ (popup.html / js / css│            │        (background.js)       │  │
│  └───────────────────────┘            └──────────────┬───────────────┘  │
└──────────────────────────────────────────────────────┼──────────────────┘
                                                       │
                           chrome.tabs.sendMessage     │ runtime.onMessage
                                                       ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     Target Job Board Web Pages                         │
 │                                                                        │
 │  ┌───────────────────────┐   ┌───────────────────┐   ┌──────────────┐  │
 │  │      LinkedIn         │   │      Indeed       │   │    Naukri    │  │
 │  │ (content-linkedin.js) │   │(content-indeed.js)│   │(content-     │  │
 │  │                       │   │                   │   │  naukri.js)  │  │
 │  └───────────────────────┘   └───────────────────┘   └──────────────┘  │
 │                                                                        │
 │        Injected Floating Glassmorphism Widget (#venus-copilot-host)     │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Capabilities

### 1. 1-Click Job Board Auto-Filling
- Auto-populates Job Title, Department, Workplace Type (Remote / Hybrid / On-site), Job Description, Minimum Experience, Compensation/Salary brackets, Key Skills, and Direct Apply URLs.
- Compatible with modern React, Lexical, DraftJS, and Quill rich text editors by dispatching synthetic `InputEvent`, `beforeinput`, and native prototype value setters.

### 2. Viral Social Hiring Blast (LinkedIn Feed & Groups)
- Instantly formats high-converting, emoji-rich hiring announcements with role highlights, key required skills, location badges, compensation, relevant trending hashtags, and direct link to your official Careers page (`/careers/:jobId`).

### 3. Reverse Candidate Sourcing
- When browsing any candidate profile on **LinkedIn** (`linkedin.com/in/*`) or **Naukri Resdex** (`resdex.naukri.com`), the extension extracts their full name, headline/title, location, and skill tags.
- Select any active job requisition from Venus CRM and click **"1-Click Import to Venus Pipeline"**. The candidate is immediately added to your CRM Recruitment Center (`/recruitment`) with stage set to **`SOURCED`**.

---

## 🛠 Installation & Setup

### Step 1: Open Chrome Extensions
1. Launch **Google Chrome**, **Microsoft Edge**, or **Brave**.
2. Open a new tab and enter:
   ```text
   chrome://extensions
   ```
   *(For Edge: `edge://extensions`)*

### Step 2: Enable Developer Mode
- In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 3: Load Unpacked Extension
1. Click the **Load unpacked** button in the top-left corner.
2. In the folder picker dialog, select the `chrome-extension` directory inside this project:
   ```text
   c:\Users\HP\Desktop\gentle-crm-glide-app\chrome-extension
   ```
3. Click **Select Folder**.
4. You will see **Venus CRM — Job Board Auto-Poster & Recruiter Copilot** appear in your extension list with its violet icon!
5. Pin the extension to your Chrome toolbar for instant access.

---

## 🔐 Authentication & Modes of Operation

The extension supports two modes out-of-the-box:

### Mode A: Authenticated Recruiter Mode (Recommended)
1. Click the **Venus Copilot** icon in your toolbar.
2. Go to the **Settings** tab.
3. Verify the **Base URL** (defaults to `http://localhost:8080`).
4. Enter your Venus CRM email and password, then click **Sign In to Venus CRM**.
5. Once signed in:
   - Header badge shows **`Connected as [Your Name]`**.
   - Sourced candidates are imported directly with full metadata and assigned owner.
   - Stage is set to **`SOURCED`** in the CRM recruitment kanban.

### Mode B: Public Careers Mode (Zero-Config)
- Works immediately without logging in!
- Automatically pulls open requisitions from the public `GET /api/careers/jobs` API.
- Enables 1-click form auto-fill and social announcement generation.
- Sourced candidates submit through the verified `/api/careers/apply` gateway.

---

## 🌐 Job Board Operational Guide

### 1. LinkedIn

#### Requisition Auto-Posting:
1. Navigate to LinkedIn Job Creation: [linkedin.com/jobs/post](https://www.linkedin.com/jobs/post) or [linkedin.com/talent/post-a-job](https://www.linkedin.com/talent/post-a-job).
2. The floating **✨ Venus Copilot** pill will automatically appear in the bottom-right corner.
3. Click the pill to open the widget, or click the extension icon in your toolbar.
4. Select your target requisition from the dropdown (e.g., *Lead Fullstack Engineer*).
5. Click **⚡ Auto-Fill This Job On Page**.
6. The extension fills the Title, Location, Workplace Type, Job Description, and External Apply URL.

#### Social Hiring Post (LinkedIn Feed):
1. In the extension popup or floating widget, click **📢 Draft Viral LinkedIn Hiring Post**.
2. The complete formatted post is copied to your clipboard.
3. Go to [linkedin.com/feed](https://www.linkedin.com/feed/), click **Start a post**, press `Ctrl + V` (or `Cmd + V`), and hit **Post**!

---

### 2. Indeed

#### Requisition Auto-Posting:
1. Navigate to Indeed Employer Job Creation: [employers.indeed.com](https://employers.indeed.com/) or [indeed.com/hire](https://www.indeed.com/hire).
2. The **✨ Venus Indeed Copilot** widget pill will appear.
3. Pick your Venus job requisition.
4. Click **⚡ Auto-Fill This Job On Indeed**.
5. The extension fills Job Title, Location, Min/Max Compensation, Job Description, and the direct Venus application link.

---

### 3. Naukri & Resdex

#### Recruiter Posting & Sourcing:
1. Navigate to [employer.naukri.com](https://employer.naukri.com/) or [recruiter.naukri.com](https://recruiter.naukri.com/).
2. The **✨ Venus Naukri Copilot** widget will appear.
3. Select the requisition and click **⚡ Auto-Fill This Job On Naukri**.
4. The extension populates Job Title, Key Skills/Keywords, Minimum Experience, Location, and Job Description.

---

## 👤 Reverse Candidate Sourcing (1-Click Import)

1. Open any candidate's profile on LinkedIn (`https://www.linkedin.com/in/...`) or Naukri Resdex.
2. Click the floating **✨ Venus Copilot** pill and switch to the **Candidate Sourcing** tab (or open the toolbar popup).
3. The Copilot extracts:
   - Full Name
   - Current Title & Headline
   - City & State
   - Top Skills chips
4. Select which requisition in Venus CRM you are sourcing this candidate for.
5. Click **📥 1-Click Import Candidate to Venus CRM**.
6. Open your Venus CRM at `http://localhost:8080/recruitment`. The candidate will be visible under the **Applicants** tab or Kanban board under stage **`SOURCED`**!

---

## 🔒 Technical Architecture & Security

- **Manifest V3 Compliant**: Built strictly adhering to Chrome Manifest V3 standards with a modern service worker background script.
- **CSS Isolation**: All injected styles are encapsulated under `#venus-copilot-host` with `all: initial` and high CSS specificity, ensuring zero interference with host site layout or themes.
- **Synthesized DOM Events**: Modern SPA frameworks (React, Angular, Vue) bypass standard `.value = ...` changes. The content scripts dispatch native property descriptor setters alongside `input`, `change`, and `blur` events so host component state updates immediately.
- **Security & Privacy**:
  - Auth tokens are stored locally in Chrome's encrypted `chrome.storage.local`.
  - Content scripts only run on authorized job board patterns declared in `matches`.
  - Zero external third-party telemetry or ad-trackers.

---

## 📁 File Structure

```text
chrome-extension/
├── manifest.json                  # Manifest V3 specification & permissions
├── generate-icons.js              # Script for generating PNG icon assets
├── README.md                      # Comprehensive documentation
├── icons/
│   ├── icon16.png                 # 16x16 toolbar icon
│   ├── icon48.png                 # 48x48 extensions list icon
│   └── icon128.png                # 128x128 Chrome Web Store icon
├── popup/
│   ├── popup.html                 # Extension popup interface
│   ├── popup.css                  # Modern UI styles
│   └── popup.js                   # Extension popup controller
└── scripts/
    ├── background.js              # Background service worker (API sync, auth, storage)
    ├── content-linkedin.js        # LinkedIn auto-fill, sourcing & social post injector
    ├── content-indeed.js          # Indeed employer auto-fill & sourcing script
    ├── content-naukri.js          # Naukri employer & Resdex sourcing script
    └── content-widget.css         # Injected floating widget stylesheet
```
