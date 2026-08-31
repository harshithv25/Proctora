const examDeliveryService = require('./exam-delivery.service');

class ExamDeliveryController {
    async startOrResumeSession(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { examId } = req.body;
            if (!examId) {
                return res.status(400).json({ error: 'examId is required.' });
            }

            const data = await examDeliveryService.startOrResumeSession(candidateId, examId);
            res.status(200).json(data);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async submitDiagnostics(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, browserInfo, webcamPassed, micPassed, bandwidthPassed, remediationNotes } = req.body;
            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required.' });
            }

            const result = await examDeliveryService.recordDiagnostics(candidateId, sessionId, {
                browserInfo, webcamPassed, micPassed, bandwidthPassed, remediationNotes
            });

            res.status(200).json({ message: 'Diagnostics processed', diagnostic: result });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async launchExam(req, res, next) {
        try {
            const { sessionId } = req.body;
            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required.' });
            }

            const session = await examDeliveryService.launchExam(sessionId);
            res.status(200).json({ message: 'Exam session in progress', session });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new ExamDeliveryController();
