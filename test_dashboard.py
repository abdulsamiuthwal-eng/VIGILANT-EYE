import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from app import app, db
from database.models import User

BASE_URL = "http://127.0.0.1:5000"

@pytest.fixture(scope="module", autouse=True)
def setup_test_user():
    """Create a temporary test user in the database for Selenium testing."""
    with app.app_context():
        # Clean up existing test user if any
        existing_user = User.query.filter_by(email="selenium_test@vigilanteye.com").first()
        if existing_user:
            db.session.delete(existing_user)
            db.session.commit()
            
        # Create fresh test user
        user = User(name="Selenium Test User", email="selenium_test@vigilanteye.com", role="admin", email_verified=True)
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        
    yield
    
    with app.app_context():
        # Remove test user after tests run
        user = User.query.filter_by(email="selenium_test@vigilanteye.com").first()
        if user:
            db.session.delete(user)
            db.session.commit()

@pytest.fixture(scope="module")
def driver():
    """Set up and tear down headless Chrome webdriver with explicit window size."""
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(10)
    yield driver
    driver.quit()

def test_login_page_loads(driver):
    """Test case: Login page loads correctly."""
    driver.get(BASE_URL + "/")
    
    # Wait for the splash screen to redirect to login
    time.sleep(5)
    
    # Verify page location and title
    assert "login" in driver.current_url.lower(), f"Expected login in URL, got: {driver.current_url}"
    assert "Login — Vigilant Eye" in driver.title, "Login page title is incorrect"
    
    # Verify input elements are displayed
    email_input = driver.find_element(By.ID, "email")
    password_input = driver.find_element(By.ID, "password")
    submit_button = driver.find_element(By.ID, "loginBtn")
    
    assert email_input.is_displayed(), "Email input field is not displayed"
    assert password_input.is_displayed(), "Password input field is not displayed"
    assert submit_button.is_displayed(), "Submit button is not displayed"

def test_login_with_correct_credentials(driver):
    """Test case: Login with correct credentials works."""
    driver.get(BASE_URL + "/")
    time.sleep(5)
    
    email_input = driver.find_element(By.ID, "email")
    password_input = driver.find_element(By.ID, "password")
    
    email_input.clear()
    email_input.send_keys("selenium_test@vigilanteye.com")
    
    password_input.clear()
    password_input.send_keys("password123")
    
    submit_button = driver.find_element(By.ID, "loginBtn")
    submit_button.click()
    
    # Wait for Simulated Secure Session Initialization Delay (2.5 seconds in JS) and splash redirects
    time.sleep(8)

    assert "dashboard" in driver.current_url.lower(), f"Failed to log in. URL is still: {driver.current_url}"

def test_dashboard_page_opens(driver):
    """Test case: Dashboard page opens after login."""
    # Since we are already logged in from the previous test, check the current page content
    dashboard_logo = driver.find_element(By.CLASS_NAME, "logo-name")
    assert "VIGILANT EYE" in dashboard_logo.text, "Dashboard logo text is incorrect"
    
    # Verify sections are visible
    nav_cameras = driver.find_element(By.ID, "nav-cameras")
    nav_alerts = driver.find_element(By.ID, "nav-alerts")
    assert nav_cameras.is_displayed(), "Live Cameras nav item not visible"
    assert nav_alerts.is_displayed(), "Alerts nav item not visible"
