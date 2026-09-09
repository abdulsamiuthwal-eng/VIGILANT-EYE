<p align="center">
  <img src="https://raw.githubusercontent.com/abdulsamiuthwal-eng/VIGILANT-EYE/main/static/images/logo.png" alt="Vigilant Eye Logo" width="120" onerror="this.style.display='none'"/>
</p>

<h1 align="center">👁️ VIGILANT EYE</h1>
<h3 align="center">Enterprise Real-Time AI Computer Vision Surveillance & Theft Prevention Platform</h3>

<p align="center">
  <a href="https://vigilant-eye-gold.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/🚀%20LIVE%20DEMO-vigilant--eye--gold.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo on Vercel" height="38"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-00ffff?style=flat-square" alt="YOLOv8"/>
  <img src="https://img.shields.io/badge/PyTorch-CUDA%20Accelerated-ee4c2c?style=flat-square&logo=pytorch&logoColor=white" alt="PyTorch"/>
  <img src="https://img.shields.io/badge/OpenCV-Computer%20Vision-5c3ee8?style=flat-square&logo=opencv&logoColor=white" alt="OpenCV"/>
  <img src="https://img.shields.io/badge/Flask-Web%20Server-000000?style=flat-square&logo=flask&logoColor=white" alt="Flask"/>
  <img src="https://img.shields.io/badge/Socket.IO-Real--Time%20Events-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO"/>
  <img src="https://img.shields.io/badge/Three.js-WebGL%203D%20CCTV-black?style=flat-square&logo=threedotjs&logoColor=white" alt="Three.js"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/>
</p>

---

> 📘 **FOR NEW AI AGENTS & DEVELOPERS**:
> Always read **[AGENT_GUIDE.md](AGENT_GUIDE.md)** and **[ARCHITECTURE.md](ARCHITECTURE.md)** first! They contain the complete architectural blueprints, dual-stack parity rules, sequence diagrams, database schemas, REST endpoints, WebSocket events, and critical gotchas for this repository.

---

