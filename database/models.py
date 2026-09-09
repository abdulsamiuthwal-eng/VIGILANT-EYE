"""
Vigilant Eye - Database Models
================================
SQLAlchemy ORM models for all database tables.
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import UserMixin

db = SQLAlchemy()
bcrypt = Bcrypt()


class User(UserMixin, db.Model):
    """User account model with secure password hashing."""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(20), default="operator")  # admin / operator
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    email_verified = db.Column(db.Boolean, default=False)
    profile_picture_url = db.Column(db.String(255), nullable=True)
    auth_method = db.Column(db.String(50), default="local")
    verification_token = db.Column(db.String(100), nullable=True)

    # Preferences (default to OFF for new users)
    email_alerts = db.Column(db.Boolean, default=False)
    push_alerts = db.Column(db.Boolean, default=False)
    sound_alerts = db.Column(db.Boolean, default=False)
    theme = db.Column(db.String(10), default="dark")

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "theme": self.theme,
            "email_alerts": self.email_alerts,
            "push_alerts": self.push_alerts,
            "sound_alerts": self.sound_alerts,
            "profile_picture_url": self.profile_picture_url,
            "email_verified": self.email_verified,
            "auth_method": self.auth_method,
        }

    def __repr__(self):
        return f"<User {self.email}>"


class Camera(db.Model):
    """Camera device model."""
    __tablename__ = "cameras"

    id = db.Column(db.Integer, primary_key=True)
    camera_uid = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    source = db.Column(db.String(255), nullable=False)  # 0,1,2 or RTSP URL or IP
    camera_type = db.Column(db.String(30), default="usb")  # usb / wifi / ip / mobile
    location = db.Column(db.String(100), default="Unspecified")
    is_active = db.Column(db.Boolean, default=False)
    detection_enabled = db.Column(db.Boolean, default=False)
    alert_enabled = db.Column(db.Boolean, default=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, nullable=True)

    # Stats
    total_alerts = db.Column(db.Integer, default=0)
    total_detections = db.Column(db.Integer, default=0)

    events = db.relationship("Event", backref="camera", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "camera_uid": self.camera_uid,
            "name": self.name,
            "source": self.source,
            "camera_type": self.camera_type,
            "location": self.location,
            "is_active": self.is_active,
            "detection_enabled": self.detection_enabled,
            "alert_enabled": self.alert_enabled,
            "total_alerts": self.total_alerts,
            "total_detections": self.total_detections,
            "added_at": self.added_at.isoformat(),
        }

    def __repr__(self):
        return f"<Camera {self.name} [{self.source}]>"


class Event(db.Model):
    """Theft/suspicious activity event model."""
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    event_uid = db.Column(db.String(50), unique=True, nullable=False)
    camera_id = db.Column(db.Integer, db.ForeignKey("cameras.id"), nullable=False)
    activity_type = db.Column(db.String(100), nullable=False)
    confidence = db.Column(db.Float, default=0.0)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    snapshot_path = db.Column(db.String(255), nullable=True)
    video_clip_path = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_reviewed = db.Column(db.Boolean, default=False)
    is_false_alarm = db.Column(db.Boolean, default=False)
    severity = db.Column(db.String(20), default="medium")  # low / medium / high

    def to_dict(self):
        return {
            "id": self.id,
            "event_uid": self.event_uid,
            "camera_id": self.camera_id,
            "camera_name": self.camera.name if self.camera else "Unknown",
            "activity_type": self.activity_type,
            "confidence": round(self.confidence * 100, 1),
            "timestamp": self.timestamp.isoformat(),
            "snapshot_path": self.snapshot_path,
            "is_reviewed": self.is_reviewed,
            "is_false_alarm": self.is_false_alarm,
            "severity": self.severity,
        }

    def __repr__(self):
        return f"<Event {self.event_uid} - {self.activity_type}>"


class SystemSettings(db.Model):
    """Global system settings."""
    __tablename__ = "system_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get(cls, key, default=None):
        setting = cls.query.filter_by(key=key).first()
        return setting.value if setting else default

    @classmethod
    def set(cls, key, value):
        setting = cls.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value)
            setting.updated_at = datetime.utcnow()
        else:
            setting = cls(key=key, value=str(value))
            db.session.add(setting)
        db.session.commit()

    def __repr__(self):
        return f"<Setting {self.key}={self.value}>"


class TrainingSession(db.Model):
    """AI model training session record."""
    __tablename__ = "training_sessions"

    id = db.Column(db.Integer, primary_key=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default="pending")  # pending/running/completed/failed
    epochs = db.Column(db.Integer, default=50)
    dataset_size = db.Column(db.Integer, default=0)
    accuracy = db.Column(db.Float, nullable=True)
    map50 = db.Column(db.Float, nullable=True)
    model_path = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    initiated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "epochs": self.epochs,
            "dataset_size": self.dataset_size,
            "accuracy": self.accuracy,
            "map50": self.map50,
            "notes": self.notes,
        }
