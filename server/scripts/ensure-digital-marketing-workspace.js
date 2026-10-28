require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient, RoleName } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database to provision Digital Marketing Manager workspace...');

    // 1. Find or verify MANAGER role
    const managerRole = await prisma.role.findFirst({
      where: { name: RoleName.MANAGER },
    });
    if (!managerRole) {
      throw new Error('MANAGER role not found in database.');
    }

    // 2. Upsert Digital Marketing Department
    let digitalMarketingDept = await prisma.department.findFirst({
      where: { name: { equals: 'Digital Marketing', mode: 'insensitive' } },
    });
    if (!digitalMarketingDept) {
      digitalMarketingDept = await prisma.department.create({
        data: {
          name: 'Digital Marketing',
          description: 'Digital marketing & SEO team',
          managerTitle: 'Manager',
        },
      });
      console.log('Created Digital Marketing department.');
    }

    // 3. Upsert Shantanu Tyagi
    const email = 'digital@venushiring.ca';
    const rawPassword = 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        firstName: 'Shantanu',
        lastName: 'Tyagi',
        roleId: managerRole.id,
        departmentId: digitalMarketingDept.id,
        isActive: true,
        screenRecordingEnabled: false,
        canSignOut: true,
        shiftStart: '10:00',
        shiftEnd: '19:00',
        passwordHash,
      },
      create: {
        email,
        firstName: 'Shantanu',
        lastName: 'Tyagi',
        passwordHash,
        roleId: managerRole.id,
        departmentId: digitalMarketingDept.id,
        isActive: true,
        screenRecordingEnabled: false,
        canSignOut: true,
        shiftStart: '10:00',
        shiftEnd: '19:00',
      },
    });

    console.log(`Provisioned Shantanu Tyagi user account (${user.email}, ID: ${user.id}).`);

    // 4. Set Shantanu Tyagi as head of Digital Marketing department
    await prisma.department.update({
      where: { id: digitalMarketingDept.id },
      data: {
        headId: user.id,
      },
    });
    console.log('Assigned Shantanu Tyagi as Department Head of Digital Marketing.');

    // 5. Digital Marketing Project
    const seoProject = await prisma.project.upsert({
      where: { id: 'proj-digital-marketing-seo-growth' },
      update: {
        ownerId: user.id,
        departmentId: digitalMarketingDept.id,
      },
      create: {
        id: 'proj-digital-marketing-seo-growth',
        name: 'Venus Hiring Organic Growth & SEO 2026',
        description: 'Search engine optimization, keyword acquisition, and content briefs for Venus Hiring',
        status: 'ACTIVE',
        ownerId: user.id,
        departmentId: digitalMarketingDept.id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });
    console.log('Provisioned Digital Marketing Project:', seoProject.name);

    // 6. Seed SEO Keywords
    const keywordsToSeed = [
      { term: 'ai recruitment platform', searchIntent: 'COMMERCIAL', volume: 14500, difficulty: 48, currentRank: 4, targetRank: 1, url: 'https://venushiring.ca/solutions/ai-recruitment' },
      { term: 'b2b hiring signals software', searchIntent: 'TRANSACTIONAL', volume: 6200, difficulty: 35, currentRank: 2, targetRank: 1, url: 'https://venushiring.ca/hiring-signals' },
      { term: 'executive technical staffing canada', searchIntent: 'COMMERCIAL', volume: 8800, difficulty: 42, currentRank: 5, targetRank: 2, url: 'https://venushiring.ca/staffing' },
      { term: 'it contract talent solutions', searchIntent: 'INFORMATIONAL', volume: 12000, difficulty: 55, currentRank: 8, targetRank: 3, url: 'https://venushiring.ca/it-talent' },
      { term: 'real-time company hiring velocity', searchIntent: 'INFORMATIONAL', volume: 3400, difficulty: 28, currentRank: 1, targetRank: 1, url: 'https://venushiring.ca/signals' },
    ];

    for (const kw of keywordsToSeed) {
      const existingKw = await prisma.seoKeyword.findFirst({
        where: { term: kw.term, departmentId: digitalMarketingDept.id },
      });
      if (!existingKw) {
        await prisma.seoKeyword.create({
          data: {
            ...kw,
            departmentId: digitalMarketingDept.id,
            projectId: seoProject.id,
          },
        });
      }
    }
    console.log(`Seeded ${keywordsToSeed.length} target keywords.`);

    // 7. Seed Website Audit Snapshot
    const existingAudit = await prisma.seoAudit.findFirst({
      where: { departmentId: digitalMarketingDept.id },
    });
    if (!existingAudit) {
      await prisma.seoAudit.create({
        data: {
          url: 'https://venushiring.ca',
          score: 92,
          issues: JSON.stringify([
            { severity: 'INFO', message: 'Core Web Vitals LCP 1.4s (Good)' },
            { severity: 'INFO', message: 'Mobile responsive viewport verified' },
            { severity: 'WARNING', message: 'Missing open-graph images on 2 careers pages' },
            { severity: 'PASS', message: 'Canonical tags and HTTPS certificates active' },
          ]),
          departmentId: digitalMarketingDept.id,
          runAt: new Date(),
        },
      });
      console.log('Seeded Website Audit snapshot (Score: 92/100).');
    }

    // 8. Seed Backlinks
    const backlinksToSeed = [
      { sourceUrl: 'https://techcrunch.com/features/recruitment-tech-canada', targetUrl: 'https://venushiring.ca', anchorText: 'Venus Hiring AI Platform', domainAuthority: 92, spamScore: 1, status: 'VERIFIED' },
      { sourceUrl: 'https://forbes.com/innovation/b2b-growth-signals-2026', targetUrl: 'https://venushiring.ca/hiring-signals', anchorText: 'hiring signals intelligence', domainAuthority: 94, spamScore: 0, status: 'VERIFIED' },
      { sourceUrl: 'https://clutch.co/ca/staffing/top-firms', targetUrl: 'https://venushiring.ca', anchorText: 'Top Technical Staffing Partner', domainAuthority: 87, spamScore: 2, status: 'VERIFIED' },
    ];

    for (const bl of backlinksToSeed) {
      const existingBl = await prisma.seoBacklink.findFirst({
        where: { sourceUrl: bl.sourceUrl, departmentId: digitalMarketingDept.id },
      });
      if (!existingBl) {
        await prisma.seoBacklink.create({
          data: {
            ...bl,
            loggedById: user.id,
            verifiedById: user.id,
            projectId: seoProject.id,
            departmentId: digitalMarketingDept.id,
          },
        });
      }
    }
    console.log(`Seeded ${backlinksToSeed.length} verified backlinks.`);

    // 9. Seed Content Briefs
    const briefsToSeed = [
      {
        title: 'The Executive Guide to AI-Powered Hiring Signals in 2026',
        targetKeyword: 'b2b hiring signals software',
        secondaryKeywords: ['ai recruitment platform', 'intent hiring signals'],
        targetWordCount: 2200,
        status: 'APPROVED',
        slaStatus: 'ON_TRACK',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assigneeId: user.id,
        reviewerId: user.id,
        departmentId: digitalMarketingDept.id,
        projectId: seoProject.id,
        content: '# The Executive Guide to AI-Powered Hiring Signals in 2026\n\nModern sales and recruitment teams are shifting from reactive cold outreach to intent-driven hiring signal intelligence...',
      },
      {
        title: 'Technical Staffing Benchmarks for Canadian Enterprises',
        targetKeyword: 'executive technical staffing canada',
        secondaryKeywords: ['it contract talent solutions'],
        targetWordCount: 1800,
        status: 'IN_PROGRESS',
        slaStatus: 'ON_TRACK',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        assigneeId: user.id,
        reviewerId: user.id,
        departmentId: digitalMarketingDept.id,
        projectId: seoProject.id,
        content: '# Technical Staffing Benchmarks for Canadian Enterprises\n\nHow enterprise tech leaders in Toronto, Vancouver, and Montreal scale contract engineering teams...',
      },
    ];

    for (const brief of briefsToSeed) {
      const existingBrief = await prisma.seoContentBrief.findFirst({
        where: { title: brief.title, departmentId: digitalMarketingDept.id },
      });
      if (!existingBrief) {
        await prisma.seoContentBrief.create({
          data: brief,
        });
      }
    }
    console.log(`Seeded ${briefsToSeed.length} content briefs.`);

    // 10. Seed Competitors
    const competitorsToSeed = [
      { domain: 'hired.com', da: 78, traffic: 450000 },
      { domain: 'turing.com', da: 82, traffic: 680000 },
      { domain: 'roberthalf.ca', da: 85, traffic: 320000 },
    ];

    for (const comp of competitorsToSeed) {
      const existingComp = await prisma.seoCompetitor.findFirst({
        where: { domain: comp.domain, departmentId: digitalMarketingDept.id },
      });
      if (!existingComp) {
        await prisma.seoCompetitor.create({
          data: {
            ...comp,
            departmentId: digitalMarketingDept.id,
          },
        });
      }
    }
    console.log(`Seeded ${competitorsToSeed.length} competitors.`);

    console.log('\nDigital Marketing Manager workspace successfully provisioned!');
    console.log('Login credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${rawPassword}`);
    console.log(`  Role: MANAGER`);
    console.log(`  Department: Digital Marketing (Head)`);
  } catch (err) {
    console.error('Failed to provision Digital Marketing workspace:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
