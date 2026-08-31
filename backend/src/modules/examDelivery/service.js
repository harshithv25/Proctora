const { prisma } = require('../../config/db');
const { AppError } = require('../../lib/apiError');
const { encrypt } = require('../../lib/crypto');

class ExamDeliveryService {
    async recordDiagnostics(candidateId, sessionId, diagnosticData) {
        const { browserInfo, webcamPassed, micPassed, bandwidthPassed, remediationNotes } = diagnosticData;

        const allPassed = webcamPassed && micPassed && bandwidthPassed;
        const status = allPassed ? 'PASS' : 'FAIL';

        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });

        const diagnostic = await prisma.deviceDiagnostic.create({
            data: {
                examId: session ? session.examId : null,
                sessionId,
                candidateId,
                browserInfo: browserInfo || 'Unknown Browser',
                webcamPassed: !!webcamPassed,
                micPassed: !!micPassed,
                bandwidthPassed: !!bandwidthPassed,
                status,
                remediationNotes: remediationNotes || null
            }
        });

        if (allPassed && session) {
            await prisma.examSession.update({
                where: { id: sessionId },
                data: { status: 'DIAGNOSTICS_PASSED' }
            });
        }

        return diagnostic;
    }

    shuffleQuestionsBySeating(questions, seatRow, seatCol, rollNumber) {
        const seed = seatRow * 31 + seatCol * 17 + (rollNumber ? rollNumber.charCodeAt(rollNumber.length - 1) : 0);
        const shuffled = [...questions];

        for (let i = shuffled.length - 1; i > 0; i--) {
            const pseudoRandom = Math.floor(Math.abs(Math.sin(seed + i)) * (i + 1));
            const temp = shuffled[i];
            shuffled[i] = shuffled[pseudoRandom];
            shuffled[pseudoRandom] = temp;
        }

        return shuffled;
    }

    async startOrResumeSession(candidateId, examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { questions: { orderBy: { orderIndex: 'asc' } } }
        });

        if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found');

        const candidate = await prisma.user.findUnique({
            where: { id: candidateId }
        });

        let session = await prisma.examSession.findFirst({
            where: {
                examId,
                candidateId
            }
        });

        const seatingAssignment = candidate?.rollNumber ? await prisma.seatingAssignment.findUnique({
            where: {
                examId_rollNumber: {
                    examId,
                    rollNumber: candidate.rollNumber
                }
            }
        }) : null;

        const accommodation = await prisma.accommodation.findUnique({
            where: {
                examId_userId: {
                    examId,
                    userId: candidateId
                }
            }
        });

        const extraTimeSec = accommodation ? accommodation.extraTimeSec : 0;
        const totalDurationSec = (exam.durationMinutes * 60) + extraTimeSec;

        let shuffledQuestions = exam.questions;
        if (exam.shufflingMode === 'SEATING' && seatingAssignment) {
            shuffledQuestions = this.shuffleQuestionsBySeating(
                exam.questions,
                seatingAssignment.seatRow,
                seatingAssignment.seatCol,
                candidate.rollNumber
            );
        }

        const assignedQuestionIds = shuffledQuestions.map(q => q.id);

        if (!session) {
            session = await prisma.examSession.create({
                data: {
                    examId,
                    candidateId,
                    status: 'NOT_STARTED',
                    seatLabel: seatingAssignment ? seatingAssignment.seatLabel : null,
                    assignedQuestions: JSON.stringify(assignedQuestionIds),
                    lastActivityAt: new Date()
                }
            });
        }

        const sanitizeQuestions = shuffledQuestions.map(q => {
            let meta = {};
            if (q.metadata) {
                try { meta = JSON.parse(q.metadata); } catch(e) {}
            }
            return {
                id: q.id,
                title: q.title,
                content: q.content,
                type: q.type,
                options: meta.options || null,
                starterCode: meta.starterCode || null,
                points: meta.points || 1
            };
        });

        return {
            session,
            exam: {
                id: exam.id,
                title: exam.title,
                description: exam.description,
                baseDurationMinutes: exam.durationMinutes,
                extraTimeSec,
                totalDurationSec,
                idleTimeoutSec: exam.idleTimeoutSec,
                startTime: exam.startTime,
                endTime: exam.endTime,
                shufflingMode: exam.shufflingMode
            },
            seatLabel: seatingAssignment ? seatingAssignment.seatLabel : 'Unassigned',
            seatCoordinates: seatingAssignment ? { row: seatingAssignment.seatRow, col: seatingAssignment.seatCol } : null,
            questions: sanitizeQuestions
        };
    }

    async launchExam(sessionId) {
        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found');

        return prisma.examSession.update({
            where: { id: sessionId },
            data: {
                status: 'IN_PROGRESS',
                startedAt: session.startedAt || new Date(),
                lastActivityAt: new Date()
            }
        });
    }

    async autoLogoutUserSession(examId, targetUserId, reason = 'timer_expiry') {
        const session = await prisma.examSession.findFirst({
            where: { examId, candidateId: targetUserId, status: 'IN_PROGRESS' }
        });

        if (!session) {
            throw new AppError(404, 'ACTIVE_SESSION_NOT_FOUND', 'No active session found to auto-logout.');
        }

        const updatedSession = await prisma.examSession.update({
            where: { id: session.id },
            data: {
                status: 'AUTOLOGOUT',
                endedAt: new Date()
            }
        });

        const encryptedAnswers = encrypt(JSON.stringify({ autoLogoutReason: reason, timestamp: new Date() }));

        await prisma.examResponse.create({
            data: {
                examId,
                userId: targetUserId,
                sessionId: session.id,
                answers: encryptedAnswers,
                submittedVia: 'auto_logout'
            }
        });

        await prisma.proctorAlert.create({
            data: {
                examId,
                sessionId: session.id,
                userId: targetUserId,
                alertType: 'IDLE_TIMEOUT',
                severity: 'CRITICAL',
                message: `Session auto-terminated (${reason}).`
            }
        });

        return updatedSession;
    }
}

module.exports = new ExamDeliveryService();
