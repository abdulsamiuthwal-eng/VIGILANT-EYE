<p align="center">
  <img src="https://raw.githubusercontent.com/abdulsamiuthwal-eng/VIGILANT-EYE/main/static/images/logo.png" alt="Vigilant Eye Logo" width="120" onerror="this.style.display='none'"/>
</p>

<h1 align="center">👁️ VIGILANT EYE</h1>
<h3 align="center">AI-Powered Real-Time Intelligent Surveillance & Theft Detection System</h3>

<p align="center">
  <a href="https://vigilant-eye-gold.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/🚀%20LIVE%20DEMO-Vercel%20Preview-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo on Vercel" height="38"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-00ffff?style=flat-square" alt="YOLOv8"/>
  <img src="https://img.shields.io/badge/PyTorch-CUDA%20Accelerated-ee4c2c?style=flat-square&logo=pytorch&logoColor=white" alt="PyTorch"/>
  <img src="https://img.shields.io/badge/OpenCV-Computer%20Vision-5c3ee8?style=flat-square&logo=opencv&logoColor=white" alt="OpenCV"/>
  <img src="https://img.shields.io/badge/Flask-Web%20Server-000000?style=flat-square&logo=flask&logoColor=white" alt="Flask"/>
  <img src="https://img.shields.io/badge/Socket.IO-Real--Time%20Events-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/>
</p>

---

