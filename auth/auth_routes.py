"""
Vigilant Eye - Authentication Routes
======================================
Handles login, registration, logout, and password reset.
"""

import logging
import re
import secrets
import threading
from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, session, current_app
from flask_login import login_user, logout_user, login_required, current_user
from database.models import db, User
from database.db_manager import UserManager
from alerts.verified_email_alert import VerifiedEmailManager

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Security Notification Emails
# ─────────────────────────────────────────────────────────────────────────────

def _send_security_notification(event_type, user, extra=None):
    """
    Send a security notification email to the account owner.
    Runs in a background daemon thread to avoid blocking request processing.

    event_type:
        'new_login'           — standard email/password login
        'new_device'          — login from a different IP/browser
        'google_registration' — account created via Google
        'password_reset'      — password was changed via forgot-password
    """
    ts = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    request_ip = request.remote_addr or "Unknown"
    user_agent = request.headers.get("User-Agent", "Unknown Browser")[:80]

    if event_type == "new_login":
        subject = "🔐 New Sign-In Detected — Vigilant Eye"
        event_label = "New Sign-In"
        icon = "🔐"
        color = "#0052cc"
        body_html = f"""
          <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 18px;">
            A new sign-in to your <strong>Vigilant Eye</strong> account was detected.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:0.87rem;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;width:140px;">👤 Account</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">📍 IP Address</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{request_ip}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">🕒 Time</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{ts}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;font-weight:600;">🌐 Browser</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user_agent}</td>
            </tr>
          </table>
          <div style="background:#f0f4ff;border-radius:8px;padding:12px 16px;margin-top:18px;font-size:0.82rem;color:#555;border:1px solid #d0e0ff;">
            If this was not you, please <strong>change your password immediately</strong> and contact your system administrator.
          </div>
        """

    elif event_type == "new_device":
        subject = "🛡️ New Device Login Detected — Vigilant Eye"
        event_label = "New Device Login"
        icon = "🛡️"
        color = "#e67e22"
        body_html = f"""
          <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 18px;">
            Your account was accessed from a <strong>new or unrecognized device/location</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:0.87rem;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;width:140px;">👤 Account</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">📍 IP Address</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{request_ip}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">🕒 Time</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{ts}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;font-weight:600;">🌐 Browser</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user_agent}</td>
            </tr>
          </table>
          <div style="background:#fff8ec;border-radius:8px;padding:12px 16px;margin-top:18px;font-size:0.82rem;color:#555;border:1px solid #fde8b0;">
            ⚠️ If you do not recognize this activity, <strong>change your password immediately</strong>.
          </div>
        """

    elif event_type == "google_registration":
        subject = "✅ New Account Created via Google — Vigilant Eye"
        event_label = "Google Account Registration"
        icon = "✅"
        color = "#27ae60"
        body_html = f"""
          <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 18px;">
            A new <strong>Vigilant Eye</strong> account was successfully created using your Google account.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:0.87rem;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;width:140px;">👤 Name</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user.name}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">📧 Email</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">📍 IP Address</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{request_ip}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;font-weight:600;">🕒 Time</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{ts}</td>
            </tr>
          </table>
          <div style="background:#f0fff4;border-radius:8px;padding:12px 16px;margin-top:18px;font-size:0.82rem;color:#555;border:1px solid #b2dfdb;">
            Welcome to Vigilant Eye! If you did not create this account, please contact your system administrator.
          </div>
        """

    elif event_type == "password_reset":
        subject = "🔑 Password Changed — Vigilant Eye"
        event_label = "Password Reset"
        icon = "🔑"
        color = "#c0392b"
        body_html = f"""
          <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 18px;">
            Your <strong>Vigilant Eye</strong> account password was recently changed.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:0.87rem;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;width:140px;">👤 Account</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{user.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:9px 0;color:#888;font-weight:600;">📍 IP Address</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{request_ip}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;color:#888;font-weight:600;">🕒 Time</td>
              <td style="padding:9px 0;color:#1a1f35;font-weight:700;">{ts}</td>
            </tr>
          </table>
          <div style="background:#fff5f5;border-radius:8px;padding:12px 16px;margin-top:18px;font-size:0.82rem;color:#555;border:1px solid #ffd0d0;">
            🔒 If you did not make this change, <strong>contact your system administrator immediately</strong>.
          </div>
        """
    else:
        return  # Unknown event type — skip silently

    html_content = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <div style="background:linear-gradient(135deg,{color},{color}cc);padding:24px 32px 16px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:6px;">{icon}</div>
        <h2 style="color:#fff;margin:0;font-size:1.15rem;font-weight:700;letter-spacing:1px;">VIGILANT EYE</h2>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:0.82rem;">Security Notification — {event_label}</p>
      </div>
      <div style="padding:28px 32px;">
        {body_html}
      </div>
      <div style="background:#f8f9fc;border-top:1px solid #eee;padding:14px 32px;text-align:center;">
        <p style="color:#aaa;font-size:0.72rem;margin:0;">This is a system-generated security alert. Please do not reply.</p>
      </div>
    </div>
    """

    threading.Thread(
        target=VerifiedEmailManager._send_via_smtp,
        args=(user.email, subject, html_content),
        daemon=True
    ).start()


def validate_registration(name, email, password, confirm_password):
    """Validate registration inputs."""
    errors = []
    
    # Name validation
    if not name or len(name.strip()) < 2:
        errors.append("Full name must be at least 2 characters.")
        
    # Email validation (using regex)
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not email or not re.match(email_regex, email):
        errors.append("Please enter a valid email address.")
        
    # Password validation
    if not password or len(password) < 8:
        errors.append("Password must be at least 8 characters.")
    else:
        # Enforce uppercase, number, and special character
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number.")
        if not any(c in '!@#$%^&*(),.?":{}|<>' for c in password):
            errors.append("Password must contain at least one special character.")
            
    # Confirm password
    if password != confirm_password:
        errors.append("Passwords do not match.")
        
    return errors


def send_verification_email(user):
    """Send account verification email using SMTP in a background thread."""
    token = user.verification_token
    verification_link = url_for("auth.verify_email", token=token, _external=True)
    
    subject = "Verify Your Vigilant Eye Account"
    html_content = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <div style="background:linear-gradient(135deg,#0052cc,#00a8ff);padding:28px 32px 18px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:6px;">👁</div>
        <h2 style="color:#fff;margin:0;font-size:1.3rem;font-weight:700;letter-spacing:1px;">VIGILANT EYE</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:0.85rem;">Surveillance System</p>
      </div>
      <div style="padding:32px;">
        <h3 style="color:#1a1f35;margin:0 0 10px;font-size:1.1rem;font-weight:600;">Welcome, {user.name}!</h3>
        <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 22px;">
          Thank you for registering with Vigilant Eye. To activate your account and start monitoring, please verify your email address by clicking the button below.
        </p>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="{verification_link}" style="display:inline-block;padding:12px 30px;background:linear-gradient(135deg,#0052cc,#00a8ff);color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:0.9rem;box-shadow:0 4px 15px rgba(0,82,204,0.3);">Verify Email Address</a>
        </div>
        <p style="color:#999;font-size:0.78rem;line-height:1.5;margin:0 0 12px;">
          If the button doesn't work, copy and paste the link below into your browser:
        </p>
        <p style="color:#0066ff;font-size:0.75rem;word-break:break-all;margin:0;">
          <a href="{verification_link}" style="color:#0066ff;">{verification_link}</a>
        </p>
      </div>
      <div style="background:#f8f9fc;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
        <p style="color:#aaa;font-size:0.72rem;margin:0;">
          This is an automated system email. Please do not reply.
        </p>
      </div>
    </div>
    """
    
    # Run in a daemon thread so it doesn't block the request response
    threading.Thread(
        target=VerifiedEmailManager._send_via_smtp,
        args=(user.email, subject, html_content),
        daemon=True
    ).start()


