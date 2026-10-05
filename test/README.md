# Proctora Test Suite 🛡️

Automated test architecture for the **Proctora Online Examination & Real-Time AI Proctoring System**.

All unit tests are structured in separate, dedicated directories per microservice/service, with dedicated test files per module/component. The only test combining multi-service workflows is the integrated test.

---

## 📁 Directory Structure

```
test/
├── unit/                                  # Unit Tests Directory
│   ├── backend/                           # Backend Microservice Unit Tests
│   │   ├── auth.test.ts                   # Password hashing, AES-256-GCM TOTP, JWT, schema validation
│   │   ├── examConfig.test.ts             # 9-color tiling seating plan deconfliction & PRNG shuffling
│   │   ├── examDelivery.test.ts           # Pre-flight device checks, exam time-gating, question ordering
│   │   ├── integrityMonitoring.test.ts    # Cheating score thresholds (0.65), focus infractions, telemetry
│   │   ├── evaluationExport.test.ts       # MCQ single choice, multi-correct strict grading, code telemetry
│   │   └── middleware.test.ts             # Custom AppError classes, RBAC guards, envelope serialization
│   ├── ai-service/                        # AI Proctoring Engine Microservice Unit Tests
│   │   ├── test_face_detector.py          # Bounding box geometry, duplicate suppression (IoU), noise filter
│   │   ├── test_pose_estimator.py         # Head pose (Yaw/Pitch/Roll), centering bounds, gaze deviation
│   │   ├── test_classifier.py             # 6D feature vector, cheat classification labels, probability bounds
│   │   └── test_api_endpoints.py          # /health, /verify-face, /analyze-frame request/response contracts
│   └── frontend/                          # Frontend Client Layer Unit Tests
│       ├── router.test.ts                 # Dynamic parameterized routes, wildcard fallback, query cleanup
│       ├── api_client.test.ts             # Axios interceptors, CSRF/Auth token propagation, error extraction
│       ├── auth_store.test.ts             # Client session states, role permissions, 2FA challenge flow
│       └── diagnostics.test.ts            # Hardware device diagnostics (webcam, mic, browser, resolution)
├── integration/                           # Integrated Tests Directory
│   └── proctora_integrated.test.ts        # End-to-end multi-service pipeline across Auth -> ExamConfig ->
│                                          # AI Proctoring -> Integrity Monitoring -> Evaluation & Grading
├── run_tests.sh                           # Master runner script
└── README.md                              # Test suite documentation
```

---

## 🚀 Running Tests

### 1. Run Everything (All Unit Tests + Integrated Test)

```bash
./test/run_tests.sh
```

---

### 2. Run Individual Microservice Unit Tests Separately

#### Backend Unit Tests:
```bash
# Run all backend unit tests
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/*.test.ts

# Or run specific backend module unit tests individually:
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/auth.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/examConfig.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/examDelivery.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/integrityMonitoring.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/evaluationExport.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/backend/middleware.test.ts
```

#### AI Service Unit Tests:
```bash
# Run all AI service unit tests
python3 -m unittest discover -s test/unit/ai-service -p "test_*.py"

# Or run specific AI component unit tests individually:
python3 -m unittest test/unit/ai-service/test_face_detector.py
python3 -m unittest test/unit/ai-service/test_pose_estimator.py
python3 -m unittest test/unit/ai-service/test_classifier.py
python3 -m unittest test/unit/ai-service/test_api_endpoints.py
```

#### Frontend Unit Tests:
```bash
# Run all frontend unit tests
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/frontend/*.test.ts

# Or run specific frontend module unit tests individually:
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/frontend/router.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/frontend/api_client.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/frontend/auth_store.test.ts
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/unit/frontend/diagnostics.test.ts
```

---

### 3. Run Integrated Multi-Service Test

```bash
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/tsx --test test/integration/proctora_integrated.test.ts
```
