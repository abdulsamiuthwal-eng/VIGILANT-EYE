"""
Vigilant Eye - Main Flask Application
========================================
Entry point: registers all blueprints, initializes DB, starts SocketIO.
"""

import os
import logging
import logging.handlers
from flask import Flask, render_template, redirect, url_for, request, jsonify, Response, session
from flask_login import LoginManager, login_required, current_user
from flask_socketio import SocketIO
from config import Config, LOGGING_CONFIG, DETECTION_CONFIG, DEVELOPER_CONFIG

# ─────────────────────────────────────────────
# Logging Setup
# ─────────────────────────────────────────────
def setup_logging():
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    root.addHandler(ch)

    # App log file
    fh = logging.handlers.RotatingFileHandler(
        LOGGING_CONFIG["app_log"],
        maxBytes=LOGGING_CONFIG["max_bytes"],
        backupCount=LOGGING_CONFIG["backup_count"]
    )
    fh.setFormatter(formatter)
    root.addHandler(fh)

    # Error log file
    eh = logging.handlers.RotatingFileHandler(
        LOGGING_CONFIG["error_log"],
        maxBytes=LOGGING_CONFIG["max_bytes"],
        backupCount=LOGGING_CONFIG["backup_count"]
    )
    eh.setLevel(logging.ERROR)
    eh.setFormatter(formatter)
    root.addHandler(eh)

setup_logging()
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# App Factory
# ─────────────────────────────────────────────
app = Flask(__name__)
app.config.from_object(Config)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Database
from database.models import db, bcrypt
db.init_app(app)
bcrypt.init_app(app)

# Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = "auth.login"
login_manager.login_message = "Please log in to access the dashboard."
login_manager.login_message_category = "warning"

@login_manager.user_loader
def load_user(user_id):
    from database.models import User
    return User.query.get(int(user_id))

# ─────────────────────────────────────────────
# Register Blueprints
# ─────────────────────────────────────────────
from auth.auth_routes import auth_bp
app.register_blueprint(auth_bp)

# ─────────────────────────────────────────────
# Share SocketIO with modules
# ─────────────────────────────────────────────
from alerts.alert_manager import alert_manager, set_socketio as alert_set_sio
from training.trainer import set_socketio as trainer_set_sio
from training.extractor import set_extractor_socketio
alert_set_sio(socketio)
trainer_set_sio(socketio)
set_extractor_socketio(socketio)

# ─────────────────────────────────────────────
# Wire detector → alert manager
# ─────────────────────────────────────────────
from detection.detector import detector
detector.register_alert_callback(alert_manager.handle_alert)

# ─────────────────────────────────────────────
# Verified Email System Integration
# ─────────────────────────────────────────────
from alerts.verified_email_alert import VerifiedEmailManager

# ─────────────────────────────────────────────
# Dashboard Blueprint (inline for simplicity)
# ─────────────────────────────────────────────
from flask import Blueprint
dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/dashboard")
@login_required
def index():
    from config import EMAIL_API_CONFIG, DEVELOPER_CONFIG
    theme = session.get("theme", current_user.theme)
    return render_template("dashboard.html", user=current_user, theme=theme,
                           email_js=EMAIL_API_CONFIG, dev_keyword=DEVELOPER_CONFIG["keyword"])

app.register_blueprint(dashboard_bp)

# ─────────────────────────────────────────────
# Camera API Routes
# ─────────────────────────────────────────────
from camera.camera_manager import camera_manager as cam_mgr
from camera.stream import generate_mjpeg_stream
from database.db_manager import CameraManager as DBCamMgr

@app.route("/api/cameras", methods=["GET"])
@login_required
def get_cameras():
    cameras = DBCamMgr.get_all()
    return jsonify([c.to_dict() for c in cameras])

@app.route("/api/cameras", methods=["POST"])
@login_required
def add_camera():
    data = request.get_json()
    name = data.get("name", "Camera").strip()
    source = data.get("source", "0").strip()
    cam_type = data.get("camera_type", "usb")
    location = data.get("location", "Store")

    # Only validate local webcam indexes — skip for IP/RTSP/URL sources
    # (remote streams can take many seconds to probe and may time out even when valid)
    source_is_url = any(source.lower().startswith(p) for p in ("http", "rtsp", "rtp", "udp", "tcp"))
    if not source_is_url:
        from camera.camera_manager import CameraManager
        if not CameraManager.validate_source(source):
            return jsonify({"success": False, "message": f"Could not connect to camera source '{source}'. Please check the index or URL."}), 400

    cam, err = DBCamMgr.add_camera(name, source, cam_type, location)
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "camera": cam.to_dict()}), 201

