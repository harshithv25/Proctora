const { prisma } = require('../../config/db');
const { encrypt, decrypt } = require('../../lib/crypto');
const { AppError } = require('../../lib/apiError');

class EvaluationExportService {
    async autosaveResponse(candidateId, sessionId, questionId, answerPayload) {
        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found');

        const encryptedAnswers = encrypt(JSON.stringify(answerPayload));

        const existingResponse = await prisma.examResponse.findFirst({
            where: { sessionId, questionId }
        });

        if (existingResponse) {
            return prisma.examResponse.update({
                where: { id: existingResponse.id },
                data: {
                    answers: encryptedAnswers,
                    submittedVia: 'manual',
                    submittedAt: new Date()
                }
            });
        }

        return prisma.examResponse.create({
            data: {
                examId: session.examId,
                userId: candidateId,
                sessionId,
                questionId,
                answers: encryptedAnswers,
                submittedVia: 'manual'
            }
        });
    }

    async finalizeSubmission(candidateId, sessionId, responses = [], submittedVia = 'manual') {
        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found');

        for (const resp of responses) {
            if (resp.questionId) {
                await this.autosaveResponse(candidateId, sessionId, resp.questionId, resp.answerPayload || resp);
            }
        }

        return prisma.examSession.update({
            where: { id: sessionId },
            data: {
                status: 'COMPLETED',
                endedAt: new Date()
            }
        });
    }

    async generateCSVReport(examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                examSessions: {
                    include: {
                        candidate: true,
                        proctoringEvents: true,
                        focusLogs: true
                    }
                },
                examResponses: true
            }
        });

        if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found');

        const headers = [
            'Candidate Name',
            'Roll Number',
            'Email',
            'Seat Label',
            'Session Status',
            'Focus Loss Count',
            'Fullscreen Exit Count',
            'Max Cheat Score',
            'Responses Count',
            'Started At',
            'Ended At'
        ].join(',');

        const rows = exam.examSessions.map(s => {
            const maxScore = s.proctoringEvents.reduce((max, e) => Math.max(max, e.cheatProbability), 0.0);
            const userResponses = exam.examResponses.filter(r => r.userId === s.candidateId);
            return [
                `"${s.candidate.name}"`,
                `"${s.candidate.rollNumber || 'N/A'}"`,
                `"${s.candidate.email}"`,
                `"${s.seatLabel || 'Unassigned'}"`,
                `"${s.status}"`,
                s.focusLossCount,
                s.fullscreenExitCount,
                maxScore.toFixed(2),
                userResponses.length,
                s.startedAt ? `"${s.startedAt.toISOString()}"` : '"N/A"',
                s.endedAt ? `"${s.endedAt.toISOString()}"` : '"N/A"'
            ].join(',');
        });

        return [headers, ...rows].join('\n');
    }

    async generatePDFReportData(examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                questions: true,
                examSessions: {
                    include: {
                        candidate: true,
                        proctoringEvents: true,
                        alerts: true
                    }
                },
                examResponses: true
            }
        });

        if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found');

        const totalCandidates = exam.examSessions.length;
        const completedCount = exam.examSessions.filter(s => s.status === 'COMPLETED').length;
        const flaggedSessions = exam.examSessions.filter(s => s.alerts.length > 0 || s.proctoringEvents.some(e => e.cheatProbability >= 0.5));

        return {
            examTitle: exam.title,
            examId: exam.id,
            durationMinutes: exam.durationMinutes,
            summary: {
                totalCandidates,
                completedCount,
                flaggedCandidatesCount: flaggedSessions.length
            },
            candidates: exam.examSessions.map(s => ({
                candidateName: s.candidate.name,
                rollNumber: s.candidate.rollNumber,
                status: s.status,
                seatLabel: s.seatLabel,
                focusLossCount: s.focusLossCount,
                fullscreenExitCount: s.fullscreenExitCount,
                alertsCount: s.alerts.length,
                alerts: s.alerts.map(a => ({ type: a.alertType, severity: a.severity, message: a.message }))
            }))
        };
    }
}

module.exports = new EvaluationExportService();
