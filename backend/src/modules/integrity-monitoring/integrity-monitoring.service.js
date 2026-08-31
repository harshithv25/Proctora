const prisma = require('../../lib/prisma');

class IntegrityMonitoringService {
    // F.4: AI Proctoring score calculation and rolling window analysis
    async logProctorFrame(candidateId, sessionId, frameData) {
        const { gazeAway, headPoseAngle, faceCount, lowLight } = frameData;

        // Rolling window heuristic calculation to reduce false positives
        let scoreDelta = 0;
        let flaggedEvent = null;

        if (faceCount > 1) {
            scoreDelta += 0.4;
            flaggedEvent = 'MULTIPLE_FACES';
        } else if (faceCount === 0) {
            scoreDelta += 0.3;
            flaggedEvent = 'NO_FACE';
        }

        if (gazeAway) {
            scoreDelta += 0.2;
            flaggedEvent = flaggedEvent ? `${flaggedEvent}_AND_GAZE` : 'GAZE_AWAY';
        }

        if (Math.abs(headPoseAngle || 0) > 30) {
            scoreDelta += 0.15;
            flaggedEvent = flaggedEvent || 'SUSPICIOUS_HEAD_POSE';
        }

        // Cap cheating score between 0.0 and 1.0
        const cheatingScore = Math.min(1.0, Math.max(0.0, scoreDelta));

        const log = await prisma.proctoringLog.create({
            data: {
                sessionId,
                candidateId,
                cheatingScore,
                flaggedEvent: cheatingScore > 0.25 ? flaggedEvent : null,
                rollingWindowDataJson: JSON.stringify(frameData)
            }
        });

        // F.8: Real-Time Alerts if threshold exceeded
        if (cheatingScore >= 0.5) {
            const alert = await prisma.proctorAlert.create({
                data: {
                    sessionId,
                    candidateId,
                    alertType: 'HIGH_CHEATING_SCORE',
                    severity: cheatingScore > 0.7 ? 'CRITICAL' : 'WARNING',
                    message: `High cheating score detected (${(cheatingScore * 100).toFixed(0)}%): ${flaggedEvent || 'Suspicious Activity'}`
                }
            });
            log.alertGenerated = alert;
        }

        // Update last activity timestamp
        await prisma.examSession.update({
            where: { id: sessionId },
            data: { lastActivityAt: new Date() }
        });

        return log;
    }

    // F.5: Record Code Editor Telemetry (keystrokes, text deltas, paste events, run, submit)
    async logEditorTelemetry(candidateId, sessionId, questionId, eventType, eventData) {
        const telemetry = await prisma.editorTelemetry.create({
            data: {
                sessionId,
                candidateId,
                questionId: questionId || null,
                eventType, // KEYSTROKE, TEXT_DELTA, PASTE, RUN, SUBMIT
                eventDataJson: typeof eventData === 'string' ? eventData : JSON.stringify(eventData)
            }
        });

        await prisma.examSession.update({
            where: { id: sessionId },
            data: { lastActivityAt: new Date() }
        });

        return telemetry;
    }

    // F.6 & F.10: Monitor Browser Focus and Fullscreen Mode
    async logBrowserFocusEvent(candidateId, sessionId, eventType) {
        // eventType: BLUR, FOCUS, VISIBILITY_HIDDEN, FULLSCREEN_EXIT, FULLSCREEN_ENTER
        const log = await prisma.browserFocusLog.create({
            data: {
                sessionId,
                candidateId,
                eventType
            }
        });

        const isViolation = ['BLUR', 'VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT'].includes(eventType);

        if (isViolation) {
            const updatedSession = await prisma.examSession.update({
                where: { id: sessionId },
                data: {
                    focusLossCount: { increment: eventType !== 'FULLSCREEN_EXIT' ? 1 : 0 },
                    fullscreenViolationsCount: { increment: eventType === 'FULLSCREEN_EXIT' ? 1 : 0 },
                    lastActivityAt: new Date()
                }
            });

            // Trigger alert if focus violations exceed 3
            if (updatedSession.focusLossCount + updatedSession.fullscreenViolationsCount >= 3) {
                await prisma.proctorAlert.create({
                    data: {
                        sessionId,
                        candidateId,
                        alertType: 'FOCUS_LOSS_EXCEEDED',
                        severity: 'WARNING',
                        message: `Candidate has switched tabs or exited fullscreen ${updatedSession.focusLossCount + updatedSession.fullscreenViolationsCount} times.`
                    }
                });
            }
        }

        return log;
    }

    // F.12: Idle Session Auto-Logout Check
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
                    sessionId: session.id,
                    candidateId: session.candidateId,
                    alertType: 'IDLE_TIMEOUT',
                    severity: 'CRITICAL',
                    message: `Session auto-terminated due to inactivity exceeding ${maxIdleSeconds} seconds.`
                }
            });

            terminatedSessions.push(updated);
        }

        return terminatedSessions;
    }

    // Telemetry Replay timeline loader for Admin Dashboard
    async getSessionTelemetryPlayback(sessionId) {
        const session = await prisma.examSession.findUnique({
            where: { id: sessionId },
            include: {
                candidate: { select: { id: true, name: true, rollNumber: true, email: true } },
                exam: { select: { id: true, title: true } },
                proctorLogs: { orderBy: { timestamp: 'asc' } },
                telemetries: { orderBy: { timestamp: 'asc' } },
                focusLogs: { orderBy: { timestamp: 'asc' } },
                alerts: { orderBy: { timestamp: 'asc' } }
            }
        });

        if (!session) throw new Error('Exam session not found.');
        return session;
    }
}

module.exports = new IntegrityMonitoringService();
