const { prisma } = require('../../config/db');
const { encrypt } = require('../../lib/crypto');
const { AppError } = require('../../lib/apiError');

class IntegrityMonitoringService {
    async logProctorFrame(candidateId, sessionId, frameData) {
        const { gazeAway, multipleFaces, noFace, headPoseAngle, lowLight, rawMetrics } = frameData;

        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');

        let frameScore = 0.0;
        if (gazeAway) frameScore += 0.35;
        if (multipleFaces) frameScore += 0.50;
        if (noFace) frameScore += 0.40;
        if (headPoseAngle && Math.abs(headPoseAngle) > 30) frameScore += 0.25;
        if (lowLight) frameScore += 0.10;

        const calculatedCheatingScore = Math.min(1.0, frameScore);
        const windowStart = new Date(Date.now() - 5000);
        const windowEnd = new Date();

        const recentLogs = await prisma.proctoringEvent.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
            take: 9
        });

        const scoreSum = recentLogs.reduce((acc, log) => acc + log.cheatProbability, calculatedCheatingScore);
        const rollingWindowScore = scoreSum / (recentLogs.length + 1);

        const flagged = rollingWindowScore >= 0.50 || multipleFaces || noFace;

        const rawDataString = JSON.stringify({ ...frameData, timestamp: new Date() });
        const detailsEncrypted = encrypt(rawDataString);

        const proctoringEvent = await prisma.proctoringEvent.create({
            data: {
                examId: session.examId,
                sessionId,
                userId: candidateId,
                cheatProbability: parseFloat(rollingWindowScore.toFixed(3)),
                windowStart,
                windowEnd,
                flagged,
                detailsEncrypted
            }
        });

        await prisma.examSession.update({
            where: { id: sessionId },
            data: { lastActivityAt: new Date() }
        });

        let alertTriggered = null;
        if (rollingWindowScore >= 0.70) {
            alertTriggered = await prisma.proctorAlert.create({
                data: {
                    examId: session.examId,
                    sessionId,
                    userId: candidateId,
                    alertType: 'HIGH_CHEATING_SCORE',
                    severity: 'CRITICAL',
                    message: `High cheating probability detected (Score: ${rollingWindowScore.toFixed(2)}).`
                }
            });
        }

        return {
            event: proctoringEvent,
            rollingWindowScore: parseFloat(rollingWindowScore.toFixed(3)),
            alert: alertTriggered
        };
    }

    async logEditorTelemetry(candidateId, sessionId, questionId, eventType, payload) {
        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');

        const telemetry = await prisma.editorTelemetryEvent.create({
            data: {
                examId: session.examId,
                sessionId,
                userId: candidateId,
                questionId: questionId || null,
                eventType,
                payload: typeof payload === 'string' ? payload : JSON.stringify(payload)
            }
        });

        await prisma.examSession.update({
            where: { id: sessionId },
            data: { lastActivityAt: new Date() }
        });

        return telemetry;
    }

    async logBrowserFocusEvent(candidateId, sessionId, eventType) {
        const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');

        const focusLog = await prisma.focusLog.create({
            data: {
                examId: session.examId,
                sessionId,
                userId: candidateId,
                eventType
            }
        });

        let updatedFocusCount = session.focusLossCount;
        let updatedFullscreenCount = session.fullscreenExitCount;

        if (['BLUR', 'VISIBILITY_HIDDEN', 'blur', 'visibility_hidden'].includes(eventType)) {
            updatedFocusCount += 1;
        } else if (['FULLSCREEN_EXIT', 'fullscreen_exit'].includes(eventType)) {
            updatedFullscreenCount += 1;
        }

        await prisma.examSession.update({
            where: { id: sessionId },
            data: {
                focusLossCount: updatedFocusCount,
                fullscreenExitCount: updatedFullscreenCount,
                lastActivityAt: new Date()
            }
        });

        let alert = null;
        if (updatedFocusCount >= 3 || updatedFullscreenCount >= 3) {
            alert = await prisma.proctorAlert.create({
                data: {
                    examId: session.examId,
                    sessionId,
                    userId: candidateId,
                    alertType: eventType.includes('FULLSCREEN') ? 'FULLSCREEN_EXIT' : 'FOCUS_LOSS_EXCEEDED',
                    severity: 'WARNING',
                    message: `Candidate focus/fullscreen violations threshold reached (Focus: ${updatedFocusCount}, Fullscreen Exits: ${updatedFullscreenCount}).`
                }
            });
        }

        return { focusLog, focusLossCount: updatedFocusCount, fullscreenExitCount: updatedFullscreenCount, alert };
    }

    async checkAndLogoutIdleSessions(maxIdleSeconds = 300) {
        const cutoffTime = new Date(Date.now() - maxIdleSeconds * 1000);

        const idleSessions = await prisma.examSession.findMany({
            where: {
                status: 'IN_PROGRESS',
                lastActivityAt: { lt: cutoffTime }
            }
        });

        const terminatedSessions = [];
        for (const session of idleSessions) {
            const updated = await prisma.examSession.update({
                where: { id: session.id },
                data: {
                    status: 'AUTOLOGOUT',
                    endedAt: new Date()
                }
            });

            await prisma.proctorAlert.create({
                data: {
                    examId: session.examId,
                    sessionId: session.id,
                    userId: session.candidateId,
                    alertType: 'IDLE_TIMEOUT',
                    severity: 'CRITICAL',
                    message: `Session auto-logged out due to inactivity exceeding ${maxIdleSeconds} seconds.`
                }
            });

            terminatedSessions.push(updated);
        }

        return terminatedSessions;
    }

    async getSessionTelemetryPlayback(sessionId) {
        const session = await prisma.examSession.findUnique({
            where: { id: sessionId },
            include: { candidate: true, exam: true }
        });

        if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Exam session not found');

        const proctoringEvents = await prisma.proctoringEvent.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' }
        });

        const editorTelemetry = await prisma.editorTelemetryEvent.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' }
        });

        const focusLogs = await prisma.focusLog.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' }
        });

        const alerts = await prisma.proctorAlert.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' }
        });

        return {
            session,
            proctoringEvents,
            editorTelemetry,
            focusLogs,
            alerts
        };
    }
}

module.exports = new IntegrityMonitoringService();
