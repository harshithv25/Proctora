import os
import math
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2

logger = logging.getLogger("proctora_ai")

class FaceDetector:
    """
    State-of-the-art YOLOv8 Pose / Face Detector.
    Detects candidates, faces, and 17 COCO body/facial keypoints
    (Nose, Left Eye, Right Eye, Left Ear, Right Ear, Shoulders, etc.)
    """

    def __init__(self, model_name: str = "yolov8n-pose.pt"):
        self.model = None
        self.model_loaded = False
        models_dir = os.path.join(os.path.dirname(__file__), "models")
        os.makedirs(models_dir, exist_ok=True)
        local_model_path = os.path.join(models_dir, model_name)

        target_model = local_model_path if os.path.exists(local_model_path) else model_name

        try:
            from ultralytics import YOLO
            self.model = YOLO(target_model)
            self.model_loaded = True
            logger.info(f"Loaded YOLOv8 Pose model successfully from {target_model}")
        except Exception as e:
            logger.warning(f"Ultralytics YOLO not yet loaded ({e}). Standby mode enabled.")

    def detect_faces(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects all candidate faces and their facial/body keypoints in the frame.
        Returns a list of dicts with bounding box [x, y, w, h], keypoints, and confidence.
        """
        if frame is None or frame.size == 0:
            return []

        # Convert grayscale to BGR if necessary for YOLOv8
        if len(frame.shape) == 2:
            frame_bgr = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        else:
            frame_bgr = frame

        frame_h, frame_w = frame_bgr.shape[:2]

        if self.model is None or not self.model_loaded:
            # Fallback if model is initializing
            try:
                from ultralytics import YOLO
                models_dir = os.path.join(os.path.dirname(__file__), "models")
                local_path = os.path.join(models_dir, "yolov8n-pose.pt")
                self.model = YOLO(local_path if os.path.exists(local_path) else "yolov8n-pose.pt")
                self.model_loaded = True
            except Exception:
                return []

        try:
            results = self.model(frame_bgr, verbose=False, conf=0.35)
        except Exception as e:
            logger.error(f"YOLOv8 inference error: {e}")
            return []

        faces = []
        for result in results:
            if result.boxes is None or len(result.boxes) == 0:
                continue

            boxes = result.boxes
            keypoints_data = result.keypoints.data.cpu().numpy() if result.keypoints is not None else None

            for i in range(len(boxes)):
                box = boxes[i]
                cls_id = int(box.cls[0])
                if cls_id != 0:  # Class 0 is person in COCO
                    continue

                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                person_w = x2 - x1
                person_h = y2 - y1

                # Extract keypoints for this person
                kpts = None
                head_x, head_y, head_w, head_h = x1, y1, person_w, int(person_h * 0.35)

                if keypoints_data is not None and i < len(keypoints_data):
                    kpts = keypoints_data[i] # 17 x 3 (x, y, conf)
                    # 0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
                    head_points = []
                    for idx in range(5):
                        kx, ky, kconf = kpts[idx]
                        if kconf > 0.25:
                            head_points.append((kx, ky))

                    if len(head_points) >= 2:
                        xs = [p[0] for p in head_points]
                        ys = [p[1] for p in head_points]
                        min_x, max_x = min(xs), max(xs)
                        min_y, max_y = min(ys), max(ys)

                        pad_x = max(20, int((max_x - min_x) * 0.5))
                        pad_y = max(25, int((max_y - min_y) * 0.6))

                        head_x = max(0, int(min_x - pad_x))
                        head_y = max(0, int(min_y - pad_y))
                        head_w = min(frame_w - head_x, int((max_x - min_x) + (2 * pad_x)))
                        head_h = min(frame_h - head_y, int((max_y - min_y) + (2 * pad_y)))

                # Determine if face is frontal or turned profile based on ear/eye visibility
                face_type = "frontal"
                if kpts is not None:
                    left_ear_conf = float(kpts[3][2])
                    right_ear_conf = float(kpts[4][2])
                    left_eye_conf = float(kpts[1][2])
                    right_eye_conf = float(kpts[2][2])

                    if (left_ear_conf > 0.5 and right_eye_conf < 0.2) or (right_ear_conf > 0.5 and left_eye_conf < 0.2):
                        face_type = "profile"

                faces.append({
                    "x": int(head_x),
                    "y": int(head_y),
                    "w": int(head_w),
                    "h": int(head_h),
                    "confidence": round(conf, 3),
                    "type": face_type,
                    "keypoints": kpts.tolist() if kpts is not None else None,
                    "person_box": [x1, y1, x2, y2]
                })

        return faces

    def detect_eyes(self, face_roi: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Helper returning eye bounding regions.
        """
        if face_roi is None or face_roi.size == 0:
            return []
        h, w = face_roi.shape[:2]
        # Return estimated left and right eye regions
        eye_y = int(h * 0.3)
        eye_h = int(h * 0.2)
        eye_w = int(w * 0.25)
        left_eye = (int(w * 0.15), eye_y, eye_w, eye_h)
        right_eye = (int(w * 0.60), eye_y, eye_w, eye_h)
        return [left_eye, right_eye]
