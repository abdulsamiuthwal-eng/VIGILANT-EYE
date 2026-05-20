import cv2
import time

for i in range(4):
    print(f"Trying camera {i}...")
    # Use DirectShow first
    cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(i)
        
    if cap.isOpened():
        print(f"Camera {i} opened!")
        time.sleep(1) # wait for sensor
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f"cam{i}.jpg", frame)
            print(f"Saved cam{i}.jpg")
        else:
            print(f"Failed to read frame from camera {i}")
        cap.release()
    else:
        print(f"Could not open camera {i}")
