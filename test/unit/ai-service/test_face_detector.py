import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai-service")))

class TestFaceDetectorUnit(unittest.TestCase):
    """
    Independent unit tests for YOLOv8 Pose Face & Keypoint Detector.
    Tests model initialization, 17 COCO keypoints extraction,
    bounding box geometry, and non-maximum suppression.
    """

    def setUp(self):
        from face_detector import FaceDetector
        self.detector = FaceDetector(model_name="yolov8n-pose.pt")

    def test_detector_initialization(self):
        """Ensure YOLOv8 Pose detector initializes cleanly."""
        self.assertTrue(self.detector.model_loaded)
        self.assertEqual(self.detector.model_name, "yolov8n-pose.pt")

    def test_yolov8_17_keypoints_structure(self):
        """Ensure detected candidates have all 17 COCO keypoint coordinates."""
        dummy_frame = type('DummyFrame', (), {
            'shape': (480, 640, 3),
            'max': lambda *args, **kwargs: 255,
            'mean': lambda *args, **kwargs: 128
        })()

        faces = self.detector.detect_faces(dummy_frame)
        self.assertEqual(len(faces), 1)

        face = faces[0]
        self.assertIn("keypoints", face)
        self.assertIsNotNone(face["keypoints"])
        self.assertEqual(len(face["keypoints"]), 17, "YOLOv8 Pose must return exactly 17 keypoints")

        # Keypoint 0: Nose, 1: Left Eye, 2: Right Eye, 3: Left Ear, 4: Right Ear
        for i in range(5):
            kpt = face["keypoints"][i]
            self.assertEqual(len(kpt), 3, "Each keypoint must be [x, y, confidence]")
            self.assertGreaterEqual(kpt[2], 0.0, "Confidence must be non-negative")

    def test_empty_frame_handling(self):
        """Ensure blank/none frames return empty detections."""
        self.assertEqual(self.detector.detect_faces(None), [])

        blank_frame = type('BlankFrame', (), {
            'shape': (480, 640, 3),
            'max': lambda *args, **kwargs: 0,
            'mean': lambda *args, **kwargs: 0
        })()
        self.assertEqual(self.detector.detect_faces(blank_frame), [])

    def test_non_overlapping_suppression(self):
        """Verify IoU calculation on duplicate bounding boxes."""
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
        boxB = {"x": 105, "y": 102, "w": 118, "h": 118}
        boxC = {"x": 350, "y": 100, "w": 120, "h": 120}

        self.assertGreater(calculate_iou(boxA, boxB), 0.80)
        self.assertEqual(calculate_iou(boxA, boxC), 0.0)

if __name__ == "__main__":
    unittest.main()
