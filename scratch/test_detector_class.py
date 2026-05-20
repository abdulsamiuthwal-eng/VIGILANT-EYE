import os
import cv2
import sys
from pathlib import Path

# Ensure root workspace is in sys.path
sys.path.append(str(Path(__file__).parent.parent))

from config import DETECTION_CONFIG
from detection.detector import TheftDetector

def test_config(model_name, model_path):
    print("\n====================================")
    print(f"Testing TheftDetector with: {model_name} ({model_path})")
    print("====================================")
    
    # Update config
    DETECTION_CONFIG["model_path"] = model_path
    
    detector = TheftDetector()
    # Force reload model with the configured path
    detector.reload_model(model_path)
    
    image_path = "snapshots/cam1_20260414_211848.jpg"
    frame = cv2.imread(image_path)
    if frame is None:
        print("Failed to load test image!")
        return
        
    processed_frame, detections = detector.process_frame(frame, camera_id=1)
    print("Detections found:", len(detections))
    
    # Save the processed frame
    output_path = f"scratch/detector_{model_name}_result.jpg"
    cv2.imwrite(output_path, processed_frame)
    print(f"Processed frame saved to {output_path}")

if __name__ == "__main__":
    # Test custom best.pt
    test_config("best", "models/best.pt")
    
    # Test fallback yolov8n.pt
    test_config("yolov8n", "yolov8n.pt")
