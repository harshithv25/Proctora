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
        # Candidates in laptop webcam view naturally sit in the upper-middle frame.
        # Allow natural vertical sitting variations while checking horizontal centering.
        is_centered = (center_distance < 0.48) and (abs(norm_dx) < 0.45) and (0.02 <= face_area_ratio <= 0.65)

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

            nose_conf = nose[2] if len(nose) > 2 else 0.0
            le_conf = left_eye[2] if len(left_eye) > 2 else 0.0
            re_conf = right_eye[2] if len(right_eye) > 2 else 0.0
            lear_conf = left_ear[2] if len(left_ear) > 2 else 0.0
            rear_conf = right_ear[2] if len(right_ear) > 2 else 0.0

            eyes_count = int(le_conf > 0.25) + int(re_conf > 0.25)

            # Order eyes by image X (left-most eye in image vs right-most eye in image)
            # This prevents 180° atan2 inversion in COCO camera perspective
            eye_l = left_eye if left_eye[0] <= right_eye[0] else right_eye
            eye_r = right_eye if left_eye[0] <= right_eye[0] else left_eye

            # Roll estimation from horizontal eye line
            if le_conf > 0.20 and re_conf > 0.20:
                d_x = eye_r[0] - eye_l[0]
                d_y = eye_r[1] - eye_l[1]
                roll = math.degrees(math.atan2(d_y, max(1.0, d_x)))
            elif len(kpts) >= 7 and kpts[5][2] > 0.30 and kpts[6][2] > 0.30:
                # Fallback to shoulder line angle
                sh_l = kpts[5] if kpts[5][0] <= kpts[6][0] else kpts[6]
                sh_r = kpts[6] if kpts[5][0] <= kpts[6][0] else kpts[5]
                d_sx = sh_r[0] - sh_l[0]
                d_sy = sh_r[1] - sh_l[1]
                roll = math.degrees(math.atan2(d_sy, max(1.0, d_sx)))

            # Yaw estimation
            if le_conf > 0.20 and re_conf > 0.20 and nose_conf > 0.20:
                eye_mid_x = (eye_l[0] + eye_r[0]) / 2.0
                eye_dist = max(10.0, eye_r[0] - eye_l[0])
                yaw_ratio = (nose[0] - eye_mid_x) / (eye_dist * 0.40)
                yaw = float(yaw_ratio * 30.0)

                # Ear cues for subtle or accentuated turning
                if rear_conf > 0.40 and lear_conf < 0.25:
                    yaw = max(yaw, 26.0)
                elif lear_conf > 0.40 and rear_conf < 0.25:
                    yaw = min(yaw, -26.0)
            elif le_conf > 0.25 and re_conf <= 0.20:
                yaw = -36.0
            elif re_conf > 0.25 and le_conf <= 0.20:
                yaw = 36.0
            elif lear_conf > 0.40 and rear_conf <= 0.20:
                yaw = -38.0
            elif rear_conf > 0.40 and lear_conf <= 0.20:
                yaw = 38.0

            # Pitch estimation
            if le_conf > 0.20 and re_conf > 0.20 and nose_conf > 0.20:
                eye_mid_y = (eye_l[1] + eye_r[1]) / 2.0
                eye_dist = max(10.0, eye_r[0] - eye_l[0])
                vert_dist = nose[1] - eye_mid_y
                expected_vert = eye_dist * 0.44
                pitch_ratio = (vert_dist - expected_vert) / (eye_dist * 0.35)
                pitch = float(pitch_ratio * 25.0)
            elif nose_conf > 0.20 and le_conf <= 0.20 and re_conf <= 0.20:
                pitch = 24.0

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
            roll = math.degrees(math.atan2(d_y, max(1.0, d_x)))

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
        if abs(yaw) > 20.0:
            gaze = "right" if yaw > 0 else "left"
        elif pitch > 18.0:
            gaze = "down"
        elif pitch < -18.0:
            gaze = "up"
        elif abs(roll) > 22.0:
            gaze = "tilt"
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
            "norm_dx": round(norm_dx, 3),
            "norm_dy": round(norm_dy, 3),
        }
