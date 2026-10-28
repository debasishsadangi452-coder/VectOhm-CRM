import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, type CSSProperties, type ReactNode } from "react";

export const Route = createFileRoute("/landing")({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,340..900&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: CrmLandingPage,
});

// The app itself is dark-themed (see :root in styles.css); this marketing
// page is deliberately light and paper-toned. Forcing the body background
// stops the dark canvas from showing through on overscroll / behind the
// fixed nav, same reason the previous version of this page did it.
function useLightPageChrome() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const { body, documentElement } = document;
    const previousBody = body.style.backgroundColor;
    const previousScroll = documentElement.style.scrollBehavior;
    body.style.backgroundColor = "#ffffff";
    documentElement.style.scrollBehavior = "smooth";
    return () => {
      body.style.backgroundColor = previousBody;
      documentElement.style.scrollBehavior = previousScroll;
    };
  }, []);
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const tint = (color: string): CSSProperties =>
  ({ "--tint": color, color } as CSSProperties);

function Wordmark({ small }: { small?: boolean }) {
  return (
    <div className={`wordmark${small ? " small" : ""}`}>
      <span className="mark">V</span>Venus CRM
    </div>
  );
}

function StatStrip() {
  return (
    <div className="stat-strip">
      <div className="stat">
        <div className="num">12</div>
        <div className="lbl">Modules</div>
      </div>
      <div className="stat">
        <div className="num">1</div>
        <div className="lbl">Login</div>
      </div>
      <div className="stat">
        <div className="num">0</div>
        <div className="lbl">Spreadsheets left</div>
      </div>
    </div>
  );
}

type Point = { title: string; body: string };

