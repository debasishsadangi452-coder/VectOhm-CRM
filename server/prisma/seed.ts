import { PrismaClient, RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "ChangeMe123!";

// NOTE on "SEO": the SEO module is department-scoped to "Digital Marketing"
// (see the nav/route guards), so the SEO manager is the Digital Marketing
// department manager. HR keeps its own manager (not part of the org roster the
// product owner specified, but required for HR directory-management features).
const SEED_USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  departmentName: string;
  managerEmail?: string;
  idlePromptMin?: number;
}> = [
  // --- Executive / Admin ---
  { email: "paresh@venusglobaltech.com", firstName: "Paresh", lastName: "Kumar", role: RoleName.ADMIN, departmentName: "Executive" },

  // Owner: the only reviewer of attendance adjustment requests.
  { email: "admin@venusglobaltech.com", firstName: "Owner", lastName: "", role: RoleName.ADMIN, departmentName: "Executive" },

  // --- Dev (manager: Jivan) + 3 employees ---
  { email: "jivan@venushiring.com", firstName: "Jivan", lastName: "Satapathy", role: RoleName.ADMIN, departmentName: "Dev" },
  { email: "pratyush@venusglobaltech.com", firstName: "Pratyush", lastName: "Nayak", role: RoleName.EMPLOYEE, departmentName: "Dev", managerEmail: "jivan@venushiring.com" },

  // --- Sales (manager: Jon) + 5 employees (3 named + 2 more) ---
  { email: "jon@venushiring.com", firstName: "Jon", lastName: "Carter", role: RoleName.MANAGER, departmentName: "Sales" },
  { email: "sourav@venushiring.com", firstName: "Sourav", lastName: "Sahoo", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com", idlePromptMin: 20 },
  // Surnames not supplied at onboarding -- Admin/HR can fill them in from the
  // HRMS Portal. Blank rather than invented: these names appear as deal
  // owners and in the activity log, so a wrong one is worse than a missing one.
  { email: "anil@venusglobaltech.com", firstName: "Anil", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "srikanth@venushiring.com", firstName: "Srikanth", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "avi@venushiring.com", firstName: "Avi", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "palavee@venusglobaltech.com", firstName: "Palavee", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },

  // --- Digital Marketing / SEO (manager: Shantanu) ---
  { email: "digital@venushiring.ca", firstName: "Shantanu", lastName: "Tyagi", role: RoleName.MANAGER, departmentName: "Digital Marketing" },

  // --- Recruitment (manager: Megan) + 10 employees ---
  { email: "megan@venushiring.ca", firstName: "Megan", lastName: "Foster", role: RoleName.ADMIN, departmentName: "Recruitment" },

  // --- HR (manager: Hana) ---
  { email: "vhr@venushiring.ca", firstName: "Hana", lastName: "Resources", role: RoleName.MANAGER, departmentName: "HR" },
  { email: "recruiter@venushiring.ca", firstName: "Vinitha", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "vhr@venushiring.ca" },
  { email: "recruiter117@venushiring.ca", firstName: "Archana", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "vhr@venushiring.ca" },
  { email: "techrecruiter@venushiring.com", firstName: "Sai", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "vhr@venushiring.ca" },
];

const SEED_DEPARTMENTS: Array<{ name: string; description: string; managerTitle: string; headEmail: string }> = [
  { name: "Executive", description: "Company leadership", managerTitle: "Manager", headEmail: "paresh@venusglobaltech.com" },
  { name: "Dev", description: "Product engineering", managerTitle: "Head", headEmail: "jivan@venushiring.com" },
  { name: "Sales", description: "Sales team", managerTitle: "Manager", headEmail: "jon@venushiring.com" },
  { name: "Digital Marketing", description: "Digital marketing & SEO team", managerTitle: "Manager", headEmail: "digital@venushiring.ca" },
  { name: "Recruitment", description: "Recruitment team", managerTitle: "Manager", headEmail: "megan@venushiring.ca" },
  { name: "HR", description: "Human resources", managerTitle: "Manager", headEmail: "vhr@venushiring.ca" },
];

async function main() {
  // Full reset -- clear all data (children before parents for FK safety) so
  // the roster below is the deterministic state after seeding.
  console.log("Cleaning existing database records...");
  await prisma.callEvent.deleteMany().catch(() => {});
  await prisma.call.deleteMany().catch(() => {});
  await prisma.callCampaignLead.deleteMany().catch(() => {});
  await prisma.callCampaign.deleteMany().catch(() => {});
  await prisma.phoneNumber.deleteMany().catch(() => {});
  await prisma.aiTokenUsage.deleteMany().catch(() => {});
  await prisma.notification.deleteMany().catch(() => {});
  await prisma.screenCapture.deleteMany().catch(() => {});
  await prisma.screenRecording.deleteMany().catch(() => {});
  await prisma.loginPhoto.deleteMany().catch(() => {});
  await prisma.loginEvent.deleteMany().catch(() => {});
  await prisma.activityPing.deleteMany().catch(() => {});
  await prisma.idleEvent.deleteMany().catch(() => {});
  await prisma.workBreak.deleteMany().catch(() => {});
  await prisma.workSession.deleteMany().catch(() => {});
  await prisma.signOutRequest.deleteMany().catch(() => {});
  await prisma.lateStartRequest.deleteMany().catch(() => {});
  await prisma.attendanceAdjustmentRequest.deleteMany().catch(() => {});
  await prisma.leaveRequest.deleteMany().catch(() => {});
  await prisma.timeLog.deleteMany().catch(() => {});
  await prisma.bugComment.deleteMany().catch(() => {});
  await prisma.bugActivityLog.deleteMany().catch(() => {});
  await prisma.bug.deleteMany().catch(() => {});
  await prisma.taskMessage.deleteMany().catch(() => {});
  await prisma.taskUpdate.deleteMany().catch(() => {});
  await prisma.taskActivityLog.deleteMany().catch(() => {});
  await prisma.taskAssignee.deleteMany().catch(() => {});
  await prisma.taskList.deleteMany().catch(() => {});
  await prisma.userEmailConnection.deleteMany().catch(() => {});
  await prisma.userLinkedInConnection.deleteMany().catch(() => {});
  await prisma.bulkEmailRecipient.deleteMany().catch(() => {});
  await prisma.bulkEmailCampaign.deleteMany().catch(() => {});
  await prisma.sequenceSend.deleteMany().catch(() => {});
  await prisma.sequenceEnrollment.deleteMany().catch(() => {});
  await prisma.sequenceStep.deleteMany().catch(() => {});
  await prisma.sequence.deleteMany().catch(() => {});
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatChannel.deleteMany();
  await prisma.kBArticle.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.gitCommit.deleteMany();
  await prisma.seoContentBrief.deleteMany();
  await prisma.seoBacklink.deleteMany();
  await prisma.seoCompetitor.deleteMany();
  await prisma.seoAudit.deleteMany();
  await prisma.seoKeyword.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.release.deleteMany();
  await prisma.project.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.githubConnection.deleteMany();

  console.log("Seeding system roles...");
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("Seeding users...");
  const userIdByEmail = new Map<string, string>();
  for (const user of SEED_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: roleIdByName.get(user.role)!,
        isActive: true,
        passwordHash,
        idlePromptMin: (user as { idlePromptMin?: number }).idlePromptMin ?? null,
      },
      create: {
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: roleIdByName.get(user.role)!,
        idlePromptMin: (user as { idlePromptMin?: number }).idlePromptMin ?? null,
      },
    });
    userIdByEmail.set(user.email, record.id);
  }

  // Prune any users that are no longer part of the roster (e.g. accounts from
  // an earlier seed). Safe because all data referencing users was cleared above.
  const seedEmails = SEED_USERS.map((u) => u.email);
  const pruned = await prisma.user.deleteMany({ where: { email: { notIn: seedEmails } } });
  if (pruned.count > 0) {
    console.log(`Pruned ${pruned.count} user(s) no longer in the roster.`);
  }

  // Handle legacy department name migration if an old DB exists.
  const legacyEngineering = await prisma.department.findUnique({ where: { name: "Engineering" } });
  if (legacyEngineering) {
    await prisma.department.update({ where: { id: legacyEngineering.id }, data: { name: "Dev" } });
  }

  console.log("Seeding departments...");
  const departmentIdByName = new Map<string, string>();
  for (const dept of SEED_DEPARTMENTS) {
    const headId = userIdByEmail.get(dept.headEmail);
    const record = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description, managerTitle: dept.managerTitle, headId },
      create: { name: dept.name, description: dept.description, managerTitle: dept.managerTitle, headId },
    });
    departmentIdByName.set(dept.name, record.id);
  }

  // Set user department + manager relations.
  for (const user of SEED_USERS) {
    await prisma.user.update({
      where: { email: user.email },
      data: {
        departmentId: departmentIdByName.get(user.departmentName),
        managerId: user.managerEmail ? userIdByEmail.get(user.managerEmail) : null,
      },
    });
  }

  console.log("Seeding default general chat channel...");
  await prisma.chatChannel.upsert({
    where: { id: "default-channel-general" },
    create: {
      id: "default-channel-general",
      name: "general",
      description: "Company-wide announcements and chat",
      isDM: false,
    },
    update: {},
  });

  console.log("Seeding recruitment mission control data...");
  const devDeptId = departmentIdByName.get("Dev");
  const recruitmentDeptId = departmentIdByName.get("Recruitment");
  const adminUserId = userIdByEmail.get("admin@crm.com") || Array.from(userIdByEmail.values())[0];

  const jobPostingData = [
    {
      jobCode: "REQ-2026-042",
      title: "Senior Full Stack AI Engineer",
      description: "Build LLM RAG pipelines, NestJS backend APIs, and React frontend dashboards.",
      location: "San Francisco, CA (Hybrid)",
      employmentType: "FULL_TIME" as const,
      status: "OPEN" as const,
      targetHeadcount: 5,
      filledHeadcount: 2,
      priority: "CRITICAL",
      currency: "USD",
      budgetMin: 140000,
      budgetMax: 180000,
      skillsRequired: ["TypeScript", "NestJS", "React", "Prisma", "Python", "Vector DB"],
      minExperienceYears: 5.0,
      departmentId: recruitmentDeptId,
      hiringDepartmentId: devDeptId,
      ownerId: adminUserId,
    },
    {
      jobCode: "REQ-2026-043",
      title: "Lead Cloud Infrastructure Architect",
      description: "Manage AWS EKS Kubernetes clusters, Terraform automation, and CI/CD pipelines.",
      location: "Austin, TX (Remote)",
      employmentType: "FULL_TIME" as const,
      status: "OPEN" as const,
      targetHeadcount: 3,
      filledHeadcount: 1,
      priority: "HIGH",
      currency: "USD",
      budgetMin: 160000,
      budgetMax: 200000,
      skillsRequired: ["AWS", "Kubernetes", "Terraform", "Docker", "Prometheus"],
      minExperienceYears: 8.0,
      departmentId: recruitmentDeptId,
      hiringDepartmentId: devDeptId,
      ownerId: adminUserId,
    },
  ];

  for (const job of jobPostingData) {
    const existingJob = await prisma.jobPosting.findFirst({ where: { jobCode: job.jobCode } });
    const jobRecord = existingJob
      ? await prisma.jobPosting.update({ where: { id: existingJob.id }, data: job })
      : await prisma.jobPosting.create({ data: job });

    // Demo syndication state: as if this posting already went through the
    // job-board syndication pipeline (see server/src/modules/job-board-syndication).
    const boardListingData = [
      { board: "LINKEDIN" as const, status: "POSTED" as const, simulated: true, externalUrl: `https://www.linkedin.com/jobs/view/stub-${jobRecord.id}` },
      { board: "NAUKRI" as const, status: "POSTED" as const, simulated: true, externalUrl: `https://www.naukri.com/job-listings/stub-${jobRecord.id}` },
      { board: "GLASSDOOR" as const, status: "POSTED" as const, simulated: true, externalUrl: `https://www.glassdoor.com/job-listing/stub-${jobRecord.id}` },
      { board: "INDEED" as const, status: "POSTED" as const, simulated: false, externalUrl: "/job-board-feeds/indeed.xml" },
    ];
    for (const listing of boardListingData) {
      await prisma.jobBoardListing.upsert({
        where: { jobPostingId_board: { jobPostingId: jobRecord.id, board: listing.board } },
        update: {},
        create: { jobPostingId: jobRecord.id, postedAt: new Date(), ...listing },
      });
    }

    // Seed candidate pipeline across all 11 stages
    const candidateData = [
      {
        candidateCode: "CAN-8801",
        firstName: "Alex",
        lastName: "Chen",
        email: "alex.chen@example.com",
        phone: "+1 (555) 234-5678",
        currentCompany: "Stripe",
        currentTitle: "Senior Staff Engineer",
        totalExperienceYears: 6.5,
        currentSalary: 155000,
        expectedSalary: 175000,
        noticePeriodDays: 15,
        location: "San Francisco, CA",
        skills: ["TypeScript", "NestJS", "React", "PostgreSQL"],
        source: "LinkedIn",
        jobBoardUrl: "https://www.linkedin.com/in/alexchen-dev",
        stage: "SHORTLISTED" as const,
        aiMatchScore: 94.5,
        fitBadge: "PLATINUM_FIT" as const,
        aiSummary: "Top tier candidate with 6+ years experience in Node.js, NestJS, and vector databases. Strong architectural alignment.",
        jobPostingId: jobRecord.id,
        ownerId: adminUserId,
        departmentId: recruitmentDeptId,
      },
      {
        candidateCode: "CAN-8802",
        firstName: "Sarah",
        lastName: "Vance",
        email: "sarah.vance@example.com",
        phone: "+1 (555) 876-5432",
        currentCompany: "Datadog",
        currentTitle: "Full Stack Engineer",
        totalExperienceYears: 5.0,
        currentSalary: 140000,
        expectedSalary: 160000,
        noticePeriodDays: 30,
        location: "San Jose, CA",
        skills: ["React", "TypeScript", "Python", "GraphQL"],
        source: "Naukri",
        jobBoardUrl: "https://www.naukri.com/profile/sarahvance",
        stage: "INTERVIEW_SCHEDULED" as const,
        aiMatchScore: 88.0,
        fitBadge: "GOLD_FIT" as const,
        aiSummary: "Solid full stack experience with frontend focus. Good culture fit and reasonable notice period.",
        jobPostingId: jobRecord.id,
        ownerId: adminUserId,
        departmentId: recruitmentDeptId,
      },
      {
        candidateCode: "CAN-8803",
        firstName: "David",
        lastName: "Miller",
        email: "david.miller@example.com",
        phone: "+1 (555) 345-6789",
        currentCompany: "Snowflake",
        currentTitle: "Lead AI Engineer",
        totalExperienceYears: 7.0,
        currentSalary: 165000,
        expectedSalary: 185000,
        noticePeriodDays: 30,
        location: "Austin, TX",
        skills: ["Python", "PyTorch", "NestJS", "Docker"],
        source: "Indeed",
        jobBoardUrl: "https://www.indeed.com/r/davidmiller",
        stage: "OFFER_RELEASED" as const,
        aiMatchScore: 91.0,
        fitBadge: "PLATINUM_FIT" as const,
        aiSummary: "Exceptional machine learning background. Interview scorecards rated him Strong Hire across technical rounds.",
        jobPostingId: jobRecord.id,
        ownerId: adminUserId,
        departmentId: recruitmentDeptId,
      },
      {
        candidateCode: "CAN-8804",
        firstName: "Emily",
        lastName: "Zhang",
        email: "emily.zhang@example.com",
        phone: "+1 (555) 987-6543",
        currentCompany: "Meta",
        currentTitle: "Senior Software Engineer",
        totalExperienceYears: 5.5,
        currentSalary: 150000,
        expectedSalary: 170000,
        noticePeriodDays: 14,
        location: "Seattle, WA",
        skills: ["React", "TypeScript", "Next.js", "TailwindCSS"],
        source: "LinkedIn",
        jobBoardUrl: "https://www.linkedin.com/in/emilyzhang",
        stage: "OFFER_ACCEPTED" as const,
        aiMatchScore: 93.0,
        fitBadge: "PLATINUM_FIT" as const,
        aiSummary: "Accepted official offer OFF-2026-104. Confirmed joining date set for next Monday.",
        jobPostingId: jobRecord.id,
        ownerId: adminUserId,
        departmentId: recruitmentDeptId,
      },
      {
        candidateCode: "CAN-8805",
        firstName: "Marcus",
        lastName: "Brody",
        email: "marcus.brody@example.com",
        phone: "+1 (555) 456-7890",
        currentCompany: "Uber",
        currentTitle: "Software Engineer II",
        totalExperienceYears: 4.0,
        currentSalary: 130000,
        expectedSalary: 150000,
        noticePeriodDays: 45,
        location: "San Francisco, CA",
        skills: ["Go", "Node.js", "Redis", "Kafka"],
        source: "Glassdoor",
        jobBoardUrl: "https://www.glassdoor.com/profile/marcusbrody",
        stage: "SCREENING" as const,
        aiMatchScore: 78.5,
        fitBadge: "SILVER_FIT" as const,
        aiSummary: "Good backend candidate, but notice period is 45 days. Screening scheduled with hiring manager.",
        jobPostingId: jobRecord.id,
        ownerId: adminUserId,
        departmentId: recruitmentDeptId,
      },
    ];

    for (const cand of candidateData) {
      const existingCand = await prisma.candidate.findFirst({ where: { email: cand.email } });
      const candidateObj = existingCand || (await prisma.candidate.create({ data: cand }));

      // Seed Candidate Risk Profiles
      if (cand.firstName === "Alex") {
        await prisma.candidateRiskProfile.upsert({
          where: { candidateId: candidateObj.id },
          create: {
            candidateId: candidateObj.id,
            offerDeclineRisk: 22.0,
            ghostingRisk: 12.0,
            counterOfferRisk: 68.0,
            joiningFailureRisk: 15.0,
            primaryRiskFactor: "Stripe current employer likely to offer retention counter-offer upon resignation.",
            recommendedMitigation: "Offer $15k signing bonus & arrange 1-on-1 with Engineering Director.",
          },
          update: {},
        });
      } else if (cand.firstName === "Emily") {
        await prisma.candidateRiskProfile.upsert({
          where: { candidateId: candidateObj.id },
          create: {
            candidateId: candidateObj.id,
            offerDeclineRisk: 65.0,
            ghostingRisk: 18.0,
            counterOfferRisk: 45.0,
            joiningFailureRisk: 10.0,
            primaryRiskFactor: "Offer OFF-2026-104 expires in 24 hours. Candidate reviewing competing Meta retention package.",
            recommendedMitigation: "Schedule urgent check-in call with Megan Foster & confirm start date readiness.",
          },
          update: {},
        });
      } else if (cand.firstName === "David") {
        await prisma.candidateRiskProfile.upsert({
          where: { candidateId: candidateObj.id },
          create: {
            candidateId: candidateObj.id,
            offerDeclineRisk: 42.0,
            ghostingRisk: 35.0,
            counterOfferRisk: 55.0,
            joiningFailureRisk: 20.0,
            primaryRiskFactor: "Idle in Shortlisted for 4 days without technical interview scheduling.",
            recommendedMitigation: "Trigger high-priority recruiter interview request.",
          },
          update: {},
        });
      }
    }
  }

  console.log("Seeding ROS Talent Pools...");
  const devDept = departmentIdByName.get("Dev");
  const pools = [
    { name: "Senior Full Stack Engineers", description: "Top tier React, Node.js, NestJS candidates with 5+ years exp" },
    { name: "AI/ML & Vector DB Specialists", description: "Python, PyTorch, RAG Architecture, Vector Database developers" },
    { name: "Cloud & Kubernetes Architects", description: "AWS EKS, Terraform, Infrastructure, DevOps Specialists" },
  ];

  for (const pool of pools) {
    await prisma.talentPool.upsert({
      where: { name: pool.name },
      create: { name: pool.name, description: pool.description, departmentId: devDept },
      update: {},
    });
  }

  console.log("Seeding Recruiter Action Queue...");
  const meganUserId = userIdByEmail.get("megan@venushiring.ca") || adminUserId;
  const alexCand = await prisma.candidate.findFirst({ where: { firstName: "Alex" } });
  const emilyCand = await prisma.candidate.findFirst({ where: { firstName: "Emily" } });

  if (alexCand) {
    await prisma.recruiterTaskQueue.create({
      data: {
        recruiterId: meganUserId,
        candidateId: alexCand.id,
        actionType: "SCORECARD_SLA_ALERT",
        priorityScore: 94.5,
        dueDate: new Date(Date.now() + 86400000),
        isCompleted: false,
      },
    });
  }
  if (emilyCand) {
    await prisma.recruiterTaskQueue.create({
      data: {
        recruiterId: meganUserId,
        candidateId: emilyCand.id,
        actionType: "ESCALATE_OFFER",
        priorityScore: 91.0,
        dueDate: new Date(Date.now() + 43200000),
        isCompleted: false,
      },
    });
  }

  console.log("Seeding Global Recruitment Health Metric...");
  await prisma.recruitmentHealthMetric.create({
    data: {
      globalHealthScore: 84.0,
      pipelineFreshnessScore: 88.0,
      offerAcceptanceScore: 90.0,
      joiningSuccessScore: 85.0,
      interviewSlaScore: 78.0,
      hiringVelocityScore: 80.0,
    },
  });

  // Seed Sales & CloudTalk Telephony records
  try {
    const { seedTelephonyAndSales } = await import("./seed-telephony");
    await seedTelephonyAndSales();
  } catch (err) {
    console.error("Telephony seed warning:", err);
  }

  // Seed English Business Email Templates
  try {
    console.log("Seeding English Business Email Templates...");
    const salesManager = await prisma.user.findFirst({ where: { email: "jon@venushiring.com" } }) || (await prisma.user.findFirst());
    const salesDepartment = await prisma.department.findFirst({ where: { name: "Sales" } });

    if (salesManager) {
      const englishTemplates = [
        {
          name: "01 - Executive Cold Introduction",
          subject: "Quick question regarding {{companyName}} growth & tech initiatives, {{firstName}}",
          bodyHtml: `Hi {{firstName}},\n\nI noticed your leadership at {{companyName}} and wanted to reach out directly.\n\nWe help fast-growing organizations accelerate engineering execution, automate CRM pipelines, and scale specialized technical teams. Leaders in your role often face bottlenecks balancing team capacity against aggressive delivery milestones.\n\nAre you open to a brief 10-minute introductory conversation this week to explore if we can help {{companyName}} hit its growth targets?\n\nBest regards,`,
          appendSignature: true,
        },
        {
          name: "02 - Active Role & Talent Support",
          subject: "Regarding your open hiring positions at {{companyName}}",
          bodyHtml: `Hi {{firstName}},\n\nI saw that {{companyName}} is actively recruiting for key roles right now. Congratulations on the company's momentum!\n\nSourcing, screening, and closing pre-vetted senior technical talent quickly can consume significant executive and engineering bandwidth. We maintain specialized talent pipelines that reduce time-to-hire by over 50% for high-growth tech teams.\n\nWould you be open to reviewing a couple of vetted candidate profiles matched to {{companyName}}'s stack this week?\n\nBest regards,`,
          appendSignature: true,
        },
        {
          name: "03 - Company Growth & Scaling Solutions",
          subject: "Congrats on {{companyName}}'s recent expansion, {{firstName}}",
          bodyHtml: `Hi {{firstName}},\n\nI came across the recent news regarding {{companyName}}'s rapid expansion. Exciting milestones ahead!\n\nAs companies scale headcount and client operations, maintaining execution speed while maintaining pipeline visibility becomes essential. We partner with leaders to provide modern workforce management and enterprise sales automation tailored for scaling organizations.\n\nDo you have 10 minutes on Tuesday or Thursday for a quick introductory chat?\n\nBest regards,`,
          appendSignature: true,
        },
        {
          name: "04 - Follow-Up & Value Delivery",
          subject: "Following up on my note, {{firstName}}",
          bodyHtml: `Hi {{firstName}},\n\nFollowing up on my previous message. I understand your schedule at {{companyName}} is quite demanding.\n\nI wanted to share how we recently helped a similar technology team reduce candidate screening time by 40% while doubling their qualified pipeline in under 30 days.\n\nIf scaling your engineering or sales capacity is a priority this quarter, let me know if a short sync makes sense. If not, no worries at all!\n\nBest regards,`,
          appendSignature: true,
        },
        {
          name: "05 - Partnership & Product Demo",
          subject: "Exploring synergy between {{companyName}} and Venus",
          bodyHtml: `Hi {{firstName}},\n\nI am reaching out from Venus. We develop next-generation sales intelligence, talent automation, and CRM platforms designed specifically for forward-thinking leadership teams.\n\nGiven your role as {{title}} at {{companyName}}, I thought you might appreciate a quick walkthrough of how our platform unifies candidate tracking, sales pipelines, and live hiring intent signals.\n\nWould you be open to a 15-minute product overview next week?\n\nLooking forward to connecting,`,
          appendSignature: true,
        },
        {
          name: "06 - Final Check-In / Permission to Close",
          subject: "Permission to close your file at {{companyName}}?",
          bodyHtml: `Hi {{firstName}},\n\nI haven't heard back from you, which usually means one of two things: either this isn't a priority for {{companyName}} right now, or you've been extraordinarily busy.\n\nIf the timing isn't right, please let me know and I will gladly close out my notes so I don't crowd your inbox.\n\nWhenever you're ready to explore ways to streamline your outreach and recruitment operations, feel free to reach out.\n\nWishing you and {{companyName}} continued success!\n\nBest regards,`,
          appendSignature: true,
        },
      ];

      for (const tpl of englishTemplates) {
        const existing = await prisma.emailTemplate.findFirst({ where: { name: tpl.name } });
        if (existing) {
          await prisma.emailTemplate.update({
            where: { id: existing.id },
            data: {
              subject: tpl.subject,
              bodyHtml: tpl.bodyHtml,
              appendSignature: tpl.appendSignature,
              departmentId: salesDepartment?.id || salesManager.departmentId,
            },
          });
        } else {
          await prisma.emailTemplate.create({
            data: {
              name: tpl.name,
              subject: tpl.subject,
              bodyHtml: tpl.bodyHtml,
              appendSignature: tpl.appendSignature,
              creatorId: salesManager.id,
              departmentId: salesDepartment?.id || salesManager.departmentId,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error("Email templates seed warning:", err);
  }

  // Seed Dev Projects, Tasks & Bugs
  try {
    console.log("Seeding Dev Projects, Tasks & Bugs...");
    const jivanUser = await prisma.user.findFirst({ where: { email: "jivan@venushiring.com" } });
    const pratyushUser = await prisma.user.findFirst({ where: { email: "pratyush@venusglobaltech.com" } });
    const devDepartment = await prisma.department.findFirst({ where: { name: "Dev" } });

    if (devDepartment && jivanUser) {
      let devProject = await prisma.project.findFirst({ where: { name: "Venus Web Platform" } });
      if (!devProject) {
        devProject = await prisma.project.create({
          data: {
            name: "Venus Web Platform",
            description: "Core web applications and portal redesign",
            status: "ACTIVE",
            departmentId: devDepartment.id,
            ownerId: jivanUser.id,
          },
        });
      }

      const devUserIds = [jivanUser?.id, pratyushUser?.id].filter(Boolean) as string[];
      await prisma.project.update({
        where: { id: devProject.id },
        data: {
          members: {
            set: devUserIds.map((id) => ({ id })),
          },
        },
      });

      const existingTask = await prisma.task.findFirst({ where: { projectId: devProject.id } });
      if (!existingTask) {
        const t1 = await prisma.task.create({
          data: {
            taskNumber: 101,
            title: "Authentication & Role-Based Access Control Audit",
            description: "Perform comprehensive security audit on JWT token validation, refresh rotations, and multi-role permission guards.",
            status: "IN_PROGRESS",
            priority: "HIGH",
            departmentId: devDepartment.id,
            projectId: devProject.id,
            creatorId: jivanUser.id,
            assigneeId: pratyushUser?.id || jivanUser.id,
            testerId: pratyushUser?.id,
            assignees: {
              create: [
                { userId: pratyushUser?.id || jivanUser.id },
                { userId: jivanUser.id },
              ],
            },
            subtasks: {
              create: [
                {
                  taskNumber: 1011,
                  title: "Implement Token Revocation Whitelist in Redis/DB",
                  creatorId: jivanUser.id,
                  assigneeId: pratyushUser?.id,
                  departmentId: devDepartment.id,
                  status: "DONE",
                },
                {
                  taskNumber: 1012,
                  title: "Configure Route Guards for Department Manager Override",
                  creatorId: jivanUser.id,
                  assigneeId: pratyushUser?.id,
                  departmentId: devDepartment.id,
                  status: "IN_PROGRESS",
                },
              ],
            },
          },
        });

        await prisma.bug.create({
          data: {
            bugNumber: 1001,
            title: "Token expiry edge condition causes intermittent 401 on background sync",
            description: "When token expires exactly during long polling, user is booted to login instead of silent refresh.",
            severity: "HIGH",
            priority: "HIGH",
            status: "IN_PROGRESS",
            taskId: t1.id,
            reporterId: jivanUser.id,
            assigneeId: pratyushUser?.id || jivanUser.id,
          },
        });

        await prisma.task.create({
          data: {
            taskNumber: 102,
            title: "Optimize CRM Dashboard Realtime Telemetry & Charts",
            description: "Refactor analytics query aggregations and implement cached dashboard widgets with smooth micro-animations.",
            status: "IN_PROGRESS",
            priority: "URGENT",
            departmentId: devDepartment.id,
            projectId: devProject.id,
            creatorId: jivanUser.id,
            assigneeId: jivanUser.id,
            testerId: pratyushUser?.id,
            assignees: {
              create: [{ userId: jivanUser.id }],
            },
          },
        });

        const t3 = await prisma.task.create({
          data: {
            taskNumber: 103,
            title: "Zoho Projects Engine Task Workflow & Bug Fix QA Review",
            description: "Build developer fix submission modal with root cause analysis and manager approval workflow.",
            status: "READY_FOR_TESTING",
            priority: "HIGH",
            departmentId: devDepartment.id,
            projectId: devProject.id,
            creatorId: jivanUser.id,
            assigneeId: pratyushUser?.id || jivanUser.id,
            testerId: jivanUser.id,
            assignees: {
              create: [
                { userId: pratyushUser?.id || jivanUser.id },
                { userId: jivanUser.id },
              ],
            },
          },
        });

        await prisma.bug.create({
          data: {
            bugNumber: 1004,
            title: "Fix submission modal requires root cause analysis input",
            description: "Root cause analysis field was not saving properly on review submission.",
            severity: "HIGH",
            priority: "HIGH",
            status: "PENDING_REVIEW",
            taskId: t3.id,
            reporterId: jivanUser.id,
            assigneeId: pratyushUser?.id || jivanUser.id,
            fixSummary: "Refactored input payload to correctly capture rootCause and testingNotes strings.",
            rootCause: "DTO field was stripped by validation pipe.",
            testingNotes: "Tested and verified in network inspector.",
            prLink: "https://github.com/debasishsadangi452-coder/gentle-crm-glide/pull/42",
            fixSubmittedAt: new Date(),
            fixSubmittedById: pratyushUser?.id || jivanUser.id,
          },
        });
        // Create and link Active Sprint
        let activeSprint = await prisma.sprint.findFirst({
          where: { departmentId: devDepartment.id, status: "ACTIVE" },
        });
        if (!activeSprint) {
          activeSprint = await prisma.sprint.create({
            data: {
              name: "Sprint 1: Core Web & QA Platform",
              startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
              status: "ACTIVE",
              departmentId: devDepartment.id,
              projectId: devProject.id,
            },
          });
        }

        await prisma.task.updateMany({
          where: { id: { in: [t1.id, t3.id] } },
          data: { sprintId: activeSprint.id, storyPoints: 5 },
        });

        // Create sample Pull Request
        if (pratyushUser) {
          await prisma.gitCommit.upsert({
            where: { hash: "pr-42-auth-audit" },
            update: {},
            create: {
              hash: "pr-42-auth-audit",
              message: "feat(auth): implement JWT token blacklist and role guards",
              authorId: pratyushUser.id,
              branch: "feat/jwt-blacklist",
              isPR: true,
              prNumber: 42,
              prStatus: "OPEN",
              buildStatus: "SUCCESS",
              taskId: t1.id,
            },
          });
        }
      }
    }
  } catch (err) {
    console.log("Seeding Digital Marketing workspace data...");
    const digitalMarketingDeptId = departmentIdByName.get("Digital Marketing");
    const shantanuUser = await prisma.user.findUnique({ where: { email: "digital@venushiring.ca" } });

    if (digitalMarketingDeptId && shantanuUser) {
      // 1. Digital Marketing Project
      const seoProject = await prisma.project.upsert({
        where: { id: "proj-digital-marketing-seo-growth" },
        update: {},
        create: {
          id: "proj-digital-marketing-seo-growth",
          name: "Venus Hiring Organic Growth & SEO 2026",
          description: "Search engine optimization, keyword acquisition, and content briefs for Venus Hiring",
          status: "ACTIVE",
          ownerId: shantanuUser.id,
          departmentId: digitalMarketingDeptId,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        },
      });

      // 2. SEO Keywords
      const keywordsToSeed = [
        { term: "ai recruitment platform", searchIntent: "COMMERCIAL", volume: 14500, difficulty: 48, currentRank: 4, targetRank: 1, url: "https://venushiring.ca/solutions/ai-recruitment" },
        { term: "b2b hiring signals software", searchIntent: "TRANSACTIONAL", volume: 6200, difficulty: 35, currentRank: 2, targetRank: 1, url: "https://venushiring.ca/hiring-signals" },
        { term: "executive technical staffing canada", searchIntent: "COMMERCIAL", volume: 8800, difficulty: 42, currentRank: 5, targetRank: 2, url: "https://venushiring.ca/staffing" },
        { term: "it contract talent solutions", searchIntent: "INFORMATIONAL", volume: 12000, difficulty: 55, currentRank: 8, targetRank: 3, url: "https://venushiring.ca/it-talent" },
        { term: "real-time company hiring velocity", searchIntent: "INFORMATIONAL", volume: 3400, difficulty: 28, currentRank: 1, targetRank: 1, url: "https://venushiring.ca/signals" },
      ];

      for (const kw of keywordsToSeed) {
        const existingKw = await prisma.seoKeyword.findFirst({
          where: { term: kw.term, departmentId: digitalMarketingDeptId },
        });
        if (!existingKw) {
          await prisma.seoKeyword.create({
            data: {
              ...kw,
              departmentId: digitalMarketingDeptId,
              projectId: seoProject.id,
            },
          });
        }
      }

      // 3. Website Audit Snapshot
      const existingAudit = await prisma.seoAudit.findFirst({
        where: { departmentId: digitalMarketingDeptId },
      });
      if (!existingAudit) {
        await prisma.seoAudit.create({
          data: {
            url: "https://venushiring.ca",
            score: 92,
            issues: JSON.stringify([
              { severity: "INFO", message: "Core Web Vitals LCP 1.4s (Good)" },
              { severity: "INFO", message: "Mobile responsive viewport verified" },
              { severity: "WARNING", message: "Missing open-graph images on 2 careers pages" },
              { severity: "PASS", message: "Canonical tags and HTTPS certificates active" },
            ]),
            departmentId: digitalMarketingDeptId,
            runAt: new Date(),
          },
        });
      }

      // 4. Verified Backlinks
      const backlinksToSeed = [
        { sourceUrl: "https://techcrunch.com/features/recruitment-tech-canada", targetUrl: "https://venushiring.ca", anchorText: "Venus Hiring AI Platform", domainAuthority: 92, spamScore: 1, status: "VERIFIED" as const },
        { sourceUrl: "https://forbes.com/innovation/b2b-growth-signals-2026", targetUrl: "https://venushiring.ca/hiring-signals", anchorText: "hiring signals intelligence", domainAuthority: 94, spamScore: 0, status: "VERIFIED" as const },
        { sourceUrl: "https://clutch.co/ca/staffing/top-firms", targetUrl: "https://venushiring.ca", anchorText: "Top Technical Staffing Partner", domainAuthority: 87, spamScore: 2, status: "VERIFIED" as const },
      ];

      for (const bl of backlinksToSeed) {
        const existingBl = await prisma.seoBacklink.findFirst({
          where: { sourceUrl: bl.sourceUrl, departmentId: digitalMarketingDeptId },
        });
        if (!existingBl) {
          await prisma.seoBacklink.create({
            data: {
              ...bl,
              loggedById: shantanuUser.id,
              verifiedById: shantanuUser.id,
              projectId: seoProject.id,
              departmentId: digitalMarketingDeptId,
            },
          });
        }
      }

      // 5. SEO Content Briefs
      const briefsToSeed = [
        {
          title: "The Executive Guide to AI-Powered Hiring Signals in 2026",
          targetKeyword: "b2b hiring signals software",
          secondaryKeywords: ["ai recruitment platform", "intent hiring signals"],
          targetWordCount: 2200,
          status: "APPROVED" as const,
          slaStatus: "ON_TRACK" as const,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          assigneeId: shantanuUser.id,
          reviewerId: shantanuUser.id,
          departmentId: digitalMarketingDeptId,
          projectId: seoProject.id,
          content: "# The Executive Guide to AI-Powered Hiring Signals in 2026\n\nModern sales and recruitment teams are shifting from reactive cold outreach to intent-driven hiring signal intelligence...",
        },
        {
          title: "Technical Staffing Benchmarks for Canadian Enterprises",
          targetKeyword: "executive technical staffing canada",
          secondaryKeywords: ["it contract talent solutions"],
          targetWordCount: 1800,
          status: "IN_PROGRESS" as const,
          slaStatus: "ON_TRACK" as const,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          assigneeId: shantanuUser.id,
          reviewerId: shantanuUser.id,
          departmentId: digitalMarketingDeptId,
          projectId: seoProject.id,
          content: "# Technical Staffing Benchmarks for Canadian Enterprises\n\nHow enterprise tech leaders in Toronto, Vancouver, and Montreal scale contract engineering teams...",
        },
      ];

      for (const brief of briefsToSeed) {
        const existingBrief = await prisma.seoContentBrief.findFirst({
          where: { title: brief.title, departmentId: digitalMarketingDeptId },
        });
        if (!existingBrief) {
          await prisma.seoContentBrief.create({
            data: brief,
          });
        }
      }

      // 6. Tracked Competitors
      const competitorsToSeed = [
        { domain: "hired.com", da: 78, traffic: 450000 },
        { domain: "turing.com", da: 82, traffic: 680000 },
        { domain: "roberthalf.ca", da: 85, traffic: 320000 },
      ];

      for (const comp of competitorsToSeed) {
        const existingComp = await prisma.seoCompetitor.findFirst({
          where: { domain: comp.domain, departmentId: digitalMarketingDeptId },
        });
        if (!existingComp) {
          await prisma.seoCompetitor.create({
            data: {
              ...comp,
              departmentId: digitalMarketingDeptId,
            },
          });
        }
      }
    }

  console.log("Seeding complete!");

  console.log("Seeded users (all password: " + SEED_PASSWORD + "):");
  for (const user of SEED_USERS) {
    console.log(
      `  ${user.departmentName.padEnd(18)} ${user.role.padEnd(8)} ${(user.firstName + " " + user.lastName).padEnd(20)} ${user.email}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
