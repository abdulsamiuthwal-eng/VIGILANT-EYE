import os
import cv2
from ultralytics import YOLO

def run_static_test(model_path, image_path, output_path):
    print(f"Task 1: Loading model from {model_path}...")
    if not os.path.exists(model_path):
        print(f"Model file not found at {model_path}!")
        return
        
    model = YOLO(model_path)
    print("Model successfully loaded.")
    
    # Task 1: Print model.names to confirm "person" class exists
    print("Model Class Names:")
    print(model.names)
    
    # Verify person class
    person_exists = any(name.lower() == "person" for name in model.names.values())
    if person_exists:
        print("SUCCESS: 'person' class exists in the model names.")
    else:
        print("WARNING: 'person' class NOT found in the model names!")

    print(f"\nTask 7: Loading static test image from {image_path}...")
    if not os.path.exists(image_path):
        print(f"Test image not found at {image_path}!")
        return
        
    frame = cv2.imread(image_path)
    if frame is None:
        print("Failed to read image!")
        return
        
    # Task 6: Debug logs
    print("Frame received")
    print("Detection running")
    
    # Task 4 & 2 & 3: Ensure detection pipeline with conf=0.25 and classes=None
    results = model(frame, conf=0.25, classes=None, verbose=False)
    
    # Task 6: Objects detected log
    num_objects = len(results[0].boxes) if results[0].boxes is not None else 0
    print(f"Objects detected: {num_objects}")
    
    if num_objects > 0:
        # Task 5: Display processed frame using results[0].plot()
        processed_frame = results[0].plot()
        
        # Save output so we can verify visually
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, processed_frame)
        print(f"SUCCESS: Processed frame saved with bounding boxes to {output_path}")
    else:
        print("No objects detected at confidence threshold 0.25.")

if __name__ == "__main__":
    # Test with custom best.pt
    run_static_test(
        model_path="models/best.pt", 
        image_path="snapshots/cam1_20260414_211848.jpg", 
        output_path="scratch/static_result_best.jpg"
    )
    
    # Test with fallback yolov8n.pt
    run_static_test(
        model_path="yolov8n.pt", 
        image_path="snapshots/cam1_20260414_211848.jpg", 
        output_path="scratch/static_result_yolo.jpg"
    )
