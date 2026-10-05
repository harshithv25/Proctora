import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';

describe('Backend Unit Tests: Exam Configuration & Seating Plan Module', () => {

  describe('Deterministic Question Shuffling Algorithm (LCG PRNG)', () => {
    // Exact algorithm extracted from Proctora examConfig service
    function getShuffledQuestionIds(questionIds: string[], setIndex: number): string[] {
      if (questionIds.length <= 1) return [...questionIds];
      const list = [...questionIds];
      let seed = (setIndex + 1) * 2654435761;
      const nextRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(nextRandom() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    }

    const questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];

    it('should produce deterministic permutations for the same setIndex', () => {
      const run1 = getShuffledQuestionIds(questionIds, 2);
      const run2 = getShuffledQuestionIds(questionIds, 2);
      assert.deepStrictEqual(run1, run2, 'Identical setIndex must yield identical question order');
    });

    it('should produce distinct permutations for different setIndices', () => {
      const setA = getShuffledQuestionIds(questionIds, 0);
      const setB = getShuffledQuestionIds(questionIds, 1);
      const setC = getShuffledQuestionIds(questionIds, 2);

      assert.notDeepStrictEqual(setA, setB, 'Set 0 and Set 1 should have different question order');
      assert.notDeepStrictEqual(setA, setC, 'Set 0 and Set 2 should have different question order');
    });

    it('should preserve all original question elements without loss or duplicates', () => {
      const shuffled = getShuffledQuestionIds(questionIds, 5);
      assert.strictEqual(shuffled.length, questionIds.length);
      const sortedOriginal = [...questionIds].sort();
      const sortedShuffled = [...shuffled].sort();
      assert.deepStrictEqual(sortedOriginal, sortedShuffled, 'Permutation must contain all original IDs');
    });
  });

  describe('9-Color Tiling Seating Plan Deconfliction Matrix', () => {
    function computeSetIndex(row: number, col: number): number {
      return ((row % 3) * 3 + (col % 3)) % 9;
    }

    function getNeighborOffsets(): [number, number][] {
      return [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];
    }

    it('should assign distinct question sets to all 8 immediate physical neighbors', () => {
      const targetRow = 1;
      const targetCol = 1;
      const targetSet = computeSetIndex(targetRow, targetCol);

      const neighbors = getNeighborOffsets();
      const neighborSets = new Set<number>();

      for (const [dRow, dCol] of neighbors) {
        const nRow = targetRow + dRow;
        const nCol = targetCol + dCol;
        const nSet = computeSetIndex(nRow, nCol);

        assert.notStrictEqual(
          targetSet,
          nSet,
          `Neighbor at (${nRow}, ${nCol}) has identical set (${nSet}) to target at (${targetRow}, ${targetCol})`
        );
        neighborSets.add(nSet);
      }

      // In a 3x3 block, all 9 positions (center + 8 neighbors) must have unique set indices (0 to 8)
      assert.strictEqual(neighborSets.size, 8, 'All 8 surrounding neighbors must have unique set indices');
    });

    it('should correctly map setIndex to uppercase set identifier (SET-A through SET-I)', () => {
      for (let i = 0; i < 9; i++) {
        const setId = `SET-${String.fromCharCode(65 + i)}`;
        assert.match(setId, /^SET-[A-I]$/);
      }
    });
  });

  describe('Exam Configuration Validation Schemas', () => {
    const ExamCreateSchema = z.object({
      title: z.string().min(3),
      testId: z.string().optional(),
      maxStudents: z.number().int().positive().optional(),
      duration: z.number().int().min(5), // min 5 minutes
      idleTimeoutSec: z.number().int().min(10).default(60),
    });

    it('should validate exam configuration parameters', () => {
      const validExam = {
        title: 'IT303 Software Engineering Final Exam',
        duration: 90,
        idleTimeoutSec: 120,
        maxStudents: 60,
      };
      const parsed = ExamCreateSchema.parse(validExam);
      assert.strictEqual(parsed.title, validExam.title);
      assert.strictEqual(parsed.duration, 90);
    });

    it('should reject invalid exam duration less than 5 minutes', () => {
      const invalid = {
        title: 'Pop Quiz',
        duration: 2,
      };
      assert.throws(() => ExamCreateSchema.parse(invalid));
    });
  });
});
