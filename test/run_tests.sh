#!/usr/bin/env bash
set -e

# ==============================================================================
# Proctora Automated Test Suite Runner
# Runs individual unit tests for each microservice and the integrated system test
# ==============================================================================

# ANSI Color codes
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
NC="\033[0m" # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_PATH="$ROOT_DIR/backend/node_modules:$ROOT_DIR/frontend/node_modules"
TSX_BIN="$ROOT_DIR/backend/node_modules/.bin/tsx"
if [ -f "$ROOT_DIR/ai-service/venv/bin/python" ]; then
  PYTHON_BIN="$ROOT_DIR/ai-service/venv/bin/python"
else
  PYTHON_BIN="python3"
fi

echo -e "${BOLD}${BLUE}====================================================================${NC}"
echo -e "${BOLD}${CYAN}                PROCTORA TEST SUITE EXECUTION                       ${NC}"
echo -e "${BOLD}${BLUE}====================================================================${NC}"

# 1. Backend Unit Tests
echo -e "\n${BOLD}${YELLOW}[1/4] Running Backend Unit Tests (Individual Modules)...${NC}"
$TSX_BIN --test \
  test/unit/backend/auth.test.ts \
  test/unit/backend/examConfig.test.ts \
  test/unit/backend/examDelivery.test.ts \
  test/unit/backend/integrityMonitoring.test.ts \
  test/unit/backend/evaluationExport.test.ts \
  test/unit/backend/middleware.test.ts
echo -e "${GREEN}✔ Backend unit tests completed successfully.${NC}"

# 2. AI Service Unit Tests
echo -e "\n${BOLD}${YELLOW}[2/4] Running AI Service Unit Tests (Individual Modules)...${NC}"
$PYTHON_BIN test/unit/ai-service/test_face_detector.py
$PYTHON_BIN test/unit/ai-service/test_pose_estimator.py
$PYTHON_BIN test/unit/ai-service/test_classifier.py
$PYTHON_BIN test/unit/ai-service/test_api_endpoints.py
echo -e "${GREEN}✔ AI Service unit tests completed successfully.${NC}"

# 3. Frontend Unit Tests
echo -e "\n${BOLD}${YELLOW}[3/4] Running Frontend Unit Tests (Individual Modules)...${NC}"
$TSX_BIN --test \
  test/unit/frontend/landing_page.test.ts \
  test/unit/frontend/router.test.ts \
  test/unit/frontend/api_client.test.ts \
  test/unit/frontend/auth_store.test.ts \
  test/unit/frontend/diagnostics.test.ts
echo -e "${GREEN}✔ Frontend unit tests completed successfully.${NC}"

# 4. Integrated System Test
echo -e "\n${BOLD}${YELLOW}[4/4] Running Integrated System Test (Multi-Service Pipeline)...${NC}"
$TSX_BIN --test test/integration/proctora_integrated.test.ts
echo -e "${GREEN}✔ Integrated system test completed successfully.${NC}"

echo -e "\n${BOLD}${GREEN}====================================================================${NC}"
echo -e "${BOLD}${GREEN}   ALL SEPARATE UNIT TESTS AND INTEGRATED TEST PASSED! 🛡️          ${NC}"
echo -e "${BOLD}${GREEN}====================================================================${NC}"
