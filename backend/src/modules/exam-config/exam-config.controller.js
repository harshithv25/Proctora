const examConfigService = require('./exam-config.service');

class ExamConfigController {
    async createExam(req, res, next) {
        try {
            const adminId = req.user.id;
            const exam = await examConfigService.createExam(adminId, req.body);
            res.status(201).json({ message: 'Exam created successfully', exam });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async getExams(req, res, next) {
        try {
            const exams = await examConfigService.getExamList();
            res.status(200).json({ exams });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async getExamDetails(req, res, next) {
        try {
            const { examId } = req.params;
            const exam = await examConfigService.getExamById(examId);
            res.status(200).json({ exam });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    }

    async uploadQuestions(req, res, next) {
        try {
            const { examId } = req.params;
            const { questions } = req.body;
            if (!Array.isArray(questions) || questions.length === 0) {
                return res.status(400).json({ error: 'Questions array is required.' });
            }

            const created = await examConfigService.addQuestionsToExam(examId, questions);
            res.status(201).json({ message: `${created.length} questions uploaded successfully`, questions: created });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async uploadSeatingPlan(req, res, next) {
        try {
            const { examId } = req.params;
            const { seatingPlan } = req.body; // Array of { rollNumber, seatRow, seatCol, seatLabel }
            if (!Array.isArray(seatingPlan)) {
                return res.status(400).json({ error: 'Seating plan array is required.' });
            }

            const plans = await examConfigService.uploadSeatingPlan(examId, seatingPlan);
            res.status(200).json({ message: `Seating plan updated (${plans.length} seats mapped)`, seatingPlan: plans });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async addAccommodation(req, res, next) {
        try {
            const { examId } = req.params;
            const { candidateId, extraMinutes, notes } = req.body;
            if (!candidateId || extraMinutes === undefined) {
                return res.status(400).json({ error: 'candidateId and extraMinutes are required.' });
            }

            const accommodation = await examConfigService.configureAccommodation(examId, candidateId, extraMinutes, notes);
            res.status(200).json({ message: 'Accommodation updated successfully', accommodation });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new ExamConfigController();
