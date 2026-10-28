// ---------------------------------------------------------------------------
// DESTRUCTIVE DEMO-DATA SCRIPT -- LOCAL/DEV DATABASES ONLY.
//
// This script unconditionally deletes every existing Offer, JobSubmission,
// JobNote, JobTask, JobActivity, and Interview row, then inserts fabricated
// placements attributed to real company names (Morgan Stanley, JPMorgan
// Chase, AWS, Scotiabank, Deloitte, TD Bank) purely for demo purposes. Never
// run this against a shared or production database -- it will destroy real
// recruitment pipeline data and replace it with fake records that look like
// real business relationships with those companies.
//
// Guarded behind an explicit env var so it can't be run by accident:
//   ALLOW_DESTRUCTIVE_SEED=yes-i-am-sure-this-is-not-shared node scripts/seed-lively-recruitment.js
// ---------------------------------------------------------------------------

const { PrismaClient, CandidateStage, InterviewType, InterviewStatus, OfferStatus } = require('@prisma/client');
const p = new PrismaClient();

const CONFIRM_TOKEN = 'yes-i-am-sure-this-is-not-shared';

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== CONFIRM_TOKEN) {
    console.error('\nREFUSING TO RUN: this script deletes real Offer/JobSubmission/JobNote/JobTask/');
    console.error('JobActivity/Interview data and replaces it with fabricated demo records under');
    console.error('real company names (Morgan Stanley, JPMorgan Chase, AWS, Scotiabank, Deloitte,');
    console.error('TD Bank). It must never touch a shared or production database.\n');
    console.error('If you are certain this is an isolated local/dev database, re-run as:');
    console.error(`  ALLOW_DESTRUCTIVE_SEED=${CONFIRM_TOKEN} node scripts/seed-lively-recruitment.js\n`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || '(not set)';
  const redactedUrl = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  console.log(`\nDESTRUCTIVE SEED CONFIRMED. Target database: ${redactedUrl}`);
  console.log('Proceeding in 5 seconds -- Ctrl+C now to abort if this is not the intended database...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('Seeding lively recruitment CRM data...');

  // 1. Fetch recruiters and departments
  const recruiters = await p.user.findMany({
    where: { department: { name: { contains: 'Recruit', mode: 'insensitive' } } },
    orderBy: { firstName: 'asc' },
  });
  console.log(`Found ${recruiters.length} recruiters.`);

  const recruitmentDept = await p.department.findFirst({
    where: { name: { contains: 'Recruit', mode: 'insensitive' } },
  });
  const devDept = await p.department.findFirst({
    where: { name: { contains: 'Dev', mode: 'insensitive' } },
  });

  const megan = recruiters.find(r => r.firstName === 'Megan') || recruiters[0];

  // 2. Ensure clients exist
  const clientNames = ['Morgan Stanley', 'Amazon Web Services', 'JPMorgan Chase', 'Scotiabank', 'Deloitte', 'TD Bank'];
  const clientMap = new Map();
  for (const name of clientNames) {
    let client = await p.client.findFirst({ where: { name } });
    if (!client) {
      client = await p.client.create({
        data: {
          name,
          contactNumber: '+1 (416) 555-0199',
          website: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
          industry: 'Financial & Cloud Technology',
          status: 'Active',
          category: 'Tier-1 Direct Client',
          businessUnit: 'Enterprise IT Staffing',
          displayOnJob: true,
          createdById: megan.id,
        },
      });
    }
    clientMap.set(name, client);
  }

  // 3. Ensure Job Postings with realistic codes and clients
  const jobsData = [
    { jobCode: 'REQ-2026-101', title: 'Senior Full Stack AI Engineer', client: 'Morgan Stanley', clientJobId: 'MS-ENG-9941', clientBillRate: '$95.00/hr', payRate: '$65.00/hr', location: 'New York, NY', priority: 'HIGH' },
    { jobCode: 'REQ-2026-102', title: 'Cloud Solutions Architect', client: 'Amazon Web Services', clientJobId: 'AWS-ARCH-2044', clientBillRate: '$110.00/hr', payRate: '$75.00/hr', location: 'Seattle, WA', priority: 'HIGH' },
    { jobCode: 'REQ-2026-103', title: 'Lead DevOps Platform Engineer', client: 'JPMorgan Chase', clientJobId: 'JPMC-DEVOPS-412', clientBillRate: '$105.00/hr', payRate: '$72.00/hr', location: 'Jersey City, NJ', priority: 'CRITICAL' },
    { jobCode: 'REQ-2026-104', title: 'Senior React / TypeScript Developer', client: 'Scotiabank', clientJobId: 'BNS-FE-3301', clientBillRate: '$85.00/hr', payRate: '$58.00/hr', location: 'Toronto, ON', priority: 'MEDIUM' },
    { jobCode: 'REQ-2026-105', title: 'Senior Data Engineer', client: 'Deloitte', clientJobId: 'DEL-DATA-5502', clientBillRate: '$90.00/hr', payRate: '$62.00/hr', location: 'Chicago, IL', priority: 'HIGH' },
    { jobCode: 'REQ-2026-106', title: 'Cybersecurity Analyst', client: 'TD Bank', clientJobId: 'TD-SEC-819', clientBillRate: '$80.00/hr', payRate: '$55.00/hr', location: 'Toronto, ON', priority: 'MEDIUM' },
  ];

  const jobs = [];
  for (const j of jobsData) {
    let job = await p.jobPosting.findFirst({ where: { jobCode: j.jobCode } });
    if (!job) {
      job = await p.jobPosting.create({
        data: {
          jobCode: j.jobCode,
          title: j.title,
          client: j.client,
          clientJobId: j.clientJobId,
          clientBillRate: j.clientBillRate,
          location: j.location,
          description: `Key hiring role for ${j.client}: ${j.title}. High priority enterprise contract staffing position.`,
          employmentType: 'CONTRACT',
          status: 'OPEN',
          priority: j.priority,
          targetHeadcount: 3,
          filledHeadcount: 1,
          departmentId: recruitmentDept?.id,
          hiringDepartmentId: devDept?.id,
          ownerId: megan.id,
          businessUnit: 'Enterprise Staffing',
        },
      });
    } else {
      job = await p.jobPosting.update({
        where: { id: job.id },
        data: { client: j.client, clientJobId: j.clientJobId, clientBillRate: j.clientBillRate, location: j.location },
      });
    }
    jobs.push(job);
  }

  // 4. Candidate pool with submissions, interviews, and hires per recruiter
  // Target distribution:
  // Total Submissions: 49, Client Submissions: 38, Interviews: 20, Placements/Offers: 11
  const recruiterPlan = [
    { name: 'Aditya Rao', subs: 5, clientSubs: 4, intvs: 2, hireStatus: 'JOINED', applicant: 'Siddharth Nair', job: jobs[0], bill: '$95.00/hr', pay: '$65.00/hr', date: '2026-08-15' },
    { name: 'Sneha Kapoor', subs: 4, clientSubs: 3, intvs: 2, hireStatus: 'JOINED', applicant: 'Pooja Verma', job: jobs[1], bill: '$110.00/hr', pay: '$75.00/hr', date: '2026-08-20' },
    { name: 'Rohit Jena', subs: 6, clientSubs: 5, intvs: 3, hireStatus: 'OFFER_ACCEPTED', applicant: 'Kavita Das', job: jobs[2], bill: '$105.00/hr', pay: '$72.00/hr', date: '2026-09-02' },
    { name: 'Ananya Iyer', subs: 5, clientSubs: 4, intvs: 2, hireStatus: 'JOINED', applicant: 'Rohan Sharma', job: jobs[3], bill: '$85.00/hr', pay: '$58.00/hr', date: '2026-08-28' },
    { name: 'Karan Malhotra', subs: 4, clientSubs: 3, intvs: 1, hireStatus: null, applicant: null, job: jobs[4] },
    { name: 'Meera Pillai', subs: 5, clientSubs: 4, intvs: 2, hireStatus: 'JOINED', applicant: 'Tanvi Joshi', job: jobs[4], bill: '$90.00/hr', pay: '$62.00/hr', date: '2026-08-10' },
    { name: 'Vikram Singh', subs: 4, clientSubs: 3, intvs: 2, hireStatus: 'JOINED', applicant: 'Aman Deep', job: jobs[5], bill: '$80.00/hr', pay: '$55.00/hr', date: '2026-08-18' },
    { name: 'Nisha Patel', subs: 4, clientSubs: 3, intvs: 1, hireStatus: null, applicant: null, job: jobs[0] },
    { name: 'Arjun Reddy', subs: 5, clientSubs: 4, intvs: 2, hireStatus: 'OFFER_ACCEPTED', applicant: 'Deepak Chowdary', job: jobs[1], bill: '$110.00/hr', pay: '$75.00/hr', date: '2026-09-05' },
    { name: 'Riya Sen', subs: 3, clientSubs: 2, intvs: 1, hireStatus: null, applicant: null, job: jobs[2] },
    { name: 'Megan Foster', subs: 4, clientSubs: 3, intvs: 2, hireStatus: 'JOINED', applicant: 'Elena Rostova', job: jobs[3], bill: '$85.00/hr', pay: '$58.00/hr', date: '2026-08-05' },
  ];

  // Extra confirmed candidates to reach 11 placements total (7 Joined + 4 Confirmed/Pending)
  const extraOffers = [
    { recruiterName: 'Rohit Jena', applicant: 'Nikhil Saxena', job: jobs[4], bill: '$90.00/hr', pay: '$62.00/hr', date: '2026-09-08', status: 'OFFER_RELEASED' },
    { recruiterName: 'Ananya Iyer', applicant: 'Preeti Deshmukh', job: jobs[5], bill: '$80.00/hr', pay: '$55.00/hr', date: '2026-09-12', status: 'OFFER_ACCEPTED' },
    { recruiterName: 'Meera Pillai', applicant: 'Gaurav Kulkarni', job: jobs[0], bill: '$95.00/hr', pay: '$65.00/hr', date: '2026-08-25', status: 'JOINED' },
  ];

  // Clear existing submissions, offers, notes, tasks, activities to prevent duplicate buildup
  console.log('Cleaning existing sample recruitment pipeline entries...');
  await p.offer.deleteMany();
  await p.jobSubmission.deleteMany();
  await p.jobNote.deleteMany();
  await p.jobTask.deleteMany();
  await p.jobActivity.deleteMany();
  await p.interview.deleteMany();

  // Create candidates, submissions, interviews, and placements
  let candSeq = 9000;
  for (const plan of recruiterPlan) {
    const recruiter = recruiters.find(r => `${r.firstName} ${r.lastName}` === plan.name) || recruiters[0];

    // Seed candidate records and submissions for this recruiter
    for (let s = 1; s <= plan.subs; s++) {
      candSeq++;
      const isClientSub = s <= plan.clientSubs;
      const candCode = `CAN-${candSeq}`;
      const fName = `Candidate_${candSeq}`;
      const lName = `${recruiter.lastName}Talent`;

      let stage = CandidateStage.SOURCED;
      if (s === 1 && plan.hireStatus) {
        stage = plan.hireStatus === 'JOINED' ? CandidateStage.JOINED : CandidateStage.OFFER_ACCEPTED;
      } else if (s <= plan.intvs + 1) {
        stage = CandidateStage.INTERVIEWED;
      } else if (isClientSub) {
        stage = CandidateStage.SHORTLISTED;
      }

      const candidate = await p.candidate.create({
        data: {
          candidateCode: candCode,
          firstName: (s === 1 && plan.applicant) ? plan.applicant.split(' ')[0] : fName,
          lastName: (s === 1 && plan.applicant) ? plan.applicant.split(' ')[1] || 'Talent' : lName,
          email: `cand.${candSeq}@example.com`,
          phone: `+1 (555) ${100 + candSeq % 899}-${1000 + candSeq % 8999}`,
          location: plan.job.location,
          city: plan.job.location?.split(',')[0]?.trim() || 'Toronto',
          state: plan.job.location?.split(',')[1]?.trim() || 'ON',
          currentTitle: plan.job.title,
          stage,
          jobPostingId: plan.job.id,
          ownerId: recruiter.id,
          departmentId: recruitmentDept?.id,
        },
      });

      // Create JobSubmission
      const subStatus = isClientSub ? 'CLIENT_SUBMISSION' : 'INTERNAL_REVIEW';
      const subStatusLabel = isClientSub ? 'Submitted to Client' : 'Internal Sourced';
      await p.jobSubmission.create({
        data: {
          jobPostingId: plan.job.id,
          candidateId: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          submittedBy: `${recruiter.firstName} ${recruiter.lastName}`,
          contact: candidate.phone,
          location: candidate.location,
          status: subStatus,
          statusLabel: subStatusLabel,
          billRate: plan.job.clientBillRate || '$90.00/hr',
          payRate: '$60.00/hr',
          createdById: recruiter.id,
        },
      });

      // Create Interview if within intvs count
      if (s <= plan.intvs) {
        await p.interview.create({
          data: {
            candidateId: candidate.id,
            interviewerId: recruiter.id,
            createdById: recruiter.id,
            scheduledAt: new Date(Date.now() - (s * 86400000 * 3)),
            durationMinutes: 45,
            type: s === 1 ? InterviewType.TECHNICAL : InterviewType.FINAL,
            status: InterviewStatus.COMPLETED,
          },
        });
      }

      // Create Offer/Placement if this is a hire
      if (s === 1 && plan.hireStatus) {
        const offerStat = plan.hireStatus === 'JOINED' ? OfferStatus.ACCEPTED : OfferStatus.OFFER_RELEASED;
        const marginVal = parseFloat((plan.bill || '$90').replace(/[^0-9.]/g, '')) - parseFloat((plan.pay || '$60').replace(/[^0-9.]/g, ''));
        await p.offer.create({
          data: {
            candidateId: candidate.id,
            salary: 120000,
            status: offerStat,
            approvalState: 'APPROVED',
            placementCode: `PLC-2026-${100 + candSeq % 900}`,
            placementType: 'Contract',
            clientPrimeVendor: plan.job.client,
            businessUnit: 'Enterprise IT Staffing',
            clientBillRate: plan.bill,
            payRate: plan.pay,
            margin: `$${marginVal.toFixed(2)}/hr`,
            startDate: new Date(plan.date),
            createdById: recruiter.id,
            departmentId: recruitmentDept?.id,
          },
        });
      }
    }

    // Seed Notes, Tasks, Activities
    const notesCount = Math.floor(Math.random() * 3) + 2;
    for (let n = 1; n <= notesCount; n++) {
      await p.jobNote.create({
        data: {
          jobPostingId: plan.job.id,
          text: `Candidate outreach & screening review #${n} completed for position ${plan.job.title}.`,
          action: 'Screening Feedback',
          addedBy: `${recruiter.firstName} ${recruiter.lastName}`,
          createdById: recruiter.id,
        },
      });
    }

    const tasksCount = Math.floor(Math.random() * 2) + 2;
    for (let t = 1; t <= tasksCount; t++) {
      await p.jobTask.create({
        data: {
          jobPostingId: plan.job.id,
          taskName: `Follow-up with candidate pipeline #${t} - ${plan.job.title}`,
          assignedTo: `${recruiter.firstName} ${recruiter.lastName}`,
          assignedBy: `${megan.firstName} ${megan.lastName}`,
          completed: t <= tasksCount - (Math.random() > 0.7 ? 1 : 0),
          status: 'Active',
          createdById: recruiter.id,
        },
      });
    }

    const activitiesCount = Math.floor(Math.random() * 3) + 4;
    for (let a = 1; a <= activitiesCount; a++) {
      await p.jobActivity.create({
        data: {
          jobPostingId: plan.job.id,
          user: `${recruiter.firstName} ${recruiter.lastName}`,
          description: `Logged client outreach update for ${plan.job.title}`,
          type: 'SUBMISSION',
          createdById: recruiter.id,
        },
      });
    }
  }

  // Seed extra 3 offers to reach exactly 11 placements across the team
  for (const extra of extraOffers) {
    const rec = recruiters.find(r => `${r.firstName} ${r.lastName}` === extra.recruiterName) || recruiters[0];
    candSeq++;
    const cand = await p.candidate.create({
      data: {
        candidateCode: `CAN-${candSeq}`,
        firstName: extra.applicant.split(' ')[0],
        lastName: extra.applicant.split(' ')[1] || 'Talent',
        email: `cand.${candSeq}@example.com`,
        phone: `+1 (555) ${100 + candSeq % 899}-${1000 + candSeq % 8999}`,
        location: extra.job.location,
        city: extra.job.location?.split(',')[0]?.trim() || 'Toronto',
        state: extra.job.location?.split(',')[1]?.trim() || 'ON',
        currentTitle: extra.job.title,
        stage: extra.status === 'JOINED' ? CandidateStage.JOINED : CandidateStage.OFFER_ACCEPTED,
        jobPostingId: extra.job.id,
        ownerId: rec.id,
        departmentId: recruitmentDept?.id,
      },
    });

    const marginVal = parseFloat(extra.bill.replace(/[^0-9.]/g, '')) - parseFloat(extra.pay.replace(/[^0-9.]/g, ''));
    await p.offer.create({
      data: {
        candidateId: cand.id,
        salary: 125000,
        status: extra.status === 'JOINED' ? OfferStatus.ACCEPTED : OfferStatus.OFFER_RELEASED,
        approvalState: 'APPROVED',
        placementCode: `PLC-2026-${100 + candSeq % 900}`,
        placementType: 'Contract',
        clientPrimeVendor: extra.job.client,
        businessUnit: 'Enterprise IT Staffing',
        clientBillRate: extra.bill,
        payRate: extra.pay,
        margin: `$${marginVal.toFixed(2)}/hr`,
        startDate: new Date(extra.date),
        createdById: rec.id,
        departmentId: recruitmentDept?.id,
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main().catch(console.error).finally(() => p.$disconnect());
