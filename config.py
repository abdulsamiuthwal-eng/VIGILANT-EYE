"""
Vigilant Eye - Central Configuration
=====================================
Edit this file to configure your email, Firebase, and other settings.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ─────────────────────────────────────────────
# Base Paths
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

DB_PATH = BASE_DIR / "database" / "vigilant_eye.db"
SNAPSHOTS_DIR = BASE_DIR / "snapshots"
MODELS_DIR = BASE_DIR / "models"
SOUNDS_DIR = BASE_DIR / "sounds"
LOGS_DIR = BASE_DIR / "logs"
DATASET_DIR = BASE_DIR / "dataset"

# Create required directories
for d in [SNAPSHOTS_DIR, MODELS_DIR, SOUNDS_DIR, LOGS_DIR, DATASET_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
# Flask Configuration
# ─────────────────────────────────────────────
class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "vigilant-eye-secret-key-2024-secure")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max upload
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "your-google-client-id-here.apps.googleusercontent.com")

    # Session
    SESSION_PERMANENT = False
    SESSION_COOKIE_SECURE = False  # Set True in production with HTTPS
    SESSION_COOKIE_HTTPONLY = True
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour

# ─────────────────────────────────────────────
# Email Configuration (Gmail SMTP)
# ─────────────────────────────────────────────
EMAIL_CONFIG = {
    "enabled": os.environ.get("EMAIL_ENABLED", "True").lower() == "true",
    "sender_email": os.environ.get("SENDER_EMAIL", "your_email@gmail.com"),         # << Set in .env or update here
    "sender_password": os.environ.get("SENDER_PASSWORD", "your_16_digit_app_password"),    # << Use Gmail App Password
    "recipient_email": os.environ.get("RECIPIENT_EMAIL", "alert_recipient@gmail.com"), # << Set recipient email
    "smtp_host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
    "smtp_port": int(os.environ.get("SMTP_PORT", 587)),
}

# ─────────────────────────────────────────────
# Free Email API Configuration (EmailJS)
# ─────────────────────────────────────────────
EMAIL_API_CONFIG = {
    "enabled": True,
    "service_id": "service_xxxxxxx",
    "template_id": "template_xxxxxxx",
    "public_key": "user_xxxxxxxxxxxx",
    "private_key": "xxxxxxxxxxxxxxxx",
}

# ─────────────────────────────────────────────
# Brevo Email API Configuration (NEW)
# ─────────────────────────────────────────────
BREVO_CONFIG = {
    "enabled": False,
    "api_key": "xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", # << Replace with actual Brevo API Key
    "sender_email": "security@vigilanteye.ai",
    "sender_name": "Vigilant Eye Security",
}

# ─────────────────────────────────────────────
# Firebase FCM Configuration (Optional)
# ─────────────────────────────────────────────
FCM_CONFIG = {
    "enabled": False,  # Set to True when serviceAccountKey.json is added
    "credentials_path": str(BASE_DIR / "serviceAccountKey.json"),
}

# ─────────────────────────────────────────────
# AI Detection Configuration
# ─────────────────────────────────────────────
DETECTION_CONFIG = {
    "model_path": str(MODELS_DIR / "best.pt"),
    "fallback_model": "yolov8n.pt",  # Downloaded automatically if best.pt missing
    "confidence_threshold": 0.3,
    "frame_size": (640, 640),
    "device": 0,  # Use GPU 0
    "alert_cooldown": 10,  # Seconds between repeated alerts for same camera
    
    # ─────────────────────────────────────────────
    # Smart Theft Detection - Zone Logic
    # ─────────────────────────────────────────────
    "ZONES": {
        # Defined as relative coordinates: [x_min, y_min, x_max, y_max] (0.0 to 1.0)
        "Zone_A_Shelf": [0.0, 0.0, 0.33, 1.0],      # Left third of the frame
        "Zone_B_Checkout": [0.66, 0.0, 1.0, 0.5],   # Top right corner
        "Zone_C_Exit": [0.66, 0.5, 1.0, 1.0],       # Bottom right corner
    },
    "ZONE_A_DWELL_TIME": 1.5,  # Seconds person must spend in Zone A to trigger pickup logic
}

# ─────────────────────────────────────────────
# Camera Configuration
# ─────────────────────────────────────────────
CAMERA_CONFIG = {
    "max_cameras": 8,
    "default_fps": 30,
    "reconnect_attempts": 3,
    "reconnect_delay": 2,  # seconds
    "snapshot_quality": 85,  # JPEG quality
}

# ─────────────────────────────────────────────
# Alert Configuration
# ─────────────────────────────────────────────
ALERT_CONFIG = {
    "sound_enabled": True,
    "sound_file": str(SOUNDS_DIR / "alert.wav"),
    "volume": 0.8,
    "flash_duration": 3000,  # ms
    "max_alerts_display": 50,
}

# ─────────────────────────────────────────────
# Training Configuration
# ─────────────────────────────────────────────
TRAINING_CONFIG = {
    "dataset_path": str(DATASET_DIR),
    "epochs": 50,
    "batch_size": 2, # Optimized for GPU VRAM (4GB) - Reduced to prevent OOM
    "img_size": 416,  # Optimized for speed
    "output_dir": str(MODELS_DIR),
    "model_base": "yolov8n.pt",
    "device": 0,      # Use GPU 0
    "workers": 0,     # Parallel data loading - Set to 0 to prevent Windows multiprocessing/CUDA crashes
    "cache": False,   # Disabled RAM cache to save resources
    "amp": True,      # Automatic Mixed Precision
    "optimizer": "auto", 
    "patience": 50,   # Early stopping
    "close_mosaic": 10,  
}

# ─────────────────────────────────────────────
# Logging Configuration
# ─────────────────────────────────────────────
LOGGING_CONFIG = {
    "app_log": str(LOGS_DIR / "app.log"),
    "error_log": str(LOGS_DIR / "error.log"),
    "max_bytes": 10 * 1024 * 1024,  # 10MB
    "backup_count": 5,
}

# ─────────────────────────────────────────────
# Developer Access Configuration
# ─────────────────────────────────────────────
# DEVELOPER NOTE:
#   To change the AI training unlock keyword, edit the value below.
#   File : config.py
#   Line : ~145 (this block)
# ─────────────────────────────────────────────
DEVELOPER_CONFIG = {
    "keyword": "VIGILANT_DEV_2026",  # << CHANGE THIS to update the training unlock keyword
}

# Suspicious activity types
ACTIVITY_TYPES = [
    "Item Taken Without Scanning",
    "Prolonged Stay in Restricted Zone",
    "Object Hidden in Bag/Pocket",
    "Suspicious Movement",
    "Unauthorized Area Access",
]
