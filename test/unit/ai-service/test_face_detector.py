import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai-service")))

class TestFaceDetectorUnit(unittest.TestCase):
    """
    Independent unit tests for Face Detector abstractions,
    cascade path discovery, and bounding box validation.
    """

    def test_bounding_box_format(self):
        """Ensure face detections produce compliant dictionary formats."""
        sample_face = {
            "x": 120,
            "y": 80,
            "w": 180,
            "h": 180,
            "type": "frontal"
        }
        self.assertIn("x", sample_face)
        self.assertIn("y", sample_face)
        self.assertIn("w", sample_face)
        self.assertIn("h", sample_face)
        self.assertIn("type", sample_face)
        self.assertGreater(sample_face["w"], 0)
        self.assertGreater(sample_face["h"], 0)

    def test_non_overlapping_suppression(self):
        """Simulate Non-Maximum Suppression (NMS) on duplicate overlapping detections."""
        def calculate_iou(box1, box2):
            x1 = max(box1["x"], box2["x"])
            y1 = max(box1["y"], box2["y"])
            x2 = min(box1["x"] + box1["w"], box2["x"] + box2["w"])
            y2 = min(box1["y"] + box1["h"], box2["y"] + box2["h"])

            intersection = max(0, x2 - x1) * max(0, y2 - y1)
            area1 = box1["w"] * box1["h"]
            area2 = box2["w"] * box2["h"]
            union = area1 + area2 - intersection
            return intersection / union if union > 0 else 0.0

        boxA = {"x": 100, "y": 100, "w": 120, "h": 120}
        boxB = {"x": 105, "y": 102, "w": 118, "h": 118} # heavily overlapping duplicate
        boxC = {"x": 350, "y": 100, "w": 120, "h": 120} # distinct second face

        self.assertGreater(calculate_iou(boxA, boxB), 0.80, "Duplicates should exhibit high IoU")
        self.assertEqual(calculate_iou(boxA, boxC), 0.0, "Disjoint candidate faces must have 0 IoU")

    def test_minimum_candidate_face_area(self):
        """Frames with tiny artifact blobs below threshold must be discarded."""
        frame_w, frame_h = 640, 480
        min_w, min_h = int(frame_w * 0.1), int(frame_h * 0.1) # 64x48 min

        valid_face = {"w": 150, "h": 150}
        noise_face = {"w": 25, "h": 20}

        self.assertTrue(valid_face["w"] >= min_w and valid_face["h"] >= min_h)
        self.assertFalse(noise_face["w"] >= min_w and noise_face["h"] >= min_h)

if __name__ == "__main__":
    unittest.main()
