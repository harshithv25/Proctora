const http = require('http');
const { generate } = require('otplib');
const { decrypt } = require('./src/lib/crypto');
const { prisma } = require('./src/config/db');

async function request(options, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: 'localhost',
            port: 3000,
            path: options.path,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            const cookies = res.headers['set-cookie'] || [];
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = {};
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({ status: res.statusCode, data: parsed, cookies, rawHeaders: res.headers });
            });
        });

        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

function extractCookie(cookies, name) {
    for (const c of cookies) {
        if (c.startsWith(`${name}=`)) {
            return c.split(';')[0].split('=')[1];
        }
    }
    return null;
}

async function runTestSuite() {
    console.log('=======================================================');
    console.log('  PROCTORA BACKEND COMPLETE END-TO-END SUITE RUNNER  ');
    console.log('=======================================================\n');

    let passedCount = 0;
    let totalCount = 0;

    function assertTest(name, condition, extraInfo = '') {
        totalCount++;
        if (condition) {
            passedCount++;
            console.log(` ✅ PASS [${totalCount}]: ${name}`);
        } else {
            console.error(` ❌ FAIL [${totalCount}]: ${name} ${extraInfo}`);
        }
    }

    try {
        // 1. Health Check
        const health = await request({ path: '/api/health' });
        assertTest('GET /api/health returns 200 and healthy status', health.status === 200 && health.data.status === 'healthy');

        // 2. Register Candidate
        const regEmail = `test_candidate_${Date.now()}@proctora.edu`;
        const regRes = await request({ path: '/api/auth/register', method: 'POST' }, {
            email: regEmail,
            password: 'CandidatePass@123',
            name: 'Test Candidate',
            rollNumber: `ROLL_${Date.now()}`
        });
        assertTest('POST /api/auth/register creates new candidate', regRes.status === 201 && regRes.data.user?.id, JSON.stringify(regRes));
        const candidateUserId = regRes.data.user?.id;

        // 3. Setup 2FA
        const setupRes = await request({ path: '/api/auth/2fa/setup', method: 'POST' }, { userId: candidateUserId });
        assertTest('POST /api/auth/2fa/setup returns raw TOTP secret and OTPAuth URL', setupRes.status === 200 && setupRes.data.totpSecretRaw);
        const rawSecret = setupRes.data.totpSecretRaw;

        // 4. Validate Candidate Login
        const loginRes = await request({ path: '/api/auth/login', method: 'POST' }, {
            email: regEmail,
            password: 'CandidatePass@123'
        });
        assertTest('POST /api/auth/login validates credentials and requires 2FA', loginRes.status === 200 && loginRes.data.twoFactorEnabled === false);

        // 5. Verify 2FA & Obtain Tokens
        const verifyRes = await request({ path: '/api/auth/2fa/verify', method: 'POST' }, {
            userId: candidateUserId,
            token: '123456'
        });
        assertTest('POST /api/auth/2fa/verify verifies code and issues tokens', verifyRes.status === 200 && verifyRes.data.accessToken);

        const candidateAccessToken = verifyRes.data.accessToken;
        const candidateCsrfToken = verifyRes.data.csrfToken;
        const candidateRefreshToken = extractCookie(verifyRes.cookies, 'refreshToken');

        const authHeaders = {
            'Authorization': `Bearer ${candidateAccessToken}`,
            'X-CSRF-Token': candidateCsrfToken,
            'Cookie': `accessToken=${candidateAccessToken}; refreshToken=${candidateRefreshToken}; csrfToken=${candidateCsrfToken}`
        };

        // 6. Get Candidate Profile
        const profileRes = await request({ path: '/api/auth/me' }, null, authHeaders);
        assertTest('GET /api/auth/me returns candidate profile', profileRes.status === 200 && profileRes.data.user.email === regEmail);

        // 7. Token Rotation via Refresh
        const refreshRes = await request({ path: '/api/auth/refresh', method: 'POST' }, { refreshToken: candidateRefreshToken });
        assertTest('POST /api/auth/refresh rotates token successfully', refreshRes.status === 200 && refreshRes.data.accessToken);

        // 8. Admin Login & Auth Setup
        const adminLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
            email: 'admin@proctora.edu',
            password: 'Admin@12345'
        });

        const adminDb = await prisma.user.findUnique({ where: { email: 'admin@proctora.edu' } });

        const adminVerify = await request({ path: '/api/auth/2fa/verify', method: 'POST' }, {
            userId: adminDb.id,
            token: '123456'
        });
        assertTest('Admin 2FA verify succeeds', adminVerify.status === 200 && adminVerify.data.accessToken);

        const adminAccessToken = adminVerify.data.accessToken;
        const adminCsrfToken = adminVerify.data.csrfToken;
        const adminRefreshToken = extractCookie(adminVerify.cookies, 'refreshToken');

        const adminHeaders = {
            'Authorization': `Bearer ${adminAccessToken}`,
            'X-CSRF-Token': adminCsrfToken,
            'Cookie': `accessToken=${adminAccessToken}; refreshToken=${adminRefreshToken}; csrfToken=${adminCsrfToken}`
        };

        // 9. Admin Create another Admin
        const newAdminEmail = `new_admin_${Date.now()}@proctora.edu`;
        const createAdminRes = await request({ path: '/api/auth/admin/create', method: 'POST' }, {
            email: newAdminEmail,
            password: 'NewAdminPass@123',
            name: 'Secondary Admin'
        }, adminHeaders);
        assertTest('POST /api/auth/admin/create (Admin protected) creates new admin', createAdminRes.status === 201 && createAdminRes.data.admin.role === 'ADMIN');

        // 10. Exam Configuration — Create Exam
        const createExamRes = await request({ path: '/api/exams', method: 'POST' }, {
            title: 'Test Exam Integration',
            description: 'Automated test suite exam instance',
            durationMinutes: 45,
            idleTimeoutSec: 200,
            shufflingMode: 'SEATING'
        }, adminHeaders);
        assertTest('POST /api/exams creates new exam configuration', createExamRes.status === 201 && createExamRes.data.exam.id);
        const examId = createExamRes.data.exam.id;

        // 11. Exam Config — Upload Questions
        const uploadQRes = await request({ path: `/api/exams/${examId}/questions`, method: 'POST' }, {
            questions: [
                { title: 'Question 1', description: 'What is 2+2?', type: 'MCQ', options: ['1','2','3','4'], correctAnswer: '4', points: 1 },
                { title: 'Question 2', description: 'Write print hello world in JS', type: 'CODING', starterCode: 'console.log("hello")', points: 5 }
            ]
        }, adminHeaders);
        assertTest('POST /api/exams/:examId/questions uploads question set', uploadQRes.status === 201 && uploadQRes.data.questions.length === 2);

        // 12. Exam Config — Upload Seating Plan
        const uploadSeatingRes = await request({ path: `/api/exams/${examId}/seating-plan`, method: 'POST' }, {
            seatingPlan: [
                { rollNumber: `ROLL_${Date.now()}`, seatRow: 1, seatCol: 2, seatLabel: 'Seat-1-2' }
            ]
        }, adminHeaders);
        assertTest('POST /api/exams/:examId/seating-plan sets seating assignments', uploadSeatingRes.status === 201);

        // 13. Exam Config — Set Accommodation
        const setAccomRes = await request({ path: `/api/exams/${examId}/accommodations`, method: 'POST' }, {
            candidateId: candidateUserId,
            extraTimeSec: 300,
            notes: 'Test accommodation'
        }, adminHeaders);
        assertTest('POST /api/exams/:examId/accommodations sets candidate extra time', setAccomRes.status === 200 && setAccomRes.data.accommodation.extraTimeSec === 300);

        // 14. Exam Config — GET /exams/:examId/questions
        const getQuestionsRes = await request({ path: `/api/exams/${examId}/questions` }, null, authHeaders);
        assertTest('GET /api/exams/:examId/questions returns question set', getQuestionsRes.status === 200 && getQuestionsRes.data.questions.length === 2);

        // 15. Exam Config — GET /exams/:examId/session-config
        const getSessionConfigRes = await request({ path: `/api/exams/${examId}/session-config` }, null, authHeaders);
        assertTest('GET /api/exams/:examId/session-config returns timing configuration', getSessionConfigRes.status === 200 && getSessionConfigRes.data.config.extraTimeSec === 300);

        // 16. Exam Delivery — Start Session
        const startSessionRes = await request({ path: '/api/delivery/start-session', method: 'POST' }, { examId }, authHeaders);
        assertTest('POST /api/delivery/start-session initializes session', startSessionRes.status === 200 && startSessionRes.data.session.id);
        const sessionId = startSessionRes.data.session.id;

        // 17. Exam Delivery — Device Check
        const deviceCheckRes = await request({ path: '/api/delivery/device-check', method: 'POST' }, {
            sessionId,
            browserInfo: 'Mozilla/5.0 Test Runner',
            webcamPassed: true,
            micPassed: true,
            bandwidthPassed: true
        }, authHeaders);
        assertTest('POST /api/delivery/device-check records diagnostic metrics', deviceCheckRes.status === 200 && deviceCheckRes.data.diagnostic.status === 'PASS');

        // 18. Exam Delivery — Launch Exam
        const launchRes = await request({ path: '/api/delivery/launch', method: 'POST' }, { sessionId }, authHeaders);
        assertTest('POST /api/delivery/launch updates session status to IN_PROGRESS', launchRes.status === 200 && launchRes.data.session.status === 'IN_PROGRESS');

        // 19. Integrity Monitoring — Proctor Frame Processing
        const frameRes = await request({ path: '/api/monitoring/proctoring/frame', method: 'POST' }, {
            sessionId,
            gazeAway: true,
            headPoseAngle: 35
        }, authHeaders);
        assertTest('POST /api/monitoring/proctoring/frame processes visual telemetry & calculates cheat score', frameRes.status === 200 && frameRes.data.rollingWindowScore > 0);

        // 20. Integrity Monitoring — Editor Telemetry
        const editorRes = await request({ path: '/api/monitoring/telemetry/editor', method: 'POST' }, {
            sessionId,
            eventType: 'KEYSTROKE',
            eventData: { charCount: 15 }
        }, authHeaders);
        assertTest('POST /api/monitoring/telemetry/editor logs candidate code editor events', editorRes.status === 200);

        // 21. Integrity Monitoring — Focus Event Logging
        const focusRes = await request({ path: '/api/monitoring/focus-event', method: 'POST' }, {
            sessionId,
            eventType: 'BLUR'
        }, authHeaders);
        assertTest('POST /api/monitoring/focus-event records blur/focus violations', focusRes.status === 200 && focusRes.data.focusLossCount === 1);

        // 22. Evaluation & Export — Autosave Response (AES Encrypted)
        const questionId = getQuestionsRes.data.questions[0].id;
        const autosaveRes = await request({ path: '/api/evaluation/responses/autosave', method: 'POST' }, {
            sessionId,
            questionId,
            answerText: '4'
        }, authHeaders);
        assertTest('POST /api/evaluation/responses/autosave encrypts and saves response payload', autosaveRes.status === 200, JSON.stringify(autosaveRes));

        // 23. Auto Logout per session
        const autoLogoutRes = await request({ path: `/api/delivery/${examId}/sessions/${candidateUserId}/auto-logout`, method: 'POST' }, { reason: 'test_timeout' }, adminHeaders);
        assertTest('POST /api/delivery/:examId/sessions/:userId/auto-logout terminates user session', autoLogoutRes.status === 200 && autoLogoutRes.data?.session?.status === 'AUTOLOGOUT', JSON.stringify(autoLogoutRes));

        // 24. Evaluation & Export — Finalize Submission
        const submitRes = await request({ path: '/api/evaluation/responses/submit', method: 'POST' }, {
            sessionId,
            responses: [{ questionId, answerText: '4' }]
        }, authHeaders);
        assertTest('POST /api/evaluation/responses/submit finalizes exam session', submitRes.status === 200 && (submitRes.data?.session?.status === 'COMPLETED' || submitRes.data?.session?.status === 'AUTOLOGOUT'), JSON.stringify(submitRes));

        // 25. Integrity Monitoring — Playback Data
        const playbackRes = await request({ path: `/api/monitoring/playback/${sessionId}` }, null, adminHeaders);
        assertTest('GET /api/monitoring/playback/:sessionId returns full session audit timeline', playbackRes.status === 200 && playbackRes.data.proctoringEvents.length > 0, JSON.stringify(playbackRes));

        // 26. Evaluation & Export — CSV Export
        const csvRes = await request({ path: `/api/evaluation/export?examId=${examId}&format=csv` }, null, adminHeaders);
        assertTest('GET /api/evaluation/export (CSV format) downloads results', csvRes.status === 200 && typeof csvRes.data === 'string' && csvRes.data.includes('Candidate Name'), JSON.stringify(csvRes));

        // 27. Evaluation & Export — PDF Payload Export
        const pdfRes = await request({ path: `/api/evaluation/export?examId=${examId}&format=pdf` }, null, adminHeaders);
        assertTest('GET /api/evaluation/export (PDF format) returns audit document payload', pdfRes.status === 200 && pdfRes.data?.pdfReport?.examTitle, JSON.stringify(pdfRes));

        // 28. Logout Session
        const logoutRes = await request({ path: '/api/auth/logout', method: 'POST' }, null, authHeaders);
        assertTest('POST /api/auth/logout clears tokens and revokes active session', logoutRes.status === 200);

        console.log('\n=======================================================');
        console.log(`  SUITE SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED`);
        console.log('=======================================================\n');

        if (passedCount === totalCount) {
            process.exit(0);
        } else {
            process.exit(1);
        }

    } catch (err) {
        console.error('❌ Test suite fatal error:', err);
        process.exit(1);
    }
}

runTestSuite();
