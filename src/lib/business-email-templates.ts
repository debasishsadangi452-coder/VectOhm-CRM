export interface BusinessTemplatePreset {
  id: string;
  category: "Cold Outreach" | "Hiring & Talent" | "Growth Signals" | "Follow-Ups" | "Partnership & Demos";
  name: string;
  subject: string;
  description: string;
  bodyHtml: string;
  appendSignature: boolean;
}

export const BUSINESS_EMAIL_PRESETS: BusinessTemplatePreset[] = [
  {
    id: "executive-cold-intro",
    category: "Cold Outreach",
    name: "01 - Executive Cold Introduction",
    subject: "Quick question regarding {{companyName}} growth & tech initiatives, {{firstName}}",
    description: "High-converting B2B cold intro tailored for C-Level executives, Founders, and VPs.",
    bodyHtml: `Hi {{firstName}},

I noticed your leadership at {{companyName}} and wanted to reach out directly.

We help fast-growing organizations accelerate engineering execution, automate CRM pipelines, and scale specialized technical teams. Leaders in your role often face bottlenecks balancing team capacity against aggressive delivery milestones.

Are you open to a brief 10-minute introductory conversation this week to explore if we can help {{companyName}} hit its growth targets?

Best regards,`,
    appendSignature: true,
  },
  {
    id: "hiring-vacancy-outreach",
    category: "Hiring & Talent",
    name: "02 - Active Role & Talent Support",
    subject: "Regarding your open hiring positions at {{companyName}}",
    description: "Tailored for companies with active job postings scraped from live market data.",
    bodyHtml: `Hi {{firstName}},

I saw that {{companyName}} is actively recruiting for key roles right now. Congratulations on the company's momentum!

Sourcing, screening, and closing pre-vetted senior technical talent quickly can consume significant executive and engineering bandwidth. We maintain specialized talent pipelines that reduce time-to-hire by over 50% for high-growth tech teams.

Would you be open to reviewing a couple of vetted candidate profiles matched to {{companyName}}'s stack this week?

Best regards,`,
    appendSignature: true,
  },
  {
    id: "growth-expansion-signal",
    category: "Growth Signals",
    name: "03 - Company Growth & Scaling Solutions",
    subject: "Congrats on {{companyName}}'s recent expansion, {{firstName}}",
    description: "Congratulate leaders on funding, headcount expansion, or newly launched offices.",
    bodyHtml: `Hi {{firstName}},

I came across the recent news regarding {{companyName}}'s rapid expansion. Exciting milestones ahead!

As companies scale headcount and client operations, maintaining execution speed while maintaining pipeline visibility becomes essential. We partner with leaders to provide modern workforce management and enterprise sales automation tailored for scaling organizations.

Do you have 10 minutes on Tuesday or Thursday for a quick introductory chat?

Best regards,`,
    appendSignature: true,
  },
  {
    id: "followup-value-add",
    category: "Follow-Ups",
    name: "04 - Follow-Up & Value Delivery",
    subject: "Following up on my note, {{firstName}}",
    description: "Gentle follow-up sharing quantifiable metrics and ROI social proof.",
    bodyHtml: `Hi {{firstName}},

Following up on my previous message. I understand your schedule at {{companyName}} is quite demanding.

I wanted to share how we recently helped a similar technology team reduce candidate screening time by 40% while doubling their qualified pipeline in under 30 days.

If scaling your engineering or sales capacity is a priority this quarter, let me know if a short sync makes sense. If not, no worries at all!

Best regards,`,
    appendSignature: true,
  },
  {
    id: "partnership-demo-invitation",
    category: "Partnership & Demos",
    name: "05 - Partnership & Product Demo",
    subject: "Exploring synergy between {{companyName}} and Venus",
    description: "Invites executives to a high-level 15-minute product walkthrough and platform demo.",
    bodyHtml: `Hi {{firstName}},

I am reaching out from Venus. We develop next-generation sales intelligence, talent automation, and CRM platforms designed specifically for forward-thinking leadership teams.

Given your role as {{title}} at {{companyName}}, I thought you might appreciate a quick walkthrough of how our platform unifies candidate tracking, sales pipelines, and live hiring intent signals.

Would you be open to a 15-minute product overview next week?

Looking forward to connecting,`,
    appendSignature: true,
  },
  {
    id: "polite-breakup-checkin",
    category: "Follow-Ups",
    name: "06 - Final Check-In / Permission to Close",
    subject: "Permission to close your file at {{companyName}}?",
    description: "Low-pressure final email to re-engage unresponsive leads or gracefully close the loop.",
    bodyHtml: `Hi {{firstName}},

I haven't heard back from you, which usually means one of two things: either this isn't a priority for {{companyName}} right now, or you've been extraordinarily busy.

If the timing isn't right, please let me know and I will gladly close out my notes so I don't crowd your inbox.

Whenever you're ready to explore ways to streamline your outreach and recruitment operations, feel free to reach out.

Wishing you and {{companyName}} continued success!

Best regards,`,
    appendSignature: true,
  },
];
