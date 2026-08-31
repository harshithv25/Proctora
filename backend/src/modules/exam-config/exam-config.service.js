const prisma = require('../../lib/prisma');

class ExamConfigService {
    async createExam(adminId, data) {
        const { title, description, durationMinutes, startTime, endTime, shufflingMode } = data;

        return await prisma.exam.create({
            data: {
                title,
                description,
                durationMinutes: Number(durationMinutes) || 60,
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                shufflingMode: shufflingMode || 'RANDOM',
                createdById: adminId
            }
        });
    }

    async getExamList() {
        return await prisma.exam.findMany({
            include: {
                _count: {
                    select: { questions: true, seatingPlans: true, accommodations: true, sessions: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getExamById(examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                questions: { orderBy: { orderIndex: 'asc' } },
                seatingPlans: true,
                accommodations: { include: { candidate: { select: { id: true, name: true, rollNumber: true, email: true } } } }
            }
        });

        if (!exam) throw new Error('Exam not found');
        return exam;
    }

    async addQuestionsToExam(examId, questions) {
        const createdQuestions = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const created = await prisma.question.create({
                data: {
                    examId,
                    title: q.title,
                    description: q.description,
                    type: q.type || 'MCQ',
                    optionsJson: q.options ? JSON.stringify(q.options) : null,
                    correctAnswer: q.correctAnswer || null,
                    starterCode: q.starterCode || null,
                    testCasesJson: q.testCases ? JSON.stringify(q.testCases) : null,
                    points: q.points ? Number(q.points) : 1,
                    orderIndex: i + 1
                }
            });
            createdQuestions.push(created);
        }
        return createdQuestions;
    }

    async uploadSeatingPlan(examId, seatingEntries) {
        // seatingEntries = Array of { rollNumber, seatRow, seatCol, seatLabel }
        const createdPlans = [];

        // Clear existing seating plan for this exam first
        await prisma.seatingPlan.deleteMany({ where: { examId } });

        for (const entry of seatingEntries) {
            const plan = await prisma.seatingPlan.create({
                data: {
                    examId,
                    rollNumber: String(entry.rollNumber).trim(),
                    seatRow: Number(entry.seatRow) || 1,
                    seatCol: Number(entry.seatCol) || 1,
                    seatLabel: entry.seatLabel || `R${entry.seatRow}-C${entry.seatCol}`
                }
            });
            createdPlans.push(plan);
        }

        return createdPlans;
    }

    async configureAccommodation(examId, candidateId, extraMinutes, notes) {
        const candidate = await prisma.user.findUnique({ where: { id: candidateId } });
        if (!candidate) throw new Error('Candidate user not found.');

        return await prisma.accommodation.upsert({
            where: {
                examId_candidateId: { examId, candidateId }
            },
            update: {
                extraMinutes: Number(extraMinutes),
                notes
            },
            create: {
                examId,
                candidateId,
                extraMinutes: Number(extraMinutes),
                notes
            }
        });
    }
}

module.exports = new ExamConfigService();
