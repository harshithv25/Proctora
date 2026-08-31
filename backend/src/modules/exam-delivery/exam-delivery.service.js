const prisma = require('../../lib/prisma');

class ExamDeliveryService {
    // F.2: Device Compatibility Verification
    async recordDiagnostics(candidateId, sessionId, diagnosticData) {
        const { browserInfo, webcamPassed, micPassed, bandwidthPassed, remediationNotes } = diagnosticData;

        const overallStatus = (webcamPassed && micPassed && bandwidthPassed) ? 'PASS' : 'FAIL';

        const record = await prisma.deviceDiagnostic.create({
            data: {
                sessionId,
                candidateId,
                browserInfo: browserInfo || 'Standard Browser',
                webcamPassed: webcamPassed !== false,
                micPassed: micPassed !== false,
                bandwidthPassed: bandwidthPassed !== false,
                status: overallStatus,
                remediationNotes: remediationNotes || (overallStatus === 'FAIL' ? 'Hardware test failed. Check camera & microphone permissions.' : null)
            }
        });

        if (overallStatus === 'PASS') {
            await prisma.examSession.update({
                where: { id: sessionId },
                data: { status: 'DIAGNOSTICS_PASSED' }
            });
        }

        return record;
    }

    // F.3: Question Shuffling based on Seating Plan / Seat Coordinates or pooled randomization
    shuffleQuestionsBySeating(questions, seatRow = 1, seatCol = 1, rollNumber = '') {
        const sorted = [...questions].sort((a, b) => a.id.localeCompare(b.id));

        // Deterministic pseudo-random seed based on seat coordinates and roll number
        let seed = (seatRow * 31 + seatCol * 17);
        if (rollNumber) {
            for (let i = 0; i < rollNumber.length; i++) {
                seed = (seed * 33 + rollNumber.charCodeAt(i)) & 0xffffffff;
            }
        }

        // Fisher-Yates shuffle with deterministic PRNG
        const shuffled = [...sorted];
        for (let i = shuffled.length - 1; i > 0; i--) {
            seed = (seed * 9301 + 49297) % 233280;
            const j = Math.floor((seed / 233280) * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    // F.3 & F.11 & Session initialization
    async startOrResumeSession(candidateId, examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { questions: true }
        });

        if (!exam) throw new Error('Exam not found');

        const candidate = await prisma.user.findUnique({ where: { id: candidateId } });
        if (!candidate) throw new Error('Candidate user not found');

        // Check if accommodation exists
        const accommodation = await prisma.accommodation.findUnique({
            where: { examId_candidateId: { examId, candidateId } }
        });

        const extraMinutes = accommodation ? accommodation.extraMinutes : 0;
        const totalDurationMinutes = exam.durationMinutes + extraMinutes;

        // Check seating plan
        let seatLabel = 'UNASSIGNED';
        let seatRow = 1;
        let seatCol = 1;

        if (candidate.rollNumber) {
            const seating = await prisma.seatingPlan.findUnique({
                where: { examId_rollNumber: { examId, rollNumber: candidate.rollNumber } }
            });
            if (seating) {
                seatLabel = seating.seatLabel;
                seatRow = seating.seatRow;
                seatCol = seating.seatCol;
            }
        }

        // Find or create session
        let session = await prisma.examSession.findFirst({
            where: { examId, candidateId, status: { notIn: ['COMPLETED', 'TERMINATED'] } }
        });

        if (!session) {
            // Shuffle questions according to mode
            let shuffledQuestions = exam.questions;
            if (exam.shufflingMode === 'SEATING') {
                shuffledQuestions = this.shuffleQuestionsBySeating(exam.questions, seatRow, seatCol, candidate.rollNumber || '');
            } else {
                // Random shuffle per candidate
                shuffledQuestions = [...exam.questions].sort(() => Math.random() - 0.5);
            }

            const assignedQuestionIds = shuffledQuestions.map(q => q.id);

            session = await prisma.examSession.create({
                data: {
                    examId,
                    candidateId,
                    seatLabel,
                    status: 'NOT_STARTED',
                    assignedQuestionsJson: JSON.stringify(assignedQuestionIds)
                }
            });
        }

        // Parse assigned questions
        const assignedIds = session.assignedQuestionsJson ? JSON.parse(session.assignedQuestionsJson) : [];
        const questionMap = new Map(exam.questions.map(q => [q.id, q]));
        const orderedQuestions = assignedIds.map(id => questionMap.get(id)).filter(Boolean);

        return {
            session,
            exam: {
                id: exam.id,
                title: exam.title,
                description: exam.description,
                baseDurationMinutes: exam.durationMinutes,
                extraMinutes,
                totalDurationMinutes,
                startTime: exam.startTime,
                endTime: exam.endTime,
                shufflingMode: exam.shufflingMode
            },
            seatLabel,
            seatCoordinates: { row: seatRow, col: seatCol },
            questions: orderedQuestions.map(q => ({
                id: q.id,
                title: q.title,
                description: q.description,
                type: q.type,
                options: q.optionsJson ? JSON.parse(q.optionsJson) : null,
                starterCode: q.starterCode,
                points: q.points
            }))
        };
    }

    async launchExam(sessionId) {
        const session = await prisma.examSession.update({
            where: { id: sessionId },
            data: {
                status: 'IN_PROGRESS',
                startedAt: new Date()
            }
        });
        return session;
    }
}

module.exports = new ExamDeliveryService();
