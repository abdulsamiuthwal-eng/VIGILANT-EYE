from app import app, db, initialize_app
from database.models import User

with app.app_context():
    initialize_app()
    # Check if there's any user, if not create a default one
    if not User.query.first():
        user = User(name="Default Operator", email="admin@vigilanteye.com", role="admin", email_verified=True)
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        print("Created default user admin@vigilanteye.com / password123")
    else:
        # Ensure at least one user is verified for test compatibility
        u = User.query.first()
        u.email_verified = True
        db.session.commit()
        print("Database already has data. Verified first user.")
