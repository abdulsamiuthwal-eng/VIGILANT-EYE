"""
Vigilant Eye - Authentication Routes
======================================
Handles login, registration, logout, and password reset.
"""

import logging
from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from database.db_manager import UserManager

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__)


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

    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        remember = bool(data.get("remember", False))

        if not email or not password:
            msg = "Email and password are required."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 400
            flash(msg, "danger")
            return render_template("login.html")

        user = UserManager.get_by_email(email)
        if not user or not user.check_password(password):
            msg = "Invalid email or password."
            if request.is_json:
                return jsonify({"success": False, "message": msg}), 401
            flash(msg, "danger")
            return render_template("login.html")

        login_user(user, remember=False)
        UserManager.update_last_login(user.id)
        session["theme"] = user.theme
        logger.info(f"User logged in: {email}")

        if request.is_json:
            return jsonify({"success": True, "redirect": url_for("dashboard.index")})
        return redirect(url_for("dashboard.index"))

    return render_template("login.html")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")

        # Validation
        errors = []
        if not name or len(name) < 2:
            errors.append("Full name must be at least 2 characters.")
        if not email or "@" not in email:
            errors.append("Please enter a valid email address.")
        if not password or len(password) < 8:
            errors.append("Password must be at least 8 characters.")
        if password != confirm_password:
            errors.append("Passwords do not match.")

        if errors:
            if request.is_json:
                return jsonify({"success": False, "errors": errors}), 400
            for error in errors:
                flash(error, "danger")
            return render_template("register.html")

        user, error = UserManager.create_user(name, email, password)
        if error:
            if request.is_json:
                return jsonify({"success": False, "message": error}), 400
            flash(error, "danger")
            return render_template("register.html")

        login_user(user)
        UserManager.update_last_login(user.id)
        logger.info(f"New user registered: {email}")

        if request.is_json:
            return jsonify({"success": True, "redirect": url_for("dashboard.index")})
        flash("Account created successfully! Welcome to Vigilant Eye.", "success")
        return redirect(url_for("dashboard.index"))

    return render_template("register.html")


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