@auth_bp.route("/")
def splash():
    """Splash screen — always rendered on root access. Forces logout for fresh launch."""
    if current_user.is_authenticated:
        logout_user()
    return render_template("splash.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    google_client_id = current_app.config.get("GOOGLE_CLIENT_ID", "")
    # Suppress placeholder value so the frontend knows no real Client ID is set
    if google_client_id == "your-google-client-id-here.apps.googleusercontent.com":
        google_client_id = ""

    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            msg = "Email and password are required."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 400
            flash(msg, "danger")
            return render_template("login.html", google_client_id=google_client_id)

        user = UserManager.get_by_email(email)
        if not user or not user.check_password(password):
            msg = "Invalid email or password."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 401
            flash(msg, "danger")
            return render_template("login.html", google_client_id=google_client_id)

        # Restrict login to verified users for local auth
        if user.auth_method == "local" and not user.email_verified:
            msg = "Your email address is not verified. Please check your inbox for the verification link."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 403
            flash(msg, "warning")
            return render_template("login.html", google_client_id=google_client_id)

        login_user(user, remember=False)
        UserManager.update_last_login(user.id)
        session["theme"] = user.theme
        logger.info(f"User logged in: {email}")

        # Security notification: new sign-in
        try:
            _send_security_notification("new_login", user)
        except Exception as e:
            logger.warning(f"Security notification failed (new_login): {e}")

        if request.is_json:
            return jsonify({"success": True, "redirect": url_for("dashboard.post_login_splash")})
        return redirect(url_for("dashboard.post_login_splash"))

    return render_template("login.html", google_client_id=google_client_id)


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    google_client_id = current_app.config.get("GOOGLE_CLIENT_ID", "")
    if google_client_id == "your-google-client-id-here.apps.googleusercontent.com":
        google_client_id = ""

    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")

        # Validation
        errors = validate_registration(name, email, password, confirm_password)

        if errors:
            if request.is_json:
                return jsonify({"success": False, "errors": errors}), 400
            for error in errors:
                flash(error, "danger")
            return render_template("register.html", google_client_id=google_client_id)

        # Duplicate account protection
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            msg = "Email is already registered."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 400
            flash(msg, "danger")
            return render_template("register.html", google_client_id=google_client_id)

        user, error = UserManager.create_user(name, email, password)
        if error:
            if request.is_json:
                return jsonify({"success": False, "message": error}), 400
            flash(error, "danger")
            return render_template("register.html", google_client_id=google_client_id)

        # Configure unverified state & verification token
        token = secrets.token_hex(32)
        user.email_verified = False
        user.auth_method = "local"
        user.verification_token = token
        db.session.commit()

        # Send verification email in the background
        try:
            send_verification_email(user)
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")

        logger.info(f"New unverified user registered: {email}")

        msg = "Account created successfully! A verification email has been sent. Please check your inbox."
        if request.is_json:
            return jsonify({"success": True, "message": msg, "redirect": url_for("auth.login")})
        flash(msg, "success")
        return redirect(url_for("auth.login"))

    return render_template("register.html", google_client_id=google_client_id)


@auth_bp.route("/verify-email/<token>")
def verify_email(token):
    """Verify registration verification token and activate account."""
    user = User.query.filter_by(verification_token=token).first()
    if not user:
        flash("Invalid or expired verification token.", "danger")
        return redirect(url_for("auth.login"))

    user.email_verified = True
    user.verification_token = None
    db.session.commit()
    logger.info(f"User email verified successfully: {user.email}")

    flash("Your email has been successfully verified! You can now log in.", "success")
    return redirect(url_for("auth.login"))


@auth_bp.route("/auth/google-login", methods=["POST"])
def google_login():
    """Verify Google ID Token, log in an existing user (login page flow)."""
    if current_user.is_authenticated:
        return jsonify({"success": True, "redirect": url_for("dashboard.index")})

    data = request.get_json()
    id_token = data.get("credential")

    if not id_token:
        return jsonify({"success": False, "message": "Google credential token missing."}), 400

    import requests
    try:
        # Verify the Google ID Token via Google tokeninfo API
        response = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}",
            timeout=10
        )
        if response.status_code != 200:
            return jsonify({"success": False, "message": "Failed to verify Google identity token."}), 401

        token_info = response.json()

        # Verify Google Client ID matches target audience
        expected_client_id = current_app.config.get("GOOGLE_CLIENT_ID")
        if token_info.get("aud") != expected_client_id:
            logger.warning(f"Google Token audience mismatch: {token_info.get('aud')} vs {expected_client_id}")
            return jsonify({"success": False, "message": "Invalid token audience validation."}), 401

        # Check if email is verified by Google
        if token_info.get("email_verified") not in ("true", True):
            return jsonify({"success": False, "message": "Google email address is not verified."}), 401

        email = token_info.get("email", "").strip().lower()
        name = token_info.get("name", "").strip()
        picture = token_info.get("picture", "").strip()

        if not email:
            return jsonify({"success": False, "message": "Email not provided by Google."}), 400

        user = User.query.filter_by(email=email).first()
        is_new_user = False

        if not user:
            # Auto-create account for Google sign-in from login page
            from database.models import bcrypt
            import os
            random_pw = os.urandom(24).hex()
            pw_hash = bcrypt.generate_password_hash(random_pw).decode("utf-8")

            user = User(
                name=name,
                email=email,
                password_hash=pw_hash,
                role="operator",
                email_verified=True,
                auth_method="google",
                profile_picture_url=picture if picture else None
            )
            db.session.add(user)
            db.session.commit()
            is_new_user = True
            logger.info(f"Auto-registered new Google user via login: {email}")
        else:
            # Update Google metadata if missing
            updated = False
            if not user.profile_picture_url and picture:
                user.profile_picture_url = picture
                updated = True
            if not user.email_verified:
                user.email_verified = True
                updated = True
            if updated:
                db.session.commit()

        login_user(user, remember=False)
        UserManager.update_last_login(user.id)
        session["theme"] = user.theme
        logger.info(f"Google user logged in: {email}")

        # Security notifications
        try:
            if is_new_user:
                _send_security_notification("google_registration", user)
            else:
                _send_security_notification("new_login", user)
        except Exception as e:
            logger.warning(f"Security notification failed (google_login): {e}")

        return jsonify({"success": True, "redirect": url_for("dashboard.post_login_splash")})

    except Exception as e:
        logger.error(f"Error during Google authentication: {e}")
        return jsonify({"success": False, "message": "An error occurred during Google authentication."}), 500


