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
    const salesDepartment = await prisma.department.findUnique({
      where: { name: 'Sales' },
      include: { head: true },
    });
    if (!salesDepartment) {
      console.warn('Sales department not found by name "Sales", searching case-insensitively...');
    }

    // 3. Find Sales Manager (Jon Carter or department head)
    const salesManager =
      (await prisma.user.findFirst({
        where: { email: 'jon@venushiring.com' },
      })) ||
      (salesDepartment && salesDepartment.headId
        ? await prisma.user.findUnique({ where: { id: salesDepartment.headId } })
        : null);

    // 4. Hash the password
    const rawPassword = 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const employees = [
      {
        email: 'avi@venushiring.com',
        firstName: 'Avi',
        lastName: '',
      },
      {
        email: 'palavee@venusglobaltech.com',
        firstName: 'Palavee',
        lastName: '',
      },
    ];

    for (const emp of employees) {
      const user = await prisma.user.upsert({
        where: { email: emp.email },
        update: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          passwordHash: passwordHash,
          roleId: employeeRole.id,
          departmentId: salesDepartment ? salesDepartment.id : undefined,
          managerId: salesManager ? salesManager.id : undefined,
          isActive: true,
        },
        create: {
          email: emp.email,
          firstName: emp.firstName,
          lastName: emp.lastName,
          passwordHash: passwordHash,
          roleId: employeeRole.id,
          departmentId: salesDepartment ? salesDepartment.id : undefined,
          managerId: salesManager ? salesManager.id : undefined,
          isActive: true,
          shiftStart: '10:00',
          shiftEnd: '19:00',
        },
        include: {
          role: true,
          department: true,
          manager: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      console.log(`Successfully added/updated: ${user.email} (ID: ${user.id})`);
      console.log(`  Role: ${user.role.name}`);
      console.log(`  Department: ${user.department ? user.department.name : 'None'}`);
      console.log(`  Manager: ${user.manager ? user.manager.email : 'None'}`);
      console.log(`  Active: ${user.isActive}`);
    }

    console.log('\nAll sales employee accounts have been successfully added to the database!');
  } catch (error) {
    console.error('Error adding sales employees:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
