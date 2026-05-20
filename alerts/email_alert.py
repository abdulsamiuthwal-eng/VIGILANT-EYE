"""
Vigilant Eye - Email Alert
============================
Gmail SMTP email notification system.
"""

import smtplib
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime
from config import EMAIL_CONFIG

logger = logging.getLogger(__name__)


class EmailAlertSender:
    """Sends theft alert emails via Gmail SMTP."""

    def __init__(self):
        self.enabled = EMAIL_CONFIG.get("enabled", False)
        self.sender = EMAIL_CONFIG.get("sender_email", "")
        self.password = EMAIL_CONFIG.get("sender_password", "")
        self.recipient = EMAIL_CONFIG.get("recipient_email", "")
        self.host = EMAIL_CONFIG.get("smtp_host", "smtp.gmail.com")
        self.port = EMAIL_CONFIG.get("smtp_port", 587)

    def send_alert(self, camera_id, camera_name, activity_type,
                   confidence, timestamp, snapshot_path=None):
        """Send theft alert email with optional snapshot attachment."""
        if not self.enabled:
            logger.info("Email alerts disabled. Skipping.")
            return False

        try:
            msg = MIMEMultipart("related")
            msg["Subject"] = f"🚨 THEFT ALERT - {activity_type} | Camera {camera_name}"
            msg["From"] = self.sender
            msg["To"] = self.recipient

            ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S") if isinstance(
                timestamp, datetime) else str(timestamp)

            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background: #0d0d1a; color: #e0e0e0; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: #1a1a2e; border-radius: 12px;
                            border: 2px solid #ff4444; padding: 30px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #ff4444; margin: 0;">🚨 VIGILANT EYE ALERT</h1>
                        <p style="color: #aaa; margin: 5px 0;">Real-time Theft Detection System</p>
                    </div>
                    <hr style="border-color: #333; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; color: #aaa; width: 40%;">📹 Camera</td>
                            <td style="padding: 10px; font-weight: bold; color: #fff;">
                                {camera_name} (ID: {camera_id})
                            </td>
                        </tr>
                        <tr style="background: #111;">
                            <td style="padding: 10px; color: #aaa;">⚠️ Activity</td>
                            <td style="padding: 10px; font-weight: bold; color: #ff6666;">
                                {activity_type}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #aaa;">🎯 Confidence</td>
                            <td style="padding: 10px; font-weight: bold; color: #66ff99;">
                                {confidence:.1%}
                            </td>
                        </tr>
                        <tr style="background: #111;">
                            <td style="padding: 10px; color: #aaa;">🕒 Timestamp</td>
                            <td style="padding: 10px; color: #fff;">{ts_str}</td>
                        </tr>
                    </table>
                    {"<br><img src='cid:snapshot' style='width:100%; border-radius:8px; border:2px solid #ff4444;'>" if snapshot_path else ""}
                    <hr style="border-color: #333; margin: 20px 0;">
                    <p style="text-align: center; color: #555; font-size: 12px;">
                        Vigilant Eye — AI-Based CCTV Theft Detection System<br>
                        This is an automated alert. Please review the camera feed immediately.
                    </p>
                </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(html, "html"))

            # Attach snapshot if available
            if snapshot_path and os.path.exists(snapshot_path):
                with open(snapshot_path, "rb") as f:
                    img = MIMEImage(f.read())
                    img.add_header("Content-ID", "<snapshot>")
                    img.add_header("Content-Disposition", "inline",
                                   filename=os.path.basename(snapshot_path))
                    msg.attach(img)

            # Send email
            with smtplib.SMTP(self.host, self.port) as server:
                server.ehlo()
                server.starttls()
                server.login(self.sender, self.password)
                server.sendmail(self.sender, self.recipient, msg.as_string())

            logger.info(f"Alert email sent for camera {camera_name}: {activity_type}")
            return True

        except smtplib.SMTPAuthenticationError:
            logger.error("Email auth failed. Check Gmail App Password in config.py.")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Email send error: {e}")
            return False

    def test_connection(self):
        """Test SMTP connection."""
        try:
            with smtplib.SMTP(self.host, self.port) as server:
                server.ehlo()
                server.starttls()
                server.login(self.sender, self.password)
            logger.info("Email connection test successful.")
            return True, "Connection successful"
        except Exception as e:
            logger.error(f"Email connection test failed: {e}")
            return False, str(e)