@app.route("/api/cameras/<int:camera_id>/toggle", methods=["POST"])
@login_required
def toggle_camera(camera_id):
    data = request.get_json()
    active = bool(data.get("active", False))

    # DB update
    ok, err = DBCamMgr.toggle_camera(camera_id, active)
    if not ok:
        return jsonify({"success": False, "message": err}), 400

    # Physical stream
    from database.models import Camera
    cam = Camera.query.get(camera_id)
    if cam:
        if active:
            cam_mgr.add_camera(camera_id, cam.source, cam.name)
        else:
            cam_mgr.remove_camera(camera_id)

    return jsonify({"success": True, "active": active})

@app.route("/api/cameras/<int:camera_id>", methods=["DELETE"])
@login_required
def remove_camera(camera_id):
    cam_mgr.remove_camera(camera_id)
    ok, err = DBCamMgr.remove_camera(camera_id)
    if not ok:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True})

@app.route("/api/cameras/<int:camera_id>/snapshot", methods=["POST"])
@login_required
def snapshot_camera(camera_id):
    import time
    from config import SNAPSHOTS_DIR
    ts = int(time.time())
    path = str(SNAPSHOTS_DIR / f"snapshot_cam{camera_id}_{ts}.jpg")
    ok = cam_mgr.take_snapshot(camera_id, path)
    if ok:
        return jsonify({"success": True, "path": path})
    return jsonify({"success": False, "message": "Camera not active or no frame available."}), 400

@app.route("/api/cameras/detect", methods=["GET"])
@login_required
def detect_cameras():
    available = cam_mgr.detect_available_cameras()
    return jsonify({"cameras": available})

@app.route("/stream/<int:camera_id>")
@login_required
def stream(camera_id):
    return Response(
        generate_mjpeg_stream(camera_id, detector if DETECTION_CONFIG.get("enabled_globally", True) else None),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

# ─────────────────────────────────────────────
# Events / Logs API
# ─────────────────────────────────────────────
from database.db_manager import EventManager

@app.route("/api/events", methods=["GET"])
@login_required
def get_events():
    camera_id = request.args.get("camera_id", type=int)
    activity_type = request.args.get("activity_type")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    events = EventManager.get_all(
        limit=limit, offset=offset,
        camera_id=camera_id, activity_type=activity_type
    )
    return jsonify([e.to_dict() for e in events])

@app.route("/api/events/stats", methods=["GET"])
@login_required
def get_stats():
    return jsonify(EventManager.get_stats())

@app.route("/api/events/<int:event_id>/review", methods=["POST"])
@login_required
def review_event(event_id):
    data = request.get_json()
    is_false = bool(data.get("is_false_alarm", False))
    ok, err = EventManager.mark_reviewed(event_id, is_false)
    if not ok:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True})

# ─────────────────────────────────────────────
# Settings API
# ─────────────────────────────────────────────
from database.db_manager import SettingsManager

@app.route("/api/settings", methods=["GET"])
@login_required
def get_settings():
    return jsonify(SettingsManager.get_all())

@app.route("/api/settings", methods=["POST"])
@login_required
def update_settings():
    data = request.get_json()
    for key, value in data.items():
        SettingsManager.set(key, value)
    # Sync theme to user session
    if "theme" in data:
        session["theme"] = data["theme"]
        from database.models import User
        user = User.query.get(current_user.id)
        if user:
            user.theme = data["theme"]
            db.session.commit()
    return jsonify({"success": True})

@app.route("/api/settings/user", methods=["POST"])
@login_required
def update_user_settings():
    data = request.get_json()
    from database.db_manager import UserManager
    ok, err = UserManager.update_preferences(current_user.id, data)
    if not ok:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True})

# ─────────────────────────────────────────────
# Verified Email Alert API — Multi-Email
# ─────────────────────────────────────────────
from alerts.verified_email_alert import VerifiedEmailManager

@app.route("/api/verified-email/list", methods=["GET"])
@login_required
def get_verified_email_list():
    """Return the list of all verified/pending emails."""
    return jsonify(VerifiedEmailManager.get_email_list())