@auth_bp.route("/auth/google-register", methods=["POST"])
def google_register():
    """Verify Google ID Token and create a new account (register page flow)."""
    if current_user.is_authenticated:
        return jsonify({"success": True, "redirect": url_for("dashboard.index")})

    data = request.get_json()
    id_token = data.get("credential")

    if not id_token:
        return jsonify({"success": False, "message": "Google credential token missing."}), 400

    import requests
    try:
        response = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}",
            timeout=10
        )
        if response.status_code != 200:
            return jsonify({"success": False, "message": "Failed to verify Google identity token."}), 401

        token_info = response.json()

        expected_client_id = current_app.config.get("GOOGLE_CLIENT_ID")
        if token_info.get("aud") != expected_client_id:
            logger.warning(f"Google Token audience mismatch (register): {token_info.get('aud')} vs {expected_client_id}")
            return jsonify({"success": False, "message": "Invalid token audience validation."}), 401

        if token_info.get("email_verified") not in ("true", True):
            return jsonify({"success": False, "message": "Google email address is not verified."}), 401

        email = token_info.get("email", "").strip().lower()
        name = token_info.get("name", "").strip()
        picture = token_info.get("picture", "").strip()

        if not email:
            return jsonify({"success": False, "message": "Email not provided by Google."}), 400

        existing = User.query.filter_by(email=email).first()
        if existing:
            # Account already exists — just log them in
            login_user(existing, remember=False)
            UserManager.update_last_login(existing.id)
            session["theme"] = existing.theme
            logger.info(f"Existing user signed in via Google register flow: {email}")
            try:
                _send_security_notification("new_login", existing)
            except Exception as e:
                logger.warning(f"Security notification failed (google_register existing): {e}")
            return jsonify({
                "success": True,
                "message": "Account already exists. You have been signed in.",
                "redirect": url_for("dashboard.post_login_splash")
            })

        # Create new account
        from database.models import bcrypt
        import os
        random_pw = os.urandom(24).hex()
        pw_hash = bcrypt.generate_password_hash(random_pw).decode("utf-8")

        user = User(
            name=name,
            email=email,
            password_hash=pw_hash,
            role="operator",
            email_verified=True,
            auth_method="google",
            profile_picture_url=picture if picture else None
        )
        db.session.add(user)
        db.session.commit()
        logger.info(f"New Google account registered: {email}")

        login_user(user, remember=False)
        UserManager.update_last_login(user.id)
        session["theme"] = user.theme

        # Security notification for new Google registration
        try:
            _send_security_notification("google_registration", user)
        except Exception as e:
            logger.warning(f"Security notification failed (google_register new): {e}")

        return jsonify({
            "success": True,
            "message": "Account created successfully via Google!",
            "redirect": url_for("dashboard.post_login_splash")
        })

    except Exception as e:
        logger.error(f"Error during Google registration: {e}")
        return jsonify({"success": False, "message": "An error occurred during Google sign-up."}), 500


