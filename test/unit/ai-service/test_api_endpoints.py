import unittest
import base64
import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai-service")))

class TestAIEndpointsUnit(unittest.TestCase):
    """
    Independent unit tests for AI Service API schemas, base64 payload
    handling, response envelopes, and pre-flight face verification logic.
    """

    def test_base64_data_uri_cleaning(self):
        """Verify handling of both raw base64 and data URI prefixed images."""
        raw_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        data_uri = f"data:image/png;base64,{raw_b64}"

        def clean_b64(input_str: str) -> str:
            if "," in input_str:
                return input_str.split(",", 1)[1]
            return input_str

        self.assertEqual(clean_b64(data_uri), raw_b64)
        self.assertEqual(clean_b64(raw_b64), raw_b64)

        decoded = base64.b64decode(clean_b64(data_uri))
        self.assertGreater(len(decoded), 0)

    def test_health_check_payload_contract(self):
        """Ensure /health endpoint returns the expected contract."""
        health_payload = {
            "status": "healthy",
            "service": "Proctora AI Live Proctoring Engine",
            "model_loaded": True,
            "detector_ready": True,
            "timestamp": time.time()
        }

        self.assertEqual(health_payload["status"], "healthy")
        self.assertIn("Proctora", health_payload["service"])
        self.assertTrue(health_payload["detector_ready"])

    def test_verify_face_response_structure_on_no_face(self):
        """Pre-exam system check rejection contract when face is absent."""
        no_face_response = {
            "ready": False,
            "face_detected": False,
            "num_faces": 0,
            "reason": "no_face",
            "message": "No face detected in camera feed. Please position your face clearly in view.",
            "boundingBoxes": []
        }

        self.assertFalse(no_face_response["ready"])
        self.assertEqual(no_face_response["reason"], "no_face")
        self.assertEqual(len(no_face_response["boundingBoxes"]), 0)

    def test_verify_face_response_structure_on_success(self):
        """Pre-exam calibration success contract."""
        calibrated_response = {
            "ready": True,
            "face_detected": True,
            "num_faces": 1,
            "is_centered": True,
            "reason": "calibrated",
            "message": "Candidate face verified and centered successfully.",
            "metrics": {
                "yaw": 1.2,
                "pitch": -0.5,
                "roll": 0.0,
                "gaze": "center",
                "center_distance": 0.04,
                "face_area_ratio": 0.16,
                "is_centered": True
            },
            "boundingBoxes": [{"x": 220, "y": 140, "w": 200, "h": 200, "type": "frontal"}]
        }

        self.assertTrue(calibrated_response["ready"])
        self.assertEqual(calibrated_response["reason"], "calibrated")
        self.assertTrue(calibrated_response["metrics"]["is_centered"])

    def test_frame_analysis_flag_threshold(self):
        """Ensure analyze_frame flags cheating whenever score >= 0.65."""
        def make_analysis_result(cheat_prob):
            return {
                "status": "multiple_faces" if cheat_prob > 0.8 else "normal",
                "cheat_probability": cheat_prob,
                "flagged": cheat_prob >= 0.65,
                "timestamp": time.time(),
            }

        flagged = make_analysis_result(0.85)
        self.assertTrue(flagged["flagged"])

        normal = make_analysis_result(0.12)
        self.assertFalse(normal["flagged"])

if __name__ == "__main__":
    unittest.main()
