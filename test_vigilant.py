import sqlite3
import os
import smtplib
import pytest
from config import DB_PATH, EMAIL_CONFIG

def test_database_connection():
    """Test that the database file exists and is accessible."""
    assert os.path.exists(DB_PATH), f"Database file not found at {DB_PATH}"
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        assert result == (1,), "Failed to execute verification query on the database."
    finally:
        conn.close()

def test_database_has_data():
    """Test that the database has expected tables and contains data."""
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        
        # Check that essential tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        assert "users" in tables, "Table 'users' does not exist."
        assert "cameras" in tables, "Table 'cameras' does not exist."
        assert "events" in tables, "Table 'events' does not exist."
        
        # Check that there is at least one user registered
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        assert user_count > 0, "The 'users' table is empty. Expected at least one registered user."
    finally:
        conn.close()

def test_smtp_connection():
    """Test connection to the SMTP server specified in the configuration."""
    assert EMAIL_CONFIG.get("enabled"), "SMTP is disabled in EMAIL_CONFIG."
    host = EMAIL_CONFIG.get("smtp_host")
    port = EMAIL_CONFIG.get("smtp_port")
    assert host, "SMTP host is not configured."
    assert port, "SMTP port is not configured."
    
    try:
        # Establish connection
        server = smtplib.SMTP(host, port, timeout=10)
        server.ehlo()
        
        # Start TLS if port is 587
        if port == 587:
            server.starttls()
            server.ehlo()
            
        server.quit()
    except Exception as e:
        pytest.fail(f"SMTP Server connection test failed: {e}")
