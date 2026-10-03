import math
from typing import Dict, Any, List, Tuple

class PoseEstimator:
    """
    Estimates 3D Head Pose (Yaw, Pitch, Roll) and Gaze Deviation
    from facial bounding boxes, eye landmarks, and frame geometry.
    """

    def estimate_pose(
        self,
        face: Dict[str, Any],
        eyes: List[Tuple[int, int, int, int]],
        frame_shape: Tuple[int, int]
    ) -> Dict[str, Any]:
        frame_h, frame_w = frame_shape[:2]
        x, y, w, h = face["x"], face["y"], face["w"], face["h"]
        face_type = face.get("type", "frontal")

        # 1. Frame Centering Offset
        face_cx = x + (w / 2.0)
        face_cy = y + (h / 2.0)
        frame_cx = frame_w / 2.0
        frame_cy = frame_h / 2.0

        norm_dx = (face_cx - frame_cx) / (frame_w / 2.0)
        norm_dy = (face_cy - frame_cy) / (frame_h / 2.0)
        center_distance = math.sqrt(norm_dx ** 2 + norm_dy ** 2)

        # 2. Estimate Yaw, Pitch, Roll
        yaw = 0.0
        pitch = 0.0
        roll = 0.0
        gaze = "center"

        if face_type == "profile":
            # Direct profile view indicates extreme head rotation (>35 degrees)
            # Determine direction from position relative to center
            yaw = 40.0 if norm_dx >= 0 else -40.0
            gaze = "right" if yaw > 0 else "left"
        else:
            # Frontal view with eye geometry analysis
            if len(eyes) >= 2:
                # Sort eyes by X position (left eye, right eye)
                sorted_eyes = sorted(eyes, key=lambda e: e[0])
                e1, e2 = sorted_eyes[0], sorted_eyes[1]
                e1_cx = e1[0] + e1[2] / 2.0
                e1_cy = e1[1] + e1[3] / 2.0
                e2_cx = e2[0] + e2[2] / 2.0
                e2_cy = e2[1] + e2[3] / 2.0

                # Roll from angle between eyes
                d_x = e2_cx - e1_cx
                d_y = e2_cy - e1_cy
                roll = math.degrees(math.atan2(d_y, d_x if d_x != 0 else 0.001))

                # Yaw from horizontal eye center offset relative to face box center
                eye_mid_x = (e1_cx + e2_cx) / 2.0
                face_rel_mid = w / 2.0
                yaw_ratio = (eye_mid_x - face_rel_mid) / (w * 0.25)
                yaw = float(max(-45.0, min(45.0, yaw_ratio * 30.0)))

                # Pitch from vertical eye level relative to expected eye level (approx 35% from top)
                eye_mid_y = (e1_cy + e2_cy) / 2.0
                expected_eye_y = h * 0.35
                pitch_ratio = (eye_mid_y - expected_eye_y) / (h * 0.20)
                pitch = float(max(-40.0, min(40.0, -pitch_ratio * 25.0)))

            elif len(eyes) == 1:
                # Single eye visible suggests partial head turn
                eye = eyes[0]
                eye_cx = eye[0] + eye[2] / 2.0
                if eye_cx < w * 0.4:
                    yaw = -26.0  # turned left
                else:
                    yaw = 26.0   # turned right
                pitch = -5.0
            else:
                # No eyes visible inside frontal face (looking down or eyes covered)
                pitch = -25.0
                yaw = 0.0

        # Classify gaze orientation
        if abs(yaw) > 22.0:
            gaze = "right" if yaw > 0 else "left"
        elif pitch < -18.0:
            gaze = "down"
        elif pitch > 18.0:
            gaze = "up"
        else:
            gaze = "center"

        # Ratio of face size relative to screen
        face_area_ratio = (w * h) / float(frame_w * frame_h)

        return {
            "yaw": round(yaw, 1),
            "pitch": round(pitch, 1),
            "roll": round(roll, 1),
            "gaze": gaze,
            "center_distance": round(center_distance, 3),
            "face_area_ratio": round(face_area_ratio, 4),
            "eyes_count": len(eyes),
            "is_centered": center_distance < 0.45 and 0.04 <= face_area_ratio <= 0.75,
        }
