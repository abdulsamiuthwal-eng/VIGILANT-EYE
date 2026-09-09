# 🧠 Vigilant Eye — Master Agent Architecture & Developer Guide

> **MANDATORY READING FOR ALL INCOMING AI AGENTS & DEVELOPERS**:
> This document is the **Single Source of Truth** for the entire **Vigilant Eye** codebase. For visual sequence diagrams, data-flow pipelines, and entity-relationship models, also refer to **[ARCHITECTURE.md](ARCHITECTURE.md)**. Before making any code edits, adding new features, or modifying styles, read this entire guide. It details the dual-stack architecture, exact file maps, REST/WebSocket contracts, AI detection pipelines, design system constraints, and critical gotchas.

---

## 📌 Table of Contents
1. [Executive Summary & Mission](#1-executive-summary--mission)
2. [Dual-Stack Architecture & 100% Parity Rule](#2-dual-stack-architecture--100-parity-rule)
3. [Repository Directory Map](#3-repository-directory-map)
4. [Design System & Strict 4-Color Palette](#4-design-system--strict-4-color-palette)
5. [Login Screen & 3D WebGL CCTV Camera](#5-login-screen--3d-webgl-cctv-camera)
6. [Dashboard Layout & Mobile Drawer Mechanics](#6-dashboard-layout--mobile-drawer-mechanics)
7. [Computer Vision & AI Detection Pipelines](#7-computer-vision--ai-detection-pipelines)
8. [Multi-Email Alert & OTP Verification System](#8-multi-email-alert--otp-verification-system)
9. [On-Premise YOLO Model Training & Frame Extraction](#9-on-premise-yolo-model-training--frame-extraction)
10. [Database Schema & SQLAlchemy Models](#10-database-schema--sqlalchemy-models)
11. [Complete REST API & WebSocket Event Reference](#11-complete-rest-api--websocket-event-reference)
12. [Configuration & Environment Variables](#12-configuration--environment-variables)
13. [Local Development & Vercel Deployment Commands](#13-local-development--vercel-deployment-commands)
14. [Crucial Gotchas & Rules for AI Agents](#14-crucial-gotchas--rules-for-ai-agents)

---

## 1. Executive Summary & Mission

**Vigilant Eye** is an enterprise-grade, real-time AI computer vision surveillance and anti-theft security platform. Designed for retail stores, warehouses, and restricted zones, it performs:
* **Multi-Camera Concurrent Capture**: Thread-safe capture from RTSP IP streams, USB webcams, and video files with auto-reconnection.
* **Real-Time Human & Suspicious Activity Detection**: YOLOv8 deep learning pipeline analyzing video streams at ~30 FPS.
* **Spatial Tracking (SORT)**: Kalman filter and Hungarian matching maintaining persistent identity tracking across frames.
* **Smart Security Zones**:
  * **Zone A (Shelf / Merchandising)**: Tracks customer dwell time, shelf approach, and hand-to-pocket heuristics.
  * **Zone B (Checkout Counter)**: Monitors scanning verification and point-of-sale clearance.
  * **Zone C (Exit Perimeter)**: Triggers instant alarms if an individual approaches exit with unpaid merchandise (bypassing Zone B).
* **Multi-Channel Alarms**: Real-time WebSocket audio-visual siren, multi-recipient Gmail SMTP alert reports with camera snapshots, and Firebase Cloud Messaging (FCM) mobile notifications.
* **On-Premise Fine-Tuning**: Web-based upload of surveillance footage, auto-frame extraction at configurable FPS, and background retraining of custom YOLOv8 weights.

---

## 2. Dual-Stack Architecture & 100% Parity Rule

The repository is built around **two parallel runtime environments**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 VIGILANT EYE REPOSITORY                                 │
├────────────────────────────────────────────┬────────────────────────────────────────────┤
│         1. Python / Flask Backend          │          2. Autonomous Vercel Demo         │
│                 (Root `/`)                 │              (`/vercel_demo/`)             │
├────────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Full PyTorch YOLOv8 + OpenCV CUDA        │ • Client-Side In-Browser TensorFlow.js     │
│ • SQLite Database (`surveillance.db`)      │ • In-Browser webcam via `getUserMedia`     │
│ • Multi-Camera thread-safe capture         │ • Browser `localStorage` mock database    │
│ • Real-time Flask-SocketIO & SMTPLib       │ • Deployed at Vercel Production            │
│ • Jinja2 templates in `templates/`         │ • Static HTML/CSS/JS in `vercel_demo/`     │
│ • Runs locally via `python app.py`         │ • Live at `vigilant-eye-gold.vercel.app`   │
└────────────────────────────────────────────┴────────────────────────────────────────────┘
```

### ⚠️ THE GOLDEN RULE OF PARITY
Whenever you modify frontend templates, styles, or client logic:
1. **Never edit `templates/` or `static/` without updating `vercel_demo/`**.
2. **Never edit `vercel_demo/` without updating `templates/` and `static/`**.
3. **Paired Files Checklist**:
   * `templates/login.html` ⟷ `vercel_demo/login.html`
   * `templates/dashboard.html` ⟷ `vercel_demo/dashboard.html`
   * `templates/register.html` ⟷ `vercel_demo/register.html`
   * `templates/forgot_password.html` ⟷ `vercel_demo/forgot_password.html`
   * `templates/splash.html` ⟷ `vercel_demo/index.html`
   * `templates/post_login_splash.html` ⟷ `vercel_demo/post_login_splash.html`
   * `static/css/style.css` ⟷ `vercel_demo/static/css/style.css`
   * `static/js/dashboard.js` ⟷ `vercel_demo/static/js/dashboard.js`
   * `static/js/alerts.js` ⟷ `vercel_demo/static/js/alerts.js`
   * `static/js/charts.js` ⟷ `vercel_demo/static/js/charts.js`

---

## 3. Repository Directory Map

```text
VIGILANT-EYE/
├── app.py                          # Flask & SocketIO entry point, route registrations, DB init
├── config.py                       # App parameters, detection thresholds, SMTP, FCM, developer keys
├── init_db.py                      # Database bootstrapper (creates admin@vigilanteye.com / password123)
├── requirements.txt                # Python backend dependencies (torch, ultralytics, flask, etc.)
├── .env.example                    # Template for environment secrets (SMTP, FCM, Google OAuth)
├── AGENT_GUIDE.md                  # Master developer & AI agent architectural guide (THIS FILE)
├── README.md                       # Public-facing repository documentation
├── vercel_checklist.md             # Vercel deployment tracking & verification log
│
├── auth/                           # Authentication & User Management Blueprint
│   ├── __init__.py
│   └── auth_routes.py              # Login, register, logout, OTP password reset, Google OAuth
│
├── camera/                         # Multi-Camera Streaming Engine
│   ├── __init__.py
│   ├── camera_manager.py           # Thread-safe RTSP/USB/Video feed capture & reconnection loop
│   └── stream.py                   # MJPEG multi-part streaming generator for web browser
│
├── detection/                      # Deep Learning & Object Tracking Module
│   ├── __init__.py
│   ├── detector.py                 # Singleton YOLOv8 TheftDetector (inference, thresholding, zones)
│   ├── tracker.py                  # SORT Kalman filter implementation for persistent track IDs
│   └── preprocessor.py             # Frame resizing, aspect ratio preservation, letterboxing
│
├── alerts/                         # Security Dispatcher & Notifications
│   ├── __init__.py
│   ├── alert_manager.py            # Dispatches WebSocket alarms, Gmail snapshots, FCM push
│   └── verified_email_alert.py     # Multi-email OTP management, independent email verification
│
├── database/                       # SQLAlchemy ORM Database Layer
│   ├── __init__.py
│   ├── models.py                   # User, Camera, Event, SystemSettings, TrainingSession
│   └── db_manager.py               # High-level query helpers (CameraManager, EventManager, etc.)
│
├── training/                       # On-Premise YOLO Fine-Tuning Pipeline
│   ├── __init__.py
│   ├── trainer.py                  # Background training thread, dataset validator, model reloader
│   └── extractor.py                # Extracts frames from uploaded videos at target FPS rate
│
├── static/                         # Desktop / Flask Static Assets
│   ├── css/
│   │   └── style.css               # Master dashboard styles, glassmorphism, mobile media queries
│   ├── js/
│   │   ├── dashboard.js            # Main dashboard controller, theme switcher, section router
│   │   ├── alerts.js               # Socket.IO audio-visual alert handlers and notifications
│   │   └── charts.js               # Chart.js analytics visualizations
│   ├── images/
│   │   ├── logo.png                # Brand logo
│   │   └── surveillance_bg.jpg     # 4K panoramic command center background
│   └── sounds/
│       └── alert.mp3               # Siren sound effect
│
├── templates/                      # Jinja2 Templates (Flask Server)
│   ├── splash.html                 # Pre-login cinematic HUD splash screen
│   ├── post_login_splash.html      # Post-login session initialization HUD
│   ├── login.html                  # 3D Photorealistic CCTV camera login page
│   ├── register.html               # Registration view
│   ├── forgot_password.html        # Password recovery view
│   └── dashboard.html              # Main surveillance monitoring dashboard
│
└── vercel_demo/                    # 🚀 Autonomous Static Vercel Webapp
    ├── vercel.json                 # Vercel deployment routes and security headers
    ├── index.html                  # Static entrypoint (Splash screen)
    ├── login.html                  # Static 3D CCTV login page
    ├── register.html               # Static registration page
    ├── forgot_password.html        # Static forgot password page
    ├── post_login_splash.html      # Static loading transition screen
    ├── dashboard.html              # Static dashboard with TF.js webcam AI
    └── static/                     # Assets for Vercel deployment (css, js, images)
```

---

## 4. Design System & Strict 4-Color Palette

The application adheres to a strict, curated 4-color palette across all dark and light themes:

| Color Token | Hex Code | UI Role |
| :--- | :--- | :--- |
| **Coral Red** | `#D96868` | Primary brand accent, alert badges, laser target locks, critical alarm buttons, active sirens |
| **Light Neutral** | `#F2F2F2` | Clean background canvas, light mode base, high-contrast text elements |
| **Sage Green** | `#91AE6E` | Secondary accent, tactical HUD borders, searching reticle, status badges, zone overlays |
| **Olive Forest** | `#689D4B` | Tertiary dark accent, active online indicators, button hover states |

### Design Rules
1. **Never introduce arbitrary bright colors** (e.g. plain electric green, neon blue, raw purple). Always use the 4 curated tokens or their calibrated rgba tints.
2. **Default Theme**: The application opens in **Light Mode by default** (`data-theme="light"`).
3. **Glassmorphism Spec**:
   * Backdrop filter: `backdrop-filter: blur(24px) saturate(180%)`.
   * Border highlight: `border: 1px solid var(--border-glass)`.
   * Specular inner shadow: `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2)`.

---

## 5. Login Screen & 3D WebGL CCTV Camera

Implemented in `templates/login.html` and `vercel_demo/login.html`:

### Architecture & Visual Structure
* **Left Panel (50% desktop)**: Frosted glass login card, demo credential quick-fill button, and Google OAuth option.
* **Right Panel (50% desktop)**: WebGL transparent canvas hosting the Three.js 3D CCTV Camera and cybernetic HUD badges (`YOLOv8-X`, `AES-256`, `AI THEFT SENTINEL: ARMED`).
* **Continuous Background**: Panoramic 4K command center wallpaper (`surveillance_bg.jpg`) spans the full container.

### 3D CCTV Model Specifications
* **Perspective Camera**: `FOV = 34°`, `Z = 28` distance for balanced negative space.
* **Procedural Brushed Metal**: Dynamic 2D canvas texture with 4,500 anisotropic brushed micro-lines mapped to Three.js `roughnessMap`.
* **Optical Lens Shading**: Multi-coated anti-reflective glass ring with emerald/violet glint, 12 infrared night-vision LEDs, and pulsing recording tally lamp.
* **Volumetric Laser Cone**: Custom GLSL vertex and fragment shader with additive blending projecting an inspection cone towards the viewport.
* **Holographic Targeting Reticle**: Dynamic crosshairs and corner brackets that rotate and pulse.
* **Servomotor Motion Choreography**:
  * **Input Focus**: Rotates servos to yaw `-0.74` and pitch `-0.12` to directly inspect login credentials with Coral Red laser lock.
  * **Cursor Tracking**: Dampened servomotor interpolation (`lerp: 0.055`) tracking mouse pan and tilt.
  * **Idle Sweep**: Autonomous perimeter sweep mode activating after 2.2s of inactivity.

### Seamless Middle Blend Implementation
* The middle dividing line and native browser scrollbars are eliminated.
* `.login-container::before` creates a **62% wide volumetric ambient wash** that gently dissolves into the surveillance room over 250px+ of feathering (`rgba(248, 250, 247, 0.98)` to `transparent`).
* `.login-left` has `scrollbar-width: none;` and `::-webkit-scrollbar { display: none; }`.
* **Mobile View (< 768px)**: `.login-container::before` is overridden to `width: 100% !important` with `background: #F8FAF7 !important`, and `.bg-grid` is set to `width: 100% !important; mask-image: none !important;` so the mobile login card sits on a completely uniform, clean background without dark cuts on the right side.

---

## 6. Dashboard Layout & Mobile Drawer Mechanics

### Desktop Layout
* **Sidebar (`<aside class="sidebar">`)**: 240px wide fixed sidebar containing navigation links, camera count badges, theme switcher, and color customization palette pickers.
* **Topbar (`<header class="topbar">`)**: 65px frosted glass header with hamburger toggle, section breadcrumb, live system clock, operational status dot, and notification bell.
* **Main Content (`<main class="main-content">`)**: Houses interchangeable sections:
  * `#section-cameras`: Multi-camera grid with live streams, status tags, and control buttons.
  * `#section-alerts`: Real-time alert feed with severity filters and snapshot previews.
  * `#section-events`: Comprehensive event log table with audit search and export.
  * `#section-stats`: Chart.js analytics graphs (hourly theft trends, zone breakdown).
  * `#section-add-camera`: Form for connecting USB webcams, RTSP streams, or video files.
  * `#section-training`: Dataset preparation, video upload, and on-premise YOLO retraining.
  * `#section-settings`: Detection thresholds, multi-email verification, and user preferences.

### Mobile Drawer Mechanics (< 900px / < 768px)
* **Hardware-Accelerated 3D Transforms**: The mobile drawer `#sidebar` sits off-screen by default via `transform: translate3d(-100%, 0, 0) !important;` and slides smoothly onto the screen at `transform: translate3d(0, 0, 0) !important;` with `transition: transform 0.34s cubic-bezier(0.25, 1, 0.5, 1)` and `will-change: transform`.
* **Topbar Hamburger Trigger**: `#mobileMenuBtn` toggles the `.mobile-open` class. Opening triggers a layout reflow (`void sidebar.offsetWidth;`) to guarantee the CSS slide-in animation starts cleanly without batching skips.
* **Reflow-Decoupled Close**: Closing the drawer triggers `translate3d(-100%, 0, 0)` immediately. Releasing the body scroll-lock (`drawer-open-lock`) is delayed by 350ms so mobile dynamic address bar reflows never cause an abrupt jerk or stutter during the exit animation.
* **Backdrop Overlay**: `<div class="sidebar-overlay" id="sidebarOverlay"></div>` fades in behind the open drawer with `background: rgba(0,0,0,0.65)` and `backdrop-filter: blur(4px)`.
* **Standardized Compact 58px Footer**: The bottom profile tab (`.sidebar-footer`) is pinned strictly to the bottom of the drawer (`flex: 0 0 58px !important; margin-top: auto !important; height: 58px !important; max-height: 58px !important;`), preventing flexbox stretching. The middle navigation list (`.sidebar-nav`) expands with `flex: 1 1 auto; overflow-y: auto;` with all scrollbars eliminated (`scrollbar-width: none; ::-webkit-scrollbar { display: none; }`).
* **Multi-Point Dismissal**: Tapping `#sidebarCloseBtn` (X button), the backdrop `#sidebarOverlay`, any `.nav-item` link, or the `#footerProfileBtn` closes the drawer with a 60fps slide-out.

---

## 7. Computer Vision & AI Detection Pipelines

### A. Local Flask Server Pipeline (`detection/detector.py` & `detection/tracker.py`)
1. **Frame Capture**: `camera/camera_manager.py` captures frames asynchronously in background daemon threads from RTSP, USB webcam, or video files.
2. **Preprocessing**: Frames are letterboxed and resized to `640x640` while preserving aspect ratio.
3. **YOLOv8 Inference**: Ultralytics YOLOv8 (`yolov8n.pt` or fine-tuned weights) runs with CUDA device `0` (auto-fallback to `cpu` if GPU is unavailable).
4. **Spatial Tracking (SORT)**:
   * Kalman filter predicts bounding box trajectory.
   * Hungarian algorithm associates detections with existing track IDs using Intersection-over-Union (IoU) cost matrix.
5. **Behavior Analysis & Anti-Theft Heuristics**:
   * **Dwell Time Violation**: Tracks whether a person remains in Zone A (Shelf) for > 90 frames (~3 seconds at 30 FPS).
   * **Hand-to-Pocket Motion**: Detects rapid movement from shelf bounding box towards person torso/waistline.
   * **Checkout Bypass**: Flags individuals moving from Zone A (Shelf) directly into Zone C (Exit) without passing through Zone B (Checkout Counter).
6. **Alert Dispatch**: Callback triggers `alert_manager.handle_alert(...)` which emits WebSocket events and saves snapshot images to `snapshots/`.

### B. Client-Side Vercel Demo Pipeline (`vercel_demo/static/js/dashboard.js`)
1. **Camera Feed**: Accesses the user's local webcam directly in the browser via `navigator.mediaDevices.getUserMedia({ video: true })`.
2. **Model Loading**: Asynchronously downloads `@tensorflow/tfjs` and `@tensorflow-models/coco-ssd` from CDN.
3. **Detection Loop**: Runs `model.detect(video)` on a `requestAnimationFrame` loop, drawing tactical HUD bounding boxes onto an overlay canvas.
4. **Theft Simulation**: Classifies detections and generates realistic security events stored in browser `localStorage`.

---

## 8. Multi-Email Alert & OTP Verification System

Located in `alerts/verified_email_alert.py`:

### Key Concepts
* **Independent Email Verification**: Multiple email addresses can be added to receive security alerts. Every email must verify an OTP before receiving alerts.
* **Storage Location**: Stored as a JSON string in SQLite table `system_settings` under the key `verified_alert_emails_list`:
  ```json
  [
    {
      "email": "security_chief@store.com",
      "verified": true,
      "alert_enabled": true
    },
    {
      "email": "manager@store.com",
      "verified": true,
      "alert_enabled": false
    }
  ]
  ```

### OTP Verification Lifecycle
1. **Add Request** (`POST /api/verified-email/add`): User inputs email. System generates a secure 6-digit OTP, stores it in memory with a 10-minute expiry, and sends an HTML email via Gmail SMTP.
2. **Verification** (`POST /api/verified-email/verify`): User enters the 6-digit OTP. System validates code, marks the email as `verified: true`, and saves the updated list.
3. **Toggle Alert** (`POST /api/verified-email/toggle`): Enables or disables notifications for any specific verified email without deleting it.
4. **Remove Email** (`POST /api/verified-email/remove`): Deletes an email address from the alert list.
5. **Test Alert** (`POST /api/verified-email/test`): Sends a test alert email to all active verified recipients.

### Gmail SMTP Setup Requirements
* Standard Gmail passwords **fail** with authentication error `535`.
* Must use a **16-character Google App Password** generated under Google Account ➔ Security ➔ 2-Step Verification ➔ App Passwords.

---

## 9. On-Premise YOLO Model Training & Frame Extraction

Located in `training/trainer.py` and `training/extractor.py`:

### Workflow
1. **Video Upload** (`POST /api/training/upload_video`):
   * Upload surveillance recordings (`.mp4`, `.avi`, `.mov`).
   * Saves temporarily into `dataset/raw_videos_temp/`.
2. **Frame Extraction**:
   * `extractor.py` samples frames at user-selected FPS (default 1 frame per second).
   * Saves extracted frames into `dataset/images/train/`.
   * Emits extraction progress via Socket.IO event `extraction_progress`.
3. **Developer Authorization**:
   * Retraining requires the developer secret keyword defined in `config.py` (`DEVELOPER_CONFIG["keyword"]`, default: `"sami"`).
4. **Model Retraining** (`POST /api/training/start`):
   * Runs YOLO fine-tuning in a background thread using PyTorch.
   * Periodically emits epoch progress via Socket.IO event `training_progress`.
   * Upon completion, saves best weights to `runs/detect/train/weights/best.pt` and automatically hot-reloads the model into `TheftDetector`.

---

## 10. Database Schema & SQLAlchemy Models

Database file: `surveillance.db` (SQLite). Models defined in `database/models.py`:

### 1. `User` Table (`users`)
* `id`: Integer primary key.
* `name`: String(100), full name.
* `email`: String(150), unique, indexed.
* `password_hash`: String(255), Bcrypt hash.
* `role`: String(20), `'admin'` or `'operator'`.
* `is_active`: Boolean.
* `created_at`: DateTime.
* `last_login`: DateTime.
* `email_verified`: Boolean.
* `profile_picture_url`: String(255).
* `auth_method`: String(50), `'local'` or `'google'`.
* `verification_token`: String(100).
* `theme`: String(10), default `'light'`.
* `email_alerts`, `push_alerts`, `sound_alerts`: Booleans.

### 2. `Camera` Table (`cameras`)
* `id`: Integer primary key.
* `camera_uid`: String(50), unique identifier.
* `name`: String(100), display name.
* `source`: String(255), camera index (`0`, `1`) or RTSP URL (`rtsp://...`).
* `camera_type`: String(30), `'usb'`, `'wifi'`, `'ip'`, or `'mobile'`.
* `location`: String(100), store zone or room.
* `is_active`: Boolean (defaults to `False` on startup so cameras require manual activation).
* `detection_enabled`: Boolean.
* `alert_enabled`: Boolean.
* `total_alerts`: Integer.
* `total_detections`: Integer.

### 3. `Event` Table (`events`)
* `id`: Integer primary key.
* `event_uid`: String(50), unique UUID.
* `camera_id`: Integer foreign key referencing `cameras.id`.
* `activity_type`: String(100), e.g. `'Suspicious Dwell'`, `'Theft Detected'`, `'Checkout Bypass'`.
* `confidence`: Float (0.0 to 1.0).
* `timestamp`: DateTime.
* `snapshot_path`: String(255), relative file path to captured JPEG.
* `is_reviewed`: Boolean.
* `is_false_alarm`: Boolean.
* `severity`: String(20), `'low'`, `'medium'`, or `'high'`.

### 4. `SystemSettings` Table (`system_settings`)
* `id`: Integer primary key.
* `key`: String(100), unique key (e.g. `'verified_alert_emails_list'`, `'confidence_threshold'`).
* `value`: Text (JSON string or scalar).
* `updated_at`: DateTime.

### 5. `TrainingSession` Table (`training_sessions`)
* `id`: Integer primary key.
* `started_at`: DateTime.
* `completed_at`: DateTime.
* `status`: String(20), `'pending'`, `'running'`, `'completed'`, `'failed'`.
* `epochs`: Integer.
* `dataset_size`: Integer.
* `accuracy`: Float.
* `map50`: Float.
* `model_path`: String(255).
* `initiated_by`: Integer foreign key referencing `users.id`.

---

## 11. Complete REST API & WebSocket Event Reference

### Authentication Routes (`auth/auth_routes.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Cinematic splash screen (clears existing session) |
| `GET`, `POST` | `/login` | Authenticates user via Bcrypt or JSON payload |
| `GET`, `POST` | `/register` | Validates and creates new user account |
| `GET` | `/logout` | Terminates session and redirects to splash |
| `GET`, `POST` | `/forgot-password` | Initiates password reset via email OTP |
| `POST` | `/reset-password/<token>` | Applies new password with token validation |
| `GET` | `/verify-email/<token>` | Confirms account activation token |
| `POST` | `/google-login` | Authenticates Google OAuth JWT credential |

### Camera Routes (`app.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/cameras` | List all registered camera feeds |
| `POST` | `/api/cameras` | Add a new camera (validates local index if not URL) |
| `POST` | `/api/cameras/<id>/toggle` | Turn camera physical stream ON or OFF |
| `DELETE` | `/api/cameras/<id>` | Delete camera and stop active capture thread |
| `POST` | `/api/cameras/<id>/snapshot` | Manually capture and save full-resolution snapshot |
| `GET` | `/api/cameras/detect` | Probe and list available local video devices |
| `GET` | `/stream/<camera_id>` | MJPEG multi-part streaming video feed |

### Events & Analytics Routes (`app.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/events` | Paginated event history with camera & type filters |
| `GET` | `/api/events/stats` | Aggregated statistics (total alerts, false alarm rate) |
| `POST` | `/api/events/<id>/review` | Mark event reviewed or flag as false alarm |

### Multi-Email Verification Routes (`app.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/verified-email/list` | Returns all registered alert emails and statuses |
| `POST` | `/api/verified-email/add` | Dispatches 6-digit OTP to candidate email |
| `POST` | `/api/verified-email/verify` | Verifies submitted OTP and activates email |
| `POST` | `/api/verified-email/toggle` | Toggles email alert delivery ON or OFF |
| `POST` | `/api/verified-email/remove` | Removes email from notification list |
| `POST` | `/api/verified-email/test` | Sends test alert to all active verified recipients |

### Training Routes (`app.py`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/training/upload_video` | Uploads surveillance video for frame extraction |
| `POST` | `/api/training/start` | Starts YOLO retraining (requires `developer_keyword`) |
| `POST` | `/api/training/stop` | Halts currently running training process |
| `GET` | `/api/training/status` | Returns current epoch, loss, and mAP status |
| `GET` | `/api/training/validate` | Checks dataset formatting and image counts |
| `GET` | `/api/training/history` | Returns previous training session records |

### WebSocket Events (`flask_socketio`)
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `connect` | Client ➔ Server | None | Authenticates socket connection |
| `request_stats` | Client ➔ Server | None | Requests immediate dashboard statistics |
| `stats_update` | Server ➔ Client | JSON stats object | Pushes updated dashboard statistics |
| `new_alert` | Server ➔ Client | Alert object + snapshot | Broadcasts security alarm across all active clients |
| `training_progress` | Server ➔ Client | Epoch & loss data | Real-time training loop updates |
| `extraction_progress` | Server ➔ Client | Frame count & percent | Real-time video frame extraction updates |

---

## 12. Configuration & Environment Variables

Key parameters defined in `config.py` and `.env`:

```env
# Server Secrets
SECRET_KEY=your_super_secret_session_key

# Email SMTP Settings (Google App Password required)
EMAIL_ENABLED=True
SENDER_EMAIL=your_surveillance_admin@gmail.com
SENDER_PASSWORD=abcd efgh ijkl mnop
RECIPIENT_EMAIL=primary_alerts@store.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Detection AI Parameters
CONFIDENCE_THRESHOLD=0.35
YOLO_MODEL_PATH=yolov8n.pt
DEVICE=0   # 0 for GPU, 'cpu' for CPU fallback

# Developer Keyword for Model Training
DEV_KEYWORD=sami

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## 13. Local Development & Vercel Deployment Commands

### Local Flask Server
```bash
# 1. Activate virtual environment
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/macOS

# 2. Initialize SQLite database & default admin
python init_db.py

# 3. Start Flask + SocketIO application
python app.py
# Navigate to: http://127.0.0.1:5000
```
* **Default Local Admin**: `admin@vigilanteye.com` / `password123`

### Autonomous Vercel Production Deployment
```bash
# Deploy standalone client demo
cd vercel_demo
vercel --prod --yes
```
* **Live Production URL**: [https://vigilant-eye-gold.vercel.app](https://vigilant-eye-gold.vercel.app)
* **Default Vercel Demo Credentials**: `admin@vigilanteye.com` / `admin123`

---

## 14. Crucial Gotchas & Rules for AI Agents

1. **Dual-Stack Parity**: Always apply HTML/CSS/JS edits to both `templates/` / `static/` AND `vercel_demo/`.
2. **Never Change the 4 Brand Colors**:
   * `#D96868` (Coral Red)
   * `#F2F2F2` (Light Neutral)
   * `#91AE6E` (Sage Green)
   * `#689D4B` (Olive Forest)
3. **Mobile Login Background Rule**: On screens `< 768px`, `.login-container::before` must always be `width: 100% !important; background: #F8FAF7 !important;` to avoid dark right-side background splitting.
4. **Mobile Drawer Rule**: Never use hardcoded green borders or solid dark colors on `.sidebar` under `@media (max-width: 900px)`. Always use `var(--sidebar-bg)` and rely on `#sidebarOverlay` for tap-to-dismiss functionality.
5. **Camera Startup State**: Cameras are intentionally set to `is_active = False` on app launch in `app.py` line 584 so that cameras never start unexpectedly until the operator turns them on.
6. **Gmail SMTP Passwords**: Google accounts require a **16-digit Google App Password**. Standard account passwords will fail with SMTP error `535 Authentication Failed`.
7. **Developer Training Authorization**: Starting YOLO training via `/api/training/start` will fail unless the payload contains `"developer_keyword": "sami"` (or the configured `DEV_KEYWORD`).
8. **CSS Nesting in Vanilla Media Queries**: In vanilla CSS, never leave unclosed braces like `.sidebar { ... .sidebar {` inside `@media` blocks. Modern browser engines will compile it as a descendant selector (`.sidebar .sidebar`), silently failing all drawer and responsive layout rules.
9. **Transition Override Hazard**: Never apply global `[data-theme] .sidebar { transition: background, border-color !important; }` without explicitly preserving `transform` in the transition declaration, otherwise drawer slide animations will instantly snap with an abrupt jerk.
10. **Reflow Decoupling on Drawer Close**: Releasing body scroll lock (`drawer-open-lock`) at the same tick as removing `.mobile-open` causes mobile browser address bars to recalculate layout mid-flight. Always delay body lock release by ~350ms until the drawer has finished sliding off-screen.
