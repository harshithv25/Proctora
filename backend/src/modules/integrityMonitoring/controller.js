const integrityMonitoringService = require('./service');

class IntegrityMonitoringController {
    async processProctorFrame(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, gazeAway, multipleFaces, noFace, headPoseAngle, lowLight, rawMetrics } = req.body;
            const result = await integrityMonitoringService.logProctorFrame(
                candidateId,
                sessionId,
                { gazeAway, multipleFaces, noFace, headPoseAngle, lowLight, rawMetrics }
            );

            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    }

    async recordEditorTelemetry(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, questionId, eventType, eventData } = req.body;
            const telemetry = await integrityMonitoringService.logEditorTelemetry(
                candidateId, sessionId, questionId, eventType, eventData
            );

            res.status(200).json({ message: 'Telemetry logged', telemetry });
        } catch (err) {
            next(err);
        }
    }

    async recordFocusEvent(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, eventType } = req.body;
            const result = await integrityMonitoringService.logBrowserFocusEvent(
                candidateId, sessionId, eventType
            );

            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    }

    async getPlayback(req, res, next) {
        try {
            const { sessionId } = req.params;
            const playback = await integrityMonitoringService.getSessionTelemetryPlayback(sessionId);
            res.status(200).json(playback);
        } catch (err) {
            next(err);
        }
    }

    async triggerIdleCheck(req, res, next) {
        try {
            const { maxIdleSeconds } = req.body;
            const terminated = await integrityMonitoringService.checkAndLogoutIdleSessions(maxIdleSeconds || 300);
            res.status(200).json({ message: 'Idle session check completed', terminatedSessionsCount: terminated.length, terminated });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new IntegrityMonitoringController();
