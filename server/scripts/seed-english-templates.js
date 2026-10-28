const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ENGLISH_TEMPLATES = [
  {
    name: "01 - Executive Cold Introduction",
    subject: "Quick question regarding {{companyName}} growth & tech initiatives, {{firstName}}",
    bodyHtml: `Hi {{firstName}},

I noticed your leadership at {{companyName}} and wanted to reach out directly.

We help fast-growing organizations accelerate engineering execution, automate CRM pipelines, and scale specialized technical teams. Leaders in your role often face bottlenecks balancing team capacity against aggressive delivery milestones.

Are you open to a brief 10-minute introductory conversation this week to explore if we can help {{companyName}} hit its growth targets?

Best regards,`,
    appendSignature: true,
  },
  {
    name: "02 - Active Job Opening & Hiring Support",
    subject: "Regarding your open {{title}} role at {{companyName}}",
    bodyHtml: `Hi {{firstName}},

I saw that {{companyName}} is actively recruiting for key roles right now. Congratulations on the company's momentum!

Sourcing, screening, and closing pre-vetted senior technical talent quickly can consume significant executive and engineering bandwidth. We maintain pre-qualified talent pipelines that reduce time-to-hire by over 50% for high-growth tech companies.

Would you be open to reviewing a couple of vetted candidate profiles matched to {{companyName}}'s stack this week?

Best regards,`,
    appendSignature: true,
  },
  {
    name: "03 - Company Growth & Scaling Solutions",
    subject: "Congrats on {{companyName}}'s recent expansion, {{firstName}}",
    bodyHtml: `Hi {{firstName}},

I came across the recent news regarding {{companyName}}'s rapid expansion. Exciting milestones ahead!

As companies scale headcount and client operations, maintaining execution speed while maintaining pipeline visibility becomes essential. We partner with leaders to provide modern workforce management and enterprise sales automation tailored for scaling organizations.

Do you have 10 minutes on Tuesday or Thursday for a quick introductory chat?

Best regards,`,
    appendSignature: true,
  },
  {
    name: "04 - Follow-Up & Value Delivery",
    subject: "Following up on my note, {{firstName}}",
    bodyHtml: `Hi {{firstName}},

Following up on my previous message. I understand your schedule at {{companyName}} is quite demanding.

I wanted to share how we recently helped a similar technology team reduce candidate screening time by 40% while doubling their qualified pipeline in under 30 days.

If scaling your engineering or sales capacity is a priority this quarter, let me know if a short sync makes sense. If not, no worries at all!

Best regards,`,
    appendSignature: true,
  },
  {
    name: "05 - Partnership & Demo Invitation",
    subject: "Exploring synergy between {{companyName}} and Venus",
    bodyHtml: `Hi {{firstName}},

I am reaching out from Venus. We develop next-generation sales intelligence, talent automation, and CRM platforms designed specifically for forward-thinking leadership teams.

Given your role as {{title}} at {{companyName}}, I thought you might appreciate a quick walkthrough of how our platform unifies candidate tracking, sales pipelines, and live hiring intent signals.

Would you be open to a 15-minute product overview next week?

Looking forward to connecting,`,
    appendSignature: true,
  },
  {
    name: "06 - Final Check-In / Permission to Close",
    subject: "Permission to close your file at {{companyName}}?",
    bodyHtml: `Hi {{firstName}},

I haven't heard back from you, which usually means one of two things: either this isn't a priority for {{companyName}} right now, or you've been extraordinarily busy.

If the timing isn't right, please let me know and I will gladly close out my notes so I don't crowd your inbox.

Whenever you're ready to explore ways to streamline your outreach and recruitment operations, feel free to reach out.

Wishing you and {{companyName}} continued success!

Best regards,`,
    appendSignature: true,
  },
];

async function main() {
  console.log("Checking creator user & sales department...");
  const user =
    (await prisma.user.findFirst({ where: { email: "jon@venushiring.com" } })) ||
    (await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } })) ||
    (await prisma.user.findFirst());

  if (!user) {
    console.error("No user found to assign as creator!");
    return;
  }

  const salesDept = await prisma.department.findFirst({ where: { name: "Sales" } });

  console.log(`Using user: ${user.firstName} ${user.lastName} (${user.email}), dept: ${salesDept?.name || "N/A"}`);

  for (const tpl of ENGLISH_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: tpl.name } });
    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          appendSignature: tpl.appendSignature,
          departmentId: salesDept?.id || user.departmentId,
        },
      });
      console.log(`Updated template: ${tpl.name}`);
    } else {
      await prisma.emailTemplate.create({
        data: {
          name: tpl.name,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          appendSignature: tpl.appendSignature,
          creatorId: user.id,
          departmentId: salesDept?.id || user.departmentId,
        },
      });
      console.log(`Created template: ${tpl.name}`);
    }
  }

  const total = await prisma.emailTemplate.count();
  console.log(`Done! Total templates in database: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
