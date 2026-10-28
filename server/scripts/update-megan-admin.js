require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      console.error('ADMIN role not found in database.');
      return;
    }

    const res = await prisma.user.updateMany({
      where: {
        OR: [
          { email: 'megan@venushiring.ca' },
          { firstName: 'Megan', lastName: 'Foster' }
        ]
      },
      data: {
        roleId: adminRole.id
      }
    });

    console.log(`Updated ${res.count} user record(s).`);

    const megan = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'megan@venushiring.ca' },
          { firstName: 'Megan', lastName: 'Foster' }
        ]
      },
      include: {
        role: true,
        department: true
      }
    });

    console.log('Megan Foster User details:', JSON.stringify(megan, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