@auth_bp.route("/logout")
@login_required
def logout():
    logger.info(f"User logged out: {current_user.email}")
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("auth.login"))


@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        email = data.get("email", "").strip().lower()
        new_password = data.get("new_password", "")
        confirm_password = data.get("confirm_password", "")

        if not email:
            msg = "Email is required."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 400
            flash(msg, "danger")
            return render_template("forgot_password.html")

        if len(new_password) < 8:
            msg = "Password must be at least 8 characters."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 400
            flash(msg, "danger")
            return render_template("forgot_password.html")

        if new_password != confirm_password:
            msg = "Passwords do not match."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 400
            flash(msg, "danger")
            return render_template("forgot_password.html")

        success, error = UserManager.reset_password(email, new_password)
        if not success:
            if request.is_json:
                return jsonify({"success": False, "message": error}), 400
            flash(error, "danger")
            return render_template("forgot_password.html")

        # Security notification: password was changed
        try:
            user = UserManager.get_by_email(email)
            if user:
                _send_security_notification("password_reset", user)
        except Exception as e:
            logger.warning(f"Security notification failed (password_reset): {e}")

        if request.is_json:
            return jsonify({"success": True, "message": "Password reset successfully."})
        flash("Password reset successfully. Please log in.", "success")
        return redirect(url_for("auth.login"))

    return render_template("forgot_password.html")


@auth_bp.route("/api/check-auth")
def check_auth():
    return jsonify({
        "authenticated": current_user.is_authenticated,
        "user": current_user.to_dict() if current_user.is_authenticated else None
    })