## 📌 Table of Contents
1. [Project Overview](#-project-overview)
2. [🌐 Live Web Demo (Vercel)](#-live-web-demo-vercel)
3. [✨ Key Features](#-key-features)
4. [🏗️ Dual-Stack Architecture](#️-dual-stack-architecture)
5. [🎨 Design System & Color Tokens](#-design-system--color-tokens)
6. [🛠️ Tech Stack](#️-tech-stack)
7. [📧 Email Alert Configuration (SMTP) — Step-by-Step](#-email-alert-configuration-smtp--step-by-step)
8. [🚀 Installation & Local Setup](#-installation--local-setup)
9. [📁 Project Structure](#-project-structure)
10. [🔑 Default Credentials](#-default-credentials)
11. [🔒 Security & Best Practices](#-security--best-practices)
12. [📄 License](#-license)

---

## 📖 Project Overview

**Vigilant Eye** is an enterprise-grade AI computer vision surveillance and anti-theft security platform built for retail environments, supermarkets, warehouses, and secured industrial zones.

By combining **YOLOv8 deep learning detection**, **SORT spatial tracking**, **smart zone collision logic**, and **Flask-SocketIO**, Vigilant Eye continuously monitors concurrent video streams, detects persons, tracks dwell time in sensitive areas, flags suspicious item-concealment actions, and dispatches instant multi-channel security alerts (WebSocket audio siren, Gmail snapshot reports, and FCM push notifications).

---

## 🌐 Live Web Demo (Vercel)

Experience the modern dashboard interface and in-browser camera detection right now without installing any local Python environment:

<p align="center">
  <a href="https://vigilant-eye-gold.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/▶_LAUNCH_LIVE_DEMO-vigilant--eye--gold.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white" alt="Click to Launch Live Demo" height="42"/>
  </a>
</p>

> 💡 **Client-Side Demo Mode**:
> The live deployment on Vercel runs autonomously via **TensorFlow.js (COCO-SSD)**. It accesses your local webcam securely in the browser via `navigator.mediaDevices.getUserMedia` and simulates detections, analytics, and security events stored in browser `localStorage`. For full PyTorch CUDA inference, RTSP streams, and background model fine-tuning, run the Flask backend locally.

---

## ✨ Key Features

* 🎥 **Photorealistic 3D CCTV Camera (Three.js WebGL)**: Hardware-accurate 3D security camera with procedural brushed metal, optical glass shaders, 12 infrared night-vision LEDs, volumetric laser cone, and servomotor input/cursor tracking on the login page.
* 🎨 **Curated 4-Color Glassmorphic Design**: Strict anti-theft theme built on calibrated tokens (`#D96868`, `#F2F2F2`, `#91AE6E`, `#689D4B`) with hardware-accelerated blur, volumetric ambient background blending, and high-contrast typography.
* 🎯 **Real-Time YOLOv8 Detection**: Sub-30ms inference detecting persons, suspicious dwell times, and potential theft actions.
* 📍 **Multi-Zone Spatial Logic**:
  * **Zone A (Shelf / Merchandising)**: Measures dwell time and shelf-approach frequency.
  * **Zone B (Checkout / Register)**: Validates payment and scanning clearance.
  * **Zone C (Store Exit Perimeter)**: Immediately triggers alarms if an individual bypasses Zone B directly from Zone A.
* 📹 **Thread-Safe Camera Management**: Concurrent capture supporting RTSP IP cameras, USB webcams, and video files with automatic reconnection.
* ⚡ **Multi-Channel Alert Dispatcher**:
  * Real-time WebSocket audio siren and visual HUD flashing.
  * Multi-recipient Gmail SMTP alert emails with camera snapshots.
  * Independent OTP verification for every email added to the alert list.
  * Firebase Cloud Messaging (FCM) mobile push alerts.
* 🔄 **On-Premise Model Fine-Tuning**: Web-based upload of surveillance footage, automatic frame extraction at configurable FPS, and background retraining of custom YOLOv8 weights with live progress bars.
* 📱 **Fluid 60 FPS Mobile Drawer**: Hardware-accelerated GPU slide drawer (`translate3d`), reflow-decoupled dismissal, zero scrollbar clutter, and standardized compact profile controls on mobile viewports.
* 🔐 **Secure Authentication**: Flask-Login, Bcrypt password hashing, session-bound themes, and Google OAuth 2.0 integration.

---

## 🏗️ Dual-Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             VIGILANT EYE SYSTEM                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│   Python Flask Backend (/)   │             │   Vercel Webapp (/vercel_demo)│
├───────────────────────────────┤             ├───────────────────────────────┤
│ • PyTorch YOLOv8 + OpenCV     │             │ • TensorFlow.js (COCO-SSD)    │
│ • SORT Kalman Filter Tracking │             │ • In-browser webcam stream    │
│ • SQLite Database (`db`)      │             │ • Client `localStorage` mock  │
│ • Multi-Camera RTSP Engine    │             │ • Static HTML5 / CSS3 / JS    │
│ • Flask-SocketIO & SMTPLib    │             │ • Deployed at Vercel Edge     │
└───────────────────────────────┘             └───────────────────────────────┘
```

---

## 🎨 Design System & Color Tokens

The UI strictly adheres to a calibrated 4-color palette designed for maximum contrast and security readability:

| Color Token | Hex Code | Role in Interface |
| :--- | :--- | :--- |
| **Coral Red** | `#D96868` | Primary brand accent, alert badges, laser target locks, critical alarm triggers |
| **Light Neutral** | `#F2F2F2` | Clean background canvas, light mode base, high-contrast text |
| **Sage Green** | `#91AE6E` | Secondary accent, tactical HUD borders, searching reticle, status badges |
| **Olive Forest** | `#689D4B` | Tertiary dark accent, active online indicators, button hover states |

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.10+, Flask 3.0, Flask-SocketIO, Flask-Login, Flask-Bcrypt, SQLAlchemy |
| **Computer Vision** | Ultralytics YOLOv8, PyTorch (CUDA 12.x), OpenCV (`cv2`), Scipy, NumPy |
| **Object Tracking** | SORT (Simple Online and Realtime Tracking) with Kalman Filtering |
| **Frontend UI** | HTML5, Vanilla CSS Glassmorphism, Three.js (WebGL), Chart.js, Socket.IO Client |
| **Alerting** | Python `smtplib` (Gmail SMTP), Brevo API, Firebase Cloud Messaging (FCM) |
| **Static Demo** | Vercel Edge Serverless, TensorFlow.js, `@tensorflow-models/coco-ssd` |

---

## 📧 Email Alert Configuration (SMTP) — Step-by-Step

> [!IMPORTANT]
> **Email Alerts require a Google App Password.** Standard Gmail account passwords will **not** work due to Google's mandatory security policy for third-party SMTP applications.

### 🔑 How to Generate a Google App Password

1. Open your **[Google Account Management](https://myaccount.google.com/)**.
2. On the left navigation panel, click **Security**.
3. Under *"How you sign in to Google"*, ensure **2-Step Verification** is turned **ON**.
4. In the search bar at the top, type **`App Passwords`** and select it.
5. In the *App name* field, enter a name (e.g., `Vigilant Eye`).
6. Click **Create**.
7. Google will display a **16-character passcode** (e.g., `abcd efgh ijkl mnop`).
8. **Copy this 16-character code** (spaces don't matter).

### ⚙️ How to Add Credentials to Vigilant Eye

Create a `.env` file in the project root:
```bash
cp .env.example .env
```
Fill in your details in `.env`:
```env
EMAIL_ENABLED=True
SENDER_EMAIL=your_gmail_address@gmail.com
SENDER_PASSWORD=abcd efgh ijkl mnop
RECIPIENT_EMAIL=alert_destination@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

---

## 🚀 Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/abdulsamiuthwal-eng/VIGILANT-EYE.git
cd VIGILANT-EYE
```

### 2. Create and Activate Virtual Environment
```bash
# Windows (PowerShell)
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install PyTorch with CUDA (Optional for GPU Acceleration)
```bash
# For NVIDIA GPU acceleration
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Initialize Database & Default Admin
```bash
python init_db.py
```

### 6. Run Vigilant Eye Server
```bash
python app.py
```
Open your browser and navigate to: **`http://localhost:5000`**

---

## 📁 Project Structure

```text
VIGILANT-EYE/
├── app.py                      # Flask & SocketIO application server
├── config.py                   # Central configuration & parameters
├── init_db.py                  # Database bootstrapper & default admin generator
├── AGENT_GUIDE.md              # Master developer & AI agent architectural guide
├── auth/                       # Authentication blueprint & security routes
├── camera/                     # Video capture & multi-camera stream manager
├── detection/                  # YOLOv8 detector & SORT tracking algorithms
├── alerts/                     # Dispatcher for Email, FCM & Socket alarms
├── database/                   # SQLAlchemy ORM models & database manager
├── training/                   # Video frame extractor & YOLO fine-tuning pipeline
├── static/                     # CSS stylesheets, UI scripts, 3D assets, sound effects
├── templates/                  # Jinja2 dashboard & auth views
└── vercel_demo/                # Autonomous client-side webapp deployed on Vercel
```

---

## 🔑 Default Credentials

| Environment | URL | Email | Password |
| :--- | :--- | :--- | :--- |
| **Local Flask Server** | `http://localhost:5000` | `admin@vigilanteye.com` | `password123` |
| **Vercel Live Demo** | `https://vigilant-eye-gold.vercel.app` | `admin@vigilanteye.com` | `admin123` |

---

## 🔒 Security & Best Practices

* **Sensitive Data Isolation**: All API keys, SMTP passwords, and tokens are stored in `.env`.
* **Safe Defaults**: Cameras default to inactive on startup to prevent accidental stream leaks.
* **Fail-Safe Fallbacks**: Automatic fallback from GPU to CPU, and from custom weights to baseline YOLOv8n.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<p align="center">
  Developed with ❤️ for intelligent surveillance and safety.
</p>