@app.route("/api/verified-email/add", methods=["POST"])
@login_required
def add_verified_email():
    """Send OTP to a new email address to begin verification."""
    data  = request.get_json()
    email = data.get("email", "").strip().lower()
    if not email or "@" not in email:
        return jsonify({"success": False, "message": "Invalid email address."}), 400

    ok, msg = VerifiedEmailManager.send_verification_email(email)
    if ok:
        return jsonify({"success": True, "message": "Verification code sent. Check your inbox."})
    return jsonify({"success": False, "message": msg}), 400

@app.route("/api/verified-email/verify", methods=["POST"])
@login_required
def verify_new_email():
    """Verify OTP and add email to the alert list."""
    data = request.get_json()
    otp  = data.get("otp", "").strip()
    if not otp:
        return jsonify({"success": False, "message": "OTP is required."}), 400

    ok, msg, email = VerifiedEmailManager.verify_and_add_email(otp)
    if ok:
        return jsonify({"success": True, "message": f"{email} verified and added.", "email": email})
    return jsonify({"success": False, "message": msg}), 400

@app.route("/api/verified-email/remove", methods=["POST"])
@login_required
def remove_verified_email():
    """Remove an email from the alert list."""
    data  = request.get_json()
    email = data.get("email", "").strip().lower()
    ok, msg = VerifiedEmailManager.remove_email(email)
    return jsonify({"success": ok, "message": msg})

@app.route("/api/verified-email/toggle", methods=["POST"])
@login_required
def toggle_verified_email():
    """Enable or disable alert delivery for a specific email."""
    data    = request.get_json()
    email   = data.get("email", "").strip().lower()
    enabled = bool(data.get("enabled", True))
    ok, msg = VerifiedEmailManager.toggle_email_alert(email, enabled)
    return jsonify({"success": ok, "message": msg})

@app.route("/api/verified-email/test", methods=["POST"])
@login_required
def test_verified_email():
    logger.info("Multi-Email Test Endpoint hit — sending test alert.")
    VerifiedEmailManager.send_alert_email({
        "activity_type":   "Test Security Alert",
        "camera_id":       "TEST-01",
        "camera_name":     "Test Camera",
        "location":        "Test Zone A",
        "detected_object": "Test Person",
        "confidence":      0.99,
    })
    return jsonify({"success": True, "message": "Test alert triggered."})

# Legacy status endpoint (backward compat)
@app.route("/api/verified-email/status", methods=["GET"])
@login_required
def get_verified_email_status():
    return jsonify(VerifiedEmailManager.get_status())

# ─────────────────────────────────────────────
# User Management API
# ─────────────────────────────────────────────
@app.route("/api/users", methods=["GET"])
@login_required
def get_users():
    from database.db_manager import UserManager
    users = UserManager.get_all()
    return jsonify([u.to_dict() for u in users])

@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@login_required
def delete_user_api(user_id):
    if current_user.id == user_id:
        return jsonify({"success": False, "message": "Cannot delete your own account."}), 400
    from database.db_manager import UserManager
    ok, err = UserManager.delete_user(user_id)
    if not ok:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True})

# ─────────────────────────────────────────────
# Training API
# ─────────────────────────────────────────────
from training.trainer import trainer
from database.models import TrainingSession

@app.route("/api/training/start", methods=["POST"])
@login_required
def start_training():
    data = request.get_json() or {}
    epochs = data.get("epochs", 50)
    batch = data.get("batch_size", 16)
    dev_keyword = data.get("developer_keyword", "")

    if dev_keyword != DEVELOPER_CONFIG["keyword"]:
        return jsonify({"success": False, "message": "Unauthorized access. Invalid developer keyword."}), 400

    # Create DB session record
    ts = TrainingSession(
        epochs=epochs,
        status="running",
        initiated_by=current_user.id,
        dataset_size=0,
    )
    db.session.add(ts)
    db.session.commit()
    session_id = ts.id

    def on_complete(model_path):
        from detection.detector import detector
        detector.reload_model(model_path)
        logger.info(f"Model reloaded after training: {model_path}")

    ok, msg = trainer.train(epochs=epochs, batch_size=batch,
                            db_session_id=session_id, on_complete=on_complete)
    if not ok:
        return jsonify({"success": False, "message": msg}), 400
    return jsonify({"success": True, "message": msg, "session_id": session_id})

