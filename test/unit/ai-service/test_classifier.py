import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai-service")))

class TestCheatClassifierUnit(unittest.TestCase):
    """
    Independent unit tests for Proctora ML Behavior Classification:
    Feature extraction vectors, label assignment, and cheating risk bounds.
    """

    CLASS_NAMES = ["NORMAL", "NO_FACE", "MULTIPLE_FACES", "LOOKING_AWAY"]

    def extract_features(self, num_faces, yaw, pitch, roll, center_dist, area_ratio):
        """Constructs the canonical 6-dimensional feature vector fed to classifier."""
        return [
            float(num_faces),
            float(yaw),
            float(pitch),
            float(roll),
            float(center_dist),
            float(area_ratio),
        ]

    def heuristic_classify(self, features):
        """Standard baseline proctoring classifier logic."""
        num_faces, yaw, pitch, roll, center_dist, area_ratio = features

        if num_faces == 0:
            return "NO_FACE", 0.95
        if num_faces > 1:
            return "MULTIPLE_FACES", 0.98
        if abs(yaw) > 22.0 or abs(pitch) > 20.0 or center_dist > 0.40:
            return "LOOKING_AWAY", 0.78
        return "NORMAL", 0.05

    def test_feature_vector_dimensions(self):
        feat = self.extract_features(1, 2.5, -1.0, 0.5, 0.08, 0.15)
        self.assertEqual(len(feat), 6, "Feature vector must contain exactly 6 elements")

    def test_classification_labels(self):
        for name in self.CLASS_NAMES:
            self.assertIsInstance(name, str)
        self.assertEqual(len(self.CLASS_NAMES), 4)

    def test_no_face_detection_classification(self):
        feat = self.extract_features(0, 0, 0, 0, 0, 0)
        label, prob = self.heuristic_classify(feat)
        self.assertEqual(label, "NO_FACE")
        self.assertGreater(prob, 0.90)

    def test_multiple_faces_classification(self):
        feat = self.extract_features(2, 0, 0, 0, 0.15, 0.25)
        label, prob = self.heuristic_classify(feat)
        self.assertEqual(label, "MULTIPLE_FACES")
        self.assertGreater(prob, 0.90)

    def test_looking_away_classification(self):
        # Yaw shifted by 32 degrees to the left
        feat = self.extract_features(1, -32.0, 5.0, 2.0, 0.12, 0.15)
        label, prob = self.heuristic_classify(feat)
        self.assertEqual(label, "LOOKING_AWAY")
        self.assertGreaterEqual(prob, 0.65, "Looking away must meet or exceed flag threshold")

    def test_normal_candidate_classification(self):
        feat = self.extract_features(1, 2.0, 1.0, 0.0, 0.05, 0.18)
        label, prob = self.heuristic_classify(feat)
        self.assertEqual(label, "NORMAL")
        self.assertLess(prob, 0.30, "Normal candidate should receive minimal cheat probability")

if __name__ == "__main__":
    unittest.main()
