import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateResponses, QuestionItem } from '../../../backend/src/modules/evaluationExport/grading';

describe('Backend Unit Tests: Evaluation & Response Grading Engine', () => {

  const sampleQuestions: QuestionItem[] = [
    {
      id: 'mcq-1',
      type: 'mcq',
      content: 'What is the default port for PostgreSQL?',
      order: 1,
      metadata: { points: 2, correctAnswer: '5432' },
    },
    {
      id: 'mcq-2',
      type: 'mcq',
      content: 'Which algorithm is used for password hashing in Proctora?',
      order: 2,
      metadata: { points: 3, correctAnswer: 'Argon2' },
    },
    {
      id: 'multi-1',
      type: 'multi_correct',
      content: 'Select the primary colors in RGB:',
      order: 3,
      metadata: { points: 4, correctAnswers: ['Red', 'Green', 'Blue'] },
    },
    {
      id: 'code-1',
      type: 'coding',
      content: 'Implement binary search in Python.',
      order: 4,
      metadata: { points: 10, starterCode: 'def binary_search(arr, target): pass' },
    },
  ];

  describe('Single-Choice MCQ Auto-Grading', () => {
    it('should award full points for correct case-insensitive MCQ response', () => {
      const answers = {
        'mcq-1': '5432',
        'mcq-2': 'argon2', // case insensitive check
      };

      const result = evaluateResponses(sampleQuestions.slice(0, 2), answers);

      assert.strictEqual(result.totalScore, 5);
      assert.strictEqual(result.maxScore, 5);
      assert.strictEqual(result.autoGradedQuestionsCount, 2);
      assert.strictEqual(result.breakdown['mcq-1'].status, 'correct');
      assert.strictEqual(result.breakdown['mcq-1'].pointsAwarded, 2);
      assert.strictEqual(result.breakdown['mcq-2'].status, 'correct');
      assert.strictEqual(result.breakdown['mcq-2'].pointsAwarded, 3);
    });

    it('should award zero points for incorrect MCQ response', () => {
      const answers = {
        'mcq-1': '3306', // wrong port
      };

      const result = evaluateResponses([sampleQuestions[0]], answers);

      assert.strictEqual(result.totalScore, 0);
      assert.strictEqual(result.maxScore, 2);
      assert.strictEqual(result.breakdown['mcq-1'].status, 'incorrect');
      assert.strictEqual(result.breakdown['mcq-1'].pointsAwarded, 0);
    });
  });

  describe('Multi-Correct Strict All-or-Nothing Grading', () => {
    it('should award full points only when all correct choices match strictly', () => {
      const answers = {
        'multi-1': ['Blue', 'Green', 'Red'], // Different order, case matches
      };

      const result = evaluateResponses([sampleQuestions[2]], answers);

      assert.strictEqual(result.totalScore, 4);
      assert.strictEqual(result.breakdown['multi-1'].status, 'correct');
      assert.strictEqual(result.breakdown['multi-1'].pointsAwarded, 4);
    });

    it('should award 0 points if a choice is missing (partial answers fail)', () => {
      const answers = {
        'multi-1': ['Red', 'Green'], // Missing Blue
      };

      const result = evaluateResponses([sampleQuestions[2]], answers);

      assert.strictEqual(result.totalScore, 0);
      assert.strictEqual(result.breakdown['multi-1'].status, 'incorrect');
    });

    it('should award 0 points if an extra incorrect choice is included', () => {
      const answers = {
        'multi-1': ['Red', 'Green', 'Blue', 'Yellow'],
      };

      const result = evaluateResponses([sampleQuestions[2]], answers);

      assert.strictEqual(result.totalScore, 0);
      assert.strictEqual(result.breakdown['multi-1'].status, 'incorrect');
    });
  });

  describe('Coding Question Processing & Telemetry Association', () => {
    it('should mark coding questions as pending/ungraded and attach editor telemetry', () => {
      const answers = {
        'code-1': 'def binary_search(arr, target):\n    return -1',
        __telemetry: {
          'code-1': {
            keystrokes: 45,
            pastes: 1,
            blurs: 0,
            language: 'python',
          },
        },
      };

      const result = evaluateResponses([sampleQuestions[3]], answers);

      assert.strictEqual(result.ungradedQuestionsCount, 1);
      assert.strictEqual(result.totalScore, 0);
      assert.strictEqual(result.breakdown['code-1'].status, 'ungraded');
      assert.strictEqual(result.breakdown['code-1'].pointsAwarded, null);
      assert.strictEqual(result.breakdown['code-1'].telemetrySummary?.keystrokes, 45);
      assert.strictEqual(result.breakdown['code-1'].telemetrySummary?.pastes, 1);
    });
  });
});
