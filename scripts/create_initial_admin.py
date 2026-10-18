"""
StrokeAegis AI — Safe Initial Administrator Provisioning CLI

Provisions the initial administrator account securely.
Idempotent and safe to run multiple times.

Usage:
    python scripts/create_initial_admin.py
    python scripts/create_initial_admin.py --email admin@strokeaegis.local --password "YourSecurePass123!" --name "Chief Medical Administrator"
Or set environment variables:
    ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
"""

import os
import sys
import argparse
import getpass
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database.database import SessionLocal
from backend.database.models import User, AuditLog
from backend.auth.security import hash_password


def provision_admin(email: str = None, password: str = None, name: str = None, force: bool = False):
    db = SessionLocal()
    try:
        # 1. Check if an active administrator already exists
        existing_admin = db.query(User).filter(User.role == "admin").first()
        if existing_admin and not force:
            print(f"[Admin Provisioning] An authorized administrator already exists: '{existing_admin.email}' (ID: {existing_admin.id}).")
            print("To re-provision or reset, specify --force explicitly.")
            return existing_admin

        # 2. Determine credentials
        admin_email = email or os.getenv("ADMIN_EMAIL", "admin@strokeaegis.local").strip().lower()
        admin_name = name or os.getenv("ADMIN_NAME", "System Administrator").strip()
        admin_password = password or os.getenv("ADMIN_PASSWORD")

        if not admin_password:
            # Interactive prompt if in terminal and not provided
            if sys.stdin.isatty():
                admin_password = getpass.getpass("Enter administrator password: ")
                confirm = getpass.getpass("Confirm administrator password: ")
                if admin_password != confirm:
                    print("[Error] Passwords do not match.")
                    sys.exit(1)
            else:
                admin_password = "AdminSecure2026!"

        if len(admin_password) < 8:
            print("[Error] Administrator password must be at least 8 characters long.")
            sys.exit(1)

        # 3. Check if user with this email already exists
        user = db.query(User).filter(User.email == admin_email).first()
        if user:
            if force:
                print(f"[Admin Provisioning] Updating existing user '{admin_email}' to administrator role...")
                user.role = "admin"
                user.is_active = True
                user.full_name = admin_name
                user.password_hash = hash_password(admin_password)
                db.flush()
            else:
                print(f"[Error] A user with email '{admin_email}' already exists with role '{user.role}'. Use --force to elevate.")
                sys.exit(1)
        else:
            print(f"[Admin Provisioning] Creating new administrator account '{admin_email}'...")
            user = User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name=admin_name,
                role="admin",
                is_active=True
            )
            db.add(user)
            db.flush()

        # 4. Record audit event
        audit = AuditLog(
            actor_id=user.id,
            actor_role="admin",
            actor_email=user.email,
            action="admin_provisioned",
            target_resource=f"user:{user.id}",
            outcome="SUCCESS",
            reason="Initial administrator provisioning via trusted CLI bootstrap.",
            details={"email": user.email, "role": user.role, "full_name": user.full_name}
        )
        db.add(audit)
        db.commit()
        db.refresh(user)

        print("=" * 64)
        print("[SUCCESS] Administrator account provisioned successfully!")
        print(f"  Email: {user.email}")
        print(f"  Name:  {user.full_name}")
        print(f"  Role:  {user.role}")
        print(f"  Status: {'Active' if user.is_active else 'Inactive'}")
        print(f"  ID:    {user.id}")
        print("=" * 64)
        return user

    except Exception as exc:
        db.rollback()
        print(f"[Error] Failed to provision administrator: {exc}")
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="StrokeAegis AI Initial Administrator Provisioning CLI")
    parser.add_argument("--email", help="Administrator email address")
    parser.add_argument("--password", help="Administrator password")
    parser.add_argument("--name", help="Administrator full display name")
    parser.add_argument("--force", action="store_true", help="Force update if administrator already exists")
    args = parser.parse_args()

    provision_admin(email=args.email, password=args.password, name=args.name, force=args.force)


if __name__ == "__main__":
    main()
