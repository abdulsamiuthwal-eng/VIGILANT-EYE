"""
Vigilant Eye - Database Manager
=================================
CRUD operations and database utilities.
"""

import uuid
import logging
from datetime import datetime, timedelta
from database.models import db, User, Camera, Event, SystemSettings, TrainingSession
from config import DEVELOPER_CONFIG

logger = logging.getLogger(__name__)


class UserManager:
    @staticmethod
    def create_user(name, email, password, role="operator"):
        try:
            if User.query.filter_by(email=email).first():
                return None, "Email already registered"
            user = User(name=name, email=email, role=role)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            logger.info(f"New user created: {email}")
            return user, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating user: {e}")
            return None, str(e)

    @staticmethod
    def get_by_email(email):
        return User.query.filter_by(email=email, is_active=True).first()

    @staticmethod
    def get_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def update_last_login(user_id):
        try:
            user = User.query.get(user_id)
            if user:
                user.last_login = datetime.utcnow()
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating last login: {e}")

    @staticmethod
    def update_preferences(user_id, preferences: dict):
        try:
            user = User.query.get(user_id)
            if not user:
                return False, "User not found"
            for key, value in preferences.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating preferences: {e}")
            return False, str(e)

    @staticmethod
    def reset_password(email, new_password):
        try:
            user = User.query.filter_by(email=email).first()
            if not user:
                return False, "Email not found"
            user.set_password(new_password)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def get_all():
        return User.query.all()

    @staticmethod
    def delete_user(user_id):
        try:
            user = User.query.get(user_id)
            if not user:
                return False, "User not found"
            db.session.delete(user)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting user: {e}")
            return False, str(e)


class CameraManager:
    @staticmethod
    def add_camera(name, source, camera_type="usb", location="Store"):
        try:
            existing = Camera.query.filter_by(source=str(source)).first()
            if existing:
                return None, "Camera with this source already exists"
            camera = Camera(
                camera_uid=str(uuid.uuid4())[:8].upper(),
                name=name,
                source=str(source),
                camera_type=camera_type,
                location=location,
            )
            db.session.add(camera)
            db.session.commit()
            logger.info(f"Camera added: {name} [{source}]")
            return camera, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding camera: {e}")
            return None, str(e)

    @staticmethod
    def get_all():
        return Camera.query.all()

    @staticmethod
    def get_by_id(camera_id):
        return Camera.query.get(camera_id)

    @staticmethod
    def toggle_camera(camera_id, active: bool):
        try:
            camera = Camera.query.get(camera_id)
            if not camera:
                return False, "Camera not found"
            camera.is_active = active
            if active:
                camera.last_seen = datetime.utcnow()
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error toggling camera: {e}")
            return False, str(e)

    @staticmethod
    def remove_camera(camera_id):
        try:
            camera = Camera.query.get(camera_id)
            if not camera:
                return False, "Camera not found"
            camera.is_active = False
            db.session.delete(camera)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error removing camera: {e}")
            return False, str(e)

    @staticmethod
    def increment_stats(camera_id, alert=False):
        try:
            camera = Camera.query.get(camera_id)
            if camera:
                camera.total_detections += 1
                if alert:
                    camera.total_alerts += 1
                camera.last_seen = datetime.utcnow()
                db.session.commit()
        except Exception as e:
            db.session.rollback()


class EventManager:
    @staticmethod
    def create_event(camera_id, activity_type, confidence, snapshot_path=None,
                     description=None, severity="medium"):
        try:
            event = Event(
                event_uid=str(uuid.uuid4())[:12].upper(),
                camera_id=camera_id,
                activity_type=activity_type,
                confidence=confidence,
                snapshot_path=snapshot_path,
                description=description,
                severity=severity,
            )
            db.session.add(event)
            db.session.commit()
            logger.info(f"Event logged: {event.event_uid} - {activity_type}")
            return event, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating event: {e}")
            return None, str(e)

    @staticmethod
    def get_all(limit=100, offset=0, camera_id=None, activity_type=None,
                start_date=None, end_date=None, reviewed=None):
        query = Event.query
        if camera_id:
            query = query.filter_by(camera_id=camera_id)
        if activity_type:
            query = query.filter(Event.activity_type.ilike(f"%{activity_type}%"))
        if start_date:
            query = query.filter(Event.timestamp >= start_date)
        if end_date:
            query = query.filter(Event.timestamp <= end_date)
        if reviewed is not None:
            query = query.filter_by(is_reviewed=reviewed)
        return query.order_by(Event.timestamp.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def get_stats():
        total = Event.query.count()
        today = Event.query.filter(
            Event.timestamp >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).count()
        false_alarms = Event.query.filter_by(is_false_alarm=True).count()
        accuracy = round(((total - false_alarms) / total * 100), 1) if total > 0 else 0

        # Weekly data for charts
        weekly = []
        for i in range(7):
            day = datetime.utcnow() - timedelta(days=i)
            count = Event.query.filter(
                Event.timestamp >= day.replace(hour=0, minute=0, second=0),
                Event.timestamp < day.replace(hour=23, minute=59, second=59)
            ).count()
            weekly.append({"day": day.strftime("%a"), "count": count})

        return {
            "total": total,
            "today": today,
            "false_alarms": false_alarms,
            "accuracy": accuracy,
            "weekly": list(reversed(weekly)),
        }

    @staticmethod
    def mark_reviewed(event_id, is_false_alarm=False):
        try:
            event = Event.query.get(event_id)
            if event:
                event.is_reviewed = True
                event.is_false_alarm = is_false_alarm
                db.session.commit()
                return True, None
            return False, "Event not found"
        except Exception as e:
            db.session.rollback()
            return False, str(e)


class SettingsManager:
    DEFAULTS = {
        "alert_sound_enabled": "false",
        "alert_volume": "0.8",
        "alert_tone": "default",
        "global_alerts_enabled": "false",
        "detection_confidence": "0.7",
        "theme": "dark",
        "email_alerts_enabled": "false",
        "push_alerts_enabled": "false",
        # Multi-email alert list (JSON encoded)
        "verified_alert_emails_list": "[]",
        # Pending OTP fields for new-email verification flow
        "pending_new_verified_email": "",
        "pending_new_verified_otp": "",
        "pending_new_verified_otp_expiry": "",
        "pending_new_verified_otp_attempts": "0",
    }

    @classmethod
    def initialize_defaults(cls):
        for key, value in cls.DEFAULTS.items():
            if not SystemSettings.query.filter_by(key=key).first():
                SystemSettings.set(key, value)

    @classmethod
    def get(cls, key):
        return SystemSettings.get(key, cls.DEFAULTS.get(key))

    @classmethod
    def set(cls, key, value):
        return SystemSettings.set(key, value)

    @classmethod
    def get_all(cls):
        settings = {}
        for key in cls.DEFAULTS:
            settings[key] = cls.get(key)
        return settings
