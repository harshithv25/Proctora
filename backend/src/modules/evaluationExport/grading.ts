export interface QuestionItem {
  id: string;
  type: string;
  content: string;
  order: number;
  metadata?: any;
}

export interface QuestionEvaluation {
  questionId: string;
  type: string;
  content: string;
  pointsPossible: number;
  pointsAwarded: number | null;
  status: "correct" | "incorrect" | "ungraded";
  candidateAnswer: any;
  correctAnswer: any;
  telemetrySummary?: {
    keystrokes?: number;
    pastes?: number;
    blurs?: number;
    language?: string;
  };
}

export interface ExamEvaluationResult {
  totalScore: number;
  maxScore: number;
  autoGradedQuestionsCount: number;
  ungradedQuestionsCount: number;
  breakdown: Record<string, QuestionEvaluation>;
}

export function evaluateResponses(
  questions: QuestionItem[],
  answers: Record<string, any>
): ExamEvaluationResult {
  let totalScore = 0;
  let maxScore = 0;
  let autoGradedQuestionsCount = 0;
  let ungradedQuestionsCount = 0;
  const breakdown: Record<string, QuestionEvaluation> = {};

  const telemetryByQuestion: Record<string, any> = answers.__telemetry || {};

  for (const q of questions) {
    const meta = (q.metadata as Record<string, any>) || {};
    const questionPoints = Number(meta.points ?? 1);
    maxScore += questionPoints;

    const rawCandidateAns = answers[q.id];
    let candidateAns = rawCandidateAns;

    if (q.type === "mcq") {
      autoGradedQuestionsCount++;
      const expected = (meta.correctAnswer || "").toString().trim();
      const actual = (rawCandidateAns || "").toString().trim();

      const isMatch = actual.length > 0 && actual.toLowerCase() === expected.toLowerCase();
      const pointsAwarded = isMatch ? questionPoints : 0;
      totalScore += pointsAwarded;

      breakdown[q.id] = {
        questionId: q.id,
        type: q.type,
        content: q.content,
        pointsPossible: questionPoints,
        pointsAwarded,
        status: isMatch ? "correct" : "incorrect",
        candidateAnswer: rawCandidateAns || null,
        correctAnswer: meta.correctAnswer || null,
      };
    } else if (q.type === "multi_correct") {
      autoGradedQuestionsCount++;
      const expectedList: string[] = Array.isArray(meta.correctAnswers)
        ? meta.correctAnswers.map((s: any) => s.toString().trim())
        : [];

      let actualList: string[] = [];
      if (Array.isArray(rawCandidateAns)) {
        actualList = rawCandidateAns.map((s: any) => s.toString().trim());
      } else if (typeof rawCandidateAns === "string") {
        actualList = rawCandidateAns
          .split("|||")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }

      // Strict all-or-nothing matching:
      // Candidate receives full points only if selected choices match all options
      // in metadata.correctAnswers with no missing choices and no extra incorrect choices.
      const expectedNormalized = [...new Set(expectedList.map((s) => s.toLowerCase()))].sort();
      const actualNormalized = [...new Set(actualList.map((s) => s.toLowerCase()))].sort();

      const isStrictMatch =
        expectedNormalized.length > 0 &&
        actualNormalized.length === expectedNormalized.length &&
        actualNormalized.every((val, idx) => val === expectedNormalized[idx]);

      const pointsAwarded = isStrictMatch ? questionPoints : 0;
      totalScore += pointsAwarded;

      breakdown[q.id] = {
        questionId: q.id,
        type: q.type,
        content: q.content,
        pointsPossible: questionPoints,
        pointsAwarded,
        status: isStrictMatch ? "correct" : "incorrect",
        candidateAnswer: actualList,
        correctAnswer: expectedList,
      };
    } else if (q.type === "coding") {
      ungradedQuestionsCount++;
      // Descriptive & Coding questions are NOT auto-graded (marked as pending/ungraded)
      const qTelemetry = telemetryByQuestion[q.id] || {};

      breakdown[q.id] = {
        questionId: q.id,
        type: q.type,
        content: q.content,
        pointsPossible: questionPoints,
        pointsAwarded: null, // ungraded pending instructor evaluation
        status: "ungraded",
        candidateAnswer: rawCandidateAns || "",
        correctAnswer: meta.solutionCode || meta.starterCode || null,
        telemetrySummary: {
          keystrokes: qTelemetry.keystrokes ?? 0,
          pastes: qTelemetry.pastes ?? 0,
          blurs: qTelemetry.blurs ?? 0,
          language: qTelemetry.language || meta.language || "python",
        },
      };
    } else {
      // descriptive or other
      ungradedQuestionsCount++;
      breakdown[q.id] = {
        questionId: q.id,
        type: q.type,
        content: q.content,
        pointsPossible: questionPoints,
        pointsAwarded: null, // ungraded
        status: "ungraded",
        candidateAnswer: rawCandidateAns || "",
        correctAnswer: meta.sampleAnswer || meta.rubric || null,
      };
    }
  }

  return {
    totalScore,
    maxScore,
    autoGradedQuestionsCount,
    ungradedQuestionsCount,
    breakdown,
  };
}
