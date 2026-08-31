const examConfigService = require('./service');

class ExamConfigController {
    async createExam(req, res, next) {
        try {
            const adminId = req.user.id;
            const exam = await examConfigService.createExam(adminId, req.body);
            res.status(201).json({ message: 'Exam created successfully', exam });
        } catch (err) {
            next(err);
        }
    }

    async getExams(req, res, next) {
        try {
            const exams = await examConfigService.getExamList();
            res.status(200).json({ exams });
        } catch (err) {
            next(err);
        }
    }

    async getExamDetails(req, res, next) {
        try {
            const { examId } = req.params;
            const exam = await examConfigService.getExamById(examId);
            res.status(200).json({ exam });
        } catch (err) {
            next(err);
        }
    }

    async getExamQuestions(req, res, next) {
        try {
            const { examId } = req.params;
            const userId = req.user?.id;
            const questions = await examConfigService.getExamQuestions(examId, userId);
            res.status(200).json({ questions });
        } catch (err) {
            next(err);
        }
    }

    async getSessionConfig(req, res, next) {
        try {
            const { examId } = req.params;
            const userId = req.user?.id;
            const config = await examConfigService.getSessionConfig(examId, userId);
            res.status(200).json({ config });
        } catch (err) {
            next(err);
        }
    }

    async uploadQuestions(req, res, next) {
        try {
            const { examId } = req.params;
            const { questions } = req.body;
            const created = await examConfigService.addQuestionsToExam(examId, questions || []);
            res.status(201).json({ message: 'Questions uploaded successfully', questions: created });
        } catch (err) {
            next(err);
        }
    }

    async uploadSeatingPlan(req, res, next) {
        try {
            const { examId } = req.params;
            const { seatingPlan } = req.body;
            const created = await examConfigService.uploadSeatingPlan(examId, seatingPlan || []);
            res.status(201).json({ message: 'Seating plan processed successfully', seatingPlan: created });
        } catch (err) {
            next(err);
        }
    }

    async setAccommodation(req, res, next) {
        try {
            const { examId } = req.params;
            const approvedByAdminId = req.user.id;
            const { candidateId, extraTimeSec, extraMinutes, notes } = req.body;

            const extraSec = extraTimeSec !== undefined ? extraTimeSec : (extraMinutes ? extraMinutes * 60 : 0);

            const accommodation = await examConfigService.configureAccommodation(
                examId,
                candidateId,
                extraSec,
                approvedByAdminId,
                notes
            );
            res.status(200).json({ message: 'Candidate accommodation saved', accommodation });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ExamConfigController();
