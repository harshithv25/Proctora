import os
import io
import time
import base64
import logging
from typing import Optional, Dict, Any, List

import cv2
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from face_detector import FaceDetector
from pose_estimator import PoseEstimator

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("proctora_ai")

app = FastAPI(
    title="Proctora AI Live Proctoring Engine",
    description="Real-time face detection, head pose estimation, and suspicious behavioral classification for online examinations.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize CV & ML Engines
detector = FaceDetector()
pose_estimator = PoseEstimator()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "cheat_classifier.joblib")
classifier = None
if os.path.exists(MODEL_PATH):
    try:
        classifier = joblib.load(MODEL_PATH)
        logger.info(f"Loaded ML cheat classifier from {MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load classifier: {e}")
else:
    logger.warning("Classifier file not found. Ensure train_model.py has been run.")

CLASS_NAMES = ["NORMAL", "NO_FACE", "MULTIPLE_FACES", "LOOKING_AWAY"]

class FrameAnalysisRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded JPEG or PNG image (with or without data URI prefix)")
    examId: Optional[str] = None
    userId: Optional[str] = None
    persistenceSec: Optional[float] = 1.0

class VerifyFaceRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded JPEG or PNG image")

def decode_base64_image(image_b64: str) -> np.ndarray:
    """Decodes a base64 string (including data URI) into an OpenCV BGR image."""
    try:
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Decoded image is None")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Proctora AI Live Proctoring Engine",
        "model_loaded": classifier is not None,
        "detector_ready": True,
        "timestamp": time.time()
    }

@app.post("/verify-face")
def verify_face(req: VerifyFaceRequest):
    """
    Pre-exam system check: validates candidate face is present, unique, and centered.
    """
    img = decode_base64_image(req.image)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = detector.detect_faces(gray)
    frame_h, frame_w = img.shape[:2]

    if len(faces) == 0:
        return {
            "ready": False,
            "face_detected": False,
            "num_faces": 0,
            "reason": "no_face",
            "message": "No face detected in camera feed. Please position your face clearly in view.",
            "boundingBoxes": []
        }

    if len(faces) > 1:
        return {
            "ready": False,
            "face_detected": True,
            "num_faces": len(faces),
            "reason": "multiple_faces",
            "message": f"Multiple faces ({len(faces)}) detected! Only the registered candidate must be present.",
            "boundingBoxes": faces
        }

    # Exactly 1 face
    face = faces[0]
    eyes = detector.detect_eyes(gray[face["y"]:face["y"]+face["h"], face["x"]:face["x"]+face["w"]])
    metrics = pose_estimator.estimate_pose(face, eyes, (frame_h, frame_w))

    if not metrics["is_centered"]:
        return {
            "ready": False,
            "face_detected": True,
            "num_faces": 1,
            "reason": "not_centered",
            "message": "Please center your face within the frame and sit at a normal reading distance.",
            "metrics": metrics,
            "boundingBoxes": faces
        }

    if abs(metrics["yaw"]) > 22.0 or abs(metrics["pitch"]) > 20.0:
        return {
            "ready": False,
            "face_detected": True,
            "num_faces": 1,
            "reason": "pose_deviated",
            "message": "Please look directly at the screen to calibrate camera.",
            "metrics": metrics,
            "boundingBoxes": faces
        }

    return {
        "ready": True,
        "face_detected": True,
        "num_faces": 1,
        "is_centered": True,
        "reason": "calibrated",
        "message": "Candidate face verified and centered successfully.",
        "metrics": metrics,
        "boundingBoxes": faces
    }

@app.post("/analyze-frame")
def analyze_frame(req: FrameAnalysisRequest):
    """
    Analyzes an in-exam candidate video frame for suspicious activity:
    - Candidate moved out of frame
    - Multiple people in frame
    - Looking away / gaze & head pose deviation
    """
    img = decode_base64_image(req.image)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    frame_h, frame_w = img.shape[:2]

    faces = detector.detect_faces(gray)
    num_faces = len(faces)

    persistence = max(0.5, float(req.persistenceSec or 1.0))

    if num_faces == 0:
        feature_vector = np.array([[0, 0.0, 0.0, 0.0, 1.0, 0, 0.0, persistence]], dtype=np.float32)
        metrics = {
            "num_faces": 0,
            "yaw": 0.0,
            "pitch": 0.0,
            "roll": 0.0,
            "gaze": "none",
            "center_distance": 1.0,
            "face_area_ratio": 0.0,
            "eyes_count": 0,
            "is_centered": False
        }
        details = "Candidate face not detected in frame. Please return to screen view."
        status = "no_face"
        cheat_prob = 0.92
    else:
        primary_face = faces[0]
        face_roi = gray[primary_face["y"]:primary_face["y"]+primary_face["h"], primary_face["x"]:primary_face["x"]+primary_face["w"]]
        eyes = detector.detect_eyes(face_roi)
        metrics = pose_estimator.estimate_pose(primary_face, eyes, (frame_h, frame_w))

        feature_vector = np.array([[
            num_faces,
            abs(metrics["yaw"]),
            abs(metrics["pitch"]),
            abs(metrics["roll"]),
            metrics["center_distance"],
            metrics["eyes_count"],
            metrics["face_area_ratio"],
            persistence
        ]], dtype=np.float32)

        if num_faces > 1:
            status = "multiple_faces"
            details = f"Multiple people detected in frame ({num_faces} persons)!"
            cheat_prob = 0.95
        elif abs(metrics["yaw"]) > 22.0:
            status = "looking_away"
            direction = "right" if metrics["yaw"] > 0 else "left"
            details = f"Candidate turned head to the {direction} (Yaw: {metrics['yaw']}°)"
            cheat_prob = 0.85
        elif metrics["pitch"] < -18.0:
            status = "looking_away"
            details = f"Candidate looking down at desk or notes (Pitch: {metrics['pitch']}°)"
            cheat_prob = 0.82
        elif metrics["pitch"] > 18.0:
            status = "looking_away"
            details = f"Candidate looking up away from monitor (Pitch: {metrics['pitch']}°)"
            cheat_prob = 0.78
        else:
            status = "normal"
            details = "Candidate focused on examination"
            cheat_prob = 0.05

    # Refine probability through trained ML classifier
    if classifier is not None:
        try:
            probas = classifier.predict_proba(feature_vector)[0]
            # Normal class is index 0; anomaly probability is 1.0 - probas[0]
            ml_cheat_prob = float(1.0 - probas[0])
            # Calibrate ensemble score
            cheat_prob = float(np.clip(0.6 * cheat_prob + 0.4 * ml_cheat_prob, 0.0, 1.0))
        except Exception as e:
            logger.debug(f"Classifier prediction fallback: {e}")

    flagged = cheat_prob >= 0.65

    return {
        "status": status,
        "cheat_probability": round(cheat_prob, 2),
        "flagged": flagged,
        "details": details,
        "metrics": metrics,
        "boundingBoxes": faces,
        "timestamp": time.time()
    }

@app.websocket("/ws/proctor")
async def proctor_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to /ws/proctor")
    try:
        while True:
            data = await websocket.receive_json()
            image_b64 = data.get("image")
            if not image_b64:
                await websocket.send_json({"error": "Missing image"})
                continue

            req = FrameAnalysisRequest(
                image=image_b64,
                examId=data.get("examId"),
                userId=data.get("userId"),
                persistenceSec=data.get("persistenceSec", 1.0)
            )
            result = analyze_frame(req)
            await websocket.send_json(result)
    except WebSocketDisconnect:
        logger.info("Client disconnected from /ws/proctor")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
