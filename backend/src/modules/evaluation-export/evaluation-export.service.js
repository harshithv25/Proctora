const prisma = require('../../lib/prisma');

class EvaluationExportService {
    // F.7: Continuous response autosave
    async autosaveResponse(candidateId, sessionId, questionId, answerText, codeSubmission) {
        const session = await prisma.examSession.findFirst({
            where: { id: sessionId, candidateId }
        });

        if (!session) throw new Error('Session not found or invalid');
        if (['COMPLETED', 'TERMINATED', 'AUTOLOGOUT'].includes(session.status)) {
            throw new Error('Cannot autosave. Exam session has ended.');
        }

        const response = await prisma.response.upsert({
            where: {
                sessionId_questionId: { sessionId, questionId }
            },
            update: {
                answerText: answerText !== undefined ? answerText : undefined,
                codeSubmission: codeSubmission !== undefined ? codeSubmission : undefined,
                isAutoSaved: true,
                submittedAt: new Date()
            },
            create: {
                sessionId,
                candidateId,
                questionId,
                answerText,
                codeSubmission,
                isAutoSaved: true
            }
        });

        await prisma.examSession.update({
            where: { id: sessionId },
            data: { lastActivityAt: new Date() }
        });

        return response;
    }

    // F.7: Finalize exam submission (manual submit or timer expiry)
    async finalizeSubmission(candidateId, sessionId, finalResponses = []) {
        const session = await prisma.examSession.findFirst({
            where: { id: sessionId, candidateId },
            include: { exam: { include: { questions: true } } }
        });

        if (!session) throw new Error('Exam session not found');

        // Upsert final responses if provided
        for (const resp of finalResponses) {
            if (resp.questionId) {
                await prisma.response.upsert({
                    where: {
                        sessionId_questionId: { sessionId, questionId: resp.questionId }
                    },
                    update: {
                        answerText: resp.answerText || null,
                        codeSubmission: resp.codeSubmission || null,
                        isAutoSaved: false,
                        submittedAt: new Date()
                    },
                    create: {
                        sessionId,
                        candidateId,
                        questionId: resp.questionId,
                        answerText: resp.answerText || null,
                        codeSubmission: resp.codeSubmission || null,
                        isAutoSaved: false
                    }
                });
            }
        }

        const updatedSession = await prisma.examSession.update({
            where: { id: sessionId },
            data: {
                status: 'COMPLETED',
                endedAt: new Date()
            }
        });

        return updatedSession;
    }

    // F.9: Export CSV results for an exam
    async generateCSVReport(examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                sessions: {
                    include: {
                        candidate: selectCandidateFields(),
                        responses: { include: { question: true } },
                        proctorLogs: true,
                        alerts: true
                    }
                }
            }
        });

        if (!exam) throw new Error('Exam not found');

        const headers = [
            'Candidate Name',
            'Roll Number',
            'Email',
            'Seat Label',
            'Status',
            'Started At',
            'Ended At',
            'Focus Loss Count',
            'Fullscreen Exit Count',
            'Max Cheating Score (%)',
            'Total Alerts',
            'Responses Saved'
        ];

        const rows = [headers.join(',')];

        for (const s of exam.sessions) {
            const maxCheating = s.proctorLogs.reduce((max, log) => Math.max(max, log.cheatingScore || 0), 0);
            const row = [
                `"${s.candidate.name}"`,
                `"${s.candidate.rollNumber || 'N/A'}"`,
                `"${s.candidate.email}"`,
                `"${s.seatLabel || 'N/A'}"`,
                `"${s.status}"`,
                `"${s.startedAt ? s.startedAt.toISOString() : 'N/A'}"`,
                `"${s.endedAt ? s.endedAt.toISOString() : 'N/A'}"`,
                s.focusLossCount,
                s.fullscreenViolationsCount,
                (maxCheating * 100).toFixed(1),
                s.alerts.length,
                s.responses.length
            ];
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    // F.9: Export PDF report data format (structured for client rendering or downloading)
    async generatePDFReportData(examId) {
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                questions: true,
                sessions: {
                    include: {
                        candidate: selectCandidateFields(),
                        responses: { include: { question: true } },
                        proctorLogs: true,
                        alerts: true,
                        focusLogs: true
                    }
                }
            }
        });

        if (!exam) throw new Error('Exam not found');

        return {
            title: exam.title,
            description: exam.description,
            generatedAt: new Date().toISOString(),
            totalCandidates: exam.sessions.length,
            sessions: exam.sessions.map(s => {
                const maxCheatingScore = s.proctorLogs.reduce((m, l) => Math.max(m, l.cheatingScore || 0), 0);
                return {
                    sessionId: s.id,
                    candidateName: s.candidate.name,
                    rollNumber: s.candidate.rollNumber,
                    email: s.candidate.email,
                    seatLabel: s.seatLabel,
                    status: s.status,
                    focusLossCount: s.focusLossCount,
                    fullscreenViolationsCount: s.fullscreenViolationsCount,
                    maxCheatingScore: Number((maxCheatingScore * 100).toFixed(1)),
                    alertsCount: s.alerts.length,
                    responses: s.responses.map(r => ({
                        questionTitle: r.question.title,
                        questionType: r.question.type,
                        answerText: r.answerText,
                        codeSubmission: r.codeSubmission
                    }))
                };
            })
        };
    }
}

function selectCandidateFields() {
    return { select: { id: true, name: true, rollNumber: true, email: true } };
}

module.exports = new EvaluationExportService();
