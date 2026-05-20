import cv2
import time

def test_webcam(index=0):
    print(f"Testing webcam at index {index}...")
    
    # Try with DirectShow
    print("Attempting to open with CAP_DSHOW...")
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if cap.isOpened():
        print("Success with CAP_DSHOW!")
    else:
        print("Failed with CAP_DSHOW. Trying default...")
        cap.release()
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            print("Success with default backend!")
        else:
            print("Failed with default backend too.")
            return

    ret, frame = cap.read()
    if ret:
        print(f"Successfully read a frame! Shape: {frame.shape}")
    else:
        print("Failed to read a frame.")

    cap.release()
    print("Camera released.")

if __name__ == "__main__":
    test_webcam(0)
    test_webcam(1)
