const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { generateSecret } = require('otplib');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Proctora Database...');

    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const studentPasswordHash = await bcrypt.hash('student123', 10);

    // Create Admin
    const admin = await prisma.user.upsert({
        where: { email: 'admin@proctora.edu' },
        update: {},
        create: {
            email: 'admin@proctora.edu',
            name: 'Prof. Adarsh Bellamane (Admin)',
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
            twoFactorSecret: generateSecret(),
            twoFactorEnabled: true
        }
    });

    // Create Students
    const student1 = await prisma.user.upsert({
        where: { email: 'candidate@proctora.edu' },
        update: {},
        create: {
            email: 'candidate@proctora.edu',
            name: 'Adarsh Bellamane',
            rollNumber: '241IT004',
            passwordHash: studentPasswordHash,
            role: 'STUDENT',
            twoFactorSecret: generateSecret(),
            twoFactorEnabled: true
        }
    });

    const student2 = await prisma.user.upsert({
        where: { email: 'harshith@proctora.edu' },
        update: {},
        create: {
            email: 'harshith@proctora.edu',
            name: 'Harshith Vellapha',
            rollNumber: '241IT033',
            passwordHash: studentPasswordHash,
            role: 'STUDENT',
            twoFactorSecret: generateSecret(),
            twoFactorEnabled: true
        }
    });

    // Create Sample Exam
    const exam = await prisma.exam.create({
        data: {
            title: 'IT303: Software Engineering & DSA Assessment',
            description: 'Real-Time Proctoring & Coding Examination 2026',
            durationMinutes: 45,
            shufflingMode: 'SEATING',
            createdById: admin.id,
            questions: {
                create: [
                    {
                        title: 'Time Complexity of Binary Search',
                        description: 'What is the worst-case time complexity of binary search on a sorted array of N elements?',
                        type: 'MCQ',
                        optionsJson: JSON.stringify(['O(1)', 'O(log N)', 'O(N)', 'O(N log N)']),
                        correctAnswer: 'O(log N)',
                        points: 2,
                        orderIndex: 1
                    },
                    {
                        title: 'Reverse Words in a String',
                        description: 'Write a function in JavaScript/Python to reverse words in a given string sentence.',
                        type: 'CODING',
                        starterCode: 'function reverseWords(str) {\n    // Write your code here\n    return "";\n}',
                        testCasesJson: JSON.stringify([{ input: '"hello world"', output: '"world hello"' }]),
                        points: 10,
                        orderIndex: 2
                    }
                ]
            }
        }
    });

    // Create Seating Plan
    await prisma.seatingPlan.createMany({
        data: [
            { examId: exam.id, rollNumber: '241IT004', seatRow: 1, seatCol: 1, seatLabel: 'Lab-A-R1-C1' },
            { examId: exam.id, rollNumber: '241IT033', seatRow: 1, seatCol: 2, seatLabel: 'Lab-A-R1-C2' }
        ]
    });

    // Create Accommodation
    await prisma.accommodation.create({
        data: {
            examId: exam.id,
            candidateId: student1.id,
            extraMinutes: 15,
            notes: 'Approved 15-minute extended time accommodation.'
        }
    });

    console.log('Seeding completed successfully!');
    console.log(`Admin User: admin@proctora.edu / admin123`);
    console.log(`Candidate User: candidate@proctora.edu / student123 (Roll: 241IT004)`);
    console.log(`Created Exam ID: ${exam.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
