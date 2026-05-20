"""
Vigilant Eye - Frame Preprocessor
====================================
Handles frame resizing, normalization, and color conversion for YOLOv8.
"""

import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


class FramePreprocessor:
    """Preprocess video frames before AI detection."""

    def __init__(self, target_size=(640, 640), normalize=False, denoise=False):
        self.target_size = target_size
        self.normalize = normalize
        self.denoise = denoise

    def preprocess(self, frame):
        """
        Full preprocessing pipeline.
        Returns: preprocessed frame (BGR, ready for YOLOv8)
        """
        if frame is None:
            return None
        try:
            frame = self.resize(frame)
            if self.denoise:
                frame = self.apply_denoise(frame)
            return frame
        except Exception as e:
            logger.error(f"Preprocessing error: {e}")
            return frame

    def resize(self, frame):
        """Resize frame to target size maintaining aspect ratio."""
        h, w = frame.shape[:2]
        tw, th = self.target_size
        if w == tw and h == th:
            return frame
        scale = min(tw / w, th / h)
        nw, nh = int(w * scale), int(h * scale)
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
        # Pad to target size
        padded = np.zeros((th, tw, 3), dtype=np.uint8)
        y_off = (th - nh) // 2
        x_off = (tw - nw) // 2
        padded[y_off:y_off+nh, x_off:x_off+nw] = resized
        return padded

    def bgr_to_rgb(self, frame):
        """Convert BGR (OpenCV) to RGB."""
        return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    def normalize_frame(self, frame):
        """Normalize pixel values to [0, 1]."""
        return frame.astype(np.float32) / 255.0

    def apply_denoise(self, frame):
        """Apply fast non-local means denoising."""
        try:
            return cv2.fastNlMeansDenoisingColored(frame, None, 5, 5, 7, 21)
        except Exception:
            return frame

    def enhance_contrast(self, frame):
        """Apply CLAHE for contrast enhancement in low-light conditions."""
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    def draw_bounding_box(self, frame, box, label, confidence, color=(0, 0, 255)):
        """Draw detection bounding box with label on frame."""
        x1, y1, x2, y2 = map(int, box)
        # Box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        # Label background
        label_text = f"{label} {confidence:.0%}"
        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
        # Label text
        cv2.putText(frame, label_text, (x1 + 3, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
        return frame

    def draw_alert_overlay(self, frame, message="THEFT DETECTED"):
        """Draw flashing red alert overlay on frame."""
        overlay = frame.copy()
        h, w = frame.shape[:2]
        # Red border
        cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 220), 8)
        # Alert banner
        cv2.rectangle(overlay, (0, 0), (w, 50), (0, 0, 180), -1)
        cv2.putText(overlay, f"⚠ {message}", (10, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        return cv2.addWeighted(overlay, 0.75, frame, 0.25, 0)
