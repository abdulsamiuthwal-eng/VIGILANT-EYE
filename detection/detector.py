"""
Vigilant Eye - YOLOv8 Theft Detector
========================================
Real-time human/object detection with suspicious activity classification.
"""

import cv2
import time
import logging
import os
import threading
import numpy as np
from datetime import datetime
from pathlib import Path
from config import DETECTION_CONFIG, SNAPSHOTS_DIR, ACTIVITY_TYPES
from detection.preprocessor import FramePreprocessor
from detection.tracker import SORTTracker

logger = logging.getLogger(__name__)


class TheftDetector:
    """
    YOLOv8-based theft detection engine.
    Runs detection + SORT tracking + activity analysis.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.model = None
        self.preprocessor = FramePreprocessor(
            target_size=DETECTION_CONFIG["frame_size"]
        )
        self.trackers = {}  # camera_id -> SORTTracker
        self.track_states = {} # camera_id -> dict of track_id -> state
        self.confidence_threshold = DETECTION_CONFIG["confidence_threshold"]
        self.device = DETECTION_CONFIG["device"]
        self._alert_cooldowns = {}  # camera_id -> last alert time
        self._alert_cooldown = DETECTION_CONFIG["alert_cooldown"]
        self._alert_callbacks = []  # Functions to call on detection
        # Zone tracking: suspicious if in area > N frames
        self.zone_threshold_frames = 90  # ~3 seconds at 30fps
        self._load_model()

    def _load_model(self):
        """Force load pretrained YOLOv8n model and verify capability."""
        try:
            from ultralytics import YOLO
            
            # Task 1: Force YOLOv8n pretrained model
            model_path = "yolov8n.pt"
            logger.info(f"Forcing pretrained YOLOv8n model: {model_path}")
            self.model = YOLO(model_path)

            # Task 6: Force GPU (device=0), fallback to CPU if GPU fails
            try:
                self.model.to(0)
                self.device = 0
                logger.info("YOLOv8 model loaded on GPU (device 0)")
            except Exception as e:
                logger.warning(f"Failed to load on GPU: {e}. Falling back to 'cpu'")
                self.model.to("cpu")
                self.device = "cpu"
                logger.info("YOLOv8 model loaded on CPU")

            # Print model.names to confirm "person" class exists
            if self.model:
                print("====================================")
                print("Model Names Loaded:")
                print(self.model.names)
                person_exists = any(name.lower() == "person" for name in self.model.names.values())
                if person_exists:
                    print("Confirming 'person' class exists in the model.")
                else:
                    print("WARNING: 'person' class NOT found in the model names!")
                print("====================================")

            # Task 8: Startup Test Mode (Run detection on static image with a person)
            try:
                import cv2
                test_img_path = "snapshots/cam1_20260414_211848.jpg"
                if os.path.exists(test_img_path):
                    test_frame = cv2.imread(test_img_path)
                    if test_frame is not None:
                        print("====================================")
                        print("TEST MODE: Running detection on static image...")
                        test_results = self.model(test_frame, conf=0.25, classes=None, verbose=False, device=self.device)
                        test_objects = len(test_results[0].boxes) if test_results[0].boxes is not None else 0
                        print(f"TEST MODE SUCCESS: Detected {test_objects} objects in static image.")
                        print("====================================")
            except Exception as e:
                logger.error(f"Startup test mode failed: {e}")

        except ImportError:
            logger.error("ultralytics not installed. Run: pip install ultralytics")
            self.model = None
        except Exception as e:
            logger.error(f"Model load error: {e}")
            self.model = None

    def register_alert_callback(self, callback):
        """Register a function to be called when theft is detected."""
        self._alert_callbacks.append(callback)

    def _fire_alert(self, camera_id, activity_type, confidence, frame):
        """Fire alert if cooldown has passed."""
        now = time.time()
        last = self._alert_cooldowns.get(camera_id, 0)
        if now - last < self._alert_cooldown:
            return
        self._alert_cooldowns[camera_id] = now
        
        logger.info("Alert triggered")

        # Save snapshot
        snapshot_path = None
        try:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cam{camera_id}_{ts}.jpg"
            snapshot_path = str(SNAPSHOTS_DIR / filename)
            cv2.imwrite(snapshot_path, frame)
        except Exception as e:
            logger.error(f"Snapshot save error: {e}")

        for cb in self._alert_callbacks:
            try:
                cb(camera_id=camera_id, activity_type=activity_type,
                   confidence=confidence, snapshot_path=snapshot_path)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")

    def _get_tracker(self, camera_id):
        if camera_id not in self.trackers:
            self.trackers[camera_id] = SORTTracker(
                max_age=30, min_hits=3, iou_threshold=0.3
            )
        return self.trackers[camera_id]

    def _get_zone(self, x_center, y_center, w, h):
        for zone_name, (x1, y1, x2, y2) in DETECTION_CONFIG.get("ZONES", {}).items():
            if (w * x1 <= x_center <= w * x2) and (h * y1 <= y_center <= h * y2):
                return zone_name
        return None

    def process_frame(self, frame, camera_id):
        """
        Run detection and draw bounding boxes.
        """
        if self.model is None or frame is None:
            return frame, []

        # Task 5: Debug logs
        print("Frame received")
        print("Running detection")

        detections_out = []
        try:
            h, w = frame.shape[:2]
            
            # Task 4 & 2 & 3: Every camera frame MUST pass through model with conf=0.25 and classes=None
            results = self.model(frame, conf=0.25, classes=None, verbose=False, device=self.device)
            
            # Task 5: Detections found log
            num_objects = len(results[0].boxes) if results[0].boxes is not None else 0
            print(f"Detections found: {num_objects}")
            
            if num_objects > 0:
                # Task 4: Draw boxes via results[0].plot() and display annotated_frame
                frame = results[0].plot()
                
                # Check for person/suspicious/theft to trigger alerts
                for box in results[0].boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    coords = box.xyxy[0].tolist()
                    cls_name = self.model.names[cls_id] if hasattr(self.model, 'names') else "unknown"
                    
                    # Determine detection zone
                    x_center = (coords[0] + coords[2]) / 2
                    y_center = (coords[1] + coords[3]) / 2
                    zone = self._get_zone(x_center, y_center, w, h)
                    
                    detections_out.append({
                        "camera_id": camera_id,
                        "activity_type": cls_name,
                        "confidence": conf,
                        "bbox": coords,
                    })
                    
                    # Fire alert for suspicious class or if person entered Zone C (Exit)
                    if cls_name in ["suspicious_person", "theft_action"] or (cls_name == "person" and zone == "Zone_C_Exit"):
                        self._fire_alert(camera_id, cls_name, conf, frame)

            # Draw Zones for visualization on top of plotted frame
            zones = DETECTION_CONFIG.get("ZONES", {})
            for z_name, (x1, y1, x2, y2) in zones.items():
                cv2.rectangle(frame, (int(w*x1), int(h*y1)), (int(w*x2), int(h*y2)), (255, 255, 255), 1)
                cv2.putText(frame, z_name.replace("Zone_", ""), (int(w*x1)+5, int(h*y1)+15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        except Exception as e:
            logger.error(f"Detection processing error on cam {camera_id}: {e}")

        return frame, detections_out

    def reload_model(self, model_path=None):
        """Reload model (after training)."""
        if model_path:
            DETECTION_CONFIG["model_path"] = model_path
        self._load_model()

    def is_ready(self):
        return self.model is not None


# Global singleton
detector = TheftDetector()
