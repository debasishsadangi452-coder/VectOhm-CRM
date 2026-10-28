function isDepartmentMatch(userDept, targetDept) {
  if (!userDept || !targetDept) return false;
  const normalize = (val) => val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const u = normalize(userDept);
  const t = normalize(targetDept);
  if (u === t) return true;
  if ((u === 'dev' || u === 'development') && (t === 'dev' || t === 'development')) return true;
  if ((u === 'hr' || u === 'humanresources') && (t === 'hr' || t === 'humanresources')) return true;
  if ((u === 'digitalmarketing' || u === 'marketing' || u === 'seo') &&
      (t === 'digitalmarketing' || t === 'marketing' || t === 'seo')) return true;
  return false;
}

const DEPARTMENT_ROUTES = [
  { prefix: '/crm', department: 'Sales' },
  { prefix: '/sales', department: 'Sales' },
  { prefix: '/outreach', department: 'Sales' },
  { prefix: '/calls', department: 'Sales' },
  { prefix: '/campaigns', department: 'Sales' },
  { prefix: '/deals', department: 'Sales' },
  { prefix: '/projects', department: 'Development' },
  { prefix: '/tasks', department: 'Development' },
  { prefix: '/dev', department: 'Development' },
  { prefix: '/recruitment', department: 'Recruitment' },
  { prefix: '/priority-center', department: 'Recruitment' },
  { prefix: '/recruitment-stream', department: 'Recruitment' },
  { prefix: '/hr', department: 'HR' },
  { prefix: '/seo', department: 'Digital Marketing' },
];

function canAccess(user, routePath) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const matched = DEPARTMENT_ROUTES.find(r => routePath.startsWith(r.prefix));
  if (!matched) return true; // generic routes
  return isDepartmentMatch(user.department, matched.department);
}

const users = [
  { name: 'Admin', role: 'ADMIN', department: 'Executive' },
  { name: 'Dev User', role: 'EMPLOYEE', department: 'Dev' },
  { name: 'Sales User', role: 'EMPLOYEE', department: 'Sales' },
  { name: 'Recruitment User', role: 'EMPLOYEE', department: 'Recruitment' },
  { name: 'HR User', role: 'EMPLOYEE', department: 'HR' }
];

for (const u of users) {
  console.log(`\n--- User: ${u.name} (${u.department}) ---`);
  for (const r of ['/crm', '/sales', '/projects', '/tasks', '/recruitment', '/priority-center', '/hr']) {
    console.log(`  ${r}: ${canAccess(u, r) ? 'ALLOWED' : 'BLOCKED'}`);
  }
}
