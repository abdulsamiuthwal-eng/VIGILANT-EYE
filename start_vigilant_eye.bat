@echo off
TITLE Vigilant Eye Server
echo ===================================================
echo 👁 VIGILANT EYE — AI-Based CCTV Theft Detection
echo ===================================================
echo.
echo Checking for updates or missing dependencies (optional)...
@REM pip install -r requirements.txt >nul 2>&1

echo Starting Flask Server...
echo The dashboard will open in your default browser.
echo Do not close this window while using the system.
echo.

:: Wait for a second and then launch the browser
start "" http://localhost:5000

:: Run the server
python app.py

pause
