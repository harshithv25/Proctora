const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const crypto = require('crypto');

const prisma = new PrismaClient();

function encrypt(text, hexKey = '0000000000000000000000000000000000000000000000000000000000000000') {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

async function main() {
    console.log('🌱 Seeding Proctora database...');

    await prisma.examResponse.deleteMany({});
    await prisma.proctorAlert.deleteMany({});
    await prisma.editorTelemetryEvent.deleteMany({});
    await prisma.focusLog.deleteMany({});
    await prisma.proctoringEvent.deleteMany({});
    await prisma.deviceDiagnostic.deleteMany({});
    await prisma.examSession.deleteMany({});
    await prisma.accommodation.deleteMany({});
    await prisma.seatingAssignment.deleteMany({});
    await prisma.question.deleteMany({});
    await prisma.exam.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});

    const adminPasswordHash = await argon2.hash('Admin@12345', { type: argon2.argon2id });
    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@proctora.edu',
            name: 'Dr. Proctora Admin',
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
            totpSecret: encrypt('JBSWY3DPEHPK3PXP'),
            twoFactorEnabled: true
        }
    });

    const candidatePasswordHash = await argon2.hash('Student@12345', { type: argon2.argon2id });
    const candidateUser = await prisma.user.create({
        data: {
            email: 'candidate@proctora.edu',
            name: 'Adarsh Bellamane',
            rollNumber: '241IT004',
            passwordHash: candidatePasswordHash,
            role: 'CANDIDATE',
            totpSecret: encrypt('JBSWY3DPEHPK3PXQ'),
            twoFactorEnabled: true
        }
    });

    console.log('✅ Created initial users: Admin & Candidate');

    const exam = await prisma.exam.create({
        data: {
            title: 'CS303: Data Structures & Algorithms End-Semester Examination',
            description: 'Proctored examination covering Trees, Graphs, Dynamic Programming, and System Design.',
            durationMinutes: 90,
            idleTimeoutSec: 300,
            shufflingMode: 'SEATING',
            createdBy: adminUser.id
        }
    });

    await prisma.question.createMany({
        data: [
            {
                examId: exam.id,
                title: 'Time Complexity of QuickSelect',
                content: 'What is the average-case time complexity of the QuickSelect algorithm for finding the k-th smallest element?',
                type: 'MCQ',
                metadata: JSON.stringify({
                    options: ['O(N^2)', 'O(N log N)', 'O(N)', 'O(log N)'],
                    correctAnswer: 'O(N)',
                    points: 2
                }),
                orderIndex: 1
            },
            {
                examId: exam.id,
                title: 'Implement Invert Binary Tree',
                content: 'Write an efficient function to invert a binary tree in Node.js/Python.',
                type: 'CODING',
                metadata: JSON.stringify({
                    starterCode: 'function invertTree(root) {\n  // Write your code here\n}',
                    testCases: [{ input: '[4,2,7,1,3,6,9]', expected: '[4,7,2,9,6,3,1]' }],
                    points: 10
                }),
                orderIndex: 2
            }
        ]
    });

    await prisma.seatingAssignment.create({
        data: {
            examId: exam.id,
            rollNumber: '241IT004',
            seatRow: 3,
            seatCol: 4,
            seatLabel: 'Lab-A-Row-3-Col-4'
        }
    });

    await prisma.accommodation.create({
        data: {
            examId: exam.id,
            userId: candidateUser.id,
            extraTimeSec: 900,
            approvedBy: adminUser.id,
            notes: 'Approved 15 minutes extra time accommodation'
        }
    });

    console.log('✅ Created exam, questions, seating plan, and accommodations.');
    console.log('🌱 Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
