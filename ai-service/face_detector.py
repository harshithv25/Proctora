import os
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional

CASCADE_DIR_CANDIDATES = [
    "/usr/share/opencv4/haarcascades",
    "/usr/share/opencv/haarcascades",
    "/usr/local/share/opencv4/haarcascades",
    "/usr/local/share/opencv/haarcascades",
    getattr(cv2, "data", None) and getattr(cv2.data, "haarcascades", None),
]

def find_cascade_path(filename: str) -> str:
    for candidate in CASCADE_DIR_CANDIDATES:
        if candidate and os.path.exists(candidate):
            full_path = os.path.join(candidate, filename)
            if os.path.exists(full_path):
                return full_path
    raise FileNotFoundError(f"Cascade classifier file '{filename}' not found in system paths.")

class FaceDetector:
    def __init__(self):
        frontal_path = find_cascade_path("haarcascade_frontalface_default.xml")
        alt_path = find_cascade_path("haarcascade_frontalface_alt2.xml")
        profile_path = find_cascade_path("haarcascade_profileface.xml")
        eye_path = find_cascade_path("haarcascade_eye.xml")

        self.frontal_cascade = cv2.CascadeClassifier(frontal_path)
        self.alt_cascade = cv2.CascadeClassifier(alt_path)
        self.profile_cascade = cv2.CascadeClassifier(profile_path)
        self.eye_cascade = cv2.CascadeClassifier(eye_path)

    def detect_faces(self, gray_frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects all faces in a grayscale frame.
        Supports both frontal and profile detection with duplicate suppression.
        """
        h, w = gray_frame.shape[:2]
        min_face_size = (int(w * 0.1), int(h * 0.1))

        # 1. Frontal faces
        frontal_rects = self.alt_cascade.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=min_face_size
        )
        if len(frontal_rects) == 0:
            frontal_rects = self.frontal_cascade.detectMultiScale(
                gray_frame,
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=min_face_size
            )

        # 2. Profile faces (turned left or right)
        profile_rects = self.profile_cascade.detectMultiScale(
            gray_frame,
            scaleFactor=1.15,
            minNeighbors=4,
            minSize=min_face_size
        )
        # Also check flipped for opposite profile
        gray_flipped = cv2.flip(gray_frame, 1)
        flipped_profile_rects = self.profile_cascade.detectMultiScale(
            gray_flipped,
            scaleFactor=1.15,
            minNeighbors=4,
            minSize=min_face_size
        )
        reconstructed_flipped = []
        for (rx, ry, rw, rh) in flipped_profile_rects:
            reconstructed_flipped.append((w - (rx + rw), ry, rw, rh))

        raw_faces: List[Tuple[int, int, int, int, str]] = []
        for (x, y, fw, fh) in frontal_rects:
            raw_faces.append((int(x), int(y), int(fw), int(fh), "frontal"))
        for (x, y, fw, fh) in profile_rects:
            raw_faces.append((int(x), int(y), int(fw), int(fh), "profile"))
        for (x, y, fw, fh) in reconstructed_flipped:
            raw_faces.append((int(x), int(y), int(fw), int(fh), "profile"))

        # Non-maximum / overlap suppression
        merged_faces: List[Dict[str, Any]] = []
        for (x, y, fw, fh, ftype) in raw_faces:
            is_overlap = False
            for existing in merged_faces:
                ex, ey, ew, eh = existing["x"], existing["y"], existing["w"], existing["h"]
                # Compute IoU / overlap
                ix = max(x, ex)
                iy = max(y, ey)
                iw = min(x + fw, ex + ew) - ix
                ih = min(y + fh, ey + eh) - iy
                if iw > 0 and ih > 0:
                    intersection = iw * ih
                    union = (fw * fh) + (ew * eh) - intersection
                    if (intersection / union) > 0.35:
                        is_overlap = True
                        if existing["type"] == "profile" and ftype == "frontal":
                            existing["type"] = "frontal"
                        break
            if not is_overlap:
                merged_faces.append({
                    "x": x,
                    "y": y,
                    "w": fw,
                    "h": fh,
                    "type": ftype
                })

        # Sort largest face first
        merged_faces.sort(key=lambda f: f["w"] * f["h"], reverse=True)
        return merged_faces

    def detect_eyes(self, gray_face: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detects eyes within the upper 60% of the face bounding box.
        """
        fh, fw = gray_face.shape[:2]
        upper_half = gray_face[0:int(fh * 0.65), :]
        eyes = self.eye_cascade.detectMultiScale(
            upper_half,
            scaleFactor=1.1,
            minNeighbors=3,
            minSize=(int(fw * 0.12), int(fh * 0.12))
        )
        return [(int(ex), int(ey), int(ew), int(eh)) for (ex, ey, ew, eh) in eyes]
