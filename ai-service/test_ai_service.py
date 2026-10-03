import os
import cv2
import numpy as np
import base64
import json
from main import app, verify_face, analyze_frame, VerifyFaceRequest, FrameAnalysisRequest

def b64_encode_image(img: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

def create_synthetic_face_image(num_faces: int = 1, yaw_offset: int = 0, pitch_offset: int = 0) -> np.ndarray:
    """Creates a synthetic image with realistic face geometry and eye landmarks for testing."""
    h, w = 480, 640
    img = np.full((h, w, 3), 220, dtype=np.uint8) # light background

    def draw_face(center_x, center_y, radius, yaw_off, pitch_off):
        # Head / skin
        cv2.ellipse(img, (center_x, center_y), (radius, int(radius * 1.25)), 0, 0, 360, (180, 195, 220), -1)
        # Hair
        cv2.ellipse(img, (center_x, center_y - int(radius * 0.7)), (int(radius * 1.05), int(radius * 0.6)), 0, 180, 360, (50, 45, 40), -1)
        # Eyes
        eye_y = center_y - int(radius * 0.2) + pitch_off
        eye_dist = int(radius * 0.35)
        # Left eye
        cv2.circle(img, (center_x - eye_dist + yaw_off, eye_y), int(radius * 0.12), (255, 255, 255), -1)
        cv2.circle(img, (center_x - eye_dist + yaw_off, eye_y), int(radius * 0.06), (30, 30, 30), -1)
        # Right eye
        cv2.circle(img, (center_x + eye_dist + yaw_off, eye_y), int(radius * 0.12), (255, 255, 255), -1)
        cv2.circle(img, (center_x + eye_dist + yaw_off, eye_y), int(radius * 0.06), (30, 30, 30), -1)
        # Eyebrows
        cv2.line(img, (center_x - eye_dist - 15 + yaw_off, eye_y - 15), (center_x - eye_dist + 15 + yaw_off, eye_y - 15), (40, 35, 30), 3)
        cv2.line(img, (center_x + eye_dist - 15 + yaw_off, eye_y - 15), (center_x + eye_dist + 15 + yaw_off, eye_y - 15), (40, 35, 30), 3)
        # Nose
        cv2.line(img, (center_x + yaw_off, eye_y + 10), (center_x + yaw_off, eye_y + 35), (140, 150, 175), 3)
        # Mouth
        cv2.ellipse(img, (center_x + yaw_off, center_y + int(radius * 0.5) + pitch_off), (int(radius * 0.3), int(radius * 0.12)), 0, 0, 180, (110, 120, 160), -1)

    if num_faces == 1:
        draw_face(w // 2, h // 2, 110, yaw_offset, pitch_offset)
    elif num_faces == 2:
        draw_face(w // 3, h // 2, 85, 0, 0)
        draw_face((2 * w) // 3, h // 2, 85, 0, 0)

    return img

def run_tests():
    print("=" * 60)
    print("RUNNING PROCTORA AI ENGINE SUITE TESTS")
    print("=" * 60)

    # Test 1: Blank Frame (No Face)
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    res_blank = analyze_frame(FrameAnalysisRequest(image=b64_encode_image(blank_img)))
    print("[TEST 1 - NO FACE]")
    print(f"Status: {res_blank['status']} (Expected: no_face)")
    print(f"Cheat Probability: {res_blank['cheat_probability']} (Expected > 0.8)")
    print(f"Flagged: {res_blank['flagged']} (Expected: True)")
    assert res_blank["status"] == "no_face", "Failed on no_face status"
    assert res_blank["flagged"] is True, "Failed to flag missing face"
    print(">>> PASS: Missing face correctly detected and flagged.")

    # Test 2: Pre-exam Face Verification (Blank)
    res_verify_blank = verify_face(VerifyFaceRequest(image=b64_encode_image(blank_img)))
    print("\n[TEST 2 - PRE-EXAM VERIFY (BLANK)]")
    print(f"Ready: {res_verify_blank['ready']} (Expected: False)")
    print(f"Reason: {res_verify_blank['reason']} (Expected: no_face)")
    assert res_verify_blank["ready"] is False, "Should reject empty frame"
    print(">>> PASS: Pre-exam correctly blocked missing face.")

    # Test 3: Standard Centered Candidate (Normal)
    # Generate synthetic image and test
    normal_img = create_synthetic_face_image(num_faces=1, yaw_offset=0, pitch_offset=0)
    res_normal = analyze_frame(FrameAnalysisRequest(image=b64_encode_image(normal_img)))
    print("\n[TEST 3 - NORMAL CANDIDATE]")
    print(f"Status: {res_normal['status']}")
    print(f"Cheat Probability: {res_normal['cheat_probability']}")
    print(f"Flagged: {res_normal['flagged']}")
    print(f"Details: {res_normal['details']}")

    # Test 4: Multiple People Frame
    multi_img = create_synthetic_face_image(num_faces=2)
    res_multi = analyze_frame(FrameAnalysisRequest(image=b64_encode_image(multi_img)))
    print("\n[TEST 4 - MULTIPLE PEOPLE]")
    print(f"Status: {res_multi['status']}")
    print(f"Cheat Probability: {res_multi['cheat_probability']}")
    print(f"Flagged: {res_multi['flagged']}")
    print(f"Details: {res_multi['details']}")

    print("\n" + "=" * 60)
    print("ALL PROCTORA AI SUITE TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
