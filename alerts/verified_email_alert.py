"""
Vigilant Eye - Multi-Email OTP & Alert System
===============================================
Supports multiple verified emails.
Each email is verified independently via OTP before it can receive alerts.
Alert emails include full event details and a professional footer.
"""

import logging
import threading
import random
import time
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from config import EMAIL_CONFIG
from database.db_manager import SettingsManager

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Internal Helpers
# ─────────────────────────────────────────────

def _load_email_list():
    """Load the JSON list of verified emails from settings."""
    raw = SettingsManager.get("verified_alert_emails_list") or "[]"
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def _save_email_list(email_list):
    """Persist the email list back to settings."""
    SettingsManager.set("verified_alert_emails_list", json.dumps(email_list))


# ─────────────────────────────────────────────
# VerifiedEmailManager
# ─────────────────────────────────────────────

class VerifiedEmailManager:
    """
    Manages multiple verified emails for alert delivery.

    Email list structure (stored as JSON in settings key 'verified_alert_emails_list'):
    [
        {
            "email": "user@example.com",
            "verified": true,
            "alert_enabled": true
        },
        ...
    ]
    """

    # ── OTP ──────────────────────────────────

    @staticmethod
    def generate_otp():
        """Generate a secure 6-digit OTP."""
        return f"{random.randint(100000, 999999)}"

    @staticmethod
    def _send_via_smtp(recipient, subject, html_content):
        """Send email via Gmail SMTP with retry logic (up to 3 attempts)."""
        if not EMAIL_CONFIG.get("enabled", False):
            logger.warning("Email SMTP disabled in config.py.")
            return False, "SMTP_DISABLED"

        sender_email    = EMAIL_CONFIG.get("sender_email")
        sender_password = EMAIL_CONFIG.get("sender_password")
        smtp_host       = EMAIL_CONFIG.get("smtp_host", "smtp.gmail.com")
        smtp_port       = EMAIL_CONFIG.get("smtp_port", 587)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Vigilant Eye Security <{sender_email}>"
        msg["To"]      = recipient
        msg.attach(MIMEText(html_content, "html"))

        for attempt in range(3):
            try:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(msg)
                server.quit()
                logger.info(f"SMTP success: email sent to {recipient}")
                return True, "SUCCESS"
            except Exception as e:
                logger.error(f"SMTP error (attempt {attempt+1}): {e}")
            if attempt < 2:
                time.sleep(2)

        return False, "EMAIL_SEND_FAILED"

    # ── Add / Remove ─────────────────────────

    @staticmethod
    def send_verification_email(email):
        """
        Generate OTP and send verification email for a new email address.
        Stores OTP in pending slot so it doesn't conflict with any existing entry.
        """
        otp    = VerifiedEmailManager.generate_otp()
        expiry = (datetime.now() + timedelta(minutes=5)).isoformat()

        # Store pending verification data
        SettingsManager.set("pending_new_verified_email", email)
        SettingsManager.set("pending_new_verified_otp", otp)
        SettingsManager.set("pending_new_verified_otp_expiry", expiry)
        SettingsManager.set("pending_new_verified_otp_attempts", "0")

        subject = "Vigilant Eye — Email Verification Code"
        html_content = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
          <div style="background:linear-gradient(135deg,#0052cc,#00a8ff);padding:28px 32px 18px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:6px;">👁</div>
            <h2 style="color:#fff;margin:0;font-size:1.3rem;font-weight:700;letter-spacing:1px;">VIGILANT EYE</h2>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:0.85rem;">Surveillance System</p>
          </div>
          <div style="padding:32px;">
            <h3 style="color:#1a1f35;margin:0 0 10px;font-size:1rem;">Email Verification Request</h3>
            <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 22px;">
              A request was made to add <strong>{email}</strong> as a verified alert recipient
              for your Vigilant Eye surveillance system.
            </p>
            <p style="color:#888;font-size:0.82rem;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.5px;">Your verification code</p>
            <div style="background:#f0f4ff;border-radius:10px;padding:20px;text-align:center;margin-bottom:22px;border:2px solid #d0e0ff;">
              <span style="font-size:2.2rem;font-weight:900;letter-spacing:10px;color:#0052cc;font-family:monospace;">{otp}</span>
            </div>
            <p style="color:#999;font-size:0.78rem;line-height:1.5;margin:0;">
              This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
            </p>
          </div>
          <div style="background:#f8f9fc;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
            <p style="color:#aaa;font-size:0.72rem;margin:0;">
              This is a system-generated alert. Please do not reply to this email.
            </p>
          </div>
        </div>
        """

        ok, status = VerifiedEmailManager._send_via_smtp(email, subject, html_content)
        if ok:
            return True, "OTP_SENT"
        return False, status

    @staticmethod
    def verify_and_add_email(entered_otp):
        """
        Validate OTP for a pending new email.
        On success, adds the email to the verified list.
        Returns (success: bool, message: str, email: str|None)
        """
        stored_otp     = SettingsManager.get("pending_new_verified_otp")
        expiry_str     = SettingsManager.get("pending_new_verified_otp_expiry")
        attempts       = int(SettingsManager.get("pending_new_verified_otp_attempts") or 0)
        pending_email  = SettingsManager.get("pending_new_verified_email")

        if not stored_otp or not pending_email:
            return False, "OTP_FAILED", None

        if attempts >= 3:
            SettingsManager.set("pending_new_verified_otp", "")
            return False, "OTP_FAILED", None

        if expiry_str:
            if datetime.now() > datetime.fromisoformat(expiry_str):
                SettingsManager.set("pending_new_verified_otp", "")
                return False, "OTP_EXPIRED", None

        if entered_otp != stored_otp:
            new_attempts = attempts + 1
            SettingsManager.set("pending_new_verified_otp_attempts", str(new_attempts))
            if new_attempts >= 3:
                SettingsManager.set("pending_new_verified_otp", "")
                return False, "OTP_FAILED", None
            return False, "OTP_FAILED", None

        # OTP correct — add email to the list
        email_list = _load_email_list()

        # Check if already in list
        for entry in email_list:
            if entry["email"].lower() == pending_email.lower():
                entry["verified"] = True
                entry["alert_enabled"] = True
                _save_email_list(email_list)
                _clear_pending_otp()
                return True, "OTP_VERIFIED", pending_email

        # New entry
        email_list.append({
            "email":         pending_email.lower(),
            "verified":      True,
            "alert_enabled": True,
        })
        _save_email_list(email_list)
        _clear_pending_otp()
        return True, "OTP_VERIFIED", pending_email

    @staticmethod
    def remove_email(email):
        """Remove an email from the verified list."""
        email_list = _load_email_list()
        updated = [e for e in email_list if e["email"].lower() != email.lower()]
        _save_email_list(updated)
        return True, "EMAIL_REMOVED"

    @staticmethod
    def toggle_email_alert(email, enabled: bool):
        """Enable or disable alert delivery for a specific verified email."""
        email_list = _load_email_list()
        for entry in email_list:
            if entry["email"].lower() == email.lower():
                entry["alert_enabled"] = enabled
                _save_email_list(email_list)
                return True, "TOGGLED"
        return False, "EMAIL_NOT_FOUND"

    @staticmethod
    def get_email_list():
        """Return the full list of email entries."""
        return _load_email_list()

    # Legacy single-email status (kept for backward compat if anything reads it)
    @staticmethod
    def get_status():
        email_list = _load_email_list()
        verified = [e for e in email_list if e.get("verified") and e.get("alert_enabled")]
        if verified:
            return {"email": verified[0]["email"], "status": "EMAIL_VERIFIED"}
        return {"email": "", "status": "EMAIL_NOT_VERIFIED_ALERT_BLOCKED"}

    # ── Alert Sending ─────────────────────────

    @staticmethod
    def send_alert_email(alert_data):
        """
        Send a professional security alert to all verified + enabled email addresses.
        Runs in background threads to avoid blocking the detection pipeline.
        """
        email_list = _load_email_list()
        recipients = [
            e["email"] for e in email_list
            if e.get("verified") and e.get("alert_enabled")
        ]

        if not recipients:
            logger.info("No verified+enabled emails — alert email skipped.")
            return "EMAIL_NOT_VERIFIED_ALERT_BLOCKED"

        ts            = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        alert_type    = alert_data.get("activity_type", "Suspicious Activity")
        camera_name   = alert_data.get("camera_name", f"Camera {alert_data.get('camera_id', 'N/A')}")
        location      = alert_data.get("location", "Unknown Location")
        confidence    = alert_data.get("confidence", 0)
        detected_obj  = alert_data.get("detected_object", "Unknown Subject")

        # Build professional narrative sentence
        narrative = (
            f"A <strong>{alert_type}</strong> was detected at <strong>{location}</strong> "
            f"at <strong>{datetime.now().strftime('%I:%M %p')}</strong> via <strong>{camera_name}</strong>."
        )

        subject = f"🚨 Security Alert: {alert_type} — {camera_name}"

        html_content = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#c0392b,#e74c3c);padding:24px 32px 16px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:2rem;">🚨</div>
              <div>
                <div style="color:#fff;font-weight:800;font-size:1.15rem;letter-spacing:0.5px;">VIGILANT EYE</div>
                <div style="color:rgba(255,255,255,0.8);font-size:0.75rem;margin-top:2px;">Security Alert Notification</div>
              </div>
            </div>
          </div>

          <!-- Alert Narrative Banner -->
          <div style="background:#fff5f5;border-left:5px solid #e74c3c;padding:18px 24px;margin:0;font-size:0.95rem;color:#333;line-height:1.7;">
            {narrative}
          </div>

          <!-- Details Grid -->
          <div style="padding:24px 32px;">
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-weight:600;width:140px;vertical-align:top;">🔔 Event Type</td>
                <td style="padding:10px 0;color:#1a1f35;font-weight:700;">{alert_type}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-weight:600;vertical-align:top;">🕵️ Detected</td>
                <td style="padding:10px 0;color:#1a1f35;font-weight:700;">{detected_obj}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-weight:600;vertical-align:top;">🕒 Date & Time</td>
                <td style="padding:10px 0;color:#1a1f35;font-weight:700;">{ts}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-weight:600;vertical-align:top;">📷 Camera</td>
                <td style="padding:10px 0;color:#1a1f35;font-weight:700;">{camera_name}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-weight:600;vertical-align:top;">📍 Location</td>
                <td style="padding:10px 0;color:#1a1f35;font-weight:700;">{location}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#888;font-weight:600;vertical-align:top;">📊 Confidence</td>
                <td style="padding:10px 0;">
                  <span style="background:#e8f5e9;color:#2e7d32;padding:3px 12px;border-radius:20px;font-weight:700;font-size:0.85rem;">
                    {confidence * 100:.1f}%
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Action Note -->
          <div style="background:#f0f4ff;margin:0 32px 24px;border-radius:8px;padding:14px 18px;font-size:0.82rem;color:#555;line-height:1.6;border:1px solid #d0e0ff;">
            ⚠️ <strong>Action Required:</strong> Please review this event in your Vigilant Eye dashboard and take appropriate action if necessary.
          </div>

          <!-- Footer -->
          <div style="background:#f8f9fc;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
            <p style="color:#aaa;font-size:0.72rem;margin:0;line-height:1.6;">
              This is a system-generated alert. Please do not reply to this email.<br>
              © Vigilant Eye Surveillance System
            </p>
          </div>
        </div>
        """

        # Send to each recipient in a daemon thread (non-blocking)
        for email_addr in recipients:
            threading.Thread(
                target=VerifiedEmailManager._send_via_smtp,
                args=(email_addr, subject, html_content),
                daemon=True
            ).start()

        logger.info(f"Alert email dispatched to {len(recipients)} recipient(s): {recipients}")
        return "ALERT_SENT"


# ─────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────

def _clear_pending_otp():
    SettingsManager.set("pending_new_verified_otp", "")
    SettingsManager.set("pending_new_verified_otp_expiry", "")
    SettingsManager.set("pending_new_verified_otp_attempts", "0")
    SettingsManager.set("pending_new_verified_email", "")


# ─────────────────────────────────────────────
# Alert Hook (registered with detector)
# ─────────────────────────────────────────────

def verified_alert_hook(camera_id, activity_type, confidence,
                        snapshot_path=None, camera_name=None,
                        location=None, detected_object=None):
    """Bridge between the detector and the verified multi-email module."""
    VerifiedEmailManager.send_alert_email({
        "camera_id":       camera_id,
        "camera_name":     camera_name or f"Camera {camera_id}",
        "activity_type":   activity_type,
        "confidence":      confidence,
        "location":        location or "Unknown Location",
        "detected_object": detected_object or "Unknown Subject",
    })


# Auto-register with detector
try:
    from detection.detector import detector
    detector.register_alert_callback(verified_alert_hook)
    logger.info("Multi-email alert system integrated with detector.")
except Exception as e:
    logger.error(f"Failed to integrate multi-email alert hook: {e}")
