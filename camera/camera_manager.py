"""
Vigilant Eye - Camera Manager
================================
Manages multiple camera streams, ON/OFF state, and dynamic add/remove.
"""

import cv2
import logging
import threading
import time
from datetime import datetime
from config import CAMERA_CONFIG, DETECTION_CONFIG

logger = logging.getLogger(__name__)


class CameraStream:
    """Thread-safe camera stream handler for a single camera."""

    def __init__(self, camera_id, source, name="Camera"):
        self.camera_id = camera_id
        self.source = source
        self.name = name
        self._cap = None
        self._frame = None
        self._lock = threading.Lock()
        self._running = False
        self._thread = None
        self._retry_count = 0
        self._max_retries = CAMERA_CONFIG["reconnect_attempts"]
        self._retry_delay = CAMERA_CONFIG["reconnect_delay"]

    def _parse_source(self):
        """Convert source string to proper type (int for webcam, str for URL/IP)."""
        try:
            return int(self.source)
        except (ValueError, TypeError):
            return str(self.source)

    def start(self):
        """Start camera capture thread non-blockingly."""
        if self._running:
            return True

        self._running = True
        self._retry_count = 0
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info(f"Camera start requested: {self.name} [{self.source}]")
        return True

    def stop(self):
        """Stop camera capture thread."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
        if self._cap:
            self._cap.release()
            self._cap = None
        self._frame = None
        logger.info(f"Camera stopped: {self.name}")

    def _init_camera(self, src):
        """Helper to initialize VideoCapture and set properties."""
        try:
            if isinstance(src, int) or (isinstance(src, str) and src.isdigit()):
                # Use DirectShow on Windows for local webcams
                self._cap = cv2.VideoCapture(int(src), cv2.CAP_DSHOW)
                if not self._cap or not self._cap.isOpened():
                    self._cap = cv2.VideoCapture(int(src))
            else:
                self._cap = cv2.VideoCapture(src)
                
            if self._cap and self._cap.isOpened():
                self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self._cap.set(cv2.CAP_PROP_FPS, CAMERA_CONFIG["default_fps"])
                return True
        except Exception as e:
            logger.error(f"Error initializing camera {self.name}: {e}")
            
        return False

    def _capture_loop(self):
        """Continuously capture frames in a background thread."""
        src = self._parse_source()
        
        # Initial connection attempt inside the background thread
        if self._init_camera(src):
            logger.info(f"Camera successfully opened: {self.name} [{self.source}]")
        else:
            logger.warning(f"Cannot open camera initially: {self.name} [{self.source}]. Falling back to reconnect loop.")

        while self._running:
            if self._cap and self._cap.isOpened():
                ret, frame = self._cap.read()
                if ret:
                    # Process frame right away in background
                    try:
                        from config import DETECTION_CONFIG
                        if DETECTION_CONFIG.get("enabled_globally", True):
                            from detection.detector import detector
                            if detector.is_ready():
                                frame, _ = detector.process_frame(frame, self.camera_id)
                    except Exception as e:
                        logger.error(f"Background detection error on camera {self.camera_id}: {e}")

                    with self._lock:
                        self._frame = frame
                    self._retry_count = 0
                else:
                    logger.warning(f"Frame read failed: {self.name}. Retrying in background...")
                    self._handle_reconnect()
            else:
                self._handle_reconnect()
            time.sleep(0.033)  # ~30 FPS

    def _handle_reconnect(self):
        """Attempt to reconnect camera after failure."""
        if self._retry_count >= self._max_retries:
            logger.error(f"Camera {self.name} failed after {self._max_retries} retries. Stop auto-reconnect.")
            self._running = False
            return
        self._retry_count += 1
        logger.info(f"Reconnecting camera {self.name} (attempt {self._retry_count})...")
        time.sleep(self._retry_delay)
        if self._cap:
            self._cap.release()
        src = self._parse_source()
        if self._init_camera(src):
            logger.info(f"Camera reconnected successfully: {self.name}")

    def get_frame(self):
        """Get the latest captured frame (thread-safe)."""
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    def take_snapshot(self, output_path):
        """Save current frame as JPEG snapshot."""
        frame = self.get_frame()
        if frame is not None:
            cv2.imwrite(output_path, frame,
                        [cv2.IMWRITE_JPEG_QUALITY, CAMERA_CONFIG["snapshot_quality"]])
            return True
        return False

    @property
    def is_running(self):
        return self._running and self._frame is not None

    def get_status(self):
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "source": self.source,
            "running": self._running,
            "has_frame": self._frame is not None,
            "retry_count": self._retry_count,
        }


class CameraManager:
    """
    Manages all active camera streams.
    Singleton pattern — one instance for entire app lifecycle.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._cameras = {}  # camera_id -> CameraStream
                cls._instance._initialized = True
        return cls._instance

    def add_camera(self, camera_id, source, name="Camera"):
        """Add and start a new camera stream."""
        if camera_id in self._cameras:
            logger.warning(f"Camera {camera_id} already exists.")
            return False

        if len(self._cameras) >= CAMERA_CONFIG["max_cameras"]:
            logger.error("Maximum camera limit reached.")
            return False

        stream = CameraStream(camera_id, source, name)
        success = stream.start()
        if success:
            self._cameras[camera_id] = stream
            logger.info(f"Camera {camera_id} added to manager.")
        return success

    def remove_camera(self, camera_id):
        """Stop and remove a camera stream."""
        if camera_id in self._cameras:
            self._cameras[camera_id].stop()
            del self._cameras[camera_id]
            logger.info(f"Camera {camera_id} removed from manager.")
            return True
        return False

    def toggle_camera(self, camera_id, source, name, active):
        """Toggle camera ON or OFF."""
        if active:
            if camera_id not in self._cameras:
                return self.add_camera(camera_id, source, name)
            return True
        else:
            return self.remove_camera(camera_id)

    def get_frame(self, camera_id):
        """Get latest frame for a specific camera."""
        if camera_id in self._cameras:
            return self._cameras[camera_id].get_frame()
        return None

    def get_stream(self, camera_id):
        """Get camera stream object."""
        return self._cameras.get(camera_id)

    def take_snapshot(self, camera_id, output_path):
        """Take a snapshot from a specific camera."""
        stream = self._cameras.get(camera_id)
        if stream:
            return stream.take_snapshot(output_path)
        return False

    def get_all_status(self):
        """Return status of all managed cameras."""
        return {cid: stream.get_status() for cid, stream in self._cameras.items()}

    def get_active_cameras(self):
        """Return list of active camera IDs."""
        return [cid for cid, s in self._cameras.items() if s.is_running]

    def stop_all(self):
        """Stop all cameras gracefully."""
        for stream in self._cameras.values():
            stream.stop()
        self._cameras.clear()
        logger.info("All cameras stopped.")

    def detect_available_cameras(self, max_index=5):
        """Scan for available camera indexes on system."""
        available = []
        for i in range(max_index):
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if cap.isOpened():
                available.append({"index": i, "name": f"Camera {i}"})
                cap.release()
            else:
                cap = cv2.VideoCapture(i)
                if cap.isOpened():
                    available.append({"index": i, "name": f"Camera {i}"})
                    cap.release()
        return available

    @staticmethod
    def validate_source(source):
        """Check if a local webcam/index source is accessible (5-second timeout)."""
        try:
            if isinstance(source, int) or (isinstance(source, str) and source.strip().isdigit()):
                cap = cv2.VideoCapture(int(source), cv2.CAP_DSHOW)
                if cap:
                    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
                if not cap or not cap.isOpened():
                    cap = cv2.VideoCapture(int(source))
                    if cap:
                        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
            else:
                cap = cv2.VideoCapture(source)
                if cap:
                    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)

            if cap and cap.isOpened():
                ret, _ = cap.read()
                cap.release()
                return ret
        except Exception as e:
            logger.warning(f"validate_source error for '{source}': {e}")
        return False


# Global singleton instance
camera_manager = CameraManager()
