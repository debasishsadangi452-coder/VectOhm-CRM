const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function distribute() {
  console.log('Distributing record timestamps across Today, This Week, Month-To-Date, Last Month, and Last 3 Months...');

  // Target base dates relative to current date (2026-09-21)
  const dToday = new Date('2026-09-21T10:30:00Z');
  const dThisWeek = new Date('2026-09-19T14:15:00Z');
  const dEarlierThisMonth = new Date('2026-09-10T11:00:00Z');
  const dLastMonth = new Date('2026-08-18T09:45:00Z');
  const dLast3Months = new Date('2026-07-20T16:20:00Z');

  function getDateForIndex(idx, total) {
    const ratio = idx / total;
    if (ratio < 0.15) return dToday;
    if (ratio < 0.35) return dThisWeek;
    if (ratio < 0.70) return dEarlierThisMonth;
    if (ratio < 0.90) return dLastMonth;
    return dLast3Months;
  }

  // 1. Job Submissions
  const subs = await prisma.jobSubmission.findMany({ orderBy: { id: 'asc' } });
  for (let i = 0; i < subs.length; i++) {
    await prisma.jobSubmission.update({
      where: { id: subs[i].id },
      data: { createdAt: getDateForIndex(i, subs.length) }
    });
  }
  console.log(`Updated ${subs.length} job submissions`);

  // 2. Offers (Confirmations / Placements)
  const offers = await prisma.offer.findMany({ orderBy: { id: 'asc' } });
  for (let i = 0; i < offers.length; i++) {
    await prisma.offer.update({
      where: { id: offers[i].id },
      data: { createdAt: getDateForIndex(i, offers.length) }
    });
  }
  console.log(`Updated ${offers.length} offers`);

  // 3. Interviews
  const interviews = await prisma.interview.findMany({ orderBy: { id: 'asc' } });
  for (let i = 0; i < interviews.length; i++) {
    await prisma.interview.update({
      where: { id: interviews[i].id },
      data: { createdAt: getDateForIndex(i, interviews.length) }
    });
  }
  console.log(`Updated ${interviews.length} interviews`);

  // 4. Job Notes
  const notes = await prisma.jobNote.findMany({ orderBy: { id: 'asc' } });
  for (let i = 0; i < notes.length; i++) {
    await prisma.jobNote.update({
      where: { id: notes[i].id },
      data: { createdAt: getDateForIndex(i, notes.length) }
    });
  }
  console.log(`Updated ${notes.length} job notes`);

  // 5. Job Tasks
  const tasks = await prisma.jobTask.findMany({ orderBy: { id: 'asc' } });
  for (let i = 0; i < tasks.length; i++) {
    await prisma.jobTask.update({
      where: { id: tasks[i].id },
      data: { createdAt: getDateForIndex(i, tasks.length) }
    });
  }
  console.log(`Updated ${tasks.length} job tasks`);

  // 6. Job Activities
  const activities = await prisma.jobActivity.findMany({ orderBy: { id: 'asc' } });
  for (let i = 0; i < activities.length; i++) {
    await prisma.jobActivity.update({
      where: { id: activities[i].id },
      data: { createdAt: getDateForIndex(i, activities.length) }
    });
  }
  console.log(`Updated ${activities.length} job activities`);

  console.log('Finished distributing dates successfully.');
  await prisma.$disconnect();
}

distribute().catch((err) => {
  console.error(err);
  process.exit(1);
});
