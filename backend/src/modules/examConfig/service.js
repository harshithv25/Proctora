const { prisma } = require('../../config/db');
const { AppError } = require('../../lib/apiError');

class ExamConfigService {
    async createExam(adminId, examData) {
        const { title, description, durationMinutes, idleTimeoutSec, startTime, endTime, shufflingMode } = examData;

        const exam = await prisma.exam.create({
            data: {
                title,
                description,
                durationMinutes: durationMinutes || 60,
                idleTimeoutSec: idleTimeoutSec || 300,
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                shufflingMode: shufflingMode || 'RANDOM',
                createdBy: adminId
            }
        });

        return exam;
    }

    async getExamList() {
        return prisma.exam.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        questions: true,
                        seatingPlan: true,
                        accommodations: true,
                        examSessions: true
                    }
                }
            }
        });
    }

    async getExamById(examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                questions: { orderBy: { orderIndex: 'asc' } },
                seatingPlan: true,
                accommodations: true
            }
        });

        if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam configuration not found.');
        return exam;
    }

    async getExamQuestions(examId, userId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { questions: { orderBy: { orderIndex: 'asc' } } }
        });

        if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found');

        const candidate = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
        let seating = null;

        if (candidate && candidate.rollNumber) {
            seating = await prisma.seatingAssignment.findUnique({
                where: { examId_rollNumber: { examId, rollNumber: candidate.rollNumber } }
            });
        }

        let questions = exam.questions;
        if (exam.shufflingMode === 'SEATING' && seating) {
            const seed = seating.seatRow * 31 + seating.seatCol * 17;
            questions = [...questions];
            for (let i = questions.length - 1; i > 0; i--) {
                const pseudoRandom = Math.floor(Math.abs(Math.sin(seed + i)) * (i + 1));
                const temp = questions[i];
                questions[i] = questions[pseudoRandom];
                questions[pseudoRandom] = temp;
            }
        }

        return questions.map(q => {
            let parsedMetadata = {};
            if (q.metadata) {
                try { parsedMetadata = JSON.parse(q.metadata); } catch(e) {}
            }
            return {
                id: q.id,
                title: q.title,
                content: q.content,
                type: q.type,
                options: parsedMetadata.options || null,
                starterCode: parsedMetadata.starterCode || null,
                points: parsedMetadata.points || 1,
                orderIndex: q.orderIndex
            };
        });
    }

    async getSessionConfig(examId, userId) {
        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found');

        const accommodation = userId ? await prisma.accommodation.findUnique({
            where: { examId_userId: { examId, userId } }
        }) : null;

        const extraTimeSec = accommodation ? accommodation.extraTimeSec : 0;
        const totalDurationSec = (exam.durationMinutes * 60) + extraTimeSec;

        return {
            examId: exam.id,
            title: exam.title,
            baseDurationMinutes: exam.durationMinutes,
            extraTimeSec,
            totalDurationSec,
            idleTimeoutSec: exam.idleTimeoutSec,
            startTime: exam.startTime,
            endTime: exam.endTime,
            shufflingMode: exam.shufflingMode
        };
    }

    async addQuestionsToExam(examId, questions) {
        await this.getExamById(examId);

        const questionRecords = questions.map((q, index) => ({
            examId,
            title: q.title,
            content: q.description || q.content || q.title,
            type: q.type || 'MCQ',
            metadata: JSON.stringify({
                options: q.options || null,
                correctAnswer: q.correctAnswer || null,
                starterCode: q.starterCode || null,
                testCases: q.testCases || null,
                points: q.points || 1
            }),
            orderIndex: q.orderIndex !== undefined ? q.orderIndex : index + 1
        }));

        await prisma.question.createMany({
            data: questionRecords
        });

        return prisma.question.findMany({
            where: { examId },
            orderBy: { orderIndex: 'asc' }
        });
    }

    async uploadSeatingPlan(examId, seatingEntries) {
        await this.getExamById(examId);

        await prisma.seatingAssignment.deleteMany({ where: { examId } });

        const seatingData = seatingEntries.map((s) => ({
            examId,
            rollNumber: s.rollNumber,
            seatRow: s.seatRow,
            seatCol: s.seatCol,
            seatLabel: s.seatLabel || `Row-${s.seatRow}-Col-${s.seatCol}`,
            questionSetId: s.questionSetId || null
        }));

        await prisma.seatingAssignment.createMany({
            data: seatingData
        });

        return prisma.seatingAssignment.findMany({ where: { examId } });
    }

    async configureAccommodation(examId, candidateUserId, extraTimeSec, approvedByAdminId, notes) {
        await this.getExamById(examId);

        return prisma.accommodation.upsert({
            where: {
                examId_userId: { examId, userId: candidateUserId }
            },
            update: {
                extraTimeSec,
                approvedBy: approvedByAdminId,
                notes
            },
            create: {
                examId,
                userId: candidateUserId,
                extraTimeSec,
                approvedBy: approvedByAdminId,
                notes
            }
        });
    }
}

module.exports = new ExamConfigService();
