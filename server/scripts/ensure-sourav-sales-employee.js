require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient, RoleName } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database...');

    // 1. Find EMPLOYEE role
    const employeeRole = await prisma.role.findUnique({
      where: { name: RoleName.EMPLOYEE || 'EMPLOYEE' },
    });
    if (!employeeRole) {
      throw new Error('EMPLOYEE role not found in database.');
    }

    // 2. Find Sales Department
    const salesDepartment = await prisma.department.findFirst({
      where: { name: { equals: 'Sales', mode: 'insensitive' } },
    });
    if (!salesDepartment) {
      throw new Error('Sales department not found in database.');
    }

    // 3. Find Sales Manager (Jon Carter)
    const salesManager = await prisma.user.findFirst({
      where: { email: { equals: 'jon@venushiring.com', mode: 'insensitive' } },
    });

    // 4. Default password hash
    const rawPassword = 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: 'sourav@venushiring.com' },
      update: {
        firstName: 'Sourav',
        lastName: 'Sahoo',
        roleId: employeeRole.id,
        departmentId: salesDepartment.id,
        managerId: salesManager ? salesManager.id : undefined,
        isActive: true,
        screenRecordingEnabled: true,
        idlePromptMin: 20,
        shiftStart: '10:00',
        shiftEnd: '19:00',
      },
      create: {
        email: 'sourav@venushiring.com',
        firstName: 'Sourav',
        lastName: 'Sahoo',
        passwordHash,
        roleId: employeeRole.id,
        departmentId: salesDepartment.id,
        managerId: salesManager ? salesManager.id : undefined,
        isActive: true,
        screenRecordingEnabled: true,
        idlePromptMin: 20,
        shiftStart: '10:00',
        shiftEnd: '19:00',
      },
      include: {
        role: true,
        department: true,
        manager: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    console.log('Successfully configured Sales Employee account:');
    console.log(`  Email: ${user.email} (ID: ${user.id})`);
    console.log(`  Role: ${user.role.name}`);
    console.log(`  Department: ${user.department ? user.department.name : 'None'}`);
    console.log(`  Manager: ${user.manager ? user.manager.email : 'None'}`);
    console.log(`  Active: ${user.isActive}`);
  } catch (error) {
    console.error('Error configuring Sourav as Sales Employee:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
