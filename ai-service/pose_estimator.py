import math
from typing import Dict, Any, List, Tuple, Optional
import numpy as np

class PoseEstimator:
    """
    YOLOv8 Pose-Powered 3D Head Pose and Gaze Estimator.
    Computes Yaw, Pitch, Roll, Centering, and Suspicious Behavioral Indicators
    from 17 COCO keypoints (Nose, Eyes, Ears, Shoulders) and frame geometry.
    """

    def estimate_pose(
        self,
        face: Dict[str, Any],
        eyes: Optional[List[Tuple[int, int, int, int]]] = None,
        frame_shape: Tuple[int, int] = (480, 640)
    ) -> Dict[str, Any]:
        frame_h, frame_w = frame_shape[:2]
        x, y, w, h = face.get("x", 0), face.get("y", 0), face.get("w", 100), face.get("h", 100)
        face_type = face.get("type", "frontal")
        kpts = face.get("keypoints")

        # 1. Frame Centering Metrics
        face_cx = x + (w / 2.0)
        face_cy = y + (h / 2.0)
        frame_cx = frame_w / 2.0
        frame_cy = frame_h / 2.0

        norm_dx = (face_cx - frame_cx) / (frame_w / 2.0)
        norm_dy = (face_cy - frame_cy) / (frame_h / 2.0)
        center_distance = math.sqrt(norm_dx ** 2 + norm_dy ** 2)

        face_area_ratio = (w * h) / float(frame_w * frame_h)
        is_centered = (center_distance < 0.35) and (0.04 <= face_area_ratio <= 0.55)

        yaw = 0.0
        pitch = 0.0
        roll = 0.0
        gaze = "center"
        eyes_count = 2

        # 2. Keypoints-based 3D Pose Extraction (YOLOv8 Pose)
        if kpts is not None and len(kpts) >= 5:
            # 0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
            nose = kpts[0]
            left_eye = kpts[1]
            right_eye = kpts[2]
            left_ear = kpts[3]
            right_ear = kpts[4]

            nose_conf = nose[2] if len(nose) > 2 else 1.0
            le_conf = left_eye[2] if len(left_eye) > 2 else 1.0
            re_conf = right_eye[2] if len(right_eye) > 2 else 1.0
            lear_conf = left_ear[2] if len(left_ear) > 2 else 0.0
            rear_conf = right_ear[2] if len(right_ear) > 2 else 0.0

            eyes_count = int(le_conf > 0.3) + int(re_conf > 0.3)

            # Roll estimation from eye line angle
            if le_conf > 0.25 and re_conf > 0.25:
                d_x = right_eye[0] - left_eye[0]
                d_y = right_eye[1] - left_eye[1]
                roll = math.degrees(math.atan2(d_y, d_x if d_x != 0 else 0.001))

            # Yaw estimation from nose position relative to eye midpoint
            if le_conf > 0.25 and re_conf > 0.25 and nose_conf > 0.25:
                eye_mid_x = (left_eye[0] + right_eye[0]) / 2.0
                eye_dist = max(10.0, abs(right_eye[0] - left_eye[0]))
                yaw_ratio = (nose[0] - eye_mid_x) / (eye_dist * 0.45)
                yaw = float(yaw_ratio * 32.0)

                # Incorporate ear visibility cues
                if rear_conf > 0.5 and le_conf < 0.2:
                    yaw = max(yaw, 38.0)
                elif lear_conf > 0.5 and re_conf < 0.2:
                    yaw = min(yaw, -38.0)

            # Pitch estimation from nose vertical distance relative to eyes
            if le_conf > 0.25 and re_conf > 0.25 and nose_conf > 0.25:
                eye_mid_y = (left_eye[1] + right_eye[1]) / 2.0
                eye_dist = max(10.0, abs(right_eye[0] - left_eye[0]))
                vert_dist = nose[1] - eye_mid_y
                expected_vert = eye_dist * 0.35
                pitch_ratio = (vert_dist - expected_vert) / (eye_dist * 0.35)
                pitch = float(pitch_ratio * 25.0)

        elif face_type == "profile":
            yaw = 40.0 if norm_dx >= 0 else -40.0
            gaze = "right" if yaw > 0 else "left"
        elif eyes is not None and len(eyes) >= 2:
            # Fallback legacy eye box geometric estimation
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
            eyes_count = len(eyes)

        # 3. Classify Gaze Orientation
        if abs(yaw) > 18.0:
            gaze = "right" if yaw > 0 else "left"
        elif pitch > 15.0:
            gaze = "down"
        elif pitch < -15.0:
            gaze = "up"
        else:
            gaze = "center"

        return {
            "yaw": round(yaw, 2),
            "pitch": round(pitch, 2),
            "roll": round(roll, 2),
            "gaze": gaze,
            "center_distance": round(center_distance, 3),
            "face_area_ratio": round(face_area_ratio, 3),
            "eyes_count": eyes_count,
            "is_centered": is_centered,
        }
