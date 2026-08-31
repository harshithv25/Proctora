const integrityMonitoringService = require('./integrity-monitoring.service');

class IntegrityMonitoringController {
    async logProctorFrame(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, gazeAway, headPoseAngle, faceCount, lowLight } = req.body;
            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required.' });
            }

            const log = await integrityMonitoringService.logProctorFrame(candidateId, sessionId, {
                gazeAway: Boolean(gazeAway),
                headPoseAngle: Number(headPoseAngle) || 0,
                faceCount: Number(faceCount) !== undefined ? Number(faceCount) : 1,
                lowLight: Boolean(lowLight)
            });

            res.status(200).json({ message: 'Proctor frame logged', log });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async logTelemetry(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, questionId, eventType, eventData } = req.body;
            if (!sessionId || !eventType) {
                return res.status(400).json({ error: 'sessionId and eventType are required.' });
            }

            const telemetry = await integrityMonitoringService.logEditorTelemetry(
                candidateId, sessionId, questionId, eventType, eventData
            );

            res.status(200).json({ message: 'Telemetry event recorded', telemetry });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async logFocusEvent(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, eventType } = req.body;
            if (!sessionId || !eventType) {
                return res.status(400).json({ error: 'sessionId and eventType are required.' });
            }

            const log = await integrityMonitoringService.logBrowserFocusEvent(candidateId, sessionId, eventType);
            res.status(200).json({ message: 'Focus event logged', log });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async getPlayback(req, res, next) {
        try {
            const { sessionId } = req.params;
            const playback = await integrityMonitoringService.getSessionTelemetryPlayback(sessionId);
            res.status(200).json({ playback });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    }

    async triggerAutoLogoutCheck(req, res, next) {
        try {
            const maxIdleSeconds = req.body.maxIdleSeconds || 300;
            const terminated = await integrityMonitoringService.checkAndLogoutIdleSessions(maxIdleSeconds);
            res.status(200).json({ message: `Auto-logout check complete (${terminated.length} sessions logged out)`, terminatedCount: terminated.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new IntegrityMonitoringController();
