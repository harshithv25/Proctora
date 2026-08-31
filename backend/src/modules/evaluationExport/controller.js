const evaluationExportService = require('./service');

class EvaluationExportController {
    async autosave(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, questionId, answerText, codeSubmission, answerPayload } = req.body;
            const payload = answerPayload || { answerText, codeSubmission };
            const response = await evaluationExportService.autosaveResponse(
                candidateId, sessionId, questionId, payload
            );

            res.status(200).json({ message: 'Response autosaved', response });
        } catch (err) {
            next(err);
        }
    }

    async finalizeSubmit(req, res, next) {
        try {
            const candidateId = req.user.id;
            const { sessionId, responses } = req.body;
            const session = await evaluationExportService.finalizeSubmission(
                candidateId, sessionId, responses || []
            );

            res.status(200).json({ message: 'Exam submission finalized successfully', session });
        } catch (err) {
            next(err);
        }
    }

    async exportCSV(req, res, next) {
        try {
            const examId = req.query.examId || req.params.examId;
            const csvData = await evaluationExportService.generateCSVReport(examId);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=proctora_exam_${examId}_results.csv`);
            res.status(200).send(csvData);
        } catch (err) {
            next(err);
        }
    }

    async exportPDF(req, res, next) {
        try {
            const examId = req.query.examId || req.params.examId;
            const pdfReport = await evaluationExportService.generatePDFReportData(examId);
            res.status(200).json({ message: 'PDF report payload generated', pdfReport });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new EvaluationExportController();
