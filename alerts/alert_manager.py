"""
Vigilant Eye - Alert Manager
================================
Central hub for routing alerts to dashboard, email, and push notifications.
"""

import logging
import threading
from datetime import datetime
from database.db_manager import EventManager, CameraManager, SettingsManager
from alerts.verified_email_alert import VerifiedEmailManager
from alerts.fcm_alert import FCMAlertSender

logger = logging.getLogger(__name__)

# Global SocketIO reference (set from app.py)
_socketio = None


def set_socketio(sio):
    global _socketio
    _socketio = sio


class AlertManager:
    """Central alert dispatcher: DB logging + SocketIO + Email + FCM."""

    def __init__(self):
        self.email_manager = VerifiedEmailManager()
        self.fcm_sender = FCMAlertSender()
        self._lock = threading.Lock()

    def handle_alert(self, camera_id, activity_type, confidence,
                     snapshot_path=None, severity=None):
        """
        Main alert handler — called by detector when theft is detected.
        Logs event, emits socket event, sends email/FCM.
        """
        with self._lock:
            try:
                # Determine severity
                if severity is None:
                    if confidence >= 0.9:
                        severity = "high"
                    elif confidence >= 0.75:
                        severity = "medium"
                    else:
                        severity = "low"

                # Check if alerts globally enabled
                global_enabled = SettingsManager.get("global_alerts_enabled")
                if global_enabled == "false":
                    logger.info("Global alerts disabled. Skipping.")
                    return

                # Check per-camera alert setting
                from database.models import Camera
                cam = Camera.query.get(camera_id)
                if cam and not cam.alert_enabled:
                    logger.info(f"Alerts disabled for camera {camera_id}.")
                    return

                cam_name = cam.name if cam else f"Camera {camera_id}"

                # Log event to database
                event, err = EventManager.create_event(
                    camera_id=camera_id,
                    activity_type=activity_type,
                    confidence=confidence,
                    snapshot_path=snapshot_path,
                    severity=severity,
                )

                if err:
                    logger.error(f"Event log error: {err}")

                # Update camera stats
                CameraManager.increment_stats(camera_id, alert=True)

                # Prepare alert payload
                payload = {
                    "event_id": event.id if event else None,
                    "event_uid": event.event_uid if event else "",
                    "camera_id": camera_id,
                    "camera_name": cam_name,
                    "activity_type": activity_type,
                    "confidence": round(confidence * 100, 1),
                    "severity": severity,
                    "snapshot_path": snapshot_path,
                    "timestamp": datetime.utcnow().isoformat(),
                }

                # Emit real-time dashboard alert via SocketIO
                if _socketio:
                    _socketio.emit("new_alert", payload)
                    logger.info(f"Socket alert emitted: {activity_type} on cam {camera_id}")

                # Email alert (Multi-email system)
                self.email_manager.send_alert_email({
                    "camera_id": camera_id,
                    "camera_name": cam_name,
                    "activity_type": activity_type,
                    "confidence": confidence,
                    "location": cam.location if cam else "Store",
                    "detected_object": "Person", # Default label
                })

                # FCM push notification (background thread)
                if self.fcm_sender.enabled:
                    threading.Thread(
                        target=self.fcm_sender.send_alert,
                        kwargs={
                            "camera_name": cam_name,
                            "activity_type": activity_type,
                            "confidence": confidence,
                        },
                        daemon=True
                    ).start()

                logger.info(f"Alert handled: [{severity.upper()}] {activity_type} on {cam_name}")

            except Exception as e:
                logger.error(f"Alert manager error: {e}", exc_info=True)

    def test_alert(self, camera_id=0):
        """Send a test alert for system verification."""
        self.handle_alert(
            camera_id=camera_id,
            activity_type="Test Alert — System Check",
            confidence=0.99,
            severity="low",
        )


# Global singleton
alert_manager = AlertManager()
