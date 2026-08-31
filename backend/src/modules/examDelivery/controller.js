const examDeliveryService = require('./service');

class ExamDeliveryController {
    async submitDiagnostics(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, browserInfo, webcamPassed, micPassed, bandwidthPassed, remediationNotes } = req.body;
            const diagnostic = await examDeliveryService.recordDiagnostics(
                candidateId,
                sessionId,
                { browserInfo, webcamPassed, micPassed, bandwidthPassed, remediationNotes }
            );

            res.status(200).json({ message: 'Diagnostics recorded successfully', diagnostic });
        } catch (err) {
            next(err);
        }
    }

    async startSession(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { examId } = req.body;
            const payload = await examDeliveryService.startOrResumeSession(candidateId, examId);
            res.status(200).json(payload);
        } catch (err) {
            next(err);
        }
    }

    async launchExam(req, res, next) {
        try {
            const { sessionId } = req.body;
            const session = await examDeliveryService.launchExam(sessionId);
            res.status(200).json({ message: 'Exam launched successfully', session });
        } catch (err) {
            next(err);
        }
    }

    async autoLogoutSession(req, res, next) {
        try {
            const { examId, userId } = req.params;
            const { reason } = req.body;
            const session = await examDeliveryService.autoLogoutUserSession(examId, userId, reason);
            res.status(200).json({ message: 'Session auto-logged out successfully', session });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ExamDeliveryController();
