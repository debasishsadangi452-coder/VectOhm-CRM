const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testApi() {
  try {
    const admin = await prisma.user.findFirst({
      where: { email: 'paresh@venusglobaltech.com' },
      include: { role: true, department: true }
    });

    if (!admin) {
      console.log('No admin found');
      return;
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role.name },
      process.env.JWT_ACCESS_SECRET || 'omnios-default-jwt-access-secret-key-32-bytes-minimum',
      { expiresIn: '1h' }
    );

    const endpoints = [
      '/job-tasks',
      '/job-activities',
      '/job-email-merges',
      '/job-submissions',
      '/job-notes',
      '/job-documents',
      '/recruitment-analytics/team-performance'
    ];

    console.log('Testing live API endpoints on http://localhost:4001:');
    for (const ep of endpoints) {
      try {
        const res = await fetch(`http://localhost:4001${ep}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();
        console.log(`[STATUS ${res.status}] ${ep}:`, Array.isArray(data) ? `Array(${data.length})` : typeof data);
        if (ep.includes('team-performance')) {
          console.log('Team Performance sample row:', JSON.stringify(data[0] || 'EMPTY', null, 2));
        }
      } catch (err) {
        console.log(`[FAILED] ${ep}:`, err.message);
      }
    }
  } catch (e) {
    console.error('Error in testApi:', e);
  } finally {
    await prisma.$disconnect();
  }
}

testApi();