## 📌 Table of Contents
1. [Project Overview](#-project-overview)
2. [🌐 Live Web Demo (Vercel)](#-live-web-demo-vercel)
3. [Key Features](#-key-features)
4. [System Architecture](#-system-architecture)
5. [Tech Stack](#-tech-stack)
6. [📧 Email Alert Configuration (SMTP) — CRITICAL](#-email-alert-configuration-smtp--step-by-step)
7. [Installation & Local Setup](#-installation--local-setup)
8. [Project Structure](#-project-structure)
9. [Security & Best Practices](#-security--best-practices)
10. [License](#-license)

---

## 📖 Project Overview

**Vigilant Eye** is an enterprise-grade, real-time AI computer vision surveillance platform designed for retail stores, warehouses, and restricted security zones. Leveraging **YOLOv8** deep learning object detection, **SORT** spatial tracking, and **Flask-SocketIO**, Vigilant Eye monitors multi-camera feeds concurrently, identifies suspicious behaviors (theft actions, shoplifting, prolonged dwell in sensitive areas, unauthorized boundary crossing), and dispatches millisecond multi-channel security alerts.

---

## 🌐 Live Web Demo (Vercel)

Experience the frontend dashboard and in-browser camera detection right now without installing any local Python environment:

<p align="center">
  <a href="https://vigilant-eye-gold.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/▶_LAUNCH_LIVE_DEMO-vigilant--eye--gold.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white" alt="Click to Launch Live Demo" height="42"/>
  </a>
</p>

> 💡 **Client-Side Demo Note**:
> The Vercel deployment runs as an autonomous client-side web application powered by **TensorFlow.js (COCO-SSD)**. It accesses your local webcam securely in the browser via `getUserMedia` and simulates real-time detections, alerts, and analytics using client-side `localStorage`. For full high-precision YOLOv8 PyTorch CUDA inference and background model retraining, run the desktop Flask server locally.

---

## ✨ Key Features

* 🎯 **Real-Time YOLOv8 Detection**: High-accuracy detection of persons, suspicious hand-to-pocket motions, and shoplifting actions at ~30 FPS.
* 📍 **Dynamic Smart Zones**:
  * **Zone A (Shelf)**: Tracks dwell time and item pickup behaviors.
  * **Zone B (Checkout Counter)**: Validates scanning and item clearance.
  * **Zone C (Exit Zone)**: Flags individuals bypassing checkout.
* 📹 **Multi-Camera Management**: Thread-safe manager supporting USB webcams, RTSP IP camera streams, and video files with automatic reconnection.
* ⚡ **Instant Multi-Channel Alerts**:
  * Real-time WebSocket audio/visual alarms on the dashboard.
  * Automated high-priority email alerts with snapshot attachments via Gmail SMTP.
  * Mobile push alerts via Firebase Cloud Messaging (FCM).
* 🔄 **On-Premise Model Fine-Tuning**: Upload surveillance recordings, auto-extract video frames, and retrain custom YOLO weights directly from the browser UI.
* 🔐 **Secure Authentication**: Flask-Login, Bcrypt password encryption, Google OAuth support, and multi-email OTP verification.

---

## 📧 Email Alert Configuration (SMTP) — Step-by-Step

> [!IMPORTANT]
> **Email Alerts require a Google App Password.** Standard Gmail account passwords will **not** work due to Google's mandatory security policy for third-party SMTP applications.

### 🔑 How to Generate a Google App Password

Follow these exact steps to obtain your 16-character SMTP passcode:

```
Google Account ➔ Security ➔ 2-Step Verification ➔ App Passwords ➔ Generate 16-Digit Key
```

1. Open your **[Google Account Management](https://myaccount.google.com/)**.
2. On the left navigation panel, click **Security**.
3. Under *"How you sign in to Google"*, ensure **2-Step Verification** is turned **ON**.
4. In the search bar at the top, type **`App Passwords`** and select it.
5. In the *App name* field, enter a name (e.g., `Vigilant Eye`).
6. Click **Create**.
7. Google will display a **16-character passcode** (e.g., `abcd efgh ijkl mnop`).
8. **Copy this 16-character code** (spaces don't matter).

---

### ⚙️ How to Add Credentials to Vigilant Eye

You have two simple ways to configure your credentials:

#### Option A: Using `.env` File (Recommended — Keeps Credentials Safe)
1. In the project root folder, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in any text editor and fill in your details:
   ```env
   EMAIL_ENABLED=True
   SENDER_EMAIL=your_gmail_address@gmail.com
   SENDER_PASSWORD=abcd efgh ijkl mnop
   RECIPIENT_EMAIL=alert_destination@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   ```

#### Option B: Editing `config.py` Directly
Open `config.py` and update lines 44–51:
```python
EMAIL_CONFIG = {
    "enabled": True,
    "sender_email": "your_gmail_address@gmail.com",       # << Your Gmail address
    "sender_password": "abcd efgh ijkl mnop",             # << Your 16-digit Google App Password
    "recipient_email": "alert_destination@gmail.com",     # << Target email for alert notifications
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
}
```

> [!WARNING]
> **SECURITY NOTICE**: Never commit your actual App Password or `.env` file to a public GitHub repository. Ensure `.env` is listed in your `.gitignore` at all times.

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend Framework** | Python 3.10+, Flask 3.0, Flask-SocketIO, Flask-Login, Flask-Bcrypt |
| **AI & Computer Vision** | Ultralytics YOLOv8, PyTorch, TorchVision (CUDA 12.x), OpenCV (`cv2`) |
| **Object Tracking** | SORT (Simple Online and Realtime Tracking), Kalman Filter, SciPy |
| **Database & ORM** | SQLite, SQLAlchemy ORM |
| **Notification Engine** | Secure SMTPLib (Gmail), Brevo API, Firebase Cloud Messaging (FCM) |
| **Frontend & Visualization** | HTML5, Modern CSS Glassmorphism, Chart.js, Socket.IO Client |
| **Cloud Web Demo** | Vercel Serverless Hosting, TensorFlow.js, COCO-SSD |

---

## 🚀 Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/abdulsamiuthwal-eng/VIGILANT-EYE.git
cd VIGILANT-EYE
```

### 2. Create and Activate a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install PyTorch with CUDA (Optional for GPU Acceleration)
```bash
# For NVIDIA GPU (CUDA 12.1 / 12.8)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

### 4. Install Project Dependencies
```bash
pip install -r requirements.txt
```

### 5. Initialize the Database
```bash
python init_db.py
```
> Default operator account created: `admin@vigilanteye.com` / `password123`

### 6. Run Vigilant Eye
```bash
python app.py
```
Open your browser and navigate to: **`http://localhost:5000`**

---

## 📁 Project Structure

```text
VIGILANT-EYE/
├── app.py                      # Flask & SocketIO application server
├── config.py                   # Centralized configuration & AI parameters
├── init_db.py                  # Database bootstrapper & default admin generator
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── auth/                       # Authentication blueprint & security routes
├── camera/                     # Video capture & multi-camera stream manager
├── detection/                  # YOLOv8 detector & SORT tracking algorithms
├── alerts/                     # Dispatcher for Email, FCM & Socket alarms
├── database/                   # SQLAlchemy ORM models & database manager
├── training/                   # Video frame extractor & YOLO fine-tuning pipeline
├── static/                     # CSS stylesheets, UI scripts, sound effects
├── templates/                  # Jinja2 dashboard & auth views
└── vercel_demo/                # Autonomous client-side webapp deployed on Vercel
```

---

## 🔒 Security & Best Practices

* **Sensitive Data Isolation**: All sensitive credentials are decoupled into environment variables via `.env`.
* **Zero Accidental Leaks**: SQLite databases, personal webcam snapshots, and environment secrets are excluded via `.gitignore`.
* **Fail-Safe Fallbacks**: System automatically falls back from GPU to CPU, and from fine-tuned models to base YOLOv8n if custom weights are not present.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<p align="center">
  Developed with ❤️ for intelligent surveillance and safety.
</p>