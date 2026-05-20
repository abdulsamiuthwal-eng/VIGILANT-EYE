import os
from ultralytics import YOLO

def test_model(model_path):
    print("====================================")
    print(f"Testing model: {model_path}")
    if not os.path.exists(model_path):
        print("Model file does not exist!")
        return
        
    try:
        model = YOLO(model_path)
        print("Model successfully loaded!")
        print("Model device:", model.device)
        print("Model Classes (names):")
        for cid, name in model.names.items():
            print(f"  Class {cid}: {name}")
            
        # Check if 'person' class exists
        person_ids = [cid for cid, name in model.names.items() if name.lower() == 'person']
        if person_ids:
            print(f"SUCCESS: 'person' class exists with ID(s): {person_ids}")
        else:
            print("WARNING: 'person' class NOT found in model names!")
            
    except Exception as e:
        print(f"Error loading model: {e}")

if __name__ == "__main__":
    test_model("models/best.pt")
    test_model("yolov8n.pt")
