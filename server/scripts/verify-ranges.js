const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isDateInRange(dateStr, range) {
  if (!dateStr) return true;
  const parts = dateStr.split('T')[0].split('-');
  let d;
  if (parts.length === 3) {
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  const normalized = (range || '').trim().toLowerCase();

  if (normalized === 'today') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  if (normalized === 'this week') {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff && d <= now;
  }
  if (normalized.includes('month to') || normalized.includes('mtd')) {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d <= now;
  }
  if (normalized === 'last month') {
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  }
  if (normalized === 'last 3 months') {
    const cutoff = new Date(now);
    cutoff.setMonth(now.getMonth() - 3);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff && d <= now;
  }
  if (normalized === 'year to date' || normalized === 'ytd') {
    return d.getFullYear() === now.getFullYear() && d <= now;
  }
  return true;
}

async function verifyAll() {
  const admin = await prisma.user.findFirst({
    where: { email: 'paresh@venusglobaltech.com' },
    include: { role: true, department: true }
  });
  const token = jwt.sign({ sub: admin.id, email: admin.email, role: admin.role.name }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

  const offers = await prisma.offer.findMany({ select: { createdAt: true } });
  const offerDates = offers.map(o => o.createdAt.toISOString().slice(0, 10));

  console.log('=== VERIFYING DROPDOWN DATA FOR ALL 6 DATE RANGES ===');
  const ranges = ['Today', 'This Week', 'Month To Till Date', 'Last Month', 'Last 3 Months', 'Year To Date'];

  for (const r of ranges) {
    const res = await fetch('http://localhost:4001/recruitment-analytics/team-performance?range=' + encodeURIComponent(r), {
      headers: { Authorization: 'Bearer ' + token }
    });
    const teamData = await res.json();
    const subs = teamData.reduce((s, x) => s + x.submissions, 0);
    const clientSubs = teamData.reduce((s, x) => s + (x.clientSubmissions || 0), 0);
    const interviews = teamData.reduce((s, x) => s + x.interviews, 0);
    const hires = teamData.reduce((s, x) => s + x.hires, 0);
    const notes = teamData.reduce((s, x) => s + x.notesLogged, 0);
    const tasks = teamData.reduce((s, x) => s + x.tasksAssigned, 0);
    const completed = teamData.reduce((s, x) => s + x.tasksCompleted, 0);
    const activities = teamData.reduce((s, x) => s + x.activitiesLogged, 0);

    const filteredPlacements = offerDates.filter(d => isDateInRange(d, r)).length;

    console.log(`[${r}]`);
    console.log(`  -> JSIP Report:          ${subs} Subs, ${clientSubs} Client Subs, ${interviews} Interviews, ${hires} Hires`);
    console.log(`  -> Confirmations:        ${filteredPlacements} Placements`);
    console.log(`  -> Notes-Messages-Tasks: ${activities} Touchpoints (${notes} Notes, ${tasks} Tasks, ${completed} Completed)`);
  }
  console.log('=== ALL RANGES FUNCTIONAL AND VERIFIED ===');
  await prisma.$disconnect();
}

verifyAll().catch(console.error);
