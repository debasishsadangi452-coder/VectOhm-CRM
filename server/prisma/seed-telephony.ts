import { PrismaClient, CallStatus, CallDirection, LeadSource, DealStage } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedTelephonyAndSales() {
  console.log("Seeding Sales & Telephony (CloudTalk) data...");

  // Find Sales department & Sales reps
  const salesDept = await prisma.department.findUnique({ where: { name: "Sales" } });
  const salesDeptId = salesDept?.id;

  const jon = await prisma.user.findUnique({ where: { email: "jon@venushiring.com" } });
  const sourav = await prisma.user.findFirst({
    where: { email: "sourav@venushiring.com" },
  });
  const admin = await prisma.user.findFirst({ where: { role: { name: "ADMIN" } } });

  const agentId = jon?.id || admin?.id;
  if (!agentId) {
    console.log("No agent user found, skipping telephony seed");
    return;
  }

  // 1. Seed Business Phone Numbers
  const phoneNumbers = [
    { provider: "cloudtalk", providerId: "ct-num-1", e164: "+14158902134", country: "US", label: "US - San Francisco Sales Line", departmentId: salesDeptId },
    { provider: "cloudtalk", providerId: "ct-num-2", e164: "+16465550199", country: "US", label: "US - New York Inbound Line", departmentId: salesDeptId },
    { provider: "cloudtalk", providerId: "ct-num-3", e164: "+442079460912", country: "GB", label: "UK - London Sales Office", departmentId: salesDeptId },
    { provider: "justcall", providerId: "jc-num-1", e164: "+14155552671", country: "US", label: "US - JustCall Backup", departmentId: salesDeptId },
  ];

  for (const num of phoneNumbers) {
    await prisma.phoneNumber.upsert({
      where: { e164: num.e164 },
      create: num,
      update: { label: num.label, departmentId: num.departmentId },
    });
  }

  // 2. Seed Companies
  const companies = [
    { name: "Acme Cloud Solutions", domain: "acmecloud.example.com", employeeCount: 250, source: LeadSource.MANUAL },
    { name: "Apex FinTech Labs", domain: "apexfintech.example.com", employeeCount: 120, source: LeadSource.APOLLO },
    { name: "Nexus Health Systems", domain: "nexushealth.example.com", employeeCount: 540, source: LeadSource.IMPORT },
    { name: "Vanguard Logistics", domain: "vanguardlogistics.example.com", employeeCount: 80, source: LeadSource.MANUAL },
    { name: "Starlight Retail Tech", domain: "starlighttech.example.com", employeeCount: 310, source: LeadSource.APOLLO },
  ];

  const createdCompanies = [];
  for (const c of companies) {
    const existing = await prisma.company.findFirst({ where: { name: c.name } });
    const company = existing
      ? await prisma.company.update({ where: { id: existing.id }, data: c })
      : await prisma.company.create({ data: c });
    createdCompanies.push(company);
  }

  // 3. Seed Contacts
  const contactsData = [
    {
      firstName: "Marcus",
      lastName: "Vance",
      email: "marcus.vance@acmecloud.example.com",
      phone: "+1 (415) 555-0142",
      title: "VP of Engineering",
      companyId: createdCompanies[0]?.id,
      engagementScore: 85,
      engagementTier: "HOT",
    },
    {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena.r@apexfintech.example.com",
      phone: "+1 (212) 555-0188",
      title: "Chief Technology Officer",
      companyId: createdCompanies[1]?.id,
      engagementScore: 72,
      engagementTier: "WARM",
    },
    {
      firstName: "Jordan",
      lastName: "Miller",
      email: "jordan.m@nexushealth.example.com",
      phone: "+1 (312) 555-0199",
      title: "Director of Talent & Tech",
      companyId: createdCompanies[2]?.id,
      engagementScore: 90,
      engagementTier: "HOT",
    },
    {
      firstName: "Samantha",
      lastName: "Reed",
      email: "samantha.reed@vanguardlogistics.example.com",
      phone: "+44 20 7946 0192",
      title: "Head of Infrastructure",
      companyId: createdCompanies[3]?.id,
      engagementScore: 45,
      engagementTier: "COOL",
    },
    {
      firstName: "Liam",
      lastName: "O'Connor",
      email: "liam.oc@starlighttech.example.com",
      phone: "+1 (650) 555-0177",
      title: "VP of Operations",
      companyId: createdCompanies[4]?.id,
      engagementScore: 60,
      engagementTier: "WARM",
    },
  ];

  const createdContacts = [];
  for (const contact of contactsData) {
    const existing = await prisma.contact.findFirst({ where: { email: contact.email } });
    const c = existing
      ? await prisma.contact.update({ where: { id: existing.id }, data: contact })
      : await prisma.contact.create({ data: contact });
    createdContacts.push(c);
  }

  // 4. Seed Deals
  const now = Date.now();
  const dealsData = [
    {
      title: "SAP S/4 Migration Staffing - FinTech Corp",
      value: 48000,
      stage: DealStage.WON,
      companyId: createdCompanies[1]?.id,
      contactId: createdContacts[1]?.id,
      ownerId: jon?.id || agentId,
      gclid: "Cj0KCQjw123_sap_enterprise_lead",
      closedAt: new Date(now - 1000 * 60 * 60 * 4),
    },
    {
      title: "Dedicated Cloud Engineering Contract (6 Mos)",
      value: 38400,
      stage: DealStage.WON,
      companyId: createdCompanies[0]?.id,
      contactId: createdContacts[0]?.id,
      ownerId: sourav?.id || agentId,
      gclid: "Cj0KCQjw889_cloud_dev_team",
      closedAt: new Date(now - 1000 * 60 * 60 * 28),
    },
    {
      title: "Acme Cloud - Enterprise Platform License",
      value: 85000,
      stage: DealStage.PROPOSAL_SENT,
      companyId: createdCompanies[0]?.id,
      contactId: createdContacts[0]?.id,
      ownerId: jon?.id || agentId,
    },
    {
      title: "Apex FinTech - AI Cloud Pilot",
      value: 45000,
      stage: DealStage.MEETING_SCHEDULED,
      companyId: createdCompanies[1]?.id,
      contactId: createdContacts[1]?.id,
      ownerId: agentId,
    },
    {
      title: "Nexus Health - Talent Acceleration Suite",
      value: 120000,
      stage: DealStage.NEGOTIATION,
      companyId: createdCompanies[2]?.id,
      contactId: createdContacts[2]?.id,
      ownerId: sourav?.id || agentId,
    },
  ];

  const createdDeals = [];
  for (const d of dealsData) {
    const existing = await prisma.deal.findFirst({ where: { title: d.title } });
    const deal = existing
      ? await prisma.deal.update({ where: { id: existing.id }, data: d })
      : await prisma.deal.create({ data: d });
    createdDeals.push(deal);
  }

  // 5. Seed CloudTalk Call Logs
  const sampleCalls = [
    {
      provider: "cloudtalk",
      providerCallId: "ct-call-1001",
      direction: CallDirection.OUTBOUND,
      agentId: jon?.id || agentId,
      contactId: createdContacts[0]?.id,
      companyId: createdCompanies[0]?.id,
      dealId: createdDeals[0]?.id,
      fromNumber: "+14158902134",
      toNumber: "+1 (415) 555-0142",
      status: CallStatus.COMPLETED,
      durationSec: 420,
      startedAt: new Date(now - 1000 * 60 * 45),
      answeredAt: new Date(now - 1000 * 60 * 44),
      endedAt: new Date(now - 1000 * 60 * 37),
      recordingUrl: "https://my.cloudtalk.io/recordings/demo-sample-call-1001.mp3",
      recordingStatus: "AVAILABLE",
      disposition: "Connected - Demo Scheduled for Thursday",
    },
    {
      provider: "cloudtalk",
      providerCallId: "ct-call-1002",
      direction: CallDirection.INBOUND,
      agentId: agentId,
      contactId: createdContacts[1]?.id,
      companyId: createdCompanies[1]?.id,
      dealId: createdDeals[1]?.id,
      fromNumber: "+1 (212) 555-0188",
      toNumber: "+16465550199",
      status: CallStatus.COMPLETED,
      durationSec: 615,
      startedAt: new Date(now - 1000 * 60 * 180),
      answeredAt: new Date(now - 1000 * 60 * 179),
      endedAt: new Date(now - 1000 * 60 * 169),
      recordingUrl: "https://my.cloudtalk.io/recordings/demo-sample-call-1002.mp3",
      recordingStatus: "AVAILABLE",
      disposition: "Interested - Sent Custom SOW & Pricing",
    },
    {
      provider: "cloudtalk",
      providerCallId: "ct-call-1003",
      direction: CallDirection.OUTBOUND,
      agentId: sourav?.id || agentId,
      contactId: createdContacts[2]?.id,
      companyId: createdCompanies[2]?.id,
      dealId: createdDeals[2]?.id,
      fromNumber: "+14158902134",
      toNumber: "+1 (312) 555-0199",
      status: CallStatus.COMPLETED,
      durationSec: 280,
      startedAt: new Date(now - 1000 * 60 * 360),
      answeredAt: new Date(now - 1000 * 60 * 359),
      endedAt: new Date(now - 1000 * 60 * 354),
      recordingUrl: "https://my.cloudtalk.io/recordings/demo-sample-call-1003.mp3",
      recordingStatus: "AVAILABLE",
      disposition: "Discussion with VP on Contract Terms",
    },
    {
      provider: "cloudtalk",
      providerCallId: "ct-call-1004",
      direction: CallDirection.OUTBOUND,
      agentId: agentId,
      contactId: createdContacts[3]?.id,
      companyId: createdCompanies[3]?.id,
      fromNumber: "+442079460912",
      toNumber: "+44 20 7946 0192",
      status: CallStatus.NO_ANSWER,
      durationSec: 35,
      startedAt: new Date(now - 1000 * 60 * 520),
      endedAt: new Date(now - 1000 * 60 * 519),
      disposition: "Left Voicemail - Follow up tomorrow",
    },
    {
      provider: "cloudtalk",
      providerCallId: "ct-call-1005",
      direction: CallDirection.OUTBOUND,
      agentId: jon?.id || agentId,
      contactId: createdContacts[4]?.id,
      companyId: createdCompanies[4]?.id,
      fromNumber: "+14158902134",
      toNumber: "+1 (650) 555-0177",
      status: CallStatus.BUSY,
      durationSec: 12,
      startedAt: new Date(now - 1000 * 60 * 700),
      endedAt: new Date(now - 1000 * 60 * 699),
      disposition: "Busy Signal",
    },
  ];

  for (const call of sampleCalls) {
    await prisma.call.upsert({
      where: { providerCallId: call.providerCallId },
      create: call,
      update: call,
    });
  }

  console.log(`Seeded ${createdCompanies.length} companies, ${createdContacts.length} contacts, ${createdDeals.length} deals, and ${sampleCalls.length} CloudTalk calls.`);
}

if (require.main === module) {
  seedTelephonyAndSales()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
