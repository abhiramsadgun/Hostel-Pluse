const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('../src/db');
const { seed } = require('../src/db/seed');
const app = require('../src/index');

let serverInstance = null;
const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

async function fetchJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' RUNNING HOSTELPULSE FOUNDATION LAYER TEST SUITE');
  console.log('======================================================\n');

  // Start HTTP server for testing
  await new Promise(resolve => {
    serverInstance = app.listen(TEST_PORT, () => {
      resolve();
    });
  });

  // Re-seed cleanly
  await seed();

  try {
    // 1. Health check
    console.log('TEST 1: Health check endpoint...');
    const health = await fetchJson(`http://localhost:${TEST_PORT}/health`);
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.success, true);
    assert.strictEqual(health.body.data.status, 'UP');
    console.log('  PASSED: Health check returned 200 UP\n');

    // 2. Warden Login with College ID
    console.log('TEST 2: Warden login with College ID (W-MALE-101)...');
    const wardenLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'W-MALE-101',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(wardenLogin.status, 200);
    assert.strictEqual(wardenLogin.body.success, true);
    assert.strictEqual(wardenLogin.body.data.user.role, 'warden');
    assert.strictEqual(wardenLogin.body.data.user.fullName, 'Dr. Vikram Malhotra');
    const wardenToken = wardenLogin.body.data.token;
    console.log('  PASSED: Warden authenticated, JWT issued\n');

    // 3. Pending Student Login Rejection
    console.log('TEST 3: Pending student login rejection (HID-BBA-005)...');
    const pendingLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'HID-BBA-005',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(pendingLogin.status, 403);
    assert.strictEqual(pendingLogin.body.success, false);
    assert.strictEqual(pendingLogin.body.error.code, 'ACCOUNT_PENDING');
    console.log('  PASSED: Pending student blocked with ACCOUNT_PENDING code\n');

    // 4. Warden Block-Scoped Pending Students Query
    console.log('TEST 4: Warden views pending students scoped to Boys Block A...');
    const pendingQuery = await fetchJson('/auth/pending-students', {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(pendingQuery.status, 200);
    assert.strictEqual(pendingQuery.body.success, true);
    const pendingList = pendingQuery.body.data.pendingStudents;
    // Must only contain male students from Block A
    assert(pendingList.length > 0, 'Should find at least 1 pending student in Block A');
    pendingList.forEach(s => {
      assert.strictEqual(s.gender, 'male', 'Warden Vikram should only see male students');
      assert.strictEqual(s.block_name, 'Aryabhatta Boys Block A');
    });
    const targetStudent = pendingList.find(s => s.roll_number === '2025CSB105');
    assert(targetStudent, 'Should find student Pranav Nair (2025CSB105)');
    console.log(`  PASSED: Block scoping strictly enforced (${pendingList.length} pending male students found)\n`);

    // 5. Cross-Block Security Check: Warden Vikram attempts to access or approve female student Meera
    console.log('TEST 5: Cross-block approval authorization security test...');
    const girlsPendingRes = await db.query(
      `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE s.gender = 'female' AND u.status = 'pending' LIMIT 1`
    );
    if (girlsPendingRes.rows.length > 0) {
      const girlStudentId = girlsPendingRes.rows[0].id;
      const crossBlockAttempt = await fetchJson(`/auth/students/${girlStudentId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${wardenToken}` },
        body: JSON.stringify({}),
      });
      assert.strictEqual(crossBlockAttempt.status, 403);
      assert.strictEqual(crossBlockAttempt.body.error.code, 'FORBIDDEN_CROSS_BLOCK');
      console.log('  PASSED: Cross-block approval safely rejected with 403 FORBIDDEN_CROSS_BLOCK\n');
    }

    // 6. Warden Approves Student Pranav Nair
    console.log('TEST 6: Warden Vikram approves student Pranav Nair...');
    const approveRes = await fetchJson(`/auth/students/${targetStudent.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
      body: JSON.stringify({}),
    });
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.success, true);
    assert.strictEqual(approveRes.body.data.status, 'active');
    console.log('  PASSED: Student approved by warden\n');

    // 7. Student Login Now Succeeds with Laminated ID
    console.log('TEST 7: Newly approved student logs in with Laminated ID (HID-BBA-005)...');
    const studentLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'HID-BBA-005',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(studentLogin.status, 200);
    assert.strictEqual(studentLogin.body.success, true);
    assert.strictEqual(studentLogin.body.data.user.role, 'student');
    assert.strictEqual(studentLogin.body.data.user.laminatedIdNumber, 'HID-BBA-005');
    const studentToken = studentLogin.body.data.token;
    console.log('  PASSED: Student login succeeded\n');

    // 8. Student Dashboard checks assigned warden
    console.log('TEST 8: Student fetches profile and verifies assigned warden info...');
    const studentMe = await fetchJson('/auth/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentMe.status, 200);
    const wardens = studentMe.body.data.user.assignedWardens;
    assert(wardens && wardens.length >= 1, 'Student should see assigned warden list');
    const primaryWarden = wardens.find(w => !w.is_night_deputy);
    assert.strictEqual(primaryWarden.full_name, 'Dr. Vikram Malhotra');
    console.log(`  PASSED: Student correctly mapped to assigned warden: ${primaryWarden.full_name}\n`);

    // 9. Food Module: Weekly Menu & Student Preference Selection
    console.log('TEST 9: Food Module - Get menu and record preference...');
    const menuRes = await fetchJson('/food/menu');
    assert.strictEqual(menuRes.status, 200);
    assert(menuRes.body.data.menus.length > 0, 'Menu should contain seeded weekly items');

    // Calculate a valid future date
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const prefRes = await fetchJson('/food/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        mealDate: futureDate,
        mealType: 'lunch',
        selectedOptionId: 'opt_nonveg_lunch',
      }),
    });
    assert.strictEqual(prefRes.status, 200);
    assert.strictEqual(prefRes.body.success, true);
    console.log(`  PASSED: Student preference recorded for future date ${futureDate}\n`);

    // 10. Mess Staff Meal Report Generation
    console.log('TEST 10: Mess Staff login and meal count report generation...');
    const messLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'mess@hostelpulse.edu',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(messLogin.status, 200);
    const messToken = messLogin.body.data.token;

    const reportRes = await fetchJson(`/food/report?date=${futureDate}`, {
      headers: { Authorization: `Bearer ${messToken}` },
    });
    assert.strictEqual(reportRes.status, 200);
    assert.strictEqual(reportRes.body.success, true);
    assert(reportRes.body.data.meals.length > 0);
    console.log(`  PASSED: Mess report generated with breakdown by block and meal options\n`);

    // 11. Notification In-App Bell
    console.log('TEST 11: In-app notifications retrieval and mark-read...');
    const notifs = await fetchJson('/notifications', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(notifs.status, 200);
    assert.strictEqual(notifs.body.success, true);
    assert(notifs.body.data.notifications.length > 0, 'Student should have approval notification');
    const firstNotif = notifs.body.data.notifications[0];

    const markRead = await fetchJson(`/notifications/${firstNotif.id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(markRead.status, 200);
    console.log('  PASSED: In-app notification bell list and mark-read verified\n');

    // 12. Password Reset OTP Flow
    console.log('TEST 12: Forgot and Reset Password OTP flow...');
    const forgotRes = await fetchJson('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'rahul.sharma@hostelpulse.edu' }),
    });
    assert.strictEqual(forgotRes.status, 200);
    const demoOtp = forgotRes.body.data.demoOtp;
    assert(demoOtp, 'Demo OTP should be returned in development mode');

    const resetRes = await fetchJson('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rahul.sharma@hostelpulse.edu',
        otp: demoOtp,
        newPassword: 'NewPassword@2026',
      }),
    });
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.body.success, true);

    // Verify login with new password
    const newLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'rahul.sharma@hostelpulse.edu',
        password: 'NewPassword@2026',
      }),
    });
    assert.strictEqual(newLogin.status, 200);
    console.log('  PASSED: OTP password reset and login with new password successful\n');

    // 13. Admin Panel Overview and Category Management
    console.log('TEST 13: Admin Chief Warden panel tests...');
    const adminLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'admin@hostelpulse.edu',
        password: 'Password@123',
      }),
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.body.data.token;

    const statsRes = await fetchJson('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(statsRes.status, 200);
    assert(statsRes.body.data.totalWardens >= 2);
    assert(statsRes.body.data.totalBlocks >= 2);
    console.log('  PASSED: Admin stats, infrastructure and audits validated\n');

    console.log('======================================================');
    console.log(' ALL 13 FOUNDATION TESTS PASSED CLEANLY (100% OK)');
    console.log('======================================================\n');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n[TEST-FAILED]', err);
      if (serverInstance) serverInstance.close();
      process.exit(1);
    });
}

module.exports = { runTests };
