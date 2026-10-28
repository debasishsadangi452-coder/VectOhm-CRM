const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testCrud() {
  try {
    const admin = await prisma.user.findFirst({
      where: { email: 'paresh@venusglobaltech.com' },
      include: { role: true, department: true }
    });

    const job = await prisma.jobPosting.findFirst();
    if (!job) {
      console.log('No job found to test against');
      return;
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role.name },
      process.env.JWT_ACCESS_SECRET || 'omnios-default-jwt-access-secret-key-32-bytes-minimum',
      { expiresIn: '1h' }
    );

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log(`Using Job: ${job.id} (${job.title})`);

    // 1. Test POST /job-tasks
    const taskRes = await fetch('http://localhost:4001/job-tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobPostingId: job.id,
        taskName: 'Audit Test Task',
        dueDate: '2026-09-30',
        timeZone: 'EST',
        assignedTo: 'Auditor',
        status: 'Open'
      })
    });
    const createdTask = await taskRes.json();
    console.log('[POST /job-tasks] Status:', taskRes.status, 'Created ID:', createdTask.id);

    // 2. Test POST /job-notes
    const noteRes = await fetch('http://localhost:4001/job-notes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobPostingId: job.id,
        text: 'Audit Test Note',
        action: 'Note'
      })
    });
    const createdNote = await noteRes.json();
    console.log('[POST /job-notes] Status:', noteRes.status, 'Created ID:', createdNote.id);

    // 3. Test POST /job-submissions
    const subRes = await fetch('http://localhost:4001/job-submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobPostingId: job.id,
        name: 'Audit Candidate',
        status: 'client_submissions',
        statusLabel: 'Under Review'
      })
    });
    const createdSub = await subRes.json();
    console.log('[POST /job-submissions] Status:', subRes.status, 'Created ID:', createdSub.id);

    // 4. Test POST /job-documents
    const docRes = await fetch('http://localhost:4001/job-documents', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobPostingId: job.id,
        name: 'test-audit-doc.pdf',
        type: 'PDF Document',
        size: '128 KB'
      })
    });
    const createdDoc = await docRes.json();
    console.log('[POST /job-documents] Status:', docRes.status, 'Created ID:', createdDoc.id);

    // 5. Test POST /job-activities
    const actRes = await fetch('http://localhost:4001/job-activities', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobPostingId: job.id,
        description: 'Audit Test Activity',
        type: 'GENERAL'
      })
    });
    const createdAct = await actRes.json();
    console.log('[POST /job-activities] Status:', actRes.status, 'Created ID:', createdAct.id);

    // 6. Test POST /job-email-merges
    const mergeRes = await fetch('http://localhost:4001/job-email-merges', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobPostingId: job.id,
        subject: 'Audit Email Merge',
        details: 'Audit Details',
        sentTo: 'candidate@test.com'
      })
    });
    const createdMerge = await mergeRes.json();
    console.log('[POST /job-email-merges] Status:', mergeRes.status, 'Created ID:', createdMerge.id);

    // Verify recruitment analytics reflects the new creations!
    const perfRes = await fetch('http://localhost:4001/recruitment-analytics/team-performance', { headers });
    const perfData = await perfRes.json();
    const adminPerf = perfData.find(p => p.userId === admin.id);
    console.log('[GET /recruitment-analytics/team-performance] Admin Metrics:', adminPerf || 'Admin not in recruitment department');

    // 7. Test Deletes
    const delTask = await fetch(`http://localhost:4001/job-tasks/${createdTask.id}`, { method: 'DELETE', headers });
    console.log('[DELETE /job-tasks/:id] Status:', delTask.status);

    const delNote = await fetch(`http://localhost:4001/job-notes/${createdNote.id}`, { method: 'DELETE', headers });
    console.log('[DELETE /job-notes/:id] Status:', delNote.status);

    const delSub = await fetch(`http://localhost:4001/job-submissions/${createdSub.id}`, { method: 'DELETE', headers });
    console.log('[DELETE /job-submissions/:id] Status:', delSub.status);

    const delDoc = await fetch(`http://localhost:4001/job-documents/${createdDoc.id}`, { method: 'DELETE', headers });
    console.log('[DELETE /job-documents/:id] Status:', delDoc.status);

    console.log('--- ALL CRUD TESTS COMPLETED ---');
  } catch (e) {
    console.error('Error during CRUD test:', e);
  } finally {
    await prisma.$disconnect();
  }
}

testCrud();