function StorySection({
  id,
  reverse,
  dim,
  eyebrow,
  eyebrowColor,
  title,
  lede,
  points,
  tag,
  img,
  alt,
}: {
  id: string;
  reverse?: boolean;
  dim?: boolean;
  eyebrow: string;
  eyebrowColor?: string;
  title: ReactNode;
  lede: string;
  points: Point[];
  tag: string;
  img: string;
  alt: string;
}) {
  return (
    <section
      id={id}
      className={`story${reverse ? " reverse" : ""}${dim ? " dim" : ""}`}
    >
      <div className="wrap grid">
        <div className="story-copy">
          <div className="eyebrow" style={eyebrowColor ? tint(eyebrowColor) : undefined}>
            {eyebrow}
          </div>
          <h2>{title}</h2>
          <p className="lede">{lede}</p>
          <div className="points">
            {points.map((p) => (
              <div className="pt" key={p.title} style={eyebrowColor ? tint(eyebrowColor) : undefined}>
                <b>{p.title}</b> <span>{p.body}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="story-window">
          <div className="chrome">
            <span />
            <span />
            <span />
            <span className="tag">{tag}</span>
          </div>
          <img src={img} alt={alt} loading="lazy" />
        </div>
      </div>
    </section>
  );
}

function CrmLandingPage() {
  useLightPageChrome();

  return (
    <div className="venus-landing">
      <style>{LANDING_CSS}</style>

      <nav className="top">
        <div className="wrap row">
          <Wordmark />
          <div className="navlinks">
            <a onClick={() => scrollToId("sales")}>Sales</a>
            <a onClick={() => scrollToId("engineering")}>Engineering</a>
            <a onClick={() => scrollToId("marketing")}>Marketing</a>
            <a onClick={() => scrollToId("comms")}>Comms</a>
            <a onClick={() => scrollToId("people")}>People</a>
          </div>
          <Link to="/login" className="navcta">
            Sign in
          </Link>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="eyebrow">Venus CRM — Operations Platform</div>
          <h1>
            Where every department
            <br />
            keeps <em>score.</em>
          </h1>
          <p className="sub">
            Sales pipelines, sprint boards, SEO rankings, payroll, and the team chat that
            ties it together — running under one login, not six different tools with six
            different passwords.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn primary">
              Sign in →
            </Link>
            <button type="button" className="btn ghost" onClick={() => scrollToId("sales")}>
              Walk through the modules
            </button>
          </div>
          <StatStrip />
        </div>
        <div className="hero-window-stage">
          <div className="window">
            <div className="chrome">
              <span />
              <span />
              <span />
              <span className="url">venuscrm.app/dashboard</span>
            </div>
            <img
              src="/landing/dashboard.png"
              alt="Venus CRM dashboard showing revenue, sprint, and recruitment overview"
              loading="eager"
            />
          </div>
        </div>
      </header>

      <StorySection
        id="sales"
        eyebrow="Sales"
        title={
          <>A pipeline that argues with no one about what stage a deal is in.</>
        }
        lede="Every lead moves through the same eight stages — New Lead through Won, Lost, or Archived — as a board the whole team reads the same way, with owner, value, and company visible on the card itself."
        points={[
          {
            title: "Deal-level follow-up reminders.",
            body: "Set a follow-up date on any deal and its owner gets notified in-app and by email the moment it's due — no more deals going quiet.",
          },
          {
            title: "Companies and contacts, not a separate address book.",
            body: "Every deal is already linked to who you're talking to.",
          },
          {
            title: "Approval thresholds.",
            body: "Big deals above a department's limit route to a manager before they close.",
          },
        ]}
        tag="CRM & SALES"
        img="/landing/crm-sales.png"
        alt="Sales pipeline board with deal stages and cards"
      />

      <StorySection
        id="engineering"
        reverse
        dim
        eyebrow="Engineering"
        eyebrowColor="var(--violet)"
        title={<>A task can't reach <em>Done</em> until it's actually done.</>}
        lede="Every task carries a designated tester. Before it can close, the workspace checks for a daily update, a logged time entry, and zero open bugs — automatically, not on the honor system."
        points={[
          {
            title: "Built-in bug tracker.",
            body: "Severity, priority, and status live next to the task that spawned them, with a full comment thread per bug.",
          },
          {
            title: "Subtasks and multi-assignee support.",
            body: "A task can have one owner and a QA reviewer at the same time.",
          },
          {
            title: "Full audit history.",
            body: "Every status change, assignment, and QA decision is logged against the task, permanently.",
          },
        ]}
        tag="TASKS & BUG TRACKING"
        img="/landing/tasks.png"
        alt="Task and bug tracking workspace with QA workflow"
      />

      <StorySection
        id="engineering-2"
        eyebrow="Engineering"
        eyebrowColor="var(--violet)"
        title={<>Sprints that watch the commit log, not just the ticket.</>}
        lede="A live daily-updates feed pulls straight from your team's git activity and sits beside the sprint board — so standup is a glance, not a meeting."
        points={[
          {
            title: "Seven-column sprint board.",
            body: "To Do through Ready for Testing, Changes Required, and Completed — the states a real QA cycle actually needs.",
          },
          {
            title: "Backlog planning and per-project scoping.",
            body: "Filter the whole board down to one project's sprint in a click.",
          },
        ]}
        tag="DEV SPRINTS"
        img="/landing/dev-sprints.png"
        alt="Development sprint board with live commit feed"
      />

      <StorySection
        id="marketing"
        reverse
        dim
        eyebrow="Marketing"
        eyebrowColor="var(--amber)"
        title={<>Nine tabs. One place your SEO strategy actually lives.</>}
        lede="Keyword tracking, content QA, backlink verification, competitor intel, and technical audits — the whole content operation, scoped to a project or seen department-wide."
        points={[
          {
            title: "AI-assisted content briefs.",
            body: "Generate a first draft from a target keyword, then route it through a real review and QA-checklist workflow.",
          },
          {
            title: "Manager-verified backlinks.",
            body: "Every acquired link gets a verify/reject decision, not just a spreadsheet row.",
          },
          {
            title: "Executive reporting, built in.",
            body: "Rankings, published articles, and verified links roll up into a printable client report.",
          },
        ]}
        tag="DIGITAL MARKETING HUB"
        img="/landing/digital-marketing-hub.png"
        alt="Digital Marketing Hub with SEO operations dashboard"
      />

      <StorySection
        id="comms"
        eyebrow="Outreach"
        eyebrowColor="var(--emerald)"
        title={<>Send from your own inbox. See it sync back automatically.</>}
        lede="Connect a real Gmail or Outlook account and every rep sends as themselves — recipients see and reply to a real person, not a shared no-reply address."
        points={[
          {
            title: "Bulk campaigns and drip sequences.",
            body: "Merge-fielded templates, open tracking, and one-click unsubscribe handling out of the box.",
          },
          {
            title: "Two-way mailbox sync.",
            body: "Once connected, sent and received mail syncs into the CRM automatically and lands on the right contact's timeline.",
          },
          {
            title: "Cold-outreach follow-up alerts.",
            body: "An unopened email after three days shows up on your dashboard so nothing goes quiet.",
          },
        ]}
        tag="BULK EMAIL & SEQUENCES"
        img="/landing/bulk-email.png"
        alt="Bulk email sender and sequence automation panel"
      />

      <StorySection
        id="comms-2"
        reverse
        dim
        eyebrow="Comms"
        title={<>The chat that already knows which deal you're talking about.</>}
        lede="Channel-based team chat sits next to the CRM itself — no switching apps to loop someone in on a deal, a bug, or a candidate."
        points={[
          {
            title: "Unread counts everywhere that matters.",
            body: "The sidebar badge follows you across the whole app.",
          },
          {
            title: "Pinned messages and system activity.",
            body: "Automatic posts when a deal closes or a sprint starts.",
          },
        ]}
        tag="TEAM CHAT"
        img="/landing/team-chat.png"
        alt="Team chat channel interface"
      />

      <StorySection
        id="people"
        eyebrow="People"
        eyebrowColor="var(--rose)"
        title={<>Payroll's HR portal, recruiting's pipeline, one system of record.</>}
        lede="Leave requests, attendance, and a candidate pipeline that moves from Applied to Hired — run by the same access rules as every other department."
        points={[
          {
            title: "Leave requests with real approval routing.",
            body: "A manager approves or rejects; the calendar updates itself.",
          },
          {
            title: "Full recruitment funnel.",
            body: "Applied → Screening → Interview → Offer → Hired, with job postings and candidate records attached.",
          },
        ]}
        tag="HRMS PORTAL"
        img="/landing/hrms.png"
        alt="HRMS portal with leave requests and attendance"
      />

      <section className="more">
        <div className="wrap">
          <h2>And the rest of the department, covered.</h2>
          <p>
            Every module reports up to the same dashboard and respects the same department
            and role permissions.
          </p>
          <div className="chips">
            <span className="chip">
              <b>Projects</b> — Kanban board, per-project docs &amp; credentials
            </span>
            <span className="chip">
              <b>Analytics</b> — cross-department reporting
            </span>
            <span className="chip">
              <b>Recruitment</b> — job postings, offers, interview scheduling
            </span>
            <span className="chip">
              <b>Attendance</b> — clock-in/out with photo verification
            </span>
            <span className="chip">
              <b>Knowledge Base</b> — internal docs
            </span>
            <span className="chip">
              <b>Screen Monitoring</b> — session activity for remote teams
            </span>
            <span className="chip">
              <b>Power Dialer</b> — click-to-call with live disposition logging
            </span>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap inner">
          <div className="eyebrow on-deep">Ready when you are</div>
          <h2>Stop running your company across twelve open tabs.</h2>
          <p>One login. Every department already agreed on it.</p>
          <div className="hero-actions">
            <Link to="/login" className="btn primary">
              Sign in →
            </Link>
            <button type="button" className="btn ghost" onClick={() => scrollToId("sales")}>
              Walk through the modules
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap row">
          <Wordmark small />
          <div>© 2026 Venus CRM. Built for teams who outgrew the spreadsheet.</div>
        </div>
      </footer>
    </div>
  );
}

const LANDING_CSS = `
.venus-landing {
  --paper: #ffffff;
  --paper-dim: #f6f4ef;
  --paper-line: #e8e5db;
  --ink: #15151d;
  --ink-dim: #67646f;
  --ink-faint: #a6a2ab;
  --accent: #3450e6;
  --deep: #12183a;
  --deep-line: #2b3363;
  --deep-text: #d8dcf5;
  --amber: #cf8a1f;
  --violet: #7452e0;
  --emerald: #1a9e6b;
  --rose: #d94a63;

  --display: "Fraunces", ui-serif, Georgia, "Times New Roman", serif;
  --body: "Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

  background: var(--paper);
  color: var(--ink);
  font-family: var(--body);
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.venus-landing ::selection { background: var(--accent); color: #fff; }
.venus-landing img { max-width: 100%; display: block; }
.venus-landing a { color: inherit; cursor: pointer; text-decoration: none; }

.venus-landing .wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

.venus-landing h1, .venus-landing h2, .venus-landing h3 {
  font-family: var(--display);
  font-weight: 620;
  letter-spacing: -0.01em;
  text-wrap: balance;
  margin: 0;
}

.venus-landing .eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}
.venus-landing .eyebrow.on-deep { color: #8fa0ff; }

/* ---------- Nav ---------- */
.venus-landing nav.top {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255,255,255,0.86);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--paper-line);
}
.venus-landing nav.top .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
}
.venus-landing .wordmark {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--display);
  font-weight: 650;
  font-size: 19px;
  letter-spacing: -0.01em;
}
.venus-landing .wordmark .mark {
  width: 26px; height: 26px;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  display: grid;
  place-items: center;
  font-family: var(--display);
  font-weight: 700;
  font-size: 14px;
}
.venus-landing .wordmark.small { font-size: 15px; }
.venus-landing .wordmark.small .mark { width: 20px; height: 20px; font-size: 11px; }
.venus-landing .navlinks {
  display: flex;
  gap: 30px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink-dim);
}
.venus-landing .navlinks a:hover { color: var(--ink); }
.venus-landing .navcta {
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: var(--ink);
  color: #fff;
  padding: 9px 16px;
  border-radius: 7px;
}

/* ---------- Hero ---------- */
.venus-landing header.hero { padding: 92px 0 40px; text-align: center; }
.venus-landing header.hero .eyebrow { margin-bottom: 22px; }
.venus-landing header.hero h1 {
  font-size: clamp(40px, 6.2vw, 74px);
  line-height: 1.04;
  max-width: 920px;
  margin: 0 auto;
}
.venus-landing header.hero h1 em { font-style: italic; color: var(--accent); }
.venus-landing header.hero .sub {
  max-width: 620px;
  margin: 26px auto 0;
  font-size: 18px;
  color: var(--ink-dim);
  line-height: 1.65;
}
.venus-landing .hero-actions { display: flex; justify-content: center; gap: 14px; margin-top: 36px; }
.venus-landing .btn {
  font-family: var(--body);
  font-weight: 700;
  font-size: 15px;
  padding: 13px 24px;
  border-radius: 9px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.venus-landing .btn.primary { background: var(--accent); color: #fff; }
.venus-landing .btn.ghost { background: transparent; color: var(--ink); border-color: var(--paper-line); }

.venus-landing .stat-strip { display: flex; justify-content: center; gap: 0; margin-top: 56px; font-family: var(--mono); }
.venus-landing .stat-strip .stat { padding: 0 30px; border-left: 1px solid var(--paper-line); text-align: left; }
.venus-landing .stat-strip .stat:first-child { border-left: none; }
.venus-landing .stat-strip .num { font-size: 26px; font-weight: 600; color: var(--ink); letter-spacing: -0.02em; }
.venus-landing .stat-strip .lbl { font-size: 11.5px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3px; }

/* ---------- Hero window ---------- */
.venus-landing .hero-window-stage {
  margin-top: 58px;
  padding: 0 32px 20px;
  display: flex;
  justify-content: center;
  perspective: 2400px;
}
.venus-landing .window {
  width: 100%;
  max-width: 1040px;
  border-radius: 14px;
  background: var(--deep);
  border: 1px solid var(--deep-line);
  box-shadow: 0 60px 120px -40px rgba(18,24,58,0.45), 0 20px 44px -20px rgba(18,24,58,0.35);
  overflow: hidden;
  transform: rotateX(3deg);
}
.venus-landing .window .chrome { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid var(--deep-line); }
.venus-landing .window .chrome span { width: 10px; height: 10px; border-radius: 50%; background: #3a4278; }
.venus-landing .window .chrome .url { margin-left: 14px; font-family: var(--mono); font-size: 11.5px; color: #6c76ac; }
.venus-landing .window img { width: 100%; display: block; }

/* ---------- Section rhythm ---------- */
.venus-landing section.story { padding: 118px 0; }
.venus-landing section.story.dim { background: var(--paper-dim); }
.venus-landing section.story .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 76px; align-items: center; }
.venus-landing section.story.reverse .grid { direction: rtl; }
.venus-landing section.story.reverse .grid > * { direction: ltr; }

.venus-landing .story-copy .eyebrow { margin-bottom: 16px; }
.venus-landing .story-copy h2 { font-size: clamp(28px, 3vw, 38px); line-height: 1.12; margin-bottom: 18px; }
.venus-landing .story-copy p.lede { color: var(--ink-dim); font-size: 16.5px; line-height: 1.7; max-width: 46ch; }
.venus-landing .story-copy .points { margin-top: 26px; display: flex; flex-direction: column; gap: 14px; }
.venus-landing .story-copy .points .pt { display: flex; gap: 12px; align-items: baseline; font-size: 15px; }
.venus-landing .story-copy .points .pt::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--tint, var(--accent));
  flex: none;
  transform: translateY(-3px);
}
.venus-landing .story-copy .points b { font-weight: 700; }
.venus-landing .story-copy .points span { color: var(--ink-dim); }

.venus-landing .story-window {
  border-radius: 12px;
  background: var(--deep);
  border: 1px solid var(--deep-line);
  box-shadow: 0 40px 80px -32px rgba(18,24,58,0.4);
  overflow: hidden;
}
.venus-landing .story-window .chrome { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--deep-line); }
.venus-landing .story-window .chrome span { width: 8px; height: 8px; border-radius: 50%; background: #3a4278; }
.venus-landing .story-window .chrome .tag {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: #8b94cf;
  background: rgba(140,150,220,0.12);
  padding: 3px 8px;
  border-radius: 5px;
}
.venus-landing .story-window img { width: 100%; display: block; }

/* ---------- module chip strip ---------- */
.venus-landing section.more { padding: 100px 0 120px; text-align: center; }
.venus-landing section.more h2 { font-size: clamp(26px, 2.6vw, 34px); margin-bottom: 12px; }
.venus-landing section.more p { color: var(--ink-dim); max-width: 480px; margin: 0 auto 44px; }
.venus-landing .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; max-width: 900px; margin: 0 auto; }
.venus-landing .chip {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid var(--paper-line);
  color: var(--ink-dim);
  background: var(--paper);
}
.venus-landing .chip b { color: var(--ink); font-weight: 600; }

/* ---------- CTA band ---------- */
.venus-landing section.cta {
  background: var(--deep);
  color: var(--deep-text);
  padding: 110px 0;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.venus-landing section.cta::before {
  content: "";
  position: absolute;
  inset: -40% -10% auto -10%;
  height: 480px;
  background: radial-gradient(closest-side, rgba(52,80,230,0.35), transparent 70%);
  pointer-events: none;
}
.venus-landing section.cta .inner { position: relative; }
.venus-landing section.cta h2 {
  color: #fff;
  font-size: clamp(32px, 4.4vw, 52px);
  max-width: 700px;
  margin: 20px auto 18px;
  line-height: 1.08;
}
.venus-landing section.cta p { color: var(--deep-text); max-width: 480px; margin: 0 auto 36px; font-size: 16.5px; }
.venus-landing section.cta .btn.primary { background: #fff; color: var(--deep); }
.venus-landing section.cta .btn.ghost { border-color: var(--deep-line); color: var(--deep-text); }
.venus-landing section.cta .hero-actions { margin-top: 0; }

/* ---------- footer ---------- */
.venus-landing footer { padding: 44px 0 56px; }
.venus-landing footer .row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; color: var(--ink-faint); }

@media (max-width: 880px) {
  .venus-landing .navlinks { display: none; }
  .venus-landing section.story .grid { grid-template-columns: 1fr; gap: 40px; }
  .venus-landing section.story.reverse .grid { direction: ltr; }
  .venus-landing section.story { padding: 76px 0; }
  .venus-landing .stat-strip { flex-wrap: wrap; row-gap: 24px; }
  .venus-landing .stat-strip .stat { padding: 0 20px; }
}
`;
