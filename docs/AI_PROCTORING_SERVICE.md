# Proctora Live AI Proctoring Service 🛡️🤖

## Overview
The **Proctora AI Proctoring Service** is an ultra-fast, high-precision Python microservice designed to perform real-time video analytics on candidate webcam streams. It detects and flags suspicious behavioral anomalies during online examinations while minimizing false positives using 3D facial geometry and machine learning.

---

## Key Capabilities

1. **Pre-Exam Camera & Face Verification (`/verify-face`)**:
   - Ensures candidate's face is clearly visible, centered within framing bounds (optimal area ratio 4%–30%), and properly illuminated.
   - Prevents candidate entry until facial calibration passes.

2. **Real-Time Suspicious Event Detection (`/analyze-frame`)**:
   - **Out of Frame / No Face**: Detects when candidate steps away, ducks below camera, or covers lens.
   - **Multiple People in Frame**: Flags unauthorized secondary individuals assisting the candidate.
   - **Gaze & Head Pose Deviation (Looking Away)**: Uses OpenCV SolvePnP 3D pose estimation to compute Euler angles (Yaw, Pitch, Roll) and eye-to-face vector offsets. Flags sustained gaze shifts to secondary monitors, cheat sheets, or phones.

3. **Machine Learning Behavioral Classifier**:
   - Trained Random Forest model (`models/cheat_classifier.joblib`) calibrated on 25,000 behavioral telemetry feature vectors.
   - Computes a nuanced `cheatProbability` (0.0 to 1.0) and human-readable anomaly descriptions.

4. **In-Exam Candidate Alerts**:
   - Visual warning banners and pulsing status badges directly on candidate's webcam feed.
   - Auditory warning chime via Web Audio API.

5. **Secure Backend Ingestion & Decryption**:
   - Ingests telemetry via `POST /api/exams/:examId/proctoring/frame`.
   - Payload encrypted with AES-256-GCM.
   - Real-time decrypted event stream delivered to the Admin Invigilation Monitor (`/admin/exams/:examId/monitor`).

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Candidate Browser
        Webcam[Webcam Video Stream] --> Canvas[Frame Sampler: 2.5s loop]
        Canvas -->|POST base64 image| Proxy["Vite Proxy (/ai-proctor)"]
        Alerts["Candidate HUD Alert Banner & Audio Chime"] <--- Canvas
    end

    subgraph Python AI Microservice (Port 5001)
        Proxy --> FastAPIServer[FastAPI Server]
        FastAPIServer --> FaceDetector[Multi-Cascade Face & Profile Detector]
        FastAPIServer --> PoseEstimator[3D SolvePnP Head Pose & Gaze]
        FaceDetector --> FeatureVector[Feature Extractor]
        PoseEstimator --> FeatureVector
        FeatureVector --> RFModel["Random Forest Classifier (models/cheat_classifier.joblib)"]
        RFModel --> AnomalyDecision[Cheat Probability & Anomaly Code]
    end

    AnomalyDecision -->|Response| Canvas
    Canvas -->|If flagged: POST /api/exams/:id/proctoring/frame| ExpressBackend["Express Backend (Port 4000)"]
    
    subgraph Backend & Database
        ExpressBackend --> AES["AES-256-GCM Encryption"]
        AES --> DB[(PostgreSQL Database)]
        DB --> FeedService["Evaluation & Monitor Service (AES Decrypt)"]
    end

    subgraph Admin Dashboard
        FeedService --> AdminMonitor["Admin Invigilation Feed (/admin/exams/:id/monitor)"]
    end
```

---

## Directory Structure

```
ai-service/
├── face_detector.py      # Multi-scale frontal, profile & eye detection with NMS
├── pose_estimator.py     # 3D Euler angles (Yaw/Pitch/Roll) & gaze geometry
├── train_model.py        # 25,000-sample dataset generator and RF model trainer
├── main.py               # FastAPI application with REST & WebSocket endpoints
├── requirements.txt      # Python dependencies
├── venv/                 # Virtual environment (Python 3.12)
└── models/
    └── cheat_classifier.joblib   # Serialized trained Random Forest classifier
```

---

## API Endpoints

### 1. `GET /health`
Returns service status, loaded model type, and available Haar cascade classifiers.

**Response**:
```json
{
  "status": "healthy",
  "service": "proctora-ai-proctor",
  "version": "1.0.0",
  "model_loaded": true,
  "model_type": "RandomForestClassifier",
  "cascades_loaded": {
    "frontal_face": true,
    "profile_face": true,
    "eye": true
  }
}
```

### 2. `POST /verify-face`
Validates camera and candidate framing for pre-flight device diagnostics.

**Request**:
```json
{
  "image": "data:image/jpeg;base64,..."
}
```

**Response**:
```json
{
  "verified": true,
  "face_detected": true,
  "face_count": 1,
  "is_centered": true,
  "quality_score": 0.95,
  "message": "Face verified and centered"
}
```

### 3. `POST /analyze-frame`
Continuous background video frame analyzer.

**Request**:
```json
{
  "image": "data:image/jpeg;base64,...",
  "exam_id": "TEST-MS2026",
  "candidate_id": "candidate-uuid",
  "timestamp": 1727968390000
}
```

**Response**:
```json
{
  "status": "normal",
  "is_suspicious": false,
  "cheat_probability": 0.04,
  "face_count": 1,
  "anomalies": [],
  "pose": {
    "yaw": 2.1,
    "pitch": -1.4,
    "roll": 0.8,
    "is_looking_away": false,
    "gaze_direction": "center"
  },
  "timestamp": 1727968390000
}
```

---

## Starting the Service

### Run natively in development:
```bash
cd ai-service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

### Run model training / recalibration:
```bash
cd ai-service
source venv/bin/activate
python train_model.py
```

---

## Integration Details

- **Frontend Proxy**: Vite dev server forwards all `/ai-proctor/*` requests to `http://localhost:5001/*`.
- **Exam Session**: The candidate webcam stream is captured unobtrusively via an off-screen HTML5 `<canvas>` element every 2.5 seconds.
- **Admin Real-Time Monitor**: Flagged frames are encrypted on write with AES-256-GCM, persisted to PostgreSQL, and decrypted when loaded in the Admin Invigilation Monitor dashboard.
