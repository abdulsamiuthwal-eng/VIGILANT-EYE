"""
Vigilant Eye - Firebase FCM Alert
====================================
Push notification via Firebase Cloud Messaging (optional).
"""

import logging
from config import FCM_CONFIG

logger = logging.getLogger(__name__)


class FCMAlertSender:
    """Sends push notifications via Firebase Cloud Messaging."""

    def __init__(self):
        self.enabled = FCM_CONFIG.get("enabled", False)
        self._app = None
        if self.enabled:
            self._initialize()

    def _initialize(self):
        try:
            import firebase_admin
            from firebase_admin import credentials, messaging
            cred_path = FCM_CONFIG.get("credentials_path", "serviceAccountKey.json")
            if not self._app:
                cred = credentials.Certificate(cred_path)
                self._app = firebase_admin.initialize_app(cred)
            logger.info("Firebase FCM initialized.")
        except ImportError:
            logger.error("firebase-admin not installed. Run: pip install firebase-admin")
            self.enabled = False
        except FileNotFoundError:
            logger.error(f"serviceAccountKey.json not found. FCM disabled.")
            self.enabled = False
        except Exception as e:
            logger.error(f"FCM init error: {e}")
            self.enabled = False

    def send_notification(self, title, body, token, data=None):
        """Send a push notification to a specific device token."""
        if not self.enabled:
            logger.info("FCM disabled. Skipping push notification.")
            return False
        try:
            from firebase_admin import messaging
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=data or {},
                token=token,
            )
            response = messaging.send(message)
            logger.info(f"FCM notification sent: {response}")
            return True
        except Exception as e:
            logger.error(f"FCM send error: {e}")
            return False

    def send_alert(self, camera_name, activity_type, confidence, token=""):
        """Send a theft alert push notification."""
        title = f"🚨 THEFT ALERT — {camera_name}"
        body = f"{activity_type} detected with {confidence:.0%} confidence."
        return self.send_notification(title, body, token, data={
            "camera": camera_name,
            "activity": activity_type,
            "confidence": str(round(confidence, 2)),
        })
