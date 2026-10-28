const http = require('http');

const BASE_URL = 'http://localhost:4001';
const PASSWORD = 'ChangeMe123!';

const USERS = {
  admin: 'paresh@venusglobaltech.com',
  devManager: 'jivan@venushiring.com',
  devEmployee: 'pratyush@venusglobaltech.com',
  salesManager: 'jon@venushiring.com',
  salesEmployee: 'sourav@venushiring.com',
  recruitmentManager: 'megan@venushiring.ca',
  recruitmentEmployee: 'anil@venusglobaltech.com',
  hrManager: 'vhr@venushiring.ca'
};

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function login(email) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(`Login failed for ${email}: status ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

async function run() {
  console.log('Logging in test accounts...');
  const tokens = {};
  for (const [key, email] of Object.entries(USERS)) {
    try {
      tokens[key] = await login(email);
      console.log(`  ✓ Logged in as ${key} (${email})`);
    } catch (err) {
      console.error(`  ✗ Failed to login as ${key} (${email}): ${err.message}`);
    }
  }

  const endpoints = [
    // Sales
    { path: '/deals', dept: 'Sales', name: 'GET /deals' },
    { path: '/companies', dept: 'Sales', name: 'GET /companies' },
    { path: '/contacts', dept: 'Sales', name: 'GET /contacts' },
    { path: '/dashboard/sales', dept: 'Sales', name: 'GET /dashboard/sales' },
    // Dev
    { path: '/projects', dept: 'Dev', name: 'GET /projects' },
    { path: '/tasks', dept: 'Dev', name: 'GET /tasks' },
    { path: '/dashboard/dev', dept: 'Dev', name: 'GET /dashboard/dev' },
    // Recruitment
    { path: '/candidates', dept: 'Recruitment', name: 'GET /candidates' },
    { path: '/interviews', dept: 'Recruitment', name: 'GET /interviews' },
    { path: '/dashboard/recruitment', dept: 'Recruitment', name: 'GET /dashboard/recruitment' },
    // HR
    { path: '/leave-requests', dept: 'HR', name: 'GET /leave-requests' },
    { path: '/work-sessions', dept: 'HR', name: 'GET /work-sessions' },
  ];

  console.log('\n--- RBAC Access Matrix Test ---\n');
  let totalTests = 0;
  let passedTests = 0;

  for (const ep of endpoints) {
    for (const [roleKey, token] of Object.entries(tokens)) {
      totalTests++;
      const res = await request(ep.path, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Determine expected behavior:
      // Admin: always 200
      // Same department: 200
      // Different department: 403 Forbidden
      // Note: HR endpoints (/leave-requests, /work-sessions) allow anyone to view their own self requests (200) or manager/HR
      let expectedStatus = 403;
      if (roleKey === 'admin') {
        expectedStatus = 200;
      } else if (ep.dept === 'Sales' && (roleKey === 'salesManager' || roleKey === 'salesEmployee')) {
        expectedStatus = 200;
      } else if (ep.dept === 'Dev' && (roleKey === 'devManager' || roleKey === 'devEmployee')) {
        expectedStatus = 200;
      } else if (ep.dept === 'Recruitment' && (roleKey === 'recruitmentManager' || roleKey === 'recruitmentEmployee')) {
        expectedStatus = 200;
      } else if (ep.dept === 'HR') {
        // Leave requests and work sessions allow individual employees to view their own sessions/requests or HR to view all
        expectedStatus = 200;
      }

      const passed = res.status === expectedStatus;
      if (passed) {
        passedTests++;
      } else {
        console.error(`  FAIL: ${roleKey} -> ${ep.name} | Expected ${expectedStatus}, Got ${res.status}`);
      }
    }
  }

  console.log(`\nMatrix Result: ${passedTests}/${totalTests} tests passed!`);

  // Now verify scoping for employees vs managers:
  console.log('\n--- Record Scoping Tests ---');
  
  // 1. Dev: Manager should see department projects, employee should see assigned projects
  const devMgrProj = await request('/projects', { headers: { Authorization: `Bearer ${tokens.devManager}` } });
  const devEmpProj = await request('/projects', { headers: { Authorization: `Bearer ${tokens.devEmployee}` } });
  console.log(`Dev Projects: Manager sees ${Array.isArray(devMgrProj.body) ? devMgrProj.body.length : devMgrProj.body.data?.length ?? 'N/A'}, Employee sees ${Array.isArray(devEmpProj.body) ? devEmpProj.body.length : devEmpProj.body.data?.length ?? 'N/A'}`);

  // 2. Sales: Manager should see department deals, employee should see assigned deals
  const salesMgrDeals = await request('/deals', { headers: { Authorization: `Bearer ${tokens.salesManager}` } });
  const salesEmpDeals = await request('/deals', { headers: { Authorization: `Bearer ${tokens.salesEmployee}` } });
  console.log(`Sales Deals: Manager sees ${Array.isArray(salesMgrDeals.body) ? salesMgrDeals.body.length : salesMgrDeals.body.data?.length ?? 'N/A'}, Employee sees ${Array.isArray(salesEmpDeals.body) ? salesEmpDeals.body.length : salesEmpDeals.body.data?.length ?? 'N/A'}`);

  // 3. Recruitment: Manager should see all candidates, employee should see assigned candidates
  const recMgrCand = await request('/candidates', { headers: { Authorization: `Bearer ${tokens.recruitmentManager}` } });
  const recEmpCand = await request('/candidates', { headers: { Authorization: `Bearer ${tokens.recruitmentEmployee}` } });
  console.log(`Recruitment Candidates: Manager sees ${Array.isArray(recMgrCand.body) ? recMgrCand.body.length : recMgrCand.body.data?.length ?? 'N/A'}, Employee sees ${Array.isArray(recEmpCand.body) ? recEmpCand.body.length : recEmpCand.body.data?.length ?? 'N/A'}`);

  console.log('\nDone.');
}

run().catch(console.error);
