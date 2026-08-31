const evaluationExportService = require('./evaluation-export.service');

class EvaluationExportController {
    async autosave(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, questionId, answerText, codeSubmission } = req.body;
            if (!sessionId || !questionId) {
                return res.status(400).json({ error: 'sessionId and questionId are required.' });
            }

            const response = await evaluationExportService.autosaveResponse(
                candidateId, sessionId, questionId, answerText, codeSubmission
            );

            res.status(200).json({ message: 'Response autosaved', response });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async finalizeSubmit(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, responses } = req.body;
            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required.' });
            }

            const session = await evaluationExportService.finalizeSubmission(
                candidateId, sessionId, responses || []
            );

            res.status(200).json({ message: 'Exam submission finalized successfully', session });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async exportCSV(req, res, next) {
        try {
            const { examId } = req.params;
            const csvData = await evaluationExportService.generateCSVReport(examId);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=proctora_exam_${examId}_results.csv`);
            res.status(200).send(csvData);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async exportPDF(req, res, next) {
        try {
            const { examId } = req.params;
            const pdfReport = await evaluationExportService.generatePDFReportData(examId);
            res.status(200).json({ message: 'PDF report payload generated', pdfReport });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new EvaluationExportController();
