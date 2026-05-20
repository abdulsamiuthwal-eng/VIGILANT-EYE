"""
Vigilant Eye - MJPEG Stream Generator
========================================
Generates MJPEG streams suitable for HTML <img src="/stream/camera_id">.
"""

import cv2
import time
import logging
import numpy as np
from camera.camera_manager import camera_manager

logger = logging.getLogger(__name__)

OFFLINE_FRAME_CACHE = None


def _make_offline_frame(width=640, height=480, message="Camera Offline"):
    """Generate a styled 'offline' placeholder frame."""
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    frame[:] = (20, 20, 35)  # Dark blue-black background

    # Grid lines
    for x in range(0, width, 40):
        cv2.line(frame, (x, 0), (x, height), (30, 30, 50), 1)
    for y in range(0, height, 40):
        cv2.line(frame, (0, y), (width, y), (30, 30, 50), 1)

    # Icon area (camera crossed out)
    center_x, center_y = width // 2, height // 2 - 30
    cv2.circle(frame, (center_x, center_y), 40, (60, 60, 90), 2)
    cv2.line(frame, (center_x - 30, center_y - 30),
             (center_x + 30, center_y + 30), (100, 80, 80), 3)

    # Status text
    cv2.putText(frame, message, (width // 2 - 90, center_y + 70),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (150, 150, 180), 2)
    cv2.putText(frame, "Toggle camera ON to start feed",
                (width // 2 - 140, center_y + 100),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 130), 1)
    return frame


def generate_mjpeg_stream(camera_id, detector=None):
    """
    MJPEG generator for Flask streaming response.
    Yields multipart JPEG frames continuously.
    
    Args:
        camera_id: The integer camera ID from database
        detector: Optional TheftDetector instance for AI overlay
    """
    global OFFLINE_FRAME_CACHE
    if OFFLINE_FRAME_CACHE is None:
        OFFLINE_FRAME_CACHE = _make_offline_frame()

    fps_target = 25
    frame_interval = 1.0 / fps_target
    last_time = time.time()

    while True:
        now = time.time()
        elapsed = now - last_time
        if elapsed < frame_interval:
            time.sleep(frame_interval - elapsed)
        last_time = time.time()

        frame = camera_manager.get_frame(camera_id)

        if frame is None:
            frame = OFFLINE_FRAME_CACHE.copy()
            # Animated dot in corner
            dot_x = 610
            dot_y = 15
            color = (80, 80, 120) if int(time.time() * 2) % 2 == 0 else (60, 60, 100)
            cv2.circle(frame, (dot_x, dot_y), 5, color, -1)
        else:
            # Frame is already processed by the background capture loop

            # Live indicator
            cv2.circle(frame, (frame.shape[1] - 20, 15), 6, (0, 60, 255), -1)
            cv2.putText(frame, "LIVE", (frame.shape[1] - 55, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 255), 1)

            # Timestamp
            ts = time.strftime("%Y-%m-%d  %H:%M:%S")
            cv2.putText(frame, ts, (10, frame.shape[0] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

        # Encode frame
        try:
            _, buffer = cv2.imencode(".jpg", frame,
                                     [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = buffer.tobytes()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )
        except Exception as e:
            logger.error(f"Frame encoding error: {e}")
            time.sleep(0.1)
