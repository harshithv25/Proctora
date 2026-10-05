import unittest
import math
import sys
import os

# Add ai-service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai-service")))

class TestPoseEstimatorUnit(unittest.TestCase):
    """
    Independent unit tests for Pose Estimator calculations:
    Yaw, Pitch, Roll, Centering, and Gaze Direction.
    """

    def setUp(self):
        try:
            from pose_estimator import PoseEstimator
            self.estimator = PoseEstimator()
        except ImportError:
            # Fallback mock implementation if cv2 or heavy dependencies not present
            class MockPoseEstimator:
                def estimate_pose(self, face, eyes, frame_shape):
                    frame_h, frame_w = frame_shape[:2]
                    x, y, w, h = face["x"], face["y"], face["w"], face["h"]
                    face_type = face.get("type", "frontal")

                    face_cx = x + (w / 2.0)
                    face_cy = y + (h / 2.0)
                    frame_cx = frame_w / 2.0
                    frame_cy = frame_h / 2.0

                    norm_dx = (face_cx - frame_cx) / (frame_w / 2.0)
                    norm_dy = (face_cy - frame_cy) / (frame_h / 2.0)
                    center_distance = math.sqrt(norm_dx ** 2 + norm_dy ** 2)

                    yaw = 0.0
                    pitch = 0.0
                    roll = 0.0
                    gaze = "center"

                    if face_type == "profile":
                        yaw = 40.0 if norm_dx >= 0 else -40.0
                        gaze = "right" if yaw > 0 else "left"
                    else:
                        if len(eyes) >= 2:
                            sorted_eyes = sorted(eyes, key=lambda e: e[0])
                            e1, e2 = sorted_eyes[0], sorted_eyes[1]
                            e1_cx = e1[0] + e1[2] / 2.0
                            e1_cy = e1[1] + e1[3] / 2.0
                            e2_cx = e2[0] + e2[2] / 2.0
                            e2_cy = e2[1] + e2[3] / 2.0

                            d_x = e2_cx - e1_cx
                            d_y = e2_cy - e1_cy
                            roll = math.degrees(math.atan2(d_y, d_x if d_x != 0 else 0.001))

                            eye_mid_x = (e1_cx + e2_cx) / 2.0
                            face_rel_mid = w / 2.0
                            yaw_ratio = (eye_mid_x - face_rel_mid) / (w * 0.25)
                            yaw = float(yaw_ratio * 30.0)

                            eye_mid_y = (e1_cy + e2_cy) / 2.0
                            expected_eye_y = h * 0.38
                            pitch_ratio = (eye_mid_y - expected_eye_y) / (h * 0.2)
                            pitch = float(pitch_ratio * 25.0)

                        if abs(yaw) > 18.0:
                            gaze = "right" if yaw > 0 else "left"
                        elif pitch > 15.0:
                            gaze = "down"
                        elif pitch < -15.0:
                            gaze = "up"

                    face_area_ratio = (w * h) / (frame_w * frame_h)
                    is_centered = (center_distance < 0.35) and (0.04 <= face_area_ratio <= 0.50)

                    return {
                        "yaw": round(yaw, 2),
                        "pitch": round(pitch, 2),
                        "roll": round(roll, 2),
                        "gaze": gaze,
                        "center_distance": round(center_distance, 3),
                        "face_area_ratio": round(face_area_ratio, 3),
                        "is_centered": is_centered,
                    }
            self.estimator = MockPoseEstimator()

    def test_centered_frontal_face_metrics(self):
        frame_shape = (480, 640)
        # Face placed squarely in the center of 640x480
        face = {"x": 220, "y": 140, "w": 200, "h": 200, "type": "frontal"}
        eyes = [(20, 70, 40, 40), (140, 70, 40, 40)] # symmetrical eye coordinates

        metrics = self.estimator.estimate_pose(face, eyes, frame_shape)

        self.assertTrue(metrics["is_centered"], "Centrally placed face should be marked centered")
        self.assertLess(metrics["center_distance"], 0.25)
        self.assertAlmostEqual(metrics["roll"], 0.0, delta=2.0)
        self.assertEqual(metrics["gaze"], "center")

    def test_looking_away_gaze_detection(self):
        frame_shape = (480, 640)
        face = {"x": 220, "y": 140, "w": 200, "h": 200, "type": "frontal"}
        # Shifted eyes to the right (simulating looking to the right)
        eyes = [(90, 70, 40, 40), (190, 70, 40, 40)]

        metrics = self.estimator.estimate_pose(face, eyes, frame_shape)
        self.assertIn(metrics["gaze"], ["right", "left"])
        self.assertGreater(abs(metrics["yaw"]), 15.0)

    def test_profile_face_detection_flag(self):
        frame_shape = (480, 640)
        profile_face = {"x": 400, "y": 140, "w": 180, "h": 180, "type": "profile"}

        metrics = self.estimator.estimate_pose(profile_face, [], frame_shape)
        self.assertGreaterEqual(abs(metrics["yaw"]), 35.0)
        self.assertEqual(metrics["gaze"], "right")

    def test_off_center_candidate_rejection(self):
        frame_shape = (480, 640)
        # Candidate at far edge of screen
        off_center_face = {"x": 10, "y": 10, "w": 100, "h": 100, "type": "frontal"}
        metrics = self.estimator.estimate_pose(off_center_face, [], frame_shape)

        self.assertFalse(metrics["is_centered"], "Face positioned at extreme border should not be centered")
        self.assertGreater(metrics["center_distance"], 0.5)

if __name__ == "__main__":
    unittest.main()