@app.route("/api/training/stop", methods=["POST"])
@login_required
def stop_training():
    ok, msg = trainer.stop_training()
    if not ok:
        return jsonify({"success": False, "message": msg}), 400
    return jsonify({"success": True, "message": msg})

@app.route("/api/training/status", methods=["GET"])
@login_required
def training_status():
    return jsonify(trainer.get_status())

@app.route("/api/training/validate", methods=["GET"])
@login_required
def validate_dataset():
    return jsonify(trainer.validate_dataset())

@app.route("/api/training/prepare", methods=["POST"])
@login_required
def prepare_dataset():
    path = trainer.prepare_dataset_structure()
    return jsonify({"success": True, "dataset_path": path,
                    "message": "Dataset folder structure created. Add images to dataset/images/train/"})

@app.route("/api/training/upload_video", methods=["POST"])
@login_required
def upload_video():
    if "video" not in request.files:
        return jsonify({"success": False, "message": "No video file provided"}), 400
        
    video = request.files["video"]
    if video.filename == "":
        return jsonify({"success": False, "message": "No selected file"}), 400
        
    fps_rate = int(request.form.get("fps", 1))
    
    # Save video locally
    from config import TRAINING_CONFIG
    from pathlib import Path
    import uuid
    import werkzeug.utils
    
    filename = werkzeug.utils.secure_filename(video.filename)
    safe_name = f"{uuid.uuid4().hex[:8]}_{filename}"
    upload_dir = Path(TRAINING_CONFIG["dataset_path"]) / "raw_videos_temp"
    upload_dir.mkdir(parents=True, exist_ok=True)
    temp_path = upload_dir / safe_name
    
    video.save(str(temp_path))
    
    # Run extractor
    from training.extractor import extractor
    ok, msg = extractor.start_extraction(str(temp_path), fps_rate, filename)
    if not ok:
        return jsonify({"success": False, "message": msg}), 400
        
    return jsonify({"success": True, "message": "Extraction started"})

@app.route("/api/training/history", methods=["GET"])
@login_required
def training_history():
    sessions = TrainingSession.query.order_by(TrainingSession.started_at.desc()).limit(20).all()
    return jsonify([s.to_dict() for s in sessions])

# ─────────────────────────────────────────────
# Alert Control API
# ─────────────────────────────────────────────
@app.route("/api/alerts/test", methods=["POST"])
@login_required
def test_alert():
    data = request.get_json() or {}
    cam_id = data.get("camera_id", 1)
    alert_manager.test_alert(camera_id=cam_id)
    return jsonify({"success": True, "message": "Test alert sent."})

@app.route("/api/alerts/camera/<int:camera_id>/toggle", methods=["POST"])
@login_required
def toggle_camera_alerts(camera_id):
    data = request.get_json()
    enabled = bool(data.get("enabled", True))
    from database.models import Camera
    cam = Camera.query.get(camera_id)
    if cam:
        cam.alert_enabled = enabled
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Camera not found"}), 404

# ─────────────────────────────────────────────
# SocketIO Events
# ─────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    logger.info(f"Client connected: {request.sid}")

@socketio.on("disconnect")
def on_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on("request_stats")
def on_request_stats():
    stats = EventManager.get_stats()
    socketio.emit("stats_update", stats, room=request.sid)

# ─────────────────────────────────────────────
# Error Handlers
# ─────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return render_template("login.html"), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

# ─────────────────────────────────────────────
# Initialize DB & run
# ─────────────────────────────────────────────
def initialize_app():
    with app.app_context():
        db.create_all()
        from database.db_manager import SettingsManager
        SettingsManager.initialize_defaults()

        # FIX: Do NOT auto-start cameras on startup.
        # Reset all cameras to inactive so they stay OFF until user manually enables them.
        from database.models import Camera
        try:
            cameras_to_reset = Camera.query.filter_by(is_active=True).all()
            for cam in cameras_to_reset:
                cam.is_active = False
            if cameras_to_reset:
                db.session.commit()
                logger.info(f"Reset {len(cameras_to_reset)} camera(s) to inactive on startup. Cameras must be turned ON manually.")
        except Exception as e:
            logger.error(f"Error resetting camera states on startup: {e}")

        logger.info("Vigilant Eye initialized. Database ready.")


if __name__ == "__main__":
    initialize_app()
    logger.info("Starting Vigilant Eye server on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)
