import torch
from ultralytics import YOLO
import sys

def check_gpu():
    print(f"Python version: {sys.version}")
    print(f"Torch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"Device name: {torch.cuda.get_device_name(0)}")
        print(f"CUDA Capability: {torch.cuda.get_device_capability(0)}")
        try:
            print(f"Arch list: {torch.cuda.get_arch_list()}")
        except:
            pass
    else:
        print("CUDA NOT AVAILABLE")

def test_train():
    try:
        model = YOLO('yolov8n.pt')
        # We need a tiny dataset to test training
        # But we can just try to initialize the trainer on device 0
        print("\nAttempting to initialize training on device 0...")
        results = model.train(data='coco8.yaml', epochs=1, imgsz=32, device=0, batch=1)
        print("Training successful on GPU!")
    except Exception as e:
        print(f"\nTraining failed: {e}")

if __name__ == "__main__":
    check_gpu()
    test_train()